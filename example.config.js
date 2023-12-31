const config = {
    privateKeyPath: '/etc/letsencrypt/live/your.host/privkey.pem', // path to private key
    certificatePath: '/etc/letsencrypt/live/your.host/fullchain.pem', // path to certificate
    PORT: 3000, // port to run the server on
    EMAIL_HOST: 'smtp.email.gov', // email server for SMTP
    EMAIL_PORT: 587, // port for SMTP
    EMAIL_USER: 'user', // username for SMTP
    EMAIL_PASS: 'pass', // password for SMTP
    EMAIL_SUBJ_PREFIX: 'Node 1234: ', // OPTIONAL: prefix of regex for email subjects
    EMAIL_SUBJ_SUFFIX: ' regex match!', // OPTIONAL: suffix of regex for email subjects
    EMAIL_SUB_CONF_SUBJ: 'Confirm Subscription', // Subject of the confirmation e-mail we send for new subscriptions
    SUB_CONF_RESP: 'Success! Check your Inbox (or Spam) for a confirmation link.', // Response to send to the browser after they subscribe
    UNSUB_CONF_RESP: 'Success! You have been unsubscribed.', // Response to send to the browser after they unsubscribe
    VERIFIED_RESP: 'Email verified. You will now receive email notifications when a transcription matches your subscription.', // Response to send to the browser after they verify their e-mail
    maxHourlyEmails: 40, // max number of emails per hour
    maxDailyEmails: 130, // max number of emails per day
    WEB_URL: 'https://localhost:3000', // base URL of the web server
    users: [
        { username: 'user1', password: 'pass1' },
        { username: 'user2', password: 'pass2' },
        { username: '', password: '' }, // allow just clicking of Login button
    ],
    sessionSecretKey: 'secret', // secret key for session
    WEB_nodeID: 'nodeID', // nodeID listed in website title
    WEB_nodeName: 'nodeName', // nodeName listed in website title
    confirmIDSTRLength: 36, // utility.js generateConfirmationId
    confirmIDSubSTRBegin: 2, // utility.js generateConfirmationId
    confirmIDSubSTREnd: 34, // utility.js generateConfirmationId
    idDescriptionMap: {
          '41001': 'EMS', // optionally transate talkgroup IDs to names
          '41002': 'Fire Dept',
          '': 'No Filter',
      },
      radio_id_names: {
          "1610018": "EMS CAD", // optionally transate radio IDs to names
          "1610019": "FD CAD",
          "": "No Filter",
      },
      broadcastifyLinks: `
          <a href="https://www.broadcastify.com/calls/tg/7118/41001">41001:EMS</a> <br />
          <a href="https://www.broadcastify.com/calls/tg/7118/41002">41002:FD</a> <br />`
  };
  
  module.exports = config;
  