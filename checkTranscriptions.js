const config = require('./config');
const WEB_URL = config.WEB_URL;
const fs = require('fs').promises;
const path = require('path');
const sendEmail = require('./email');
const db = require('./database');
const myEmitter = require('./events');

let lastProcessedFile = null;
let subscriptions = [];
const serverBootTime = new Date();

// Debugging Step 1: Log server boot time
console.log(`Server boot time: ${serverBootTime}`);

const shouldProcessFile = (fileName) => {
    const match = fileName.match(/^(\d{8}_\d{6})/);
    if (!match) {
        console.log(`Regex did not match for fileName: ${fileName}`);
        return false;
    }

    const timestampStr = match[1];
    const fileDate = new Date(
        `${timestampStr.substring(0, 4)}-${timestampStr.substring(4, 6)}-${timestampStr.substring(6, 8)}T${timestampStr.substring(9, 11)}:${timestampStr.substring(11, 13)}:${timestampStr.substring(13, 15)}`
    );

    // Assuming serverBootTime is a Date object
    if (fileDate <= serverBootTime) {
        console.log(`Skipping file ${fileName} as it is older ${fileDate} than server boot time ${serverBootTime}.`);
        return false;
    }

    return true;
};

const fetchActiveSubscriptions = async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT email, regex FROM subscriptions WHERE verified = TRUE AND enabled = TRUE`, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            subscriptions = rows;  // Update the subscriptions array
            console.log(`Fetched subscriptions: ${JSON.stringify(rows)}`);
            resolve(rows);
        });
    });
};

// Listen for the 'emailVerified' event to refresh subscriptions
myEmitter.on('emailVerified', () => {
    console.log('Someone verified their email; refreshing active subscriptions..');
    fetchActiveSubscriptions();
});

const readDirRecursive = async (dir) => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? readDirRecursive(res) : res;
    }));
    return Array.prototype.concat(...files);
};

const checkTranscriptions = async () => {
    console.log("Entered checkTranscriptions function");
    try {
        const files = await readDirRecursive('./public/transcriptions');
        
        // Sort files by their extracted timestamps in descending order
        files.sort((a, b) => {
            const timestampA = path.basename(a).match(/^(\d{8}_\d{6})/);
            const timestampB = path.basename(b).match(/^(\d{8}_\d{6})/);
            
            if (timestampA && timestampB) {
                return timestampB[1].localeCompare(timestampA[1]);
            }
            
            return 0;
        });
        
        const subscriptions = await fetchActiveSubscriptions();
        
        for (let i = 0; i < files.length; i++) {
            const filePath = files[i];
            const fileName = path.basename(filePath);
            
            // If the file should not be processed, break out of the loop
            if (!shouldProcessFile(fileName)) {
                console.log(`Stopping at file ${fileName} as it is older than server boot time.`);
                break;
            }
            
            const content = await fs.readFile(filePath, 'utf-8');
            let transcription;
            try {
                transcription = JSON.parse(content);
            } catch (e) {
                console.error(`Invalid JSON in file ${fileName}`);
                continue;
            }
            
            for (const sub of subscriptions) {
                const regex = new RegExp(sub.regex, 'i');
                // Debugging Step 2: Log the regex being tested
                console.log(`Testing regex: ${sub.regex}`);
                if (regex.test(transcription.text)) {
                    console.log(`Match found for regex ${sub.regex} in file ${fileName}`);
                    await sendEmail(sub.email, `${regex}`, `${fileName} \n ${transcription.text} \n ${WEB_URL}/search?q=${regex}`);
                }
            }
            lastProcessedFile = filePath;
            // Debugging Step 5: Log the last processed file
            console.log(`Last processed file: ${lastProcessedFile}`);
        }
    } catch (error) {
        console.error("Error in checkTranscriptions: ", error);
    }
};

module.exports = checkTranscriptions;
