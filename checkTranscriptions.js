const fs = require('fs').promises;
const path = require('path');
const sendEmail = require('./email');
const db = require('./database');

let lastProcessedFile = null;

const fetchActiveSubscriptions = async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT email, regex FROM subscriptions WHERE verified = TRUE AND enabled = TRUE`, [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(rows);
        });
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
                
                if (regex.test(transcription.text)) {
                    await sendEmail(sub.email, `${regex}`, `${transcription.text}`);
                }
            }
            
            lastProcessedFile = filePath;
        }
        
    } catch (error) {
        console.error("Error in checkTranscriptions: ", error);
    }
};

setInterval(checkTranscriptions, 60 * 1000);

module.exports = checkTranscriptions;
