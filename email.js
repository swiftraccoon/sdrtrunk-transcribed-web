const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.protonmail.ch',
  port: 587,
  secure: false,
  auth: {
    user: 'USERNAME',
    pass: 'PASSWORD'
  }
});

// TODO: Use transporter.sendMail to send emails
