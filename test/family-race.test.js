import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseSpeed } from '../game/Course.js';
import { FamilyRace, RACE_TOP_SPEED, raceSpeedBonus, RIVALS, takeoverPercent } from '../game/FamilyRace.js';
import { raceTricks } from '../game/RaceTricks.js';
import { RacePanel } from '../game/RacePanel.js';
import { familySchedule, RaceSchedule } from '../game/RaceSchedule.js';

const opening = familySchedule(null);
const [junior, ivanka, eric, tiffany, barron, donald] = opening;
const FRAME = 1 / 60;

function generator(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// A fast-tapping player. `hz` is taps a second, `stop` the delay in lifting off after red and `hop` in
// finding a moved pad. `slip` is the chance of landing on the same foot.
function runRace(rival, level, hz, seed = 1, { stop = .26, hop = .3, slip = .05 } = {}) {
    const race = new FamilyRace(rival, level, false, { seed });
    race.update(rival.countdown);
    const draw = generator(seed * 31 + rival.index);
    let next = hz ? .18 + .1 * draw() : Infinity, foot = -1;
    while (race.phase === 'racing') {
        race.update(1 / 120);
        const t = race.elapsed;
        if (t < next) continue;
        next += (1 + .25 * (draw() - .5)) / hz;
        const now = race.windowAt(t);
        if (now?.kind === 'stop' && t - now.from >= stop) {
            next = now.to + .15;
            continue;
        }
        let side = 0;
        if (now?.kind === 'side') side = race.windowAt(Math.max(0, t - hop)).side;
        if (now?.kind === 'feet') side = foot = draw() < slip ? foot : -foot;
        race.tap(side);
    }
    return race;
}

function winRate(rival, level, hz, hand, heats = 60) {
    let wins = 0;
    for (let seed = 1; seed <= heats; seed++) wins += runRace(rival, level, hz, seed, hand).phase === 'won';
    return wins / heats;
}

function started(rival, level = 0, options) {
    const race = new FamilyRace(rival, level, false, options);
    race.update(rival.countdown);
    return race;
}

function advanceTo(race, time) {
    while (race.phase === 'racing' && race.elapsed < time - 1e-9) race.update(Math.min(FRAME, time - race.elapsed));
}

test('the five children wait at fixed metres whatever the record, with fixed heat lengths', () => {
    for (const record of [null, 200, 19500, 60000]) {
        const schedule = familySchedule(record);
        assert.deepEqual(schedule.slice(0, 5).map(({ id, at, metres, countdown }) => [id, at, metres, countdown]), [
            ['junior', 1000, 64, 3],
            ['ivanka', 3500, 72, 3],
            ['eric', 7500, 80, 3],
            ['tiffany', 12500, 88, 3],
            ['barron', 18500, 98, 3]
        ]);
        const last = schedule[5];
        assert.deepEqual([last.id, last.record, last.target, last.metres], ['donald', true, Math.max(12000, record ?? 0), 100]);
    }
    assert.deepEqual(opening.map(({ index }) => takeoverPercent(index + 1)), [17, 33, 50, 67, 83, 100]);
    assert.deepEqual(RIVALS.map(({ prize }) => prize), [5, 8, 12, 16, 20, 50]);
});

test('every road leg is longer than the last, with real breathing room before each heat', async t => {
    for (const mode of ['day', 'night']) {
        const schedule = new RaceSchedule({
            getRecord: async () => ({ score: null }),
            claim: async score => ({ qualified: true, previousRecord: null, record: { score } })
        });
        await schedule.update(0, 0, 0);
        let distance = 0;
        let points = 0;
        let speed = courseSpeed(0, mode);
        let elapsed = 0;
        let resultAndReturnTime = 0;
        const streetLegs = [];
        for (const rival of schedule.rivals) {
            const streetStart = elapsed;
            while (!schedule.canEnter(rival, Math.floor(distance))) {
                speed = courseSpeed(distance + speed / 60, mode);
                distance += speed / 60;
                // A tidy run picks up about a third again in style.
                points += 1.33 * speed / 60;
                elapsed += 1 / 60;
                const request = schedule.update(Math.floor(points), rival.index, elapsed, Math.floor(distance));
                if (request) await request;
                assert.ok(elapsed < 600, 'reached the next heat');
            }
            const streetTime = elapsed - streetStart;
            assert.ok(streetTime > 15, `${mode}: ${rival.name} at ${streetTime} s`);
            streetLegs.push(streetTime);
            if (rival.id === 'donald') break;
            const heat = runRace(rival, 0, 9);
            assert.equal(heat.phase, 'won');
            points += 500;
            elapsed += rival.countdown + heat.elapsed;
            schedule.returnedToStreet(elapsed);
            resultAndReturnTime += .65 + 3;
        }
        const total = elapsed + resultAndReturnTime;
        const [first, ...later] = streetLegs;
        assert.ok(first >= 28 && first <= 38, String(first));
        assert.ok(later.every(seconds => seconds >= 40 - .1));
        for (let i = 1; i < 5; i++) assert.ok(streetLegs[i] > streetLegs[i - 1] + 5, `${mode} ${streetLegs}`);
        assert.ok(total >= 330 && total <= 480, `${mode} took ${total} seconds`);
        t.diagnostic(`${mode}: road legs ${streetLegs.map(seconds => seconds.toFixed(1)).join(', ')} s, ${total.toFixed(1)} s to Donald`);
    }
});

test('countdown taps add no speed and the race clock starts at go', () => {
    const race = new FamilyRace(junior);
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
    assert.equal(race.tap(0), 'step');
    assert.ok(race.speed > 0);
});

test('each race waits on the ready screen until the player starts it', () => {
    const race = new FamilyRace(junior, 0, true);
    race.update(30);
    assert.equal(race.phase, 'ready');
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
});

test('every rival explains a different rule on the ready screen', () => {
    for (const key of ['line', 'rule']) {
        assert.equal(new Set(RIVALS.map(rival => rival[key])).size, 6);
        assert.ok(RIVALS.every(rival => rival[key].length > 20 && !/[—–]/.test(rival[key])));
    }
});

test('each rival brings a distinct trick and Junior brings none', () => {
    const kinds = rival => [...new Set(raceTricks(rival, 3).map(({ kind }) => kind))].sort().join();
    assert.deepEqual(opening.map(kinds), ['', 'gold', 'stop', 'side', 'feet', 'feet,gold,stop']);
    for (const rival of opening) {
        for (let seed = 1; seed <= 60; seed++) {
            const windows = raceTricks(rival, seed);
            windows.forEach(({ from, to }, i) => {
                assert.ok(to > from && (!i || from >= windows[i - 1].to - 1e-9), rival.name);
            });
            for (const { from, to } of windows.filter(({ kind }) => kind === 'stop')) {
                assert.ok(from > 1.5 && to - from < .95, 'a red light is short and never on the start');
            }
        }
    }
    assert.ok(raceTricks(eric).length >= 4);
    const pads = raceTricks(tiffany, 5);
    assert.ok(pads.every(({ side }, i) => !i || side !== pads[i - 1].side), 'the pad always moves');
});

test('replays redraw the tricks but the same seed repeats them', () => {
    const draw = seed => JSON.stringify(raceTricks(eric, seed));
    assert.equal(draw(4), draw(4));
    assert.ok(new Set([1, 2, 3, 4, 5, 6].map(draw)).size > 2);
});

test('faster tapping is faster, for every rival', () => {
    for (const rival of opening) {
        const pace = hz => {
            const race = runRace(rival, 0, hz, 2, { slip: 0 });
            return race.distance / race.elapsed;
        };
        for (const [slow, quick] of [[3, 4.5], [4.5, 6], [6, 7.5]]) assert.ok(pace(quick) > pace(slow), rival.name);
    }
});

test('a tap on red trips the runner, reaction time is free and the warning comes first', () => {
    const race = started(eric);
    const red = race.windows[0];
    advanceTo(race, red.from - .3);
    assert.equal(race.mode, 'warn');
    for (let i = 0; i < 3; i++) {
        advanceTo(race, red.from - .28 + .09 * i);
        assert.equal(race.tap(0), 'step');
    }
    advanceTo(race, red.from + .2);
    assert.equal(race.mode, 'stop');
    assert.equal(race.tap(0), false);
    assert.equal(race.faults, 0);
    advanceTo(race, red.from + .4);
    const { speed } = race;
    assert.equal(race.tap(0), 'stop');
    assert.equal(race.speed, .4 * speed);
    advanceTo(race, red.to + .02);
    assert.equal(race.tap(0), false, 'still finding both feet');
    advanceTo(race, red.from + 1.6);
    assert.equal(race.tap(0), 'step');
});

test('gold taps carry half again', () => {
    const at = time => {
        const race = started(ivanka);
        advanceTo(race, time);
        race.tap(0);
        return race.speed;
    };
    const { from } = raceTricks(ivanka)[0];
    assert.ok(Math.abs(at(from + .1) / at(.5) - 1.5) < 1e-9);
});

test('Tiffany counts only the lit pad, with a moment to find it', () => {
    const race = started(tiffany);
    const [first, second] = race.windows;
    assert.equal(race.pad, first.side);
    advanceTo(race, first.to - .2);
    assert.equal(race.nextPad, second.side);
    advanceTo(race, second.from + .1);
    assert.equal(race.tap(first.side), 'step');
    advanceTo(race, second.from + .4);
    const { speed } = race;
    assert.equal(race.tap(first.side), 'side');
    assert.equal(race.speed, speed);
    assert.equal(race.tap(second.side), 'step');
});

test('Barron wants alternate feet and a switch that cannot aim still runs', () => {
    const race = started(barron);
    const steps = [-1, -1, 1, 0, 1, -1].map((side, i) => {
        advanceTo(race, .5 + .12 * i);
        return race.tap(side);
    });
    assert.deepEqual(steps, ['step', 'foot', 'step', 'foot', 'foot', 'step']);
    const aimless = started(barron);
    for (let i = 0; i < 4; i++) {
        advanceTo(aimless, .5 + .12 * i);
        assert.equal(aimless.tap(null), 'step');
    }
});

test('two fingers landing together are one step, and fast thumbs are not blocked', () => {
    const race = started(junior);
    advanceTo(race, .5);
    assert.equal(race.tap(0), 'step');
    race.update(.01);
    assert.equal(race.tap(0), false);
    for (let i = 1; i <= 13; i++) {
        advanceTo(race, .5 + .07 * i);
        assert.equal(race.tap(0), 'step');
    }
    assert.equal(race.rate, 14);
    assert.equal(race.bestRate, 14);
});

test('Donald jumps the gun, stalls for a recount and still never moves backward', () => {
    const race = new FamilyRace(donald);
    race.update(donald.countdown - .7);
    assert.equal(race.rivalProgress, 0);
    race.update(.5);
    assert.equal(race.phase, 'intro');
    assert.ok(race.rivalProgress > 0);
    race.update(.21);
    let last = 0, stalled = 0, fastest = 0;
    while (race.phase === 'racing') {
        race.update(FRAME);
        const step = race.rivalProgress - last;
        assert.ok(step >= 0);
        if (last) fastest = Math.max(fastest, step);
        if (race.rivalStanding) {
            stalled++;
            assert.ok(step < .0004);
        }
        last = race.rivalProgress;
    }
    assert.ok(stalled * FRAME > 1);
    assert.equal(race.rivalProgress, 1);
    assert.ok(fastest * donald.metres / FRAME < 16);
});

test('every rival wins without taps at every training level', () => {
    for (const rival of opening) {
        for (let level = 0; level <= 5; level++) {
            const race = runRace(rival, level, 0);
            assert.equal(race.phase, 'lost');
            assert.equal(race.rivalProgress, 1);
            assert.equal(race.playerProgress, 0);
            assert.ok(Math.abs(race.elapsed - rival.finish) < 1e-9);
        }
    }
});

test('fast tapping wins, slow tapping loses, and training brings the family within reach', t => {
    const table = {};
    for (const hz of [4, 5.2, 6.2, 7, 8]) {
        for (const level of [0, 3, 5]) table[hz + '@' + level] = opening.map(rival => winRate(rival, level, hz));
    }
    for (const [name, rates] of Object.entries(table)) t.diagnostic(`${name}: ${rates.map(rate => Math.round(100 * rate) + '%').join(' ')}`);
    assert.ok(table['8@0'].every(rate => rate > .85), 'eight a second beats everyone untrained');
    assert.ok(table['4@0'].every(rate => rate < .1), 'four a second beats nobody untrained');
    assert.ok(table['5.2@0'][0] > .7 && table['5.2@0'][3] < .1);
    assert.ok(table['6.2@0'][1] > .9 && table['6.2@0'][4] < .2);
    assert.ok(table['6.2@3'].slice(0, 5).every(rate => rate > .75));
    assert.ok(table['6.2@5'].every(rate => rate > .9));
    for (const hz of [5.2, 6.2, 7]) {
        for (let i = 0; i < 6; i++) assert.ok(table[hz + '@5'][i] >= table[hz + '@0'][i] - .02, 'training never hurts');
    }
});

test('each trick defeats a player who ignores it', () => {
    for (const hz of [6, 8, 10, 14]) {
        assert.ok(winRate(eric, 0, hz, { stop: 9 }, 25) < .1, `tapping through red at ${hz}`);
        for (const [rival, side] of [[tiffany, 0], [barron, -1]]) {
            const race = started(rival);
            for (let i = 1; race.phase === 'racing'; i++) {
                advanceTo(race, i / hz);
                race.tap(side);
            }
            assert.equal(race.phase, 'lost', rival.name);
        }
    }
});

test('each training level adds eleven percent to a tap', () => {
    const speeds = [0, 1, 2, 3, 4, 5].map(level => {
        const race = started(junior, level);
        advanceTo(race, .5);
        race.tap(0);
        return race.speed;
    });
    speeds.forEach((speed, level) => {
        assert.equal(raceSpeedBonus(level), 11 * level);
        assert.ok(Math.abs(speed - speeds[0] * (1 + .11 * level)) < 1e-9);
        assert.ok(speed < RACE_TOP_SPEED);
    });
});

test('coasting and finishing return the same positions at different update rates', () => {
    const single = started(barron, 2);
    const split = started(barron, 2);
    for (const race of [single, split]) {
        race.update(.8);
        race.tap(-1);
    }
    single.update(15);
    for (let frame = 0; frame < 900; frame++) split.update(1 / 60);
    assert.equal(single.phase, 'lost');
    assert.equal(split.phase, 'lost');
    assert.ok(Math.abs(single.playerProgress - split.playerProgress) < 1e-10);
    assert.equal(single.rivalProgress, split.rivalProgress);
    assert.ok(Math.abs(single.elapsed - split.elapsed) < 1e-9);
});

test('the last strides to the tape need no taps, and a tight one is a photo finish', () => {
    const race = started(junior);
    for (let i = 1; !race.leaning; i++) {
        advanceTo(race, i / 9);
        race.tap(0);
    }
    assert.equal(race.leaning, true);
    const { speed, faults } = race;
    race.update(FRAME);
    assert.equal(race.speed, speed);
    while (race.phase === 'racing') race.update(FRAME);
    assert.equal(race.phase, 'won');
    assert.equal(race.faults, faults);
    assert.equal(race.photoFinish, false);
    race.elapsed = junior.finish - .12;
    assert.equal(race.photoFinish, true);
});

test('taps and later updates cannot change a finish', () => {
    for (const hz of [0, 9]) {
        const race = runRace(junior, 0, hz);
        const result = [race.phase, race.playerProgress, race.rivalProgress, race.speed, race.elapsed];
        assert.equal(race.tap(), false);
        race.update(60);
        assert.deepEqual([race.phase, race.playerProgress, race.rivalProgress, race.speed, race.elapsed], result);
    }
});

test('holding a sprint key through the countdown or race cannot win a heat', () => {
    for (const code of ['Space', 'ArrowUp', 'Enter']) {
        const race = new FamilyRace(junior, 5);
        const panel = Object.create(RacePanel.prototype);
        Object.assign(panel, {
            hud: { inert: false }, element: { hidden: false, dataset: { phase: race.phase } },
            tapButton: {}, pressedKeys: new Set(), onTap: side => race.tap(side)
        });
        const event = { code, target: panel.tapButton, preventDefault() {}, stopImmediatePropagation() {} };
        panel.keydown(event);
        race.update(race.countdown);
        panel.element.dataset.phase = race.phase;
        advanceTo(race, .8);
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
        assert.ok(race.distance < 6, 'one real press at maximum training');
    }
});
