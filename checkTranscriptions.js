const fs = require('fs').promises;
const path = require('path');
const sendEmail = require('./email');

let lastProcessedFile = null;

const fetchActiveSubscriptions = async () => {
    return new Promise((resolve, reject) => {
        db.all(`SELECT email, regex FROM subscriptions WHERE verified = TRUE AND enabled = TRUE`, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const checkTranscriptions = async () => {
    try {
        // Read the directory where transcription files are stored
        const files = await fs.readdir('./transcriptions');
        
        // Sort files (assuming they are named in a way that sorting them makes sense)
        files.sort();
        
        // Find the index of the last processed file
        const startIndex = lastProcessedFile ? files.indexOf(lastProcessedFile) + 1 : 0;
        
        // If there are no new files, return
        if (startIndex >= files.length) {
            return;
        }
        
        // Fetch active subscriptions (assuming you have a function to do this)
        const subscriptions = await fetchActiveSubscriptions();
        
        for (let i = startIndex; i < files.length; i++) {
            const file = files[i];
            const filePath = path.join('./transcriptions', file);
            
            // Read and parse the transcription file
            const content = await fs.readFile(filePath, 'utf-8');
            const transcription = JSON.parse(content);
            
            for (const sub of subscriptions) {
                const regex = new RegExp(sub.regex, 'i');
                
                if (regex.test(transcription.text)) {
                    await sendEmail(sub.email, 'Transcription Match', `A match for your subscription was found: ${transcription.text}`);
                }
            }
            
            // Update the last processed file
            lastProcessedFile = file;
        }
        
    } catch (error) {
        console.error("Error in checkTranscriptions: ", error);
    }
};

// Run the function every minute
setInterval(checkTranscriptions, 60 * 1000);

module.exports = checkTranscriptions;
