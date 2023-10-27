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

      // Check against regex patterns in the database
      db.all(`SELECT * FROM subscriptions WHERE enabled = TRUE AND verified = TRUE`, [], (err, rows) => {
        if (err) {
          console.error(err);
          return;
        }

        getVerifiedSubscriptions((subscriptions) => {
            subscriptions.forEach((subscription) => {
              const regex = new RegExp(subscription.regex, 'i');
              newTranscriptions.forEach((transcription) => {
                if (regex.test(transcription.text)) {
                  sendEmail(
                    subscription.email,
                    'New Transcription Match',
                    `A new transcription matches your subscription: ${transcription.text}`
                  );
                }
              });
            });
          });

    // Update the last checked file
    lastCheckedFile = files[files.length - 1];
  });
}

// Run the function every 10 minutes (600000 milliseconds)
setInterval(checkNewTranscriptions, 600000);

module.exports = checkNewTranscriptions;
