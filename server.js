// Core Node.js modules
const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');

// Middleware and utilities
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');

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

// Initialize app
const app = express();
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
});
app.use(limiter);
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

const { doubleCsrfProtection, generateToken } = doubleCsrf({
    getSecret: () => sessionSecretKey,
    cookieName: '__csrf',
    cookieOptions: { secure: true, httpOnly: true, sameSite: 'strict' },
    getTokenFromRequest: (req) => req.body._csrf || req.headers['x-csrf-token']
});

app.get('/login', (req, res) => {
    const csrfToken = generateToken(req, res);
    const loginHTML = fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8');
    res.send(loginHTML.replace('</form>', `<input type="hidden" name="_csrf" value="${csrfToken}">\n    </form>`));
});
app.use('/public', express.static(PUBLIC_DIR));
app.use(doubleCsrfProtection);
app.use((req, res, next) => {
    req.csrfToken = () => generateToken(req, res);
    next();
});
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