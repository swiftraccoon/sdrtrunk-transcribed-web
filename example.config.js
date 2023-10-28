const config = {
  PORT: 3000, // port to run the server on
  EMAIL_HOST: 'smtp.email.gov', // email server for SMTP
  EMAIL_PORT: 587, // port for SMTP
  EMAIL_USER: 'user', // username for SMTP
  EMAIL_PASS: 'pass', // password for SMTP
  WEB_URL: 'http://localhost:3000', // base URL of the web server
  WEB_user0: 'user', // username for basic auth
  WEB_pass0: 'pass', // password for basic auth
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
        <a href="https://www.broadcastify.com/calls/tg/7118/41001">41001:RuCoEMS</a> <br />
        <a href="https://www.broadcastify.com/calls/tg/7118/41002">41002:RuCoFD</a> <br />`
};

module.exports = config;
