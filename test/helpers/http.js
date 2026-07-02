const request = require('supertest');

// Minimal cookie jar. supertest's agent won't replay Secure cookies over
// plain HTTP, so tests carry cookies explicitly between requests.
function updateJar(jar, res) {
    for (const line of res.headers['set-cookie'] || []) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1);
    }
    return jar;
}

const cookieHeader = (jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

// Fetch the login page to obtain a CSRF token + its cookie.
async function getCsrf(app, jar = {}) {
    const res = await request(app).get('/login');
    updateJar(jar, res);
    const match = res.text.match(/name="_csrf" value="([^"]+)"/);
    return { token: match && match[1], jar };
}

// Full login flow; returns the response plus a jar holding the session.
async function login(app, username, password) {
    const { token, jar } = await getCsrf(app);
    const res = await request(app)
        .post('/login')
        .set('Cookie', cookieHeader(jar))
        .type('form')
        .send({ username, password, _csrf: token });
    updateJar(jar, res);
    return { res, jar, token };
}

module.exports = { updateJar, cookieHeader, getCsrf, login };
