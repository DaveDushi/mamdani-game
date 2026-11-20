import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseSpeed } from '../game/Course.js';
import { FamilyRace, RACE_TOP_SPEED, RIVALS, raceSpeedBonus } from '../game/FamilyRace.js';

function runRace(index, level, tapsPerSecond) {
    const race = new FamilyRace(index, level);
    race.update(3.2);
    while (race.phase === 'racing') {
        if (tapsPerSecond) race.tap();
        race.update(tapsPerSecond ? 1 / tapsPerSecond : 1);
    }
    return race;
}

test('the six family races appear at increasingly spaced route milestones', () => {
    assert.deepEqual(RIVALS.map(({ id, name, at }) => [id, name, at]), [
        ['junior', 'Donald Trump Jr.', 1000],
        ['ivanka', 'Ivanka Trump', 2750],
        ['eric', 'Eric Trump', 5000],
        ['tiffany', 'Tiffany Trump', 7500],
        ['barron', 'Barron Trump', 10500],
        ['donald', 'Donald Trump', 14000]
    ]);
});

test('each race takes more street running time to reach in both modes', () => {
    for (const mode of ['day', 'night']) {
        let mark = 0;
        let priorLeg = 0;
        for (const { name, at } of RIVALS) {
            let seconds = 0;
            for (; mark < at; mark++) seconds += 1 / courseSpeed(mark + .5, mode);
            assert.ok(seconds > priorLeg, `${mode}: ${name}`);
            priorLeg = seconds;
        }
    }
});

test('countdown taps add no speed and the race clock starts at go', () => {
    const race = new FamilyRace(0, 0);
    assert.equal(race.countdown, 3);
    assert.equal(race.tap(), false);
    race.update(1);
    assert.equal(race.countdown, 2);
    race.update(1);
    assert.equal(race.countdown, 1);
    assert.equal(race.tap(), false);
    assert.equal(race.speed, 0);
    assert.equal(race.elapsed, 0);
    assert.equal(race.rivalProgress, 0);

    race.update(1.25);
    assert.equal(race.countdown, 0);
    assert.equal(race.phase, 'racing');
    assert.equal(race.elapsed, .25);
    assert.equal(race.playerProgress, 0);
    assert.ok(race.rivalProgress > 0);
    assert.equal(race.tap(), true);
    assert.ok(race.speed > 0);
});

test('every rival wins without taps at every race speed level', () => {
    for (const { index } of RIVALS) {
        for (let level = 0; level <= 5; level++) {
            const race = runRace(index, level, 0);
            assert.equal(race.phase, 'lost');
            assert.equal(race.rivalProgress, 1);
            assert.equal(race.playerProgress, 0);
            assert.ok(race.elapsed >= 8 && race.elapsed <= 12);
        }
    }
});

test('each rival requires a faster tap cadence, and all are beatable at level zero', () => {
    const baseRates = [4.3, 4.5, 4.7, 4.9, 5.1, 5.3];
    for (const { index, name } of RIVALS) {
        const rate = baseRates[index];
        const won = runRace(index, 0, rate);
        assert.equal(won.phase, 'won', name);
        assert.equal(won.playerProgress, 1);
        assert.ok(won.rivalProgress < 1);
        assert.equal(runRace(index, 0, rate - .2).phase, 'lost', name);
    }
});

test('each purchased level adds speed per tap and lowers the final rival cadence', () => {
    const finalRates = [5.3, 4.8, 4.4, 4.0, 3.7, 3.4];
    assert.deepEqual(finalRates.map((_, level) => raceSpeedBonus(level)), [0, 11, 22, 33, 44, 55]);
    for (const [level, rate] of finalRates.entries()) {
        assert.equal(runRace(5, level, rate).phase, 'won');
        assert.equal(runRace(5, level, rate - .2).phase, 'lost');
    }
});

test('taps build limited momentum and coasting slows the runner', () => {
    const race = new FamilyRace(0, 0);
    race.update(3);
    for (let tap = 0; tap < 10; tap++) assert.equal(race.tap(), true);
    assert.equal(race.speed, RACE_TOP_SPEED);
    race.update(.35);
    const afterCoast = race.speed;
    assert.ok(afterCoast < RACE_TOP_SPEED);
    assert.ok(race.playerProgress > 0);
    assert.ok(race.rivalProgress > 0);
    race.tap();
    assert.ok(race.speed > afterCoast);
});

test('coasting and finishing return the same positions at different update rates', () => {
    const single = new FamilyRace(4, 2);
    const split = new FamilyRace(4, 2);
    for (const race of [single, split]) {
        race.update(3);
        race.tap();
        race.tap();
    }
    single.update(15);
    for (let frame = 0; frame < 900; frame++) split.update(1 / 60);
    assert.equal(single.phase, 'lost');
    assert.equal(split.phase, 'lost');
    assert.ok(Math.abs(single.playerProgress - split.playerProgress) < 1e-10);
    assert.equal(single.rivalProgress, split.rivalProgress);
    assert.equal(single.elapsed, split.elapsed);
});

test('taps and later updates cannot change a finish', () => {
    for (const rate of [0, 6]) {
        const race = runRace(0, 0, rate);
        const result = [race.phase, race.playerProgress, race.rivalProgress, race.speed, race.elapsed];
        assert.equal(race.tap(), false);
        race.update(60);
        assert.deepEqual([race.phase, race.playerProgress, race.rivalProgress, race.speed, race.elapsed], result);
    }
});
