// Core Node.js modules
const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcrypt');
const RE2 = require('re2');

// Router setup
const router = express.Router();

// Configuration and utilities
const config = require('./config');
const WEB_URL = config.WEB_URL;
const { generateConfirmationId, getQueryParams, getDefaultDateTime, processDirectory } = require('./utility');
const { requireAuth } = require('./authMiddleware');

// Services and database
const db = require('./database');
const { sendEmailWithRateLimit } = require('./email');
const myEmitter = require('./events');

// Custom modules and functions
const renderHTML = require('./renderHTML');
const { searchTranscriptions } = require('./search');

// Constants
const PUBLIC_DIR = path.join(__dirname, 'public');


// Compared against when a username doesn't exist, so response timing doesn't
// reveal which usernames are valid.
const DUMMY_BCRYPT_HASH = '$2b$12$7phvz3pjndIJfVpNoTeWFOdNWebC4uMBxd7o3Ml42hnI1JhB38PV.';

// Add a new POST route for login
router.post('/login', async (req, res, next) => {
    const username = typeof req.body.username === 'string' ? req.body.username : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    let isValidUser = false;
    try {
        // Async credential checks (bcrypt.compare) can reject on a malformed
        // config; without this, Express 4 would leave the request hanging and
        // surface an unhandled rejection.
        if (username === '' && password === '') {
            // Click-through login must be an explicit operator decision
            isValidUser = config.allowPasswordlessLogin === true;
        } else {
            const user = (config.users || []).find(u => u.username === username);
            if (user && user.passwordHash) {
                isValidUser = await bcrypt.compare(password, user.passwordHash);
            } else if (user && typeof user.password === 'string' && user.password.length > 0) {
                isValidUser = user.password === password;
                if (isValidUser) {
                    console.warn(`[auth] User "${username}" matched a plaintext password from config.js — switch to passwordHash (bcrypt).`);
                }
            } else {
                await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
            }
        }
    } catch (error) {
        return next(error);
    }

    if (!isValidUser) {
        console.log("Authentication failed");
        return res.redirect('/login');
    }

    // A fresh session id on privilege change prevents session fixation
    req.session.regenerate((err) => {
        if (err) {
            console.error("Error regenerating session:", err);
            return res.redirect('/login');
        }
        req.session.isAuthenticated = true;
        req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Error saving session:", saveErr);
            }
            res.redirect('/');
        });
    });
});

// POST (not GET) so doubleCsrfProtection guards it — a state change must not
// be triggerable by a cross-site GET.
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Subscription input rules. Compiling with RE2 (the same engine the notifier
// matches with, see checkTranscriptions.js) rejects both invalid syntax and
// constructs RE2 can't run linearly (backreferences, lookaround), so no
// pattern that reaches the matcher can trigger catastrophic backtracking.
const MAX_REGEX_LENGTH = 200;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSubscriptionInput(regex, email) {
    if (typeof email !== 'string' || email.length > 254 || !EMAIL_PATTERN.test(email)) {
        return 'A valid email address is required.';
    }
    if (typeof regex !== 'string' || regex.length === 0 || regex.length > MAX_REGEX_LENGTH) {
        return `Regex must be between 1 and ${MAX_REGEX_LENGTH} characters.`;
    }
    try {
        new RE2(regex);
    } catch (e) {
        return 'That regex is invalid or uses unsupported syntax (e.g. lookahead or backreferences).';
    }
    return null;
}

// Subscribe
router.post('/subscribe', requireAuth, async (req, res) => {
    try {
        const { regex, email } = req.body;
        const validationError = validateSubscriptionInput(regex, email);
        if (validationError) {
            return res.status(400).json({ status: validationError });
        }

        const ip = req.ip;
        const browser = req.headers['user-agent'];
        const confirmationId = generateConfirmationId();

        await db.runAsync(`INSERT INTO subscriptions (regex, email, ip, browser, confirmationID) VALUES (?, ?, ?, ?, ?)`,
            [regex, email, ip, browser, confirmationId]);

        const confirmationUrl = `${WEB_URL}/verify/${confirmationId}`;
        try {
            await sendEmailWithRateLimit(email, `${config.EMAIL_SUB_CONF_SUBJ}`, `regex: ${regex}\n\nClick this link to confirm: ${confirmationUrl}`);
        } catch (emailError) {
            // The row must exist only if its confirmation link was actually
            // delivered; otherwise it's unverifiable and retries pile up
            // duplicates. Roll back before surfacing the failure.
            await db.runAsync(`DELETE FROM subscriptions WHERE confirmationID = ?`, [confirmationId]);
            throw emailError;
        }
        res.status(200).json({ status: `${config.SUB_CONF_RESP}` });
    } catch (error) {
        console.error("Error in /subscribe: ", error);
        res.status(500).send('Internal Server Error');
    }
});

// Unsubscribe
router.post('/unsubscribe', requireAuth, async (req, res) => {
    try {
        const { regex, email } = req.body;

        const dbResult = await db.runAsync(
            `UPDATE subscriptions SET enabled = FALSE WHERE email = ? AND regex = ?`,
            [email, regex]);

        if (dbResult.changes === 0) {
            return res.status(400).json({ status: 'No matching subscription found.' });
        }

        res.status(200).json({ status: `${config.UNSUB_CONF_RESP}` });
        myEmitter.emit('emailVerified'); // Refresh subscriptions
    } catch (error) {
        console.error("Error in /unsubscribe: ", error);
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
        res.send(`${config.VERIFIED_RESP}`);
        myEmitter.emit('emailVerified');
    });
});

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

router.get('/', requireAuth, async (req, res, next) => {
    try {
        const { selectedRadioIds, selectedTalkgroupIds, userSelectedTheme } = getQueryParams(req);

        if (req.query.theme) {
            res.cookie('theme', req.query.theme, {
                httpOnly: true,
                sameSite: 'lax',
                secure: config.secureCookies !== false
            });
        }

        const { defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime } = getDefaultDateTime();

        // No 'Z': filter bounds are local wall-clock, matching the local
        // filename timestamps they're compared against (utility.js).
        const startDate = req.query.startDate_date && req.query.startDate_time
            ? new Date(`${req.query.startDate_date}T${req.query.startDate_time}`)
            : new Date(`${defaultStartDate}T${defaultStartTime}`);

        const endDate = req.query.endDate_date && req.query.endDate_time
            ? new Date(`${req.query.endDate_date}T${req.query.endDate_time}`)
            : new Date(`${defaultEndDate}T${defaultEndTime}`);

        const dirs = await fs.promises.readdir(path.join(PUBLIC_DIR, 'audio'));
        const transcriptionsList = await Promise.all(dirs.map(dir => processDirectory(dir, selectedRadioIds, selectedTalkgroupIds, startDate, endDate)));
        const flattenedTranscriptions = transcriptionsList.flat();

        flattenedTranscriptions.sort((a, b) => b.timestamp - a.timestamp);

        res.set('Cache-Control', 'no-store');
        const csrfToken = req.csrfToken();
        res.send(renderHTML(flattenedTranscriptions, defaultStartDate, defaultStartTime, defaultEndDate, defaultEndTime, selectedRadioIds, selectedTalkgroupIds, userSelectedTheme, csrfToken));
    } catch (error) {
        // Express 4 doesn't catch async rejections — without this the request
        // hangs and the rejection is unhandled.
        next(error);
    }
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