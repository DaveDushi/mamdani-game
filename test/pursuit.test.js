import assert from 'node:assert/strict';
import test from 'node:test';
import { CATCH_GAP, GAP_MAX, GAP_START, HIT_COST, Pursuit } from '../game/Pursuit.js';
import { FAMILY_WIN_POINTS, FAMILY_WIN_STAMPS, ScoreManager } from '../game/ScoreManager.js';

const STEP = 1 / 60;
function pass(clock, seconds, ...rest) {
    const events = [];
    for (let i = 0; i < Math.round(seconds * 60); i++) {
        const event = clock.update(STEP, ...rest);
        if (event) events.push(event);
    }
    return events;
}

test('a first hit brings Trump in without catching, and the runner can shake him in a few seconds', () => {
    const chase = new Pursuit();
    assert.equal(chase.gap, GAP_START);
    assert.equal(chase.isChasing, false);
    chase.hit();
    assert.equal(chase.gap, GAP_START - HIT_COST);
    assert.ok(chase.isChasing && chase.hot);
    assert.deepEqual(pass(chase, 6), []);
    chase.cleanMove();
    chase.cleanMove();
    assert.deepEqual(pass(chase, 1), ['escaped']);
    assert.equal(chase.isChasing, false);
});

test('a good lead survives a hit outright and is capped', () => {
    const chase = new Pursuit();
    for (let i = 0; i < 40; i++) chase.cleanMove();
    assert.equal(chase.gap, GAP_MAX);
    chase.hit();
    assert.equal(chase.gap, 22);
    assert.equal(chase.isChasing, false);
});

test('the gap settles at twenty from either side while moves keep coming', () => {
    for (const start of [2, 26]) {
        const chase = new Pursuit();
        chase.gap = start;
        for (let i = 0; i < 30; i++) {
            pass(chase, 1);
            chase.idle = 0;
        }
        assert.equal(chase.gap, 20);
    }
});

test('dawdling lets him close in to ten metres and no nearer, and never counts as a recent hit', () => {
    const chase = new Pursuit();
    assert.deepEqual(pass(chase, 60), ['closing']);
    assert.equal(chase.gap, 10);
    assert.ok(chase.isChasing && !chase.hot);
    chase.stamp();
    assert.ok(chase.gap > 10);
    // Walking away from a dawdle is not an escape.
    assert.deepEqual(pass(chase, 7), []);
    assert.ok(chase.gap > CATCH_GAP);
});

test('a hit from near zero recovers even without another move', () => {
    const chase = new Pursuit();
    chase.gap = 18.4;
    chase.hit();
    pass(chase, 30);
    assert.equal(chase.gap, 10);
});

test('only a hit in the last four seconds holds up a race', () => {
    const chase = new Pursuit();
    chase.hit();
    pass(chase, 3.9);
    assert.equal(chase.hot, true);
    pass(chase, .2);
    assert.equal(chase.hot, false);
    assert.equal(chase.isChasing, true);
});

test('a sheltered runner never loses ground, and the free opening stumble stops well short of zero', () => {
    const chase = new Pursuit();
    pass(chase, 30, true);
    assert.equal(chase.gap, GAP_START);
    chase.hit(true);
    assert.equal(chase.gap, 10);
    chase.hit(true);
    assert.equal(chase.gap, 10);
});

test('intensity rises from silence to full as he closes', () => {
    const chase = new Pursuit();
    chase.gap = GAP_MAX;
    assert.equal(chase.intensity, 0);
    chase.gap = 0;
    assert.equal(chase.intensity, 1);
});

test('three chained moves raise the multiplier to five, and each move pays at the current rate', () => {
    const score = new ScoreManager();
    const streaks = Array.from({ length: 15 }, () => score.cleanMove());
    assert.deepEqual(streaks.map((paid, i) => paid && i).filter(Number.isInteger), [2, 5, 8, 11, 14]);
    assert.equal(score.multiplier, 5);
    // 2 x 10, 3 x 20, 3 x 30, 3 x 40, 4 x 50.
    assert.equal(score.stylePoints, 20 + 60 + 90 + 120 + 200);
    assert.equal(score.bestMultiplier, 5);
});

test('five quiet seconds slip one level and break the chain, and a hit resets everything', () => {
    const score = new ScoreManager();
    for (let i = 0; i < 8; i++) score.cleanMove();
    assert.deepEqual([score.multiplier, score.chain], [3, 2]);
    assert.equal(score.update(4.9, 0), false);
    score.cleanMove();
    assert.equal(score.multiplier, 4);
    assert.equal(score.update(5, 0), true);
    assert.deepEqual([score.multiplier, score.chain], [3, 0]);
    assert.equal(score.update(4.9, 0), false);
    assert.equal(score.update(.2, 0), true);
    assert.equal(score.multiplier, 2);
    assert.equal(score.hit(), true);
    assert.equal(score.multiplier, 1);
    assert.equal(score.hit(), false);
    score.cleanMove();
    assert.equal(score.update(6, 0), false);
    assert.equal(score.chain, 0);
    assert.equal(score.bestMultiplier, 4);
});

test('a frozen clock holds the multiplier while the metres keep counting', () => {
    const score = new ScoreManager();
    for (let i = 0; i < 3; i++) score.cleanMove();
    const style = score.stylePoints;
    assert.equal(score.update(40, 20.02, false), false);
    assert.equal(score.multiplier, 2);
    assert.equal(score.chainTime, 1);
    assert.equal(score.metres, 800);
    assert.equal(score.getDisplayScore(), 800 + style);
});

test('stamps earn style at the multiplier, a heatwave doubles it and family wins pay flat', () => {
    const score = new ScoreManager();
    for (let i = 0; i < 3; i++) score.cleanMove();
    const before = score.stylePoints;
    assert.equal(score.addStyle(5), 10);
    score.styleBoost = 2;
    assert.equal(score.addStyle(5), 20);
    score.addBonus(FAMILY_WIN_POINTS);
    assert.equal(score.stylePoints - before, 530);
    assert.deepEqual([...FAMILY_WIN_STAMPS], [5, 8, 12, 16, 20, 50]);
});

test('a ride lets a runner who was hit get clear and never closes the gap', () => {
    const chase = new Pursuit();
    chase.hit();
    for (let i = 0; i < 600; i++) chase.ride(STEP);
    assert.equal(chase.gap, 20);
    chase.gap = 35;
    chase.ride(STEP);
    assert.equal(chase.gap, 35);
});

test('steady expert play holds a lead near thirty metres rather than the cap', () => {
    const chase = new Pursuit();
    for (let i = 0; i < 60; i++) {
        pass(chase, 1);
        chase.cleanMove();
        chase.stamp();
    }
    assert.ok(chase.gap > 27 && chase.gap < 34, String(chase.gap));
});
