// Import modules
const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const bodyParser = require('body-parser');
const { loadCache } = require('./search');
const checkTranscriptions = require('./checkTranscriptions');
const config = require('./config');
const PORT = config.PORT;
const sessionSecretKey = config.sessionSecretKey;
const https = require('https');  // Import the https module
const fs = require('fs');  // Import the fs module

// Constants
const PUBLIC_DIR = path.join(__dirname, 'public');

// Initialize app
const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: `${sessionSecretKey}`, resave: false, saveUninitialized: true }));
console.log("Session Secret Key Length:", sessionSecretKey.length);

app.use((req, res, next) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);
    next();
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});
app.use('/public', express.static(PUBLIC_DIR));

// Authentication middleware
const requireAuth = (req, res, next) => {
    console.log("Checking authentication");
    console.log("Session State:", req.session);

    if (req.session && req.session.isAuthenticated) {
        next();
    } else {
        console.log("req.session: ", req.session)
        console.log("req.session.isAuthenticated: ", req.session.isAuthenticated)
        console.log("Redirecting to login");
        res.redirect('/login');
    }
};

app.use('/', requireAuth, routes);

app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    res.status(500).send('Internal Server Error');
});

const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);
// Initialize cache before starting the server
(async () => {
    await loadCache();
    // Now that the cache is loaded, start the server
    httpsServer.listen(PORT, () => {
        console.log(`Server running on https://localhost:${PORT}`);
    });
    setInterval(checkTranscriptions, 60 * 1000); // Check every minute
})();