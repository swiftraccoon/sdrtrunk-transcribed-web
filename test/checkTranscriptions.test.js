const chai = require('chai');
const assert = chai.assert;
const sinon = require('sinon');
const { checkTranscriptions, processFile, processedFiles } = require('../checkTranscriptions');
const fs = require('fs').promises;

describe('checkTranscriptions', () => {
    let readDirRecursiveStub, readFileStub;
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        readDirRecursiveStub = sandbox.stub(fs, 'readdir');
        readFileStub = sandbox.stub(fs, 'readFile');
    });

    afterEach(() => {
        sandbox.restore();  // Restore all stubs
    });

    it('should return the full, unedited transcription', async function() {
        // Arrange
        const mockContent = JSON.stringify({
            "2499936": "Henderson car, clear name and number, reference 10-50 PD.",
            "10-50": "Collision PD, PI, F"
        });
        readFileStub.resolves(mockContent);
        
        // Act
        const logSpy = sinon.spy(console, 'log');
        await processFile('mockFilePath', 'mockFileName');
        
        // Assert
        assert.isTrue(logSpy.calledWith(`transcription: ${mockContent}`));
        
        // Cleanup
        logSpy.restore();
    });
});
