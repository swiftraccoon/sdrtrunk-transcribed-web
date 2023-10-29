const Mocha = require('mocha');
const mocha = new Mocha();

mocha.addFile('./search.test.js');
mocha.addFile('./checkTranscriptions.test.js');
// mocha.addFile('./server.test.js');

mocha.run((failures) => {
  process.exitCode = failures ? 1 : 0;
});