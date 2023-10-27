const { expect } = require('chai');
const sinon = require('sinon');

const { searchTranscriptions } = require('../search');

describe('searchTranscriptions', () => {
  const cache = {
    'file1.txt': {
      content: 'This is the content of file1.txt',
      dir: '/path/to/dir1',
      file: 'file1.txt'
    },
    'file2.txt': {
      content: 'This is the content of file2.txt',
      dir: '/path/to/dir2',
      file: 'file2.txt'
    },
    'file3.txt': {
      content: 'This is the content of file3.txt',
      dir: '/path/to/dir3',
      file: 'file3.txt'
    }
  };

  it('should return an empty array if no transcriptions match the query', async () => {
    const results = await searchTranscriptions('foobar', cache);
    expect(results).to.be.an('array').that.is.empty;
  });

  it('should return an array of matching transcriptions', async () => {
    const results = await searchTranscriptions('content', cache);
    expect(results).to.be.an('array').that.has.lengthOf(3);
    expect(results[0]).to.deep.equal({
      dir: '/path/to/dir1',
      file: 'file1.txt',
      content: 'This is the content of file1.txt'
    });
    expect(results[1]).to.deep.equal({
      dir: '/path/to/dir2',
      file: 'file2.txt',
      content: 'This is the content of file2.txt'
    });
    expect(results[2]).to.deep.equal({
      dir: '/path/to/dir3',
      file: 'file3.txt',
      content: 'This is the content of file3.txt'
    });
  });

  it('should ignore case when matching transcriptions', async () => {
    const results = await searchTranscriptions('CONTENT', cache);
    expect(results).to.be.an('array').that.has.lengthOf(3);
  });

  it('should sort results by filename in descending order', async () => {
    const results = await searchTranscriptions('content', cache);
    expect(results[0].file).to.equal('file3.txt');
    expect(results[1].file).to.equal('file2.txt');
    expect(results[2].file).to.equal('file1.txt');
  });

  it('should handle errors gracefully', async () => {
    const consoleSpy = sinon.spy(console, 'error');
    const results = await searchTranscriptions('content', null);
    expect(results).to.be.an('array').that.is.empty;
    expect(consoleSpy.calledOnce).to.be.true;
    consoleSpy.restore();
  });
});