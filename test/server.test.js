const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

const server = require('../server');

chai.use(chaiHttp);

describe('Server Tests', function() {
  this.timeout(5000); // Increase timeout to 5000ms

  after((done) => {
    if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should return 200 OK for the root path', (done) => {
    console.log("Starting test");
    chai.request(server)
      .get('/')
      .auth('user', 'pass')
      .end((err, res) => {
        if (err) {
          console.log("Error:", err);
        }
        console.log("Response status:", res.status);
        expect(res).to.have.status(200);
        done();
      });
  });

});
