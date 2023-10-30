const nodemailer = require('nodemailer');
const config = require('./config');
const EMAIL_HOST = config.EMAIL_HOST;
const EMAIL_PORT = config.EMAIL_PORT;
const EMAIL_USER = config.EMAIL_USER;
const EMAIL_PASS = config.EMAIL_PASS;
const maxHourlyEmails = config.maxHourlyEmails;
const maxDailyEmails = config.maxDailyEmails;

let hourlyEmailCount = 0;
let dailyEmailCount = 0;
let lastHourlyReset = Date.now();
let lastDailyReset = Date.now();


const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: EMAIL_USER, // sender address
    to: to,          // list of receivers
    subject: subject,// subject line
    text: text       // plain text body
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending email: ${error}`);
  }
};

const sendEmailWithRateLimit = async (email, subject, body) => {
  const currentTimestamp = Date.now();

  // Check if an hour has passed since the last reset
  if (currentTimestamp - lastHourlyReset >= 3600000) {
    hourlyEmailCount = 0;
    lastHourlyReset = currentTimestamp;
  }

  // Check if a day has passed since the last reset
  if (currentTimestamp - lastDailyReset >= 86400000) {
    dailyEmailCount = 0;
    lastDailyReset = currentTimestamp;
  }

  // Check rate limits
  if (hourlyEmailCount >= config.maxHourlyEmails || dailyEmailCount >= config.maxDailyEmails) {
    console.log("Rate limit reached. Email not sent.");
    return;
  }

  // Send the email
  await sendEmail(email, subject, body);

  // Update counters
  hourlyEmailCount++;
  dailyEmailCount++;
};

module.exports = sendEmailWithRateLimit;
