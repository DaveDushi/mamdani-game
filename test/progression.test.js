import assert from 'node:assert/strict';
import test from 'node:test';
import { NIGHT_SHIFT_STAMPS, availableMode, creditRun, emptyWallet, startAttempt } from '../game/Progression.js';
import { ScoreManager } from '../game/ScoreManager.js';

test('Night Shift unlocks at 30 banked stamps, and Day Run is always selectable', () => {
    assert.equal(NIGHT_SHIFT_STAMPS, 30);
    assert.equal(availableMode('night', emptyWallet), 'day');
    assert.equal(availableMode('night', { stamps: 29 }), 'day');
    assert.equal(availableMode('night', { stamps: 30 }), 'night');
    assert.equal(availableMode('day', { stamps: 30 }), 'day');
    assert.equal(availableMode('unknown', { stamps: 200 }), 'day');
});

test('the after-tax remainder crosses the threshold once per run, including repeat callbacks', async () => {
    let wallet = { stamps: 27, nightBest: 0 };
    const bank = async run => {
        await Promise.resolve();
        wallet = creditRun(wallet, run);
        return wallet;
    };
    const day = startAttempt('day', bank);
    const score = new ScoreManager();
    score.addFoodStamps(5);
    assert.equal(score.applyFinalTax(), 2);
    const first = day.bank(score.foodStamps, 470);
    assert.equal(day.bank(score.foodStamps, 470), first);
    assert.deepEqual(await first, { stamps: 30, nightBest: 0 });
    const replay = startAttempt('day', bank);
    await replay.bank(2, 375);
    await day.bank(3, 470);
    assert.deepEqual(wallet, { stamps: 32, nightBest: 0 });
});

test('both modes contribute to the wallet, only Night Shift distances count for its best', () => {
    let wallet = { stamps: 30, nightBest: 0 };
    for (const [mode, kept, distance] of [
        ['night', 2, 200], ['day', 5, 800], ['night', 0, 125], ['night', 3, 240]
    ]) {
        wallet = creditRun(wallet, { mode, kept, distance });
    }
    assert.deepEqual(wallet, { stamps: 40, nightBest: 240 });
});
