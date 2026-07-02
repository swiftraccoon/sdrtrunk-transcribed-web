const assert = require('node:assert/strict');
const request = require('supertest');
const createApp = require('../app');

describe('app harness', () => {
    it('serves the login page with a CSRF token', async () => {
        const res = await request(createApp()).get('/login');
        assert.equal(res.status, 200);
        assert.match(res.text, /name="_csrf" value="[^"]+"/);
    });
});
