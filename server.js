// Import modules
const express = require('express');
const path = require('path');
const basicAuth = require('express-basic-auth');
const cookieParser = require('cookie-parser');
const routes = require('./routes'); 
const bodyParser = require('body-parser');
const { loadCache } = require('./search');
const checkTranscriptions = require('./checkTranscriptions');
const config = require('./config');
const PORT = config.PORT;
const WEB_user0 = config.WEB_user0;
const WEB_pass0 = config.WEB_pass0;
const unauthorizedResponseTitle = config.unauthorizedResponseTitle;
const unauthorizedResponseMessage = config.unauthorizedResponseMessage;

// Constants
const PUBLIC_DIR = path.join(__dirname, 'public');
const users = { [WEB_user0]: WEB_pass0 };

// Initialize app
const app = express();
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware
app.use(basicAuth({
    users: users,
    challenge: true,
    realm: unauthorizedResponseTitle,
    unauthorizedResponse: unauthorizedResponseMessage
}));
app.use('/public', express.static(PUBLIC_DIR));
app.use('/', routes);  // Use the imported routes
// app.use((req, next) => {
//     console.log('req.body:', req.body);
//     next();
// });

// Initialize cache before starting the server
(async () => {
    await loadCache();
    
    // Now that the cache is loaded, start the server
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
    setInterval(checkTranscriptions, 60 * 1000); // Check every minute
  })();