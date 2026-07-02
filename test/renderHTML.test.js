const assert = require('node:assert/strict');
const renderHTML = require('../renderHTML');
const { escapeHTML } = require('../utility');

const render = (transcription, id = '9999') => renderHTML(
    [{
        id,
        audio: `/public/audio/${id}/20260701_120000_TO_${id}_FROM_12345.mp3`,
        transcription,
        timestamp: new Date('2026-07-01T12:00:00Z')
    }],
    '2026-07-01', '10:00', '2026-07-02', '10:00',
    [''], [''], 'gray', 'test-csrf-token'
);

describe('escapeHTML', () => {
    it('escapes all HTML-significant characters', () => {
        assert.equal(
            escapeHTML(`<img src=x onerror="alert('1')" & more>`),
            '&lt;img src=x onerror=&quot;alert(&#39;1&#39;)&quot; &amp; more&gt;'
        );
    });

    it('stringifies non-string input', () => {
        assert.equal(escapeHTML(9999), '9999');
    });
});

describe('renderHTML', () => {
    it('escapes HTML in transcription content', () => {
        const html = render('<script>alert(1)</script>');
        assert.ok(!html.includes('<script>alert(1)</script>'), 'raw script tag must not appear');
        assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped form should appear');
    });

    it('escapes quote characters in talkgroup ids', () => {
        const html = render('hello', `9999') <bad`);
        assert.ok(!html.includes(`9999') <bad`), 'raw id must not appear in markup');
    });

    it('never interpolates ids into inline event handlers (HTML entities decode before JS runs)', () => {
        const html = render('hello', `x');alert(1);('`);
        assert.ok(!html.includes("onclick=\"updateTGIDFilterAndRefresh("),
            'ids must be carried via data attributes, not inline onclick');
        assert.ok(!html.includes("onclick=\"updateRIDFilterAndRefresh("),
            'rids must be carried via data attributes, not inline onclick');
        assert.match(html, /data-tgid="x&#39;\);alert\(1\);\(&#39;"/,
            'id should appear HTML-escaped in a data attribute');
    });

    it('still renders plain transcriptions untouched', () => {
        const html = render('Engine 5 responding to Main St');
        assert.ok(html.includes('Engine 5 responding to Main St'));
    });
});
