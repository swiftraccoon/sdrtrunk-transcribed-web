const fs = require('fs');
const path = require('path');
const PUBLIC_DIR = path.join(__dirname, 'public');
const renderHTML = require('./renderHTML');
const { searchTranscriptions } = require('./search');
const sendEmail = require('./email');
const express = require('express');
const router = express.Router();
const db = require('./database');
const { generateConfirmationId, getQueryParams, getDefaultDateTime, processDirectory } = require('./utility');
const myEmitter = require('./events');
const config = require('./config');
const WEB_URL = config.WEB_URL;
const {
    generateAttestationOptions,
    verifyAttestationResponse,
    generateAssertionOptions,
    verifyAssertionResponse
} = require('@simplewebauthn/server');
const { requireAuth } = require('./authMiddleware');

// Add this middleware near the top, after router is initialized
// router.use((req, res, next) => {
//     if (req.method === 'POST') {
//         console.log('POST request body:', req.body);
//         console.log("POST request headers:", req.headers);  // Debugging line 5
//     }
//     next();
// });

// Start WebAuthn registration
router.get('/webauthn/start-register', async (req, res) => {
    // Define the relying party (your application)
    const rp = {
        name: config.WEBAUTHN_RP_NAME,
        id: config.WEBAUTHN_RP_ID // This should be the domain where your app is hosted
    };

    const userId = generateRandomUserId();

    // Define the user
    const user = {
        id: userId,
        name: userId,
        displayName: 'YubiKey User'
    };

    // Generate attestation options
    const options = generateAttestationOptions({
        rp,
        user,
        attestationType: 'direct', // or 'indirect'
        authenticatorSelection: {
            authenticatorAttachment: 'platform', // or 'cross-platform'
            requireResidentKey: false,
            userVerification: 'preferred' // or 'required' or 'discouraged'
        },
        timeout: 60000 // 1 minute
    });

    // Save the options in session
    req.session.options = options;

    // Send the options to the client
    res.json(options);
});

// Finish WebAuthn registration
router.post('/webauthn/finish-register', async (req, res) => {
    const { id, rawId, response } = req.body;
    const expectedOptions = req.session.options;

    const verification = verifyAttestationResponse({
        credential: { id, rawId, response },
        expectedOptions,
    });

    if (verification.verified) {
        const userId = req.session.userId;  // Assume you have the user's ID in session
        await db.run('INSERT INTO webauthn_credentials (userId, credentialId, publicKey) VALUES (?, ?, ?)', [userId, id, verification.authenticatorInfo.publicKey]);
    }
});

// Start WebAuthn authentication
router.get('/webauthn/start-login', async (req, res) => {
    const userId = req.session.userId;  // Assume you have the user's ID in session
    const userCredentials = await db.all('SELECT * FROM webauthn_credentials WHERE userId = ?', [userId]);

    const options = generateAssertionOptions({
        allowCredentials: userCredentials.map(cred => ({
            id: cred.credentialId,
            type: 'public-key',
            transports: ['usb', 'ble', 'nfc', 'internal'],
        })),
    });
    req.session.options = options;
    res.json(options);
});


// Finish WebAuthn authentication
router.post('/webauthn/finish-login', async (req, res) => {
    const { id, rawId, response } = req.body;
    const expectedOptions = req.session.options;

    const verification = verifyAssertionResponse({
        credential: { id, rawId, response },
        expectedOptions,
    });

    if (verification.verified) {
        // User is authenticated
        req.session.isAuthenticated = true;
        res.redirect('/');
    } else {
        res.status(401).send('Authentication failed');
    }
});

// Add a new POST route for login
router.post('/login', async (req, res) => {
    // console.log("Received POST /login");
    // console.log("Request Body:", req.body);
    const { username, password } = req.body;
    // console.log(`Received username: ${username}, password: ${password}`);  // Debugging line 1

    if (username === config.WEB_user0 && password === config.WEB_pass0) {
        console.log("Authentication successful");
        req.session.isAuthenticated = true;
        console.log("Session after setting isAuthenticated:", req.session);  // Debugging line 2

        // Save the session
        req.session.save((err) => {
            console.log("Session before saving:", req.session);  // Debugging line 3
            if (err) {
                console.error("Error saving session:", err);
            }
            console.log("Session after saving:", req.session);  // Debugging line 3
            res.redirect('/');
        });
    } else {
        console.log("Authentication failed");
        res.redirect('/login');
    }
});

// Subscribe
router.post('/subscribe', requireAuth, async (req, res) => {
    try {
        const { regex, email } = req.body;
        const ip = req.ip;
        const browser = req.headers['user-agent'];
        const confirmationId = generateConfirmationId();

        const dbResult = await db.run(`INSERT INTO subscriptions (regex, email, ip, browser, confirmationID) VALUES (?, ?, ?, ?, ?)`,
            [regex, email, ip, browser, confirmationId]);
        console.log("DB Result:", dbResult);

        const confirmationUrl = `${WEB_URL}/verify/${confirmationId}`;
        await sendEmail(email, 'Confirm Subscription', `regex: ${regex}\n\nClick this link to confirm: ${confirmationUrl}`);
        res.status(200).json({ status: 'Success! Check your Inbox (or Spam) for a confirmation link.' });  // Fixed response
    } catch (error) {
        console.error("Error in /subscribe: ", error);
        res.status(500).send('Internal Server Error');
    }
});

// Unsubscribe
router.post('/unsubscribe', requireAuth, async (req, res) => {
    try {
        const { regex, email } = req.body;
        const ip = req.ip;
        const browser = req.headers['user-agent'];
        const confirmationId = generateConfirmationId();

        const dbResult = await new Promise((resolve, reject) => {
            db.run(`INSERT INTO subscriptions (regex, email, ip, browser, confirmationID) VALUES (?, ?, ?, ?, ?)`,
                [regex, email, ip, browser, confirmationId], function (err) {
                    if (err) return reject(err);
                    resolve(this);
                });
        });
        console.log("DB Result:", dbResult);
        res.status(200).json({ status: 'Successfully unsubscribed.' });
        myEmitter.emit('emailVerified'); // Refresh subscriptions
    } catch (error) {
        console.error("Error in /subscribe: ", error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/verify/:id', requireAuth, (req, res) => {
    const confirmationId = req.params.id;
    db.run(`UPDATE subscriptions SET verified = TRUE WHERE confirmationID = ?`, [confirmationId], function (err) {
        if (err) {
            return res.send('Error verifying email. Try again.');
        }
        if (this.changes === 0) {
            return res.send('Invalid confirmation ID!');
        }
        res.send('Email verified. You will now receive email notifications when a transcription matches your subscription.');
        myEmitter.emit('emailVerified');
    });
});

router.get('/robots.txt', (res) => {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

router.get('/', requireAuth, async (req, res) => {
    const { selectedRadioIds, selectedTalkgroupIds, userSelectedTheme } = getQueryParams(req);

    if (req.query.theme) {
        res.cookie('theme', req.query.theme);
    }

    const { defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime } = getDefaultDateTime();

    const startDate = req.query.startDate_date && req.query.startDate_time
        ? new Date(`${req.query.startDate_date}T${req.query.startDate_time}Z`)
        : new Date(`${defaultStartDate}T${defaultStartTime}Z`);

    const endDate = req.query.endDate_date && req.query.endDate_time
        ? new Date(`${req.query.endDate_date}T${req.query.endDate_time}Z`)
        : new Date(`${defaultEndDate}T${defaultEndTime}Z`);

    const dirs = await fs.promises.readdir(path.join(PUBLIC_DIR, 'audio'));
    const transcriptionsList = await Promise.all(dirs.map(dir => processDirectory(dir, selectedRadioIds, selectedTalkgroupIds, startDate, endDate)));
    const flattenedTranscriptions = transcriptionsList.flat();

    flattenedTranscriptions.sort((a, b) => b.timestamp - a.timestamp);

    res.set('Cache-Control', 'no-store');
    res.send(renderHTML(flattenedTranscriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, userSelectedTheme));
});



router.get('/search', requireAuth, async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.send('No query provided');
    }
    try {
        const results = await searchTranscriptions(query);
        res.send(results);
    } catch (error) {
        console.error("Error in searchTranscriptions:", error);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;