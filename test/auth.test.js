const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../app');
const config = require('../config');
const { login, getCsrf, cookieHeader } = require('./helpers/http');

describe('authentication', () => {
    let app;
    before(() => { app = createApp(); });

    // /search is the lightest requireAuth-protected probe
    const probe = (jar) => request(app).get('/search?q=zz').set('Cookie', cookieHeader(jar));

    it('accepts a user with a bcrypt passwordHash', async () => {
        const { res, jar } = await login(app, 'user1', 'testpassword1');
        assert.equal(res.status, 302);
        assert.equal(res.headers.location, '/');
        assert.equal((await probe(jar)).status, 200);
    });

    it('rejects a wrong password', async () => {
        const { res, jar } = await login(app, 'user1', 'wrongpassword');
        assert.equal(res.headers.location, '/login');
        assert.equal((await probe(jar)).status, 302);
    });

    it('rejects empty credentials by default', async () => {
        const { res, jar } = await login(app, '', '');
        assert.equal(res.headers.location, '/login');
        assert.equal((await probe(jar)).status, 302);
    });

    it('allows empty credentials only when allowPasswordlessLogin is enabled', async () => {
        config.allowPasswordlessLogin = true;
        try {
            const { res } = await login(app, '', '');
            assert.equal(res.headers.location, '/');
        } finally {
            config.allowPasswordlessLogin = false;
        }
    });

    it('still accepts legacy plaintext password entries', async () => {
        config.users.push({ username: 'legacy', password: 'legacypass' });
        try {
            const { res } = await login(app, 'legacy', 'legacypass');
            assert.equal(res.headers.location, '/');
        } finally {
            config.users.pop();
        }
    });

    it('issues a fresh session id on login (fixation defense)', async () => {
        const { token, jar } = await getCsrf(app);
        jar['connect.sid'] = 's%3Aforged-session-id.sig';
        const res = await request(app)
            .post('/login')
            .set('Cookie', cookieHeader(jar))
            .type('form')
            .send({ username: 'user1', password: 'testpassword1', _csrf: token });
        const sid = (res.headers['set-cookie'] || []).find(c => c.startsWith('connect.sid='));
        assert.ok(sid, 'login must set a session cookie');
        assert.ok(!sid.includes('forged-session-id'), 'must not reuse a supplied session id');
    });

    it('sets SameSite and an expiry on the session cookie', async () => {
        const { res } = await login(app, 'user1', 'testpassword1');
        const sid = (res.headers['set-cookie'] || []).find(c => c.startsWith('connect.sid='));
        assert.ok(sid, 'login must set a session cookie');
        assert.match(sid, /SameSite=Lax/i);
        assert.match(sid, /Expires=|Max-Age=/i);
    });

    it('returns an error response instead of hanging when a passwordHash is malformed', async () => {
        // A non-string passwordHash makes bcrypt.compare reject; the handler
        // must not leak an unhandled rejection or hang the request.
        config.users.push({ username: 'broken', passwordHash: 12345 });
        try {
            const { res } = await login(app, 'broken', 'whatever');
            assert.equal(res.status, 500);
        } finally {
            config.users.pop();
        }
    });

    it('logout via POST ends the session', async () => {
        const { jar, token } = await login(app, 'user1', 'testpassword1');
        const out = await request(app)
            .post('/logout')
            .set('Cookie', cookieHeader(jar))
            .set('x-csrf-token', token)
            .type('form')
            .send({});
        assert.equal(out.headers.location, '/login');
        assert.equal((await probe(jar)).status, 302);
    });

    it('does not allow logout via GET (CSRF-safe)', async () => {
        const { jar } = await login(app, 'user1', 'testpassword1');
        const out = await request(app).get('/logout').set('Cookie', cookieHeader(jar));
        assert.equal(out.status, 404, 'GET /logout must not be a route');
        assert.equal((await probe(jar)).status, 200, 'the session must survive a cross-site GET');
    });
});
