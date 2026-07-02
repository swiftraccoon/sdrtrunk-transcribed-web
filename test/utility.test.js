const assert = require('node:assert/strict');
const { extractDateFromFilename, isWithinDateRange } = require('../utility');

// Force a non-UTC zone so a UTC-vs-local parsing bug is observable regardless
// of where the suite runs. In America/Los_Angeles, 14:30 local != 14:30 UTC.
describe('filename timestamp parsing (local time)', () => {
    let originalTZ;
    before(() => { originalTZ = process.env.TZ; process.env.TZ = 'America/Los_Angeles'; });
    after(() => { process.env.TZ = originalTZ; });

    it('extractDateFromFilename reads the stamp as local wall-clock', () => {
        const d = extractDateFromFilename('20260701_143000_TO_9999_FROM_1.mp3');
        assert.equal(d.getFullYear(), 2026);
        assert.equal(d.getMonth(), 6); // July, 0-indexed
        assert.equal(d.getDate(), 1);
        assert.equal(d.getHours(), 14);
        assert.equal(d.getMinutes(), 30);
        assert.equal(d.getSeconds(), 0);
    });

    it('isWithinDateRange compares against local-time bounds', () => {
        const file = '20260701_143000_TO_9999_FROM_1.mp3';
        const start = new Date(2026, 6, 1, 14, 0, 0); // 14:00 local
        const end = new Date(2026, 6, 1, 15, 0, 0);   // 15:00 local
        assert.equal(isWithinDateRange(file, start, end), true);
        // 14:30 local must fall OUTSIDE a window that ends at 14:15 local
        assert.equal(isWithinDateRange(file, start, new Date(2026, 6, 1, 14, 15, 0)), false);
    });
});
