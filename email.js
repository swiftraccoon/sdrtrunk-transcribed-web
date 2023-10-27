const nodemailer = require('nodemailer');

async function sendEmail(to, subject, text) {
    let transporter = nodemailer.createTransport({
        // ProtonMail SMTP configuration here
    });

    let info = await transporter.sendMail({
        from: '"Your Name" <your-email@protonmail.com>',
        to: to,
        subject: subject,
        text: text
    });

    console.log("Message sent: %s", info.messageId);
}

module.exports = {
    sendEmail
};
