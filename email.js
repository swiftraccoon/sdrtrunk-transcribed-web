const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.protonmail.ch',
  port: 587,
  secure: false,
  auth: {
    user: 'dylan@spindale.host', // replace with your ProtonMail username
    pass: 'WUAWC5ZXFD8AAYFH'  // replace with your ProtonMail password
  }
});

const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: 'dylan@spindale.host', // sender address
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
