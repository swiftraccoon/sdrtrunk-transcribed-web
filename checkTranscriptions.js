const fs = require('fs');
const path = require('path');
const db = require('./database');
const { sendEmail } = require('./email');
const { getVerifiedSubscriptions } = require('./database');

let lastCheckedFile = null;

async function checkNewTranscriptions() {
  // Assuming transcriptions are stored in a 'transcriptions' directory
  const transcriptionDir = path.join(__dirname, 'transcriptions');

  // Read the list of files in the directory
  fs.readdir(transcriptionDir, (err, files) => {
    if (err) {
      console.error(err);
      return;
    }

    // Sort files by creation time
    files = files.map((fileName) => {
      return {
        name: fileName,
        time: fs.statSync(path.join(transcriptionDir, fileName)).mtime.getTime()
      };
    })
    .sort((a, b) => a.time - b.time)
    .map((file) => file.name);

    // Filter out files that were already checked
    const newFiles = lastCheckedFile ? files.slice(files.indexOf(lastCheckedFile) + 1) : files;

    newFiles.forEach((file) => {
      const filePath = path.join(transcriptionDir, file);
      const transcription = fs.readFileSync(filePath, 'utf8');

      // Fetch all verified and enabled subscriptions from the database
        db.all(`SELECT * FROM subscriptions WHERE verified = TRUE AND enabled = TRUE`, [], async (err, rows) => {
            if (err) {
            return console.error(err.message);
            }

            // Loop through each subscription
            for (const row of rows) {
            const { id, regex, email } = row;

            // Fetch new transcriptions (you'll need to implement this function)
            const newTranscriptions = await fetchNewTranscriptions();

            // Loop through each new transcription
            for (const transcription of newTranscriptions) {
                // Check if the transcription matches the regex pattern
                if (new RegExp(regex).test(transcription.text)) {
                // Send email (you'll need to implement or use your existing sendEmail function)
                sendEmail(email, 'New Transcription Match', `New matching transcription: ${transcription.text}`);
                }
            }
            }
        });
    });

// Run the function every 10 minutes (600000 milliseconds)
setInterval(checkNewTranscriptions, 600000);

module.exports = checkNewTranscriptions;
