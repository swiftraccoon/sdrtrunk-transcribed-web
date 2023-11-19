// Core Node.js modules
const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Middleware and utilities
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');

// Configuration and constants
const config = require('./config');
const PORT = config.PORT;
const sessionSecretKey = config.sessionSecretKey;
const privateKeyPath = config.privateKeyPath;
const certificatePath = config.certificatePath;

// Routes and custom modules
const routes = require('./routes');
const { loadCache } = require('./search');
const checkTranscriptions = require('./checkTranscriptions').checkTranscriptions;

// Directory paths
const PUBLIC_DIR = path.join(__dirname, 'public');
const AUDIO_DIR = path.join(__dirname, config.audioFolderPath);
const TRANSCRIPTIONS_DIR = path.join(__dirname, config.transcriptionsFolderPath);


// Initialize app
const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: sessionSecretKey,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: true, // Ensure the cookie is only used over HTTPS
        httpOnly: true // Ensure the cookie is not accessible via client-side scripts
    }
}));

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.use('/public', express.static(PUBLIC_DIR));
app.use('/audio', express.static(AUDIO_DIR));
app.use('/transcriptions', express.static(TRANSCRIPTIONS_DIR));
app.use('/', routes);

app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    res.status(500).send('Internal Server Error');
});

const privateKey = fs.readFileSync(`${privateKeyPath}`, 'utf8');
const certificate = fs.readFileSync(`${certificatePath}`, 'utf8');
const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);
// Initialize cache before starting the server
(async () => {
    await loadCache();
    // Now that the cache is loaded, start the server
    httpsServer.listen(PORT, () => {
        console.log(`Server running on https://localhost:${PORT}`);
    });
    setInterval(checkTranscriptions, 10 * 1000); // Check every 10 seconds
})();