const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const db = require('../database');
const { transporter } = require('../email');
const { processFile, fetchActiveSubscriptions } = require('../checkTranscriptions');

const dbRun = (sql, params) => new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));

const TMP_DIR = path.join(__dirname, '.tmp');
const FIXTURE = path.join(TMP_DIR, '20990101_000000_TEST.txt');

const addSub = (email, regex) => dbRun(
    `INSERT INTO subscriptions (regex, email, verified, enabled, confirmationID) VALUES (?, ?, 1, 1, ?)`,
    [regex, email, `cid-${email}`]);

describe('transcription notifier', () => {
    before(() => {
        fs.mkdirSync(TMP_DIR, { recursive: true });
        fs.writeFileSync(FIXTURE, JSON.stringify({ '1610018': 'engine 5 responding to Main St' }));
    });

    beforeEach(async () => {
        await dbRun('DELETE FROM subscriptions', []);
    });

    afterEach(() => sinon.restore());

    it('an invalid stored regex does not block other subscribers', async () => {
        await addSub('bad-regex@example.com', '([unclosed');
        await addSub('good@example.com', 'engine');
        await fetchActiveSubscriptions();
        const sendMailStub = sinon.stub(transporter, 'sendMail').resolves({});

        await processFile(FIXTURE, path.basename(FIXTURE));

        assert.equal(sendMailStub.callCount, 1, 'the valid subscriber must still be notified');
        assert.equal(sendMailStub.firstCall.args[0].to, 'good@example.com');
    });

    it('one failed email does not block other subscribers', async () => {
        await addSub('first@example.com', 'engine');
        await addSub('second@example.com', 'responding');
        await fetchActiveSubscriptions();
        const sendMailStub = sinon.stub(transporter, 'sendMail');
        sendMailStub.onFirstCall().rejects(new Error('mailbox unavailable'));
        sendMailStub.onSecondCall().resolves({});

        await processFile(FIXTURE, path.basename(FIXTURE));

        assert.equal(sendMailStub.callCount, 2, 'second subscriber must still be attempted');
    });

    it('does not hang on a catastrophic-backtracking subscription regex', async function () {
        this.timeout(4000);
        // This pattern melts a vanilla RegExp against a long letter run; the
        // matcher must run in bounded time regardless of the stored pattern.
        const evil = path.join(TMP_DIR, '20990101_000001_EVIL.txt');
        fs.writeFileSync(evil, JSON.stringify({ radio: 'a'.repeat(42) }));
        await addSub('redos@example.com', '(([a-z])+)+9');
        await fetchActiveSubscriptions();
        sinon.stub(transporter, 'sendMail').resolves({});

        const start = Date.now();
        await processFile(evil, path.basename(evil));
        assert.ok(Date.now() - start < 1000, 'matching must complete in bounded time');
    });

    it('URL-encodes the regex in the notification search link', async () => {
        await addSub('encode@example.com', 'engine \\d+');
        await fetchActiveSubscriptions();
        const sendMailStub = sinon.stub(transporter, 'sendMail').resolves({});

        await processFile(FIXTURE, path.basename(FIXTURE));

        assert.equal(sendMailStub.callCount, 1);
        const text = sendMailStub.firstCall.args[0].text;
        assert.ok(text.includes(`/search?q=${encodeURIComponent('engine \\d+')}`),
            `link should be URL-encoded, got: ${text.split('\n').pop()}`);
    });
});
