const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const request = require('supertest');
const createApp = require('../app');
const config = require('../config');
const { login, cookieHeader } = require('./helpers/http');

const ROOT = path.join(__dirname, '..');
const AUDIO_ROOT = path.join(ROOT, 'public', 'audio');

// A fixture stamped "now" in LOCAL time (filenames are local) so it lands
// inside the default date window regardless of the runner's timezone.
const now = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}_${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;
const BASE_NAME = `${stamp}Test__TO_9999_FROM_1610018`;

describe('rate limiting and route safety', () => {
    before(() => {
        fs.writeFileSync(path.join(AUDIO_ROOT, '9999', `${BASE_NAME}.mp3`), '');
        fs.writeFileSync(
            path.join(ROOT, 'public', 'transcriptions', '9999', `${BASE_NAME}.txt`),
            'RecentFixtureTranscription engine 5 responding');
    });

    after(() => {
        fs.rmSync(path.join(AUDIO_ROOT, '9999', `${BASE_NAME}.mp3`), { force: true });
        fs.rmSync(path.join(ROOT, 'public', 'transcriptions', '9999', `${BASE_NAME}.txt`), { force: true });
    });

    it('static assets do not consume the API rate limit', async () => {
        const saved = config.rateLimitMax;
        config.rateLimitMax = 3;
        try {
            const app = createApp();
            for (let i = 0; i < 5; i++) {
                const res = await request(app).get('/public/gray.css');
                assert.equal(res.status, 200, `static request ${i + 1} should not be limited`);
            }
            for (let i = 0; i < 3; i++) {
                await request(app).get('/login');
            }
            const limited = await request(app).get('/login');
            assert.equal(limited.status, 429, 'dynamic routes must still be limited');
        } finally {
            config.rateLimitMax = saved;
        }
    });

    it('login attempts get their own stricter rate limit', async () => {
        const saved = config.loginRateLimitMax;
        config.loginRateLimitMax = 2;
        try {
            const app = createApp();
            assert.equal((await login(app, 'user1', 'nope')).res.status, 302);
            assert.equal((await login(app, 'user1', 'nope')).res.status, 302);
            assert.equal((await login(app, 'user1', 'nope')).res.status, 429);
        } finally {
            config.loginRateLimitMax = saved;
        }
    });

    it('GET / renders transcriptions and sets a hardened theme cookie', async () => {
        const app = createApp();
        const { jar } = await login(app, 'user1', 'testpassword1');
        const res = await request(app).get('/?theme=darkGray').set('Cookie', cookieHeader(jar));
        assert.equal(res.status, 200);
        assert.match(res.text, /RecentFixtureTranscription/);
        const themeCookie = (res.headers['set-cookie'] || []).find(c => c.startsWith('theme='));
        assert.ok(themeCookie, 'theme cookie should be set');
        assert.match(themeCookie, /SameSite=Lax/i);
    });

    it('GET / responds 500 instead of hanging when the audio tree is unreadable', async () => {
        const app = createApp();
        const { jar } = await login(app, 'user1', 'testpassword1');
        sinon.stub(fs.promises, 'readdir').rejects(new Error('EACCES: permission denied'));
        try {
            const res = await request(app).get('/').set('Cookie', cookieHeader(jar));
            assert.equal(res.status, 500);
        } finally {
            sinon.restore();
        }
    });
});
