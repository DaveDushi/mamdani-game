import assert from 'node:assert/strict';
import test from 'node:test';
import { frontPage } from '../game/CityWire.js';

test('Overtime changes the headline and keeps the collision story for that edition', () => {
    for (const [cause, edition, story] of [
        ['taxi', 2, 'Mayor seizes means of transportation.'],
        ['railGate', 1, 'Ticket rail beats the mayor.'],
        ['halal', 0, 'Free lunch comes with a catch.'],
        ['protestor', 3, 'March divides over who gets the microphone.']
    ]) {
        const ordinary = frontPage(cause, edition);
        assert.equal(ordinary[0], 'Trump returns.');
        assert.ok(ordinary[1].startsWith(story));
        assert.deepEqual(frontPage(cause, edition, true), ['Mamdani keeps NYC.', ordinary[1]]);
    }
});
