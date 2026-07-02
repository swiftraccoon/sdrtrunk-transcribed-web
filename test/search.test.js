const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const { loadCache, searchTranscriptions, updateCacheForDirectory } = require('../search');

const ROOT = path.join(__dirname, '..');
const TRANSCRIPTIONS_9999 = path.join(ROOT, 'public', 'transcriptions', '9999');
const FIXTURE_TXT = path.join(TRANSCRIPTIONS_9999, '20260701_120000_TO_9999_FROM_12345.txt');
// An audio dir with no matching transcriptions dir — the case that used to
// abort the whole cache load.
const ORPHAN_AUDIO = path.join(ROOT, 'public', 'audio', '0000');

describe('search cache', () => {
    before(() => {
        fs.mkdirSync(TRANSCRIPTIONS_9999, { recursive: true });
        fs.writeFileSync(FIXTURE_TXT, 'UNIQUEcacheSTRING42 engine responding');
    });

    after(() => {
        fs.rmSync(ORPHAN_AUDIO, { recursive: true, force: true });
        fs.rmSync(FIXTURE_TXT, { force: true });
    });

    it('updateCacheForDirectory indexes the files in a directory', async () => {
        await updateCacheForDirectory(TRANSCRIPTIONS_9999);
        const results = await searchTranscriptions('uniquecachestring42');
        assert.equal(results.length, 1);
        assert.equal(results[0].dir, '9999');
        assert.match(results[0].content, /engine responding/);
    });

    it('loadCache skips directories without transcriptions instead of aborting', async () => {
        fs.mkdirSync(ORPHAN_AUDIO, { recursive: true });
        await loadCache();
        const results = await searchTranscriptions('uniquecachestring42');
        assert.equal(results.length, 1, 'valid directories must still be indexed');
    });

    it('preserves the warm cache when the audio directory is transiently unreadable', async () => {
        await loadCache();
        assert.equal((await searchTranscriptions('uniquecachestring42')).length, 1);
        const stub = sinon.stub(fs.promises, 'readdir').rejects(new Error('EMFILE'));
        try {
            await loadCache();
        } finally {
            stub.restore();
        }
        assert.equal((await searchTranscriptions('uniquecachestring42')).length, 1,
            'a transient readdir failure must not wipe the existing index');
    });
});
