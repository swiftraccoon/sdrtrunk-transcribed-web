const config = require('./config');
const fs = require('fs').promises;
const path = require('path');
const sendEmail = require('./email');
const db = require('./database');
const myEmitter = require('./events');

let lastProcessedTimestamp = "00000000_000000";
let subscriptions = [];

const serverBootTime = new Date();
console.log(`Server boot time: ${serverBootTime}`);

const fetchActiveSubscriptions = () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT email, regex FROM subscriptions WHERE verified = TRUE AND enabled = TRUE`, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            subscriptions = rows;
            console.log(`Fetched subscriptions: ${JSON.stringify(rows)}`);
            resolve(rows);
        });
    });
};

fetchActiveSubscriptions();
console.log(`subscriptions: ${JSON.stringify(subscriptions)}`);
myEmitter.on('emailVerified', fetchActiveSubscriptions);

const readDirRecursive = async (dir) => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            return readDirRecursive(res);
        } else {
            return res.endsWith('.txt') ? res : null;
        }
    }));
    const filteredFiles = Array.prototype.concat(...files).filter(Boolean);
    filteredFiles.sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
    return filteredFiles.slice(0, 5);
};

const shouldProcessFile = (fileName) => {
    const match = fileName.match(/^(\d{8}_\d{6})/);
    if (!match) return false;

    const timestampStr = match[1];
    const fileDate = new Date(timestampStr.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));

    return fileDate > serverBootTime;
};

const processFile = async (filePath, fileName) => {
    const content = await fs.readFile(filePath, 'utf-8');
    let transcription;
    try {
        transcription = JSON.parse(content);
        console.log(`transcription: ${transcription.text}`)
    } catch (e) {
        console.error(`${e} for ${fileName}`);
        return;
    }

    for (const sub of subscriptions) {
        const regex = new RegExp(sub.regex, 'i');
        console.log(`regex: ${regex}`)
        if (regex.test(transcription.text)) {
            await sendEmail(sub.email, `${regex}`, `${fileName} \n ${transcription.text} \n ${config.WEB_URL}/search?q=${regex}`);
        }
    }
};

const checkTranscriptions = async () => {
    try {
        const filePaths = await readDirRecursive('./public/transcriptions');
        console.log(`Files to process: ${filePaths}`);
        if (filePaths.length === 0) {
            console.log("No new files to process.");
            return;
        }

        for (const file of filePaths) {
            const fileName = path.basename(file);
            const match = fileName.match(/^(\d{8}_\d{6})/);
            console.log(`Current file ${fileName}`);
            console.log(`match: ${match}`);
            if (!match) continue;
        
            const timestamp = match[1];
            const fileDate = new Date(timestamp.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));
        
            // Skip files older than the server boot time and break the loop
            if (fileDate <= serverBootTime) {
                console.log(`Skipping file ${fileName}\nfileDate: ${fileDate}\nserverBootTime: ${serverBootTime}}`);
                console.log(`Before: ${lastProcessedTimestamp}`)
                lastProcessedTimestamp = timestamp;
                console.log(`After: ${lastProcessedTimestamp}`)
                break;
            }
        
            if (timestamp <= lastProcessedTimestamp) continue;
        
            if (shouldProcessFile(fileName) && fileName !== lastProcessedFileName) {
                console.log(`processFile ${fileName}`);
                try {
                    await processFile(file, fileName);
                    lastProcessedTimestamp = timestamp;
                    lastProcessedFileName = fileName;
                } catch (error) {
                    console.error(`Error processing file ${fileName}:`, error);
                }
            }
        }
    } catch (error) {
        console.error("Error in checkTranscriptions: ", error);
    }
};

module.exports = checkTranscriptions;
