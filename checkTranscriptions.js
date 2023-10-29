const config = require('./config');
const fs = require('fs').promises;
const path = require('path');
const sendEmail = require('./email');
const db = require('./database');
const myEmitter = require('./events');

let lastProcessedFile = null;
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

myEmitter.on('emailVerified', fetchActiveSubscriptions);

const readDirRecursive = async (dir) => {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? readDirRecursive(res) : res;
    }));
    return files.flat();
};

const shouldProcessFile = (fileName, mostRecentDate) => {
    const match = fileName.match(/^(\d{8}_\d{6})/);
    if (!match) return false;

    const timestampStr = match[1];
    const fileDate = new Date(timestampStr.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));

    return fileDate > mostRecentDate;
};

const processFile = async (filePath, fileName) => {
    const content = await fs.readFile(filePath, 'utf-8');
    let transcription;
    try {
        transcription = JSON.parse(content);
    } catch (e) {
        console.error(`Invalid JSON in file ${fileName}`);
        return;
    }

    for (const sub of subscriptions) {
        const regex = new RegExp(sub.regex, 'i');
        if (regex.test(transcription.text)) {
            await sendEmail(sub.email, `${regex}`, `${fileName} \n ${transcription.text} \n ${config.WEB_URL}/search?q=${regex}`);
        }
    }
};

const checkTranscriptions = async () => {
    try {
        const files = await readDirRecursive('./public/transcriptions');
        files.sort();
        const mostRecentTimestamp = path.basename(files[0]).match(/^(\d{8}_\d{6})/)[1];
        const mostRecentDate = new Date(mostRecentTimestamp.replace(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6'));

        await fetchActiveSubscriptions();

        for (const filePath of files) {
            const fileName = path.basename(filePath);
            const match = fileName.match(/^(\d{8}_\d{6})/);
            if (!match) continue;

            const timestamp = match[1];
            if (timestamp <= lastProcessedTimestamp) continue;

            if (shouldProcessFile(fileName, mostRecentDate)) {
                await processFile(filePath, fileName);
                lastProcessedTimestamp = timestamp;
                lastProcessedFile = filePath;
            }
        }
    } catch (error) {
        console.error("Error in checkTranscriptions: ", error);
    }
};

module.exports = checkTranscriptions;
