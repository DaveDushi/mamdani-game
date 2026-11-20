import assert from 'node:assert/strict';
import test from 'node:test';
import { offerDomainMove, receiveDomainMove } from '../game/DomainMove.js';

const cutoff = Date.UTC(2026, 10, 21, 14);

test('the expiring domain cannot request a transfer at or after the cutoff', async t => {
    const clock = t.mock.method(Date, 'now', () => cutoff);
    globalThis.location = { origin: 'https://mamdanirun.cc' };
    t.after(() => { delete globalThis.location; });
    for (const now of [cutoff, cutoff + 1]) {
        clock.mock.mockImplementation(() => now);
        // Neither page should need access to document, window.opener or saved data.
        await offerDomainMove();
        const status = {};
        receiveDomainMove(status);
        assert.match(status.textContent, /window has closed/);
    }
});

test('an open transfer page accepts only its original window and rejects even that window after expiry', async t => {
    let now = cutoff - 300;
    t.mock.method(Date, 'now', () => now);
    globalThis.location = { origin: 'https://mamdanirun.com' };
    const messages = [];
    const sender = { postMessage: (...args) => messages.push(args) };
    let listener;
    globalThis.window = {
        opener: sender,
        addEventListener: (_, callback) => { listener = callback; },
        removeEventListener: () => { listener = null; }
    };
    t.after(() => { delete globalThis.window; delete globalThis.location; });
    const status = { textContent: 'Waiting' };
    receiveDomainMove(status);
    assert.deepEqual(messages.map(([, origin]) => origin), ['https://mamdanirun.cc', 'https://www.mamdanirun.cc']);
    const copy = { source: sender, origin: 'https://mamdanirun.cc', data: { type: 'mamdani-save-copy' } };
    await listener({ ...copy, source: {} });
    await listener({ ...copy, origin: 'https://unrelated.example' });
    assert.equal(status.textContent, 'Waiting');
    now = cutoff;
    await listener(copy);
    assert.equal(status.textContent, 'Waiting');
    await new Promise(resolve => setTimeout(resolve, 320));
    assert.equal(listener, null);
    assert.match(status.textContent, /window has closed/);
});
