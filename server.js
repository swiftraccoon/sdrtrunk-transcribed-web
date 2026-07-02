const fs = require('fs');
const https = require('https');

const config = require('./config');
const createApp = require('./app');
const { loadCache, watchDirectories } = require('./search');
const checkTranscriptions = require('./checkTranscriptions').checkTranscriptions;

const app = createApp();

const privateKey = fs.readFileSync(`${config.privateKeyPath}`, 'utf8');
const certificate = fs.readFileSync(`${config.certificatePath}`, 'utf8');
const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);
// Initialize cache before starting the server
(async () => {
    await loadCache();
    watchDirectories();
    // Now that the cache is loaded, start the server
    httpsServer.listen(config.PORT, () => {
        console.log(`Server running on https://localhost:${config.PORT}`);
    });
    setInterval(checkTranscriptions, 10 * 1000); // Check every 10 seconds
})();
