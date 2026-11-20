import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseSpeed } from '../game/Course.js';
import { FamilyRace, RACE_TOP_SPEED, raceSpeedBonus, takeoverPercent } from '../game/FamilyRace.js';
import { RacePanel } from '../game/RacePanel.js';
import { familySchedule, RaceSchedule } from '../game/RaceSchedule.js';

const opening = familySchedule(null);
const fullLength = familySchedule(3000);

function runRace(rival, level, tapsPerSecond) {
    const race = new FamilyRace(rival, level);
    race.update(rival.countdown + .2);
    while (race.phase === 'racing') {
        if (tapsPerSecond) race.tap();
        race.update(tapsPerSecond ? 1 / tapsPerSecond : 1);
    }
    return race;
}

test('the opening campaign has five short heats in family order and a full-length final', () => {
    assert.deepEqual(opening.map(({ id, at, metres, countdown }) => [id, at, metres, countdown]), [
        ['junior', 34, 32, 2],
        ['ivanka', 80, 36, 2],
        ['eric', 139, 40, 2],
        ['tiffany', 214, 44, 2],
        ['barron', 307, 48, 2],
        ['donald', 421, 100, 3]
    ]);
    assert.deepEqual(opening.map(({ index }) => takeoverPercent(index + 1)), [17, 33, 50, 67, 83, 100]);
});

test('a clean campaign with five street returns reaches Donald in 55–80 seconds', async t => {
    for (const mode of ['day', 'night']) {
        const schedule = new RaceSchedule({
            getRecord: async () => ({ score: null }),
            claim: async score => ({ qualified: true, previousRecord: null, record: { score } })
        });
        await schedule.update(0, 0, 0);
        let distance = 0;
        let speed = courseSpeed(0, mode);
        let elapsed = 0;
        let resultAndReturnTime = 0;
        for (const rival of opening) {
            const streetStart = elapsed;
            while (!schedule.canEnter(rival, Math.floor(distance))) {
                speed = courseSpeed(distance + speed / 60, mode);
                distance += speed / 60;
                elapsed += 1 / 60;
                const request = schedule.update(Math.floor(distance), rival.index, elapsed);
                if (request) await request;
                assert.ok(elapsed < 80, 'reached the next heat');
            }
            if (rival.index) assert.ok(elapsed - streetStart >= 2);
            if (rival.id === 'donald') break;
            const heat = runRace(rival, 0, 6);
            assert.equal(heat.phase, 'won');
            elapsed += rival.countdown + heat.elapsed;
            schedule.returnedToStreet(elapsed);
            resultAndReturnTime += .65 + 3;
        }
        const total = elapsed + resultAndReturnTime;
        assert.ok(total >= 55 && total <= 80, `${mode} took ${total} seconds`);
        t.diagnostic(`${mode}: ${total.toFixed(2)} s to Donald at six taps/s`);
    }
});

test('countdown taps add no speed and the race clock starts at go', () => {
    const race = new FamilyRace(fullLength[0]);
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

test('every rival wins without taps at every race speed level and heat length', () => {
    for (const rival of [...opening, ...fullLength]) {
        for (let level = 0; level <= 5; level++) {
            const race = runRace(rival, level, 0);
            assert.equal(race.phase, 'lost');
            assert.equal(race.rivalProgress, 1);
            assert.equal(race.playerProgress, 0);
            assert.equal(race.elapsed, rival.finish);
        }
    }
});

test('each rival requires a faster tap cadence, and all are beatable at level zero', () => {
    const baseRates = [4.3, 4.5, 4.7, 4.9, 5.1, 5.3];
    for (const rival of [...opening, ...familySchedule(1500), ...fullLength]) {
        const rate = baseRates[rival.index];
        const won = runRace(rival, 0, rate);
        assert.equal(won.phase, 'won', rival.name);
        assert.equal(won.playerProgress, 1);
        assert.ok(won.rivalProgress < 1);
        assert.equal(won.distance, rival.metres);
        assert.equal(runRace(rival, 0, rate - .2).phase, 'lost', rival.name);
    }
});

test('each purchased level adds speed per tap and lowers the final rival cadence', () => {
    const finalRates = [5.3, 4.8, 4.4, 4.0, 3.7, 3.4];
    assert.deepEqual(finalRates.map((_, level) => raceSpeedBonus(level)), [0, 11, 22, 33, 44, 55]);
    for (const [level, rate] of finalRates.entries()) {
        assert.equal(runRace(opening[5], level, rate).phase, 'won');
        assert.equal(runRace(opening[5], level, rate - .2).phase, 'lost');
    }
});

test('taps build limited momentum and coasting slows the runner', () => {
    const race = new FamilyRace(opening[0]);
    race.update(race.countdown);
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
    const single = new FamilyRace(opening[4], 2);
    const split = new FamilyRace(opening[4], 2);
    for (const race of [single, split]) {
        race.update(race.countdown);
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
        const race = runRace(opening[0], 0, rate);
        const result = [race.phase, race.playerProgress, race.rivalProgress, race.speed, race.elapsed];
        assert.equal(race.tap(), false);
        race.update(60);
        assert.deepEqual([race.phase, race.playerProgress, race.rivalProgress, race.speed, race.elapsed], result);
    }
});

test('holding a sprint key through the countdown or race cannot win a heat', () => {
    for (const code of ['Space', 'ArrowUp', 'Enter']) {
        const race = new FamilyRace(opening[0], 5);
        const panel = Object.create(RacePanel.prototype);
        Object.assign(panel, {
            hud: { inert: false }, element: { hidden: false, dataset: { phase: race.phase } },
            tapButton: {}, pressedKeys: new Set(), onTap: () => race.tap()
        });
        const event = { code, target: panel.tapButton, preventDefault() {}, stopImmediatePropagation() {} };
        panel.keydown(event);
        race.update(race.countdown);
        panel.element.dataset.phase = race.phase;
        panel.keydown(event);
        assert.equal(race.speed, 0);
        panel.pressedKeys.delete(code); // keyup
        panel.keydown(event);
        assert.ok(race.speed > 0);
        while (race.phase === 'racing') {
            panel.keydown({ ...event, repeat: true });
            race.update(1 / 60);
        }
        assert.equal(race.phase, 'lost', code);
        assert.ok(race.distance < 4, 'one real press at maximum training');
    }
});
