const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

const server = require('../server');

chai.use(chaiHttp);

describe('Server Tests', () => {
  after((done) => {
    if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should return 200 OK for the root path', (done) => {
    chai.request(server)
      .get('/')
      .auth('user', 'pass')  // Include Basic Auth credentials here
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
  });

  // Add more tests as needed
});
