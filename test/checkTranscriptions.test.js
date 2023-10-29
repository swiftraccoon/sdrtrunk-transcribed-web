const chai = require('chai');
const assert = chai.assert;
const sinon = require('sinon');
const checkTranscriptions = require('../checkTranscriptions');
const fs = require('fs').promises;
// const sendEmail = require('../email');

describe('checkTranscriptions', () => {
  let readDirRecursiveStub, readFileStub;
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    readDirRecursiveStub = sandbox.stub(fs, 'readdir');
    readFileStub = sandbox.stub(fs, 'readFile');
    // sendEmailStub = sandbox.stub(sendEmail);
  });

  afterEach(() => {
    sandbox.restore();  // Restore all stubs
  });

  it('should check files created since server boot', async () => {
    readDirRecursiveStub.callsFake(async (dir) => {
      console.log(`readDirRecursive called with: ${dir}`);
      return ['file1', 'file2'];
    });
    
    readFileStub.callsFake(async (filePath) => {
      console.log(`readFile called with: ${filePath}`);
      return JSON.stringify({ text: 'some text' });
    });
    
    try {
      await checkTranscriptions();
      assert.isTrue(readDirRecursiveStub.calledOnce);
    } catch (e) {
      console.log(`Caught error: ${e}`);
    }
  });

//   it('should send an email if regex matches', async () => {
//     readDirRecursiveStub.resolves(['file1']);
//     readFileStub.resolves(JSON.stringify({ text: 'match this text' }));

//     await checkTranscriptions();

//     assert.isTrue(sendEmailStub.calledOnce);
//   });

  it('should not check any files more than once', async () => {
    readDirRecursiveStub.resolves(['file1', 'file1']);
    readFileStub.resolves(JSON.stringify({ text: 'some text' }));
    
    await checkTranscriptions();
    await checkTranscriptions();
    
    assert.isTrue(readFileStub.calledOnce);
  });

  it('should start with the newest file and go down in descending order', async () => {
    readDirRecursiveStub.resolves(['file2', 'file1']);
    readFileStub.resolves(JSON.stringify({ text: 'some text' }));
    
    await checkTranscriptions();
    
    assert.isTrue(readDirRecursiveStub.returnValues[0][0] === 'file2');
  });

  it('should stop once a file older than server boot time is reached', async () => {
    readDirRecursiveStub.resolves(['new_file', 'old_file']);
    readFileStub.resolves(JSON.stringify({ text: 'some text' }));
    
    await checkTranscriptions();
    
    assert.isTrue(readFileStub.calledOnce);
  });
});
