const fs = require('fs');
const path = require('path');
const PUBLIC_DIR = path.join(__dirname, 'public');
const renderHTML = require('./renderHTML');
const { searchTranscriptions } = require('./search');
const sendEmailWithRateLimit = require('./email');
const express = require('express');
const router = express.Router();
const db = require('./database');
const { generateConfirmationId, getQueryParams, getDefaultDateTime, processDirectory } = require('./utility');
const myEmitter = require('./events');
const config = require('./config');
const WEB_URL = config.WEB_URL;
const { requireAuth } = require('./authMiddleware');

// Add this middleware near the top, after router is initialized
// router.use((req, res, next) => {
//     if (req.method === 'POST') {
//         console.log('POST request body:', req.body);
//         console.log("POST request headers:", req.headers);  // Debugging line 5
//     }
//     next();
// });


// Add a new POST route for login
router.post('/login', async (req, res) => {
    // console.log("Received POST /login");
    // console.log("Request Body:", req.body);
    const { username, password } = req.body;
    // console.log(`Received username: ${username}, password: ${password}`);  // Debugging line 1

    if (username === config.WEB_user0 && password === config.WEB_pass0) {
        console.log("Authentication successful");
        req.session.isAuthenticated = true;
        // console.log("Session after setting isAuthenticated:", req.session);  // Debugging line 2

        // Save the session
        req.session.save((err) => {
            // console.log("Session before saving:", req.session);  // Debugging line 3
            if (err) {
                console.error("Error saving session:", err);
            }
            // console.log("Session after saving:", req.session);  // Debugging line 3
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
        await sendEmailWithRateLimit(email, 'Confirm Subscription', `regex: ${regex}\n\nClick this link to confirm: ${confirmationUrl}`);
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