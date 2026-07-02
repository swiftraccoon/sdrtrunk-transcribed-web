const assert = require('node:assert/strict');
const request = require('supertest');
const sinon = require('sinon');
const createApp = require('../app');
const db = require('../database');
const { transporter } = require('../email');
const { login, cookieHeader } = require('./helpers/http');

const dbGet = (sql, params) => new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbRun = (sql, params) => new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this); }));

describe('subscriptions', () => {
    let app, jar, token, sendMailStub;

    before(async () => {
        app = createApp();
        ({ jar, token } = await login(app, 'user1', 'testpassword1'));
    });

    beforeEach(async () => {
        sendMailStub = sinon.stub(transporter, 'sendMail').resolves({ accepted: [] });
        await dbRun('DELETE FROM subscriptions', []);
    });

    afterEach(() => sinon.restore());

    const subscribe = (body) => request(app)
        .post('/subscribe')
        .set('Cookie', cookieHeader(jar))
        .set('x-csrf-token', token)
        .type('form')
        .send(body);

    it('accepts a valid subscription, stores it, and emails a confirmation link', async () => {
        const res = await subscribe({ regex: 'engine \\d+', email: 'dispatch@example.com' });
        assert.equal(res.status, 200);
        const row = await dbGet('SELECT * FROM subscriptions WHERE email = ?', ['dispatch@example.com']);
        assert.ok(row, 'row should be inserted');
        assert.equal(row.regex, 'engine \\d+');
        assert.ok(row.confirmationID.length >= 32);
        assert.equal(sendMailStub.callCount, 1);
        assert.ok(sendMailStub.firstCall.args[0].text.includes(`/verify/${row.confirmationID}`));
    });

    it('rejects an invalid email address with 400 and sends nothing', async () => {
        const res = await subscribe({ regex: 'fire', email: 'not-an-email' });
        assert.equal(res.status, 400);
        assert.equal(sendMailStub.callCount, 0);
        assert.equal(await dbGet('SELECT COUNT(*) AS n FROM subscriptions', []).then(r => r.n), 0);
    });

    it('rejects a regex that does not compile with 400', async () => {
        const res = await subscribe({ regex: '([unclosed', email: 'a@example.com' });
        assert.equal(res.status, 400);
        assert.equal(sendMailStub.callCount, 0);
    });

    it('rejects an oversized regex with 400', async () => {
        const res = await subscribe({ regex: 'a'.repeat(201), email: 'a@example.com' });
        assert.equal(res.status, 400);
        assert.equal(sendMailStub.callCount, 0);
    });

    it('rejects a regex using syntax the safe matcher cannot run (lookahead) with 400', async () => {
        const res = await subscribe({ regex: 'foo(?=bar)', email: 'a@example.com' });
        assert.equal(res.status, 400);
        assert.equal(sendMailStub.callCount, 0);
    });

    it('leaves no orphaned row when the confirmation email fails', async () => {
        sendMailStub.rejects(new Error('SMTP down'));
        const res = await subscribe({ regex: 'fire', email: 'orphan@example.com' });
        assert.equal(res.status, 500);
        const count = await dbGet('SELECT COUNT(*) AS n FROM subscriptions WHERE email = ?', ['orphan@example.com']).then(r => r.n);
        assert.equal(count, 0, 'the row must be rolled back so retries cannot accumulate duplicates');
    });

    it('does not accumulate duplicate rows across retries when email keeps failing', async () => {
        sendMailStub.rejects(new Error('SMTP down'));
        for (let i = 0; i < 3; i++) {
            await subscribe({ regex: 'fire', email: 'retry@example.com' });
        }
        const count = await dbGet('SELECT COUNT(*) AS n FROM subscriptions WHERE email = ?', ['retry@example.com']).then(r => r.n);
        assert.equal(count, 0);
    });

    it('returns 500 and sends no email when the database write fails', async () => {
        const runStub = sinon.stub(db, 'run').callsFake(function (sql, params, cb) {
            if (typeof cb === 'function') cb(new Error('disk full'));
            return db;
        });
        const res = await subscribe({ regex: 'fire', email: 'a@example.com' });
        runStub.restore();
        assert.equal(res.status, 500);
        assert.equal(sendMailStub.callCount, 0, 'must not email a confirmation for an unsaved subscription');
    });

    it('verify marks the subscription verified', async () => {
        await dbRun(`INSERT INTO subscriptions (regex, email, confirmationID) VALUES (?, ?, ?)`,
            ['fire', 'v@example.com', 'testconfirmid1234567890123456789012']);
        const res = await request(app)
            .get('/verify/testconfirmid1234567890123456789012')
            .set('Cookie', cookieHeader(jar));
        assert.equal(res.status, 200);
        const row = await dbGet('SELECT verified FROM subscriptions WHERE email = ?', ['v@example.com']);
        assert.equal(row.verified, 1);
    });

    it('unsubscribe disables an existing subscription', async () => {
        await dbRun(`INSERT INTO subscriptions (regex, email, confirmationID) VALUES (?, ?, ?)`,
            ['fire', 'u@example.com', 'cid']);
        const res = await request(app)
            .post('/unsubscribe')
            .set('Cookie', cookieHeader(jar))
            .set('x-csrf-token', token)
            .type('form')
            .send({ regex: 'fire', email: 'u@example.com' });
        assert.equal(res.status, 200);
        const row = await dbGet('SELECT enabled FROM subscriptions WHERE email = ?', ['u@example.com']);
        assert.equal(row.enabled, 0);
    });
});
