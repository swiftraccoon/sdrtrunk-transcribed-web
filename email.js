const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.protonmail.ch',
  port: 587,
  secure: false, // use STARTTLS
  auth: {
    user: 'USERNAME', // replace with your ProtonMail username
    pass: 'PASSWORD'  // replace with your ProtonMail password
  }
});

const sendEmail = async (to, subject, text) => {
  const mailOptions = {
    from: 'USERNAME', // sender address
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
