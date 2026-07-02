const config = {
    privateKeyPath: '/etc/letsencrypt/live/your.host/privkey.pem', // path to private key
    certificatePath: '/etc/letsencrypt/live/your.host/fullchain.pem', // path to certificate
    PORT: 3000, // port to run the server on
    EMAIL_HOST: 'smtp.email.gov', // email server for SMTP
    EMAIL_PORT: 587, // port for SMTP
    EMAIL_USER: 'user', // username for SMTP
    EMAIL_PASS: 'pass', // password for SMTP
    requireTLS: true, // require STARTTLS; set false only for a plaintext internal relay
    EMAIL_SUBJ_PREFIX: 'Node 1234: ', // OPTIONAL: prefix of regex for email subjects
    EMAIL_SUBJ_SUFFIX: ' regex match!', // OPTIONAL: suffix of regex for email subjects
    EMAIL_SUB_CONF_SUBJ: 'Confirm Subscription', // Subject of the confirmation e-mail we send for new subscriptions
    SUB_CONF_RESP: 'Success! Check your Inbox (or Spam) for a confirmation link.', // Response to send to the browser after they subscribe
    UNSUB_CONF_RESP: 'Success! You have been unsubscribed.', // Response to send to the browser after they unsubscribe
    VERIFIED_RESP: 'Email verified. You will now receive email notifications when a transcription matches your subscription.', // Response to send to the browser after they verify their e-mail
    maxHourlyEmails: 40, // max number of emails per hour
    maxDailyEmails: 130, // max number of emails per day
    WEB_URL: 'https://localhost:3000', // base URL of the web server
    // Users: passwordHash is a bcrypt hash. Generate one with:
    //   node -e "console.log(require('bcrypt').hashSync(process.argv[1], 12))" 'your-password'
    // A legacy plaintext `password` field still works but logs a warning on
    // each login — migrate to passwordHash.
    users: [
        { username: 'user1', passwordHash: '$2b$12$7phvz3pjndIJfVpNoTeWFOdNWebC4uMBxd7o3Ml42hnI1JhB38PV.' }, // testpassword1
        { username: 'user2', passwordHash: '$2b$12$0DWvVoZ.MS7e1B./PUm0q.ChwdVuf3/84USHC9mKn.Dtt12dter..' }, // testpassword2
    ],
    // Set true to allow logging in with an empty username + password (anyone
    // who can reach the site gets in) — only for trusted private networks.
    allowPasswordlessLogin: false,
    secureCookies: true, // set false only behind a TLS-terminating proxy that talks plain HTTP to this app
    sessionMaxAgeMs: 8 * 60 * 60 * 1000, // how long a login lasts (default 8 hours)
    sessionSecretKey: 'secret', // secret key for session — CHANGE THIS to a long random string
    rateLimitMax: 100, // API/page requests per 15 min per IP
    loginRateLimitMax: 10, // login attempts per 15 min per IP
    staticRateLimitMax: 1000, // /public (audio + transcription files) requests per 15 min per IP
    // trustProxy: 1, // uncomment when running behind a reverse proxy (nginx etc.)
    WEB_nodeID: 'nodeID', // nodeID listed in website title
    WEB_nodeName: 'nodeName', // nodeName listed in website title
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
  