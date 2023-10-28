const nodemailer = require('nodemailer');
const config = require('./config');
const EMAIL_HOST = config.EMAIL_HOST;
const EMAIL_PORT = config.EMAIL_PORT;
const EMAIL_USER = config.EMAIL_USER;
const EMAIL_PASS = config.EMAIL_PASS;

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

module.exports = sendEmail;
