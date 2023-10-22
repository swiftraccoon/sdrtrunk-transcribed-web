const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;

// Import your app here
let app = require('../server');
let server;

chai.use(chaiHttp);

describe('Server Tests', () => {
  before((done) => {
    server = app.listen(3000, done);
  });

  after((done) => {
    server.close(done);
  });

  it('should return 200 OK for the root path', (done) => {
    chai.request(server)
      .get('/')
      .end((err, res) => {
        expect(res).to.have.status(200);
        done();
      });
  });

  // Add more tests as needed
});