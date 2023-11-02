const chai = require('chai');
const assert = chai.assert;
const sinon = require('sinon');
const { checkTranscriptions, processFile, processedFiles } = require('../checkTranscriptions');
const fs = require('fs').promises;

describe('checkTranscriptions', () => {
    let readDirRecursiveStub, processFileStub;
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        readDirRecursiveStub = sandbox.stub(fs, 'readdir');
        readFileStub = sandbox.stub(fs, 'readFile');
        processFileStub = sandbox.stub(processFile);
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

    it('should not process any files if there are no new files to process', async function() {
        // Arrange
        readDirRecursiveStub.resolves([]);
        
        // Act
        await checkTranscriptions();
        
        // Assert
        sinon.assert.notCalled(processFileStub);
    });

    it('should skip already processed files', async function() {
        // Arrange
        const processedFileName = '20220101_000000.json';
        const processedFilesSet = new Set([processedFileName]);
        processedFiles.clear();
        processedFiles.add(processedFileName);
        readDirRecursiveStub.resolves([`./public/transcriptions/${processedFileName}`]);
        
        // Act
        await checkTranscriptions();
        
        // Assert
        sinon.assert.notCalled(processFileStub);
        assert.isTrue(processedFilesSet.has(processedFileName));
    });

    it('should skip files older than the server boot time', async function() {
        // Arrange
        const oldFileName = '20220101_000000.json';
        const oldFileDate = new Date('2022-01-01T00:00:00');
        const serverBootTime = new Date('2022-01-02T00:00:00');
        const lastProcessedTimestamp = '20220101_000000';
        readDirRecursiveStub.resolves([`./public/transcriptions/${oldFileName}`]);
        sandbox.stub(path, 'basename').returns(oldFileName);
        sandbox.stub(Date, 'now').returns(serverBootTime.getTime());
        
        // Act
        await checkTranscriptions();
        
        // Assert
        sinon.assert.notCalled(processFileStub);
        assert.strictEqual(lastProcessedTimestamp, '20220101_000000');
    });

    it('should skip files that have already been processed since the last check', async function() {
        // Arrange
        const lastProcessedFileName = '20220101_000000.json';
        const lastProcessedTimestamp = '20220101_000000';
        const newFileName = '20220102_000000.json';
        readDirRecursiveStub.resolves([`./public/transcriptions/${newFileName}`]);
        sandbox.stub(path, 'basename').returns(newFileName);
        sandbox.stub(Date, 'now').returns(new Date('2022-01-02T00:00:00').getTime());
        sandbox.stub(process, 'shouldProcessFile').returns(true);
        sandbox.stub(processedFiles, 'has').returns(false);
        sandbox.stub(process, 'processFile').resolves();
        sandbox.stub(console, 'log');
        lastProcessedFileName = newFileName;
        
        // Act
        await checkTranscriptions();
        
        // Assert
        sinon.assert.calledOnce(processFileStub);
        sinon.assert.calledWith(processFileStub, `./public/transcriptions/${newFileName}`, newFileName);
        assert.strictEqual(lastProcessedTimestamp, '20220102_000000');
        assert.strictEqual(lastProcessedFileName, newFileName);
        sinon.assert.calledWith(console.log, `Sending to processFile ${newFileName}`);
    });

    it('should not process files that should not be processed', async function() {
        // Arrange
        const fileName = '20220102_000000.json';
        readDirRecursiveStub.resolves([`./public/transcriptions/${fileName}`]);
        sandbox.stub(path, 'basename').returns(fileName);
        sandbox.stub(Date, 'now').returns(new Date('2022-01-02T00:00:00').getTime());
        sandbox.stub(process, 'shouldProcessFile').returns(false);
        sandbox.stub(console, 'log');
        
        // Act
        await checkTranscriptions();
        
        // Assert
        sinon.assert.notCalled(processFileStub);
        sinon.assert.calledWith(console.log, `Skipping file ${fileName}`);
    });

    it('should not process the same file twice in a row', async function() {
        // Arrange
        const fileName = '20220102_000000.json';
        readDirRecursiveStub.resolves([`./public/transcriptions/${fileName}`]);
        sandbox.stub(path, 'basename').returns(fileName);
        sandbox.stub(Date, 'now').returns(new Date('2022-01-02T00:00:00').getTime());
        sandbox.stub(process, 'shouldProcessFile').returns(true);
        sandbox.stub(processedFiles, 'has').returns(true);
        sandbox.stub(console, 'log');
        
        // Act
        await checkTranscriptions();
        
        // Assert
        sinon.assert.notCalled(processFileStub);
        sinon.assert.calledWith(console.log, `Skipping already processed file: ${fileName}`);
    });
});