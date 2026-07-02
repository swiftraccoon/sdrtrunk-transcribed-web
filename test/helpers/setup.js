// Runs before any test file loads (wired via .mocharc.yml `require`).
// Must set env + config BEFORE application modules are required, because
// database.js and email.js read their configuration at module load.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const TMP_DIR = path.join(ROOT, 'test', '.tmp');
const CONFIG_PATH = path.join(ROOT, 'config.js');
const EXAMPLE_CONFIG_PATH = path.join(ROOT, 'example.config.js');
const GENERATED_MARKER = '// AUTO-GENERATED-FOR-TESTS';

// Point the app at a scratch database so tests never touch live data.
fs.rmSync(TMP_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_DIR, { recursive: true });
process.env.SDRTW_DB_PATH = path.join(TMP_DIR, 'subscriptions.test.db');

// Provide config.js from the example when absent. Never clobber a real
// operator config (identified by the missing marker line).
const TEST_OVERRIDES = [
    '',
    '// Test-only overrides appended by test/helpers/setup.js',
    'module.exports.secureCookies = false; // supertest speaks plain HTTP',
    'module.exports.rateLimitMax = 1000; // suites share one IP; individual limiter tests lower this locally',
    'module.exports.loginRateLimitMax = 1000;',
    'module.exports.staticRateLimitMax = 10000;',
    '// Cost-4 hashes of testpassword1/2 — same passwords as the example, but',
    "// ~2ms per compare instead of ~200ms so the suite doesn't crawl.",
    'module.exports.users = [',
    `  { username: 'user1', passwordHash: '$2b$04$rNQJBWXMuYLvYJwiqEf3Q.O4ihaFuSOrkAeUG1gJC8pseMfQA3ca.' },`,
    `  { username: 'user2', passwordHash: '$2b$04$5SkIAZ9T3ZxWU4zqrlH5TOWSvG7NLPKo9c1KgCu4LeNzQkgBuXZLC' },`,
    '];',
    ''
].join('\n');

if (fs.existsSync(CONFIG_PATH) && !fs.readFileSync(CONFIG_PATH, 'utf8').startsWith(GENERATED_MARKER)) {
    console.warn('[test setup] Using existing config.js (not test-generated); auth tests may not match its users.');
} else {
    // (Re)generate so example.config.js changes propagate to test runs.
    const example = fs.readFileSync(EXAMPLE_CONFIG_PATH, 'utf8');
    fs.writeFileSync(CONFIG_PATH, `${GENERATED_MARKER}\n${example}${TEST_OVERRIDES}`);
}

// Fixture directories for routes that read the audio/transcription tree.
// These specific paths are already gitignored.
const FIXTURE_TG = '9999';
const AUDIO_DIR = path.join(ROOT, 'public', 'audio', FIXTURE_TG);
const TRANSCRIPTION_DIR = path.join(ROOT, 'public', 'transcriptions', FIXTURE_TG);
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(TRANSCRIPTION_DIR, { recursive: true });

module.exports = {
    ROOT,
    TMP_DIR,
    FIXTURE_TG,
    AUDIO_DIR,
    TRANSCRIPTION_DIR
};
