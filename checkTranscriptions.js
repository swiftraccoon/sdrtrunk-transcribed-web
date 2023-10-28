const fs = require('fs').promises;
const path = require('path');
const sendEmail = require('./email');
const db = require('./database');

let lastProcessedFile = null;
const serverBootTime = new Date();

// Debugging Step 1: Log server boot time
console.log(`Server boot time: ${serverBootTime}`);

const shouldProcessFile = (fileName) => {
    // Extract the timestamp from the filename
    const timestampStr = fileName.match(/^(\d{8}_\d{6})/)[1];
    if (!timestampStr) {
        return false;
    }

    // Convert the extracted timestamp to a Date object
    const fileDate = new Date(
        `${timestampStr.substring(0, 4)}-${timestampStr.substring(4, 6)}-${timestampStr.substring(6, 8)}T${timestampStr.substring(9, 11)}:${timestampStr.substring(11, 13)}:${timestampStr.substring(13, 15)}Z`
    );

    // Debugging Step 3: Log files that are skipped
    if (fileDate <= serverBootTime) {
        console.log(`Skipping file ${fileName} as it is older than server boot time.`);
    }

    // Compare with server boot time
    return fileDate > serverBootTime;
};

const fetchActiveSubscriptions = async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT email, regex FROM subscriptions WHERE verified = TRUE AND enabled = TRUE`, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
        // Debugging Step 1: Log fetched subscriptions
        console.log(`Fetched subscriptions: ${JSON.stringify(rows)}`);
    });
};

const readDirRecursive = async (dir) => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? readDirRecursive(res) : res;
    }));
    return Array.prototype.concat(...files);
};

const checkTranscriptions = async () => {
    try {
        const files = await readDirRecursive('./public/transcriptions');
        files.sort();
        
        const startIndex = lastProcessedFile ? files.indexOf(lastProcessedFile) + 1 : 0;
        
        if (startIndex >= files.length) {
            return;
        }
        
        const subscriptions = await fetchActiveSubscriptions();

        for (let i = startIndex; i < files.length; i++) {
            const filePath = files[i];
            const fileName = path.basename(filePath);
    
            if (!shouldProcessFile(fileName)) {
                continue;
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
                    await sendEmail(sub.email, `${regex}`, `${fileName} \n ${transcription.text} \n http://desktop.gov:3000/search?q=${regex}`);
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

setInterval(checkTranscriptions, 60 * 1000);

module.exports = checkTranscriptions;
