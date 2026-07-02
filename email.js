const nodemailer = require('nodemailer');
const config = require('./config');
const EMAIL_HOST = config.EMAIL_HOST;
const EMAIL_PORT = config.EMAIL_PORT;
const EMAIL_USER = config.EMAIL_USER;
const EMAIL_PASS = config.EMAIL_PASS;

let hourlyEmailCount = 0;
let dailyEmailCount = 0;
let lastHourlyReset = Date.now();
let lastDailyReset = Date.now();


const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: false,
  // Refuse to send unless STARTTLS is negotiated. Operators relaying through a
  // plaintext-only internal server can set requireTLS:false in config.js.
  requireTLS: config.requireTLS !== false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Throws on failure so callers can respond honestly (e.g. /subscribe should
// not report success when the confirmation email never went out).
const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: EMAIL_USER, // sender address
    to: to,          // list of receivers
    subject: subject,// subject line
    text: text       // plain text body
  };

  await transporter.sendMail(mailOptions);
  console.log(`Email sent to ${to}`);
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
    throw new Error("Email rate limit reached; not sent.");
  }

  // Send the email; counters only track emails that actually went out
  await sendEmail(email, subject, body);
  hourlyEmailCount++;
  dailyEmailCount++;
};

// transporter is exported so tests can stub sendMail
module.exports = { sendEmailWithRateLimit, transporter };
