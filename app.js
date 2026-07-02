// Express app factory. server.js wires this to HTTPS + background jobs;
// tests build isolated instances so rate limiters and sessions don't leak
// between suites.
const express = require('express');
const fs = require('fs');
const path = require('path');

const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');

const config = require('./config');
const routes = require('./routes');

const PUBLIC_DIR = path.join(__dirname, 'public');

function createApp() {
    const app = express();
    // secureCookies: false supports deployments behind a TLS-terminating
    // proxy (and the test harness); defaults to true.
    const secureCookies = config.secureCookies !== false;
    // Needed behind a reverse proxy so req.ip (rate-limit keys) and secure
    // cookies see the real client, e.g. trustProxy: 1 for a single nginx hop.
    if (config.trustProxy !== undefined) {
        app.set('trust proxy', config.trustProxy);
    }

    // Static assets get their own generous limiter, separate from the API
    // budget: a single page load pulls CSS + many audio files and would
    // otherwise burn the API budget, yet leaving /public entirely unthrottled
    // lets an anonymous client scrape the whole recording archive.
    const staticLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: config.staticRateLimitMax ?? 1000
    });
    app.use('/public', staticLimiter, express.static(PUBLIC_DIR));

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: config.rateLimitMax ?? 100
    });
    app.use(limiter);
    // Tighter budget for credential guessing; GETs of the login page are
    // excluded so the limit maps 1:1 to actual attempts.
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: config.loginRateLimitMax ?? 10,
        skip: (req) => req.method !== 'POST'
    });
    app.use('/login', loginLimiter);
    app.use(cookieParser());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(session({
        secret: config.sessionSecretKey,
        resave: false,
        saveUninitialized: false, // don't allocate sessions for anonymous hits
        cookie: {
            secure: secureCookies,
            httpOnly: true, // Ensure the cookie is not accessible via client-side scripts
            sameSite: 'lax',
            maxAge: config.sessionMaxAgeMs ?? 8 * 60 * 60 * 1000
        }
    }));

    const { doubleCsrfProtection, generateToken } = doubleCsrf({
        getSecret: () => config.sessionSecretKey,
        cookieName: '__csrf',
        cookieOptions: { secure: secureCookies, httpOnly: true, sameSite: 'strict' },
        getTokenFromRequest: (req) => req.body._csrf || req.headers['x-csrf-token']
    });

    app.get('/login', (req, res) => {
        const csrfToken = generateToken(req, res);
        const loginHTML = fs.readFileSync(path.join(__dirname, 'login.html'), 'utf8');
        res.send(loginHTML.replace('</form>', `<input type="hidden" name="_csrf" value="${csrfToken}">\n    </form>`));
    });
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

    return app;
}

module.exports = createApp;
