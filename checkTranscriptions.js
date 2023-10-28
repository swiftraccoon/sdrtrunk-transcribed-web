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

const checkTranscriptions = async () => {
    try {
        const files = await fs.readdir('./public/transcriptions');
        files.sort();
        
        const startIndex = lastProcessedFile ? files.indexOf(lastProcessedFile) + 1 : 0;
        
        if (startIndex >= files.length) {
            return;
        }
        
        const subscriptions = await fetchActiveSubscriptions();
        
        for (let i = startIndex; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join('./public/transcriptions', file);
            
            const content = await fs.readFile(filePath, 'utf-8');
            let transcription;
            try {
                transcription = JSON.parse(content);
            } catch (e) {
                console.error(`Invalid JSON in file ${file}`);
                continue;
            }
            
            for (const sub of subscriptions) {
                const regex = new RegExp(sub.regex, 'i');
                
                if (regex.test(transcription.text)) {
                    await sendEmail(sub.email, `${regex}`, `${transcription.text}`);
                }
            }
            
            lastProcessedFile = file;
        }
        
    } catch (error) {
        console.error("Error in checkTranscriptions: ", error);
    }
};

setInterval(checkTranscriptions, 60 * 1000);

module.exports = checkTranscriptions;
