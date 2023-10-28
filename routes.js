const fs = require('fs');
const path = require('path');
const PUBLIC_DIR = path.join(__dirname, 'public');
const renderHTML = require('./renderHTML');
const searchTranscriptions = require('./search');
console.log(searchTranscriptions);
const sendEmail = require('./email');
const express = require('express');
const router = express.Router();
const db = require('./database');
const { generateConfirmationId, getQueryParams, getDefaultDateTime, processDirectory } = require('./utility');


// Subscribe
router.post('/subscribe', async (req, res) => {
    try {
        const { regex, email } = req.body;
        const ip = req.ip;
        const browser = req.headers['user-agent'];
        const confirmationId = generateConfirmationId();

        const dbResult = await db.run(`INSERT INTO subscriptions (regex, email, ip, browser, confirmationID) VALUES (?, ?, ?, ?, ?)`,
            [regex, email, ip, browser, confirmationId]);
        console.log("DB Result:", dbResult);  // Debugging

        const confirmationUrl = `http://yourdomain.com/verify/${confirmationId}`;
        await sendEmail(email, 'Confirm Subscription', `regex: ${regex}\\n\\nClick this link to confirm: ${confirmationUrl}`);

        res.status(200).json({ status: 'success' });  // Fixed response
    } catch (error) {
        console.error("Error in /subscribe: ", error);
        res.status(500).send('Internal Server Error');
    }
});

// Unsubscribe
router.post('/unsubscribe', async (req, res) => {
    try {
        const { email } = req.body;
        const dbResult = await db.run(`UPDATE subscriptions SET enabled = FALSE WHERE email = ?`, [email]);
        console.log("DB Result:", dbResult);  // Debugging
        res.status(200).json({ status: 'success' });  // Fixed response
    } catch (error) {
        console.error("Error in /unsubscribe: ", error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/verify/:id', (req, res) => {
    const confirmationId = req.params.id;
    db.run(`UPDATE subscriptions SET verified = TRUE WHERE confirmationID = ?`, [confirmationId], function (err) {
        if (err) {
            return res.send('Error verifying email');
        }
        if (this.changes === 0) {
            return res.send('Invalid confirmation ID');
        }
        res.send('Email verified');
    });
});

router.get('/robots.txt', (res) => {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
});

router.get('/', async (req, res) => {
    const { selectedRadioIds, selectedTalkgroupIds, userSelectedTheme, autoRefreshEnabled, refreshRate } = getQueryParams(req);

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



router.get('/search', async (req, res) => {
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