import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseSpeed } from '../game/Course.js';
import { FamilyRace, RACE_TOP_SPEED, raceSpeedBonus, takeoverPercent } from '../game/FamilyRace.js';
import { RacePanel } from '../game/RacePanel.js';
import { familySchedule, PRESSURE_CAP_METRES, RaceSchedule } from '../game/RaceSchedule.js';

const opening = familySchedule(null);
const fullLength = familySchedule(PRESSURE_CAP_METRES);

function runRace(rival, level, tapsPerSecond) {
    const race = new FamilyRace(rival, level);
    race.update(rival.countdown + .2);
    while (race.phase === 'racing') {
        if (tapsPerSecond) race.tap();
        race.update(tapsPerSecond ? 1 / tapsPerSecond : 1);
    }
    return race;
}

test('opening races grow in length and keep the five children ahead of Donald', () => {
    assert.deepEqual(opening.map(({ id, at, metres, countdown }) => [id, at, metres, countdown]), [
        ['junior', 650, 64, 3],
        ['ivanka', 1670, 72, 3],
        ['eric', 2975, 80, 3],
        ['tiffany', 4650, 88, 3],
        ['barron', 6650, 98, 3],
        ['donald', 9001, 100, 3]
    ]);
    assert.deepEqual(opening.map(({ index }) => takeoverPercent(index + 1)), [17, 33, 50, 67, 83, 100]);
});

test('a clean opener gives progressively longer street legs and reaches Donald in about four minutes', async t => {
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
        const streetLegs = [];
        for (const rival of opening) {
            const streetStart = elapsed;
            while (!schedule.canEnter(rival, Math.floor(distance))) {
                speed = courseSpeed(distance + speed / 60, mode);
                distance += speed / 60;
                elapsed += 1 / 60;
                const request = schedule.update(Math.floor(distance), rival.index, elapsed);
                if (request) await request;
                assert.ok(elapsed < 260, 'reached the next heat');
            }
            const streetTime = elapsed - streetStart;
            assert.ok(streetTime > (streetLegs.at(-1) ?? 0), `${mode}: ${rival.name} at ${streetTime} s`);
            streetLegs.push(streetTime);
            if (rival.id === 'donald') break;
            const heat = runRace(rival, 0, 8);
            assert.equal(heat.phase, 'won');
            elapsed += rival.countdown + heat.elapsed;
            schedule.returnedToStreet(elapsed);
            resultAndReturnTime += .65 + 3;
        }
        const total = elapsed + resultAndReturnTime;
        const [first, ...later] = streetLegs;
        assert.ok(first >= (mode === 'day' ? 20 : 15) && first <= 30);
        assert.ok(later.every(seconds => seconds >= 18));
        assert.ok(total >= 195 && total <= 260, `${mode} took ${total} seconds`);
        t.diagnostic(`${mode}: road legs ${streetLegs.map(seconds => seconds.toFixed(1)).join(', ')} s, ${total.toFixed(1)} s to Donald`);
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

test('the first race waits at the tutorial until the player is ready', () => {
    const race = new FamilyRace(opening[0], 0, true);
    race.update(30);
    assert.equal(race.phase, 'tutorial');
    assert.equal(race.elapsed, 0);
    assert.equal(race.tap(), false);
    assert.equal(race.ready(), true);
    assert.equal(race.phase, 'intro');
    assert.equal(race.countdown, 3);
    race.update(1);
    assert.equal(race.ready(), false);
    assert.equal(race.countdown, 2);
    race.update(2);
    assert.equal(race.phase, 'racing');
    assert.equal(race.tap(), true);
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
    const fastestRequired = [4.9, 5.5, 6.2, 6.9, 7.7, 8.0];
    const losingPaces = [4.7, 5.2, 5.9, 6.5, 7.2, 7.4];
    for (const rival of [...opening, ...familySchedule(19500), ...fullLength]) {
        const rate = fastestRequired[rival.index];
        const won = runRace(rival, 0, rate);
        assert.equal(won.phase, 'won', rival.name);
        assert.equal(won.playerProgress, 1);
        assert.ok(won.rivalProgress < 1);
        assert.equal(won.distance, rival.metres);
        assert.equal(runRace(rival, 0, losingPaces[rival.index]).phase, 'lost', rival.name);
    }
});

test('each purchased level adds speed per tap and lowers the final rival cadence', () => {
    const finalRates = [7.55, 7.03, 6.66, 6.38, 6.16, 6];
    assert.deepEqual(finalRates.map((_, level) => raceSpeedBonus(level)), [0, 11, 22, 33, 44, 55]);
    const launchSpeeds = finalRates.map((_, level) => {
        const race = new FamilyRace(opening[5], level);
        race.update(race.countdown);
        race.tap();
        return race.speed;
    });
    for (const [level, rate] of finalRates.entries()) {
        assert.ok(Math.abs(launchSpeeds[level] - launchSpeeds[0] * (1 + level * .11)) < 1e-10);
        assert.equal(runRace(opening[5], level, rate).phase, 'won');
        assert.equal(runRace(opening[5], level, rate - .12).phase, 'lost');
    }
});

test('steady moderate tapping loses the last two races even with all training', () => {
    for (const schedule of [opening, fullLength]) {
        for (const rival of schedule.slice(-2)) {
            assert.equal(runRace(rival, 5, 5).phase, 'lost');
            assert.equal(runRace(rival, 5, 5.5).phase, 'lost');
        }
        assert.equal(runRace(schedule.at(-1), 5, 6.5).phase, 'won');
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
