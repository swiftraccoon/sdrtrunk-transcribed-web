const assert = require('node:assert/strict');
const sinon = require('sinon');
const config = require('../config');
const { sendEmailWithRateLimit, transporter } = require('../email');

describe('email', () => {
    afterEach(() => sinon.restore());

    it('configures SMTP to require STARTTLS', () => {
        assert.equal(transporter.options.requireTLS, true);
    });

    it('propagates transport failures to the caller', async () => {
        sinon.stub(transporter, 'sendMail').rejects(new Error('SMTP down'));
        await assert.rejects(
            () => sendEmailWithRateLimit('a@example.com', 'subject', 'body'),
            /SMTP down/
        );
    });

    it('fails loudly when the outbound rate limit is reached', async () => {
        const sendMailStub = sinon.stub(transporter, 'sendMail').resolves({});
        const saved = config.maxHourlyEmails;
        config.maxHourlyEmails = 0;
        try {
            await assert.rejects(
                () => sendEmailWithRateLimit('a@example.com', 'subject', 'body'),
                /rate limit/i
            );
            assert.equal(sendMailStub.callCount, 0);
        } finally {
            config.maxHourlyEmails = saved;
        }
    });
});
