import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Box3, Group, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { courseSpeed, streetCourse } from '../game/Course.js';
import { stretchLine, stretchThemes } from '../game/Stretches.js';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { Player } from '../game/Player.js';
import { RunnerModel } from '../game/RunnerModel.js';
import { PowerupManager, pickupGlow } from '../game/PowerupManager.js';
import { busSeconds } from '../game/BusRide.js';
import { World } from '../game/World.js';
import { ICE_STEERING_SECONDS } from '../game/RentIce.js';

const step = 1 / 60;
const lanes = [0, 1, 2];
const noOp = () => {};

test('both courses introduce an actual compulsory stunt after the opening', () => {
    for (const mode of ['day', 'night']) {
        const events = layout(1, 25, mode);
        const first = events.find(row => row.gate);
        assert.equal(first?.gate, mode === 'day' ? 'jumpAll' : 'jump', mode);
        assert.ok(first.distance < 140, mode);
        assert.equal(first.exitLane, undefined);
    }
});

test('both shifts mix bottles and recurring moving hazards into the first 1,200 metres', () => {
    for (const mode of ['day', 'night']) {
        let bottles = 0;
        let runsWithRepeat = 0;
        for (let seed = 1; seed <= 64; seed++) {
            const early = layout(seed, 70, mode).filter(row => row.distance <= 1200);
            const bottleRows = early.filter(row => row.lanes?.includes('alcohol'));
            assert.ok(bottleRows[0]?.distance <= 240, `${mode}, seed ${seed}`);
            assert.ok(bottleRows.every(row => row.lanes[row.exitLane] !== 'alcohol'));
            bottles += bottleRows.length;
            const crews = early.filter(row => ['delivery-dolly', 'signal-boom', 'horse-carriage'].includes(row.encounter?.id));
            if (crews.length > 2) runsWithRepeat++;
        }
        assert.ok(bottles / 64 >= 3, mode);
        assert.ok(runsWithRepeat >= 60, mode + runsWithRepeat);
    }
});

function seededRandom(seed) {
    let state = seed * 0x9e3779b9;
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function layout(seed, size, mode = 'day', firstRun = false) {
    const course = streetCourse(seededRandom(seed), mode, undefined, firstRun);
    return Array.from({ length: size }, () => course.next().value);
}

const everyLane = row => row.gate === 'jumpAll' || row.gate === 'slideAll';
const jumpProps = ['taxi', 'trashPile'];

function legalLanes(row) {
    if (row.gate) return lanes.filter(lane => row.lanes[lane] !== 'gateBlock');
    if (row.lesson) return lanes.filter(lane => !row.lanes[lane]);
    const side = row.actionLane ?? row.bonusLane;
    return side === undefined ? [row.exitLane] : [row.exitLane, side];
}

function worldWithoutScenery(mode = 'day') {
    const world = Object.assign(Object.create(World.prototype), {
        blocks: [],
        landmarks: { update: noOp, groups: [] },
        light: { update: noOp },
        setTakeover: noOp
    });
    world.reset(mode);
    return world;
}

test('both shifts gain speed through sixty kilometres and stay bounded in Overtime', () => {
    for (const mode of ['day', 'night']) {
        const world = worldWithoutScenery(mode);
        assert.equal(world.speed, mode === 'day' ? 17.5 : 29);
        let priorSpeed = world.speed;
        for (const checkpoint of [500, 2000, 5000, 10000, 30000, 60000]) {
            while (world.distance < checkpoint) world.update(step);
            assert.ok(world.speed > priorSpeed + 3);
            priorSpeed = world.speed;
        }
        const cap = mode === 'day' ? 82 : 85;
        assert.equal(courseSpeed(1000000, mode), cap);
        world.overtime = true;
        world.update(step);
        assert.equal(world.speed, cap * 1.1);
        world.reset();
        assert.equal(world.speed, 17.5);
    }
});

test('the day opening teaches one move at a time, with no walls and nothing before sixty metres', () => {
    const openings = new Set();
    for (const firstRun of [false, true]) {
        for (let seed = 1; seed <= 64; seed++) {
            const events = layout(seed, 40, 'day', firstRun);
            const rows = events.filter(row => row.lanes);
            const [move, jump, slide] = rows;
            openings.add(move.lanes[1] + move.exitLane);
            assert.ok(move.distance >= 60);
            assert.deepEqual([move.lanes[0], move.lanes[2]], [null, null]);
            assert.equal(move.lesson.cue, move.exitLane === 0 ? 'moveLeftCue' : 'moveRightCue');
            assert.deepEqual([jump.gate, jump.tutorial, jump.lanes], ['jumpAll', true, Array(3).fill('jumpGate')]);
            assert.deepEqual([slide.gate, slide.tutorial, slide.lanes], ['slideAll', true, Array(3).fill('slideGate')]);
            for (let i = 1; i < 3; i++) {
                assert.ok((rows[i].distance - rows[i - 1].distance) / courseSpeed(rows[i].distance) > 2.1);
            }
            assert.ok(rows.every(row => !row.lesson || row.lesson.lead / courseSpeed(row.distance) > 1));
            const stamps = events.filter(row => row.trail && row.distance < 230).reduce((sum, row) => sum + row.trail.length, 0);
            assert.ok(firstRun ? stamps >= 24 : stamps >= 10, `${firstRun} ${stamps}`);
            let seconds = 0;
            for (let at = 0; at < rows[3].distance; at++) seconds += 1 / courseSpeed(at);
            if (firstRun) assert.ok(seconds > 10, String(seconds));
        }
    }
    assert.ok(openings.size >= 8);
});

test('late sequences mix more actions without removing any route or recovery window', () => {
    const expected = {
        jump: ['gateBlock', 'gateBlock', 'jumpGate'],
        slide: ['gateBlock', 'gateBlock', 'slideGate'],
        choice: ['gateBlock', 'jumpGate', 'slideGate'],
        rail: ['gateBlock', 'gateBlock', 'railGate'],
        jumpAll: ['jumpGate', 'jumpGate', 'jumpGate'],
        slideAll: ['slideGate', 'slideGate', 'slideGate']
    };
    const canJump = row => row.lanes.includes('jumpGate') || row.gate === 'rail' || row.encounter?.position === 'low' ||
        jumpProps.includes(row.lanes[row.bonusLane]);
    for (const mode of ['day', 'night']) {
        for (let seed = 1; seed <= 64; seed++) {
            const rows = layout(seed, 2400, mode, seed % 2 === 0).filter(row => row.lanes);
            assert.ok(rows.at(-1).distance > 60000);
            if (mode === 'night') {
                assert.equal(rows[0].distance, 42);
                assert.equal(rows[0].lanes.filter((key, lane) => key && lane !== rows[0].exitLane).length, 2);
            }
            const late = rows.filter(row => row.distance > 1700);
            assert.ok(late.filter(row => row.gate || row.encounter).length / late.length > 0.64);
            const combined = late.filter((row, i) => row.gate && late[i + 1]?.gate && late[i + 1].gate !== row.gate);
            assert.ok(combined.length / late.length > 0.28, `${mode} ${combined.length / late.length}`);
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i], last = rows[i - 1];
                const seconds = (row.distance - last.distance) / (courseSpeed(row.distance, mode) * 1.1);
                assert.ok(seconds >= (canJump(last) && canJump(row) ? 0.89 : 0.53), `${mode} ${seed} ${row.distance} ${seconds}`);
                // A row open in every lane asks for no steering. Otherwise each way through meets each way onward.
                if (everyLane(row) || last.lesson) continue;
                for (const a of legalLanes(last)) for (const b of legalLanes(row)) assert.ok(Math.abs(a - b) <= 1);
            }
            const stunts = rows.filter(row => row.gate);
            assert.deepEqual(stunts.slice(0, 7).map(row => [row.gate, row.tutorial]), mode === 'day' ? [
                ['jumpAll', true], ['slideAll', true], ['jump', true], ['slide', true], ['choice', true], ['rail', false],
                [stunts[6].gate, false]
            ] : [
                ['jump', true], ['slide', true], ['choice', true], ['rail', false],
                ...stunts.slice(4, 7).map(row => [row.gate, false])
            ]);
            assert.ok(stunts.slice(6).every(row => row.tutorial === false));
            const railRate = late.filter(row => row.gate === 'rail').length / late.length;
            assert.ok(railRate > 0.06 && railRate < 0.2, String(railRate));
            for (const row of stunts) {
                assert.deepEqual([...row.lanes].sort(), expected[row.gate]);
            }
        }
    }
});

test('every stretch keeps its own vocabulary, returns shuffled and harder, and rests on loose stamps', () => {
    const themes = new Map(stretchThemes.map(theme => [theme.id, theme]));
    assert.ok(themes.size >= 5);
    const owned = { protest: ['protest0', 'protest1', 'protest2'], construction: ['scaffold', 'signalBoom', 'deliveryDolly'],
        rush: ['taxi'], fair: ['halal', 'fairBanner'], carriage: ['horseCarriage'], freeze: ['rentIce'], trash: ['trashPile'] };
    for (const mode of ['day', 'night']) {
        const first = new Set(), orders = new Set(), roads = new Map();
        const density = [[0, 0], [0, 0]];
        for (let seed = 1; seed <= 24; seed++) {
            const visits = [];
            let gap = null;
            for (const row of streetCourse(seededRandom(seed), mode)) {
                if (row.distance > 26000) break;
                if (!row.stretch) {
                    if (row.trail && visits.length) gap = row;
                    continue;
                }
                if (visits.at(-1)?.stretch !== row.stretch) {
                    if (visits.length) assert.ok(gap?.distance > visits.at(-1).rows.at(-1).distance, 'breather stamps');
                    visits.push({ stretch: row.stretch, rows: [] });
                }
                visits.at(-1).rows.push(row);
            }
            visits.pop();
            first.add(visits[0].stretch.id);
            orders.add(visits.slice(0, themes.size).map(visit => visit.stretch.id).join());
            assert.ok(visits[0].stretch.at < 560);
            const seen = new Map();
            visits.forEach(({ stretch, rows }, i) => {
                const count = (seen.get(stretch.id) ?? 0) + 1;
                seen.set(stretch.id, count);
                assert.equal(stretch.level, count);
                assert.equal(stretch.name, themes.get(stretch.id).name);
                assert.ok(stretch.until - stretch.at >= 320 && stretch.until - stretch.at < 1050, String(stretch.until - stretch.at));
                assert.ok(rows.every(row => row.distance > stretch.at && row.distance <= stretch.until));
                if (i) assert.notEqual(visits[i - 1].stretch.id, stretch.id);
                const key = stretch.id + stretch.level;
                const road = rows.filter(row => row.lanes).map(row => row.gate ?? row.encounter?.id ?? 'open').join();
                (roads.get(key) ?? roads.set(key, []).get(key)).push(road);
                const pieces = rows.flatMap(row => [...(row.lanes ?? []), ...Object.values(row.skin ?? {})]);
                assert.ok(owned[stretch.id].some(piece => pieces.includes(piece)), key);
                if (stretch.level > 2) return;
                const timed = rows.filter(row => row.lanes);
                const bucket = density[stretch.level - 1];
                bucket[0] += timed.length - 1;
                bucket[1] += (timed.at(-1).distance - timed[0].distance) / courseSpeed(timed[0].distance, mode);
            });
            assert.ok(visits.length >= themes.size * 3);
        }
        assert.ok(first.size >= 5);
        assert.ok(orders.size >= 23);
        for (const [key, list] of roads) assert.ok(new Set(list).size >= list.length * .8, key);
        const [one, two] = density.map(([rows, seconds]) => rows / seconds);
        assert.ok(two > one + .06, `${mode} ${one} ${two}`);
    }
    assert.ok(stretchThemes.every(theme => theme.lines.length >= 1 && stretchLine({ id: theme.id, level: 7 })));
});

test('a theme earns harder combinations only as its level rises, at the same distance tier', () => {
    const rank = beat => ({ split: 3, team: 3, swerve: 2, blackIce: 2 }[beat] ?? 1);
    for (const { motifs, id } of stretchThemes) {
        assert.ok(motifs.filter(motif => motif.level === 1).length >= 3, id);
        assert.ok(motifs.length >= 8, id);
        for (const { level, beats } of motifs) {
            for (const beat of beats) assert.ok(level >= rank(beat), id + ' ' + beat);
        }
        const size = level => {
            const list = motifs.filter(motif => motif.level === level);
            return list.reduce((sum, motif) => sum + motif.beats.length, 0) / list.length;
        };
        assert.ok(size(1) < size(2) && size(2) <= size(3) && size(3) <= size(4), id);
    }
});

test('expert stages sustain a higher decision rate than the opening and middle streets', () => {
    const bands = [[0, 300], [500, 1200], [2000, 3000], [5000, 6000],
        [10000, 11000], [30000, 32000], [60000, 62000]];
    for (const mode of ['day', 'night']) {
        const totals = bands.map(() => ({ gates: 0, seconds: 0 }));
        for (let seed = 1; seed <= 48; seed++) {
            let previous = 0;
            for (const row of streetCourse(seededRandom(seed), mode)) {
                if (row.distance >= 62000) break;
                if (!row.lanes) continue;
                const index = bands.findIndex(([from, to]) => row.distance >= from && row.distance < to);
                if (index >= 0) {
                    totals[index].gates += Number(Boolean(row.gate || row.encounter));
                    totals[index].seconds += (row.distance - previous) / courseSpeed(row.distance, mode);
                }
                previous = row.distance;
            }
        }
        const rates = totals.map(t => t.gates / t.seconds);
        assert.ok(rates[2] > rates[1] + .10, mode + ' ' + rates);
        assert.ok(rates[5] > rates[3] + .05, mode + ' ' + rates);
        assert.ok(rates[6] > rates[2] + .15 && rates[6] > .75, mode + ' ' + rates);
    }
});

test('expert roads reproduce by seed and vary stunt order, turn direction, and timing across seeds', () => {
    function expertRows(seed, mode, overtime) {
        const rows = [];
        for (const row of streetCourse(seededRandom(seed), mode, () => overtime)) {
            if (row.distance >= 42400) break;
            if (row.distance >= 40000 && row.lanes) rows.push(row);
        }
        return rows;
    }
    for (const mode of ['day', 'night']) {
        for (const overtime of [false, true]) {
            assert.deepEqual(expertRows(9, mode, overtime), expertRows(9, mode, overtime));
            const motifs = new Set(), gapBins = new Set();
            let edgeTurns = 0, edgeHolds = 0;
            for (const seed of [1, 2, 3, 7, 9, 12, 23, 52]) {
                const rows = expertRows(seed, mode, overtime);
                const types = rows.map(row => row.gate ?? row.encounter?.id ?? 'open');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i], last = rows[i - 1];
                    const speed = courseSpeed(row.distance, mode) * (overtime ? 1.1 : 1);
                    gapBins.add(Math.floor((row.distance - last.distance) / speed * 10));
                    const from = legalLanes(last)[0], to = legalLanes(row)[0];
                    if (from !== 1) {
                        if (from === to) edgeHolds++;
                        else edgeTurns++;
                    }
                    if (i >= 3) motifs.add(types.slice(i - 3, i + 1).join('/'));
                }
            }
            assert.ok(motifs.size >= 160, `${mode} ${overtime} ${motifs.size}`);
            assert.ok(gapBins.size >= 8, `${mode} ${overtime} ${gapBins.size}`);
            assert.ok(edgeHolds / (edgeTurns + edgeHolds) >= .18, `${mode} ${overtime}`);
        }
    }
});

test('winning the final tightens the live course without touching the road already laid', () => {
    for (const mode of ['day', 'night']) {
        let regular = 0, extra = 0;
        const count = course => {
            let rows = 0;
            for (const row of course) {
                if (row.distance > 12000) return rows;
                if (row.lanes) rows++;
            }
        };
        for (let seed = 1; seed <= 32; seed++) {
            let overtime = false;
            const normal = streetCourse(seededRandom(seed), mode);
            const live = streetCourse(seededRandom(seed), mode, () => overtime);
            let row;
            do {
                row = normal.next().value;
                assert.deepEqual(live.next().value, row);
            } while (row.distance < 4000);
            overtime = true;
            regular += count(normal);
            extra += count(live);
        }
        assert.ok(extra > regular * 1.05, `${mode} ${regular} ${extra}`);
    }
});

test('both moving hazards get a standalone introduction and later link to another decision', () => {
    for (const mode of ['day', 'night']) {
        for (const overtime of [false, true]) {
            for (const seed of [1, 7, 19, 52]) {
                const source = streetCourse(seededRandom(seed), mode, () => overtime);
                const rows = [];
                for (const row of source) {
                    if (row.distance >= 62000) break;
                    if (row.lanes) rows.push(row);
                }
                const encounters = rows.filter(row => ['delivery-dolly', 'signal-boom'].includes(row.encounter?.id));
                const [delivery, signal] = encounters;
                assert.equal(delivery.encounter.id, 'delivery-dolly');
                assert.equal(signal.encounter.id, 'signal-boom');
                assert.ok(delivery.distance < 640 && signal.distance < 900, `${mode} ${delivery.distance} ${signal.distance}`);
                for (const row of [delivery, signal]) {
                    const i = rows.indexOf(row);
                    assert.equal(rows[i - 1].gate ?? rows[i - 1].encounter, undefined);
                    const next = rows[i + 1];
                    assert.equal(next.gate, undefined);
                    if (next.encounter) {
                        assert.equal(next.encounter.id, 'horse-carriage');
                        assert.ok((next.distance - row.distance) / next.encounter.approachSpeed >= 1.4);
                    }
                }
                const late = encounters.filter(row => row.distance > 15000 && row !== rows.at(-1));
                assert.ok(late.filter(row => row.encounter.id === 'signal-boom').length >= 10);
                assert.ok(late.filter(row => row.encounter.id === 'delivery-dolly').length >= 10);
                assert.ok(late.some(row => row.lanes[row.exitLane]));
                for (const row of encounters) {
                    const { encounter, exitLane } = row;
                    if (encounter.id === 'delivery-dolly') {
                        assert.equal(row.lanes[exitLane], null);
                        assert.equal(encounter.fromLane, exitLane);
                        assert.equal(Math.abs(encounter.toLane - exitLane), 1);
                        assert.equal(row.lanes[encounter.toLane], 'deliveryDolly');
                    } else {
                        assert.equal(row.actionLane, encounter.lane);
                        assert.equal(Math.abs(encounter.lane - exitLane), 1);
                        assert.equal(row.lanes[encounter.lane], 'signalBoom');
                        assert.ok(['low', 'high'].includes(encounter.position));
                        if (row.lanes[exitLane]) {
                            assert.ok(row.stretch.id === 'construction' && row.stretch.level >= 3);
                            assert.equal(row.lanes[exitLane], encounter.position === 'low' ? 'slideGate' : 'jumpGate');
                        }
                    }
                }
            }
        }
    }
});

test('expert work zones can require a second moving read during one five-second pursuit', () => {
    const ids = ['delivery-dolly', 'signal-boom', 'horse-carriage'];
    for (const mode of ['day', 'night']) {
        for (const overtime of [false, true]) {
            const pairs = new Set();
            let count = 0;
            for (const seed of [1, 9, 23, 52]) {
                let first;
                for (const row of streetCourse(seededRandom(seed), mode, () => overtime)) {
                    if (row.distance > 60000) break;
                    if (!ids.includes(row.encounter?.id)) continue;
                    if (first && row.distance >= 30000) {
                        const seconds = (row.distance - first.distance) /
                            (courseSpeed(row.distance, mode) * (overtime ? 1.1 : 1));
                        assert.ok(seconds > .84, `${mode} ${overtime} ${seconds}`);
                        if (seconds < 4.9) {
                            pairs.add(first.encounter.id + '/' + row.encounter.id);
                            count++;
                        }
                    }
                    first = row;
                }
            }
            assert.ok(count >= 60, String(count));
            assert.ok(pairs.size >= 7);
        }
    }
});

test('ice leaves a reachable dry lane and stamp, and enough Overtime runway to thaw before the next decision', () => {
    for (const mode of ['day', 'night']) {
        for (const overtime of [false, true]) {
            const lanesSeen = new Set();
            let blocked = 0;
            for (let seed = 1; seed <= 12; seed++) {
                const rows = [];
                for (const row of streetCourse(seededRandom(seed), mode, () => overtime)) {
                    if (row.distance >= 62000) break;
                    if (row.lanes) rows.push(row);
                }
                const ice = rows.filter(row => row.iceLane !== undefined && row !== rows.at(-1));
                assert.ok(ice.length >= 12, String(ice.length));
                for (const row of ice) {
                    const next = rows[rows.indexOf(row) + 1];
                    lanesSeen.add(row.iceLane);
                    assert.equal(row.stretch.id, 'freeze');
                    assert.equal(row.lanes[row.iceLane], 'rentIce');
                    assert.equal(row.lanes[row.exitLane], null);
                    const occupied = row.lanes.filter(Boolean).length;
                    if (occupied === 2) {
                        blocked++;
                        assert.ok(row.stretch.level >= 2);
                    } else assert.equal(occupied, 1);
                    if (!everyLane(next)) assert.deepEqual(legalLanes(next), [1]);
                    const speed = courseSpeed(next.distance, mode) * 1.1;
                    assert.ok((next.distance - row.distance) / speed > 1.41);
                }
            }
            assert.ok(blocked > 20);
            assert.deepEqual([...lanesSeen].sort(), [0, 1, 2]);
        }
    }
});

test('even collecting every scheduled protection leaves half of the run exposed', () => {
    for (const mode of ['day', 'night']) {
        for (const seed of [1, 9, 23, 52]) {
            const pickups = layout(seed, 900, mode).filter(row => row.pickup);
            assert.ok(pickups[0].distance >= (mode === 'night' ? 360 : 270));
            let pickupIndex = 0;
            let duration = 0;
            let protectedTime = 0;
            let frames = 0;
            const world = worldWithoutScenery(mode);
            while (world.distance < 10000) {
                world.update(step);
                const pickup = pickups[pickupIndex];
                if (world.distance >= pickup.distance) {
                    const effect = { updateWearables: noOp, powerLevels: {} };
                    Player.prototype.activatePowerup.call(effect, pickup.pickup);
                    duration = pickup.pickup === 'fastFreeBus' ? busSeconds : effect[pickup.pickup + 'Timer'];
                    // Count the visible stretch the mask clears after its timer expires.
                    if (pickup.pickup === 'covidMask') duration += Math.max(83 / world.speed, 1.65);
                    pickupIndex++;
                }
                if (duration > 0) {
                    protectedTime += step;
                    duration -= step;
                }
                frames++;
            }
            assert.ok(protectedTime / (frames * step) < 0.5);
        }
    }
});

test('a power-up comes every fifteen to twenty seconds, never repeats, and keeps the bus in rotation', () => {
    for (const mode of ['day', 'night']) {
        const firstPickups = new Set(), gaps = [];
        for (let seed = 1; seed <= 64; seed++) {
            const pickups = layout(seed, 900, mode).filter(row => row.pickup);
            const wearables = pickups.filter(row => row.pickup !== 'fastFreeBus');
            const cycle = wearables.slice(0, 3).map(row => row.pickup);
            firstPickups.add(cycle[0]);
            assert.deepEqual([...cycle].sort(), ['covidMask', 'kafiyeh', 'rainbow']);
            assert.ok(wearables.every((row, index) => row.pickup === cycle[index % 3]));
            assert.equal(pickups[1].pickup, 'fastFreeBus');
            let lastBus = 1;
            for (const [i, pickup] of pickups.entries()) {
                if (!i) continue;
                assert.notEqual(pickup.pickup, pickups[i - 1].pickup);
                gaps.push((pickup.distance - pickups[i - 1].distance) / courseSpeed((pickup.distance + pickups[i - 1].distance) / 2, mode));
                if (i > 1 && pickup.pickup === 'fastFreeBus') {
                    assert.ok(i - lastBus === 3 || i - lastBus === 4);
                    lastBus = i;
                }
            }
        }
        gaps.sort((a, b) => a - b);
        assert.ok(gaps[0] > 13.2, String(gaps[0]));
        assert.ok(gaps[Math.floor(gaps.length * .5)] < 18.6);
        assert.ok(gaps[Math.floor(gaps.length * .95)] < 21.5, String(gaps[Math.floor(gaps.length * .95)]));
        assert.equal(firstPickups.size, 3);
    }
});

function createTraffic() {
    const scene = new Scene();
    const canvasContext = { fillRect: noOp, strokeRect: noOp, fillText: noOp, measureText: () => ({ width: 100 }) };
    const cast = { commuter: { scene: new Group() }, 'new-yorker': { scene: new Group() } };
    globalThis.document = { createElement: () => ({ getContext: () => canvasContext }) };
    try {
        return new ObstacleManager(scene, new PowerupManager(scene), cast);
    } finally {
        delete globalThis.document;
    }
}

test('all generated pieces are pooled and painted lane cues lead to one collectible stamp', () => {
    const traffic = createTraffic();
    const keys = new Set(['coin']);
    for (const mode of ['day', 'night']) {
        for (let seed = 1; seed <= 64; seed++) {
            traffic.powerups.reset();
            traffic.reset(mode, seededRandom(seed));
            let viewDistance = 0;
            const rows = layout(seed, 520, mode).filter(row => row.lanes);
            const advanceTo = distance => {
                while (viewDistance < distance) {
                    const advance = Math.min(10, distance - viewDistance);
                    viewDistance += advance;
                    traffic.update(1, advance, viewDistance);
                }
            };
            for (const row of rows) {
                const leads = row.gate ? [4, 3] : [3, 2];
                advanceTo(row.distance - leads[0] * row.cueStep - 1);
                const marks = new Map();
                if (row.lesson) {
                    keys.add(row.lesson.cue);
                    assert.ok(traffic.obstacles.some(obj => obj.key === row.lesson.cue));
                }
                if (!row.gate && (!row.encounter || !row.lanes[row.exitLane])) marks.set(row.exitLane, ['laneCue', 1.02, 0]);
                for (const [lane, key] of row.lanes.entries()) {
                    if (key === 'jumpGate') marks.set(lane, ['jumpCue', 2.42, 0]);
                    if (key === 'slideGate') marks.set(lane, ['slideCue', 0.55, 0]);
                    if (key === 'railGate') marks.set(lane, ['laneCue', 1.31, 0.35]);
                    if (key === 'signalBoom') marks.set(lane, row.encounter.position === 'low'
                        ? ['jumpCue', 2.42, 0] : ['slideCue', 0.54, 0]);
                }
                const at = (obj, x, distance) => obj.mesh.position.x === x &&
                    Math.abs(viewDistance - obj.mesh.position.z - distance) < 1e-6;
                for (const [lane, [cue, height, lead]] of marks) {
                    keys.add(cue);
                    const x = (lane - 1) * 3;
                    for (const lead of leads) {
                        const objects = traffic.obstacles.filter(obj => at(obj, x, row.distance - lead * row.cueStep));
                        assert.ok(objects.some(obj => obj.key === cue && obj.type === 'cue'));
                        assert.ok(objects.every(obj => obj.type !== 'cue' || obj.key === cue));
                        assert.ok(objects.every(obj => obj.type !== 'coin'));
                    }
                    const stamps = traffic.obstacles.filter(obj => obj.type === 'coin' && at(obj, x, row.distance - lead));
                    assert.equal(stamps.length, 1);
                    assert.equal(stamps[0].height, height);
                }
                advanceTo(row.distance);
                for (const [lane, slot] of row.lanes.entries()) {
                    if (!slot || (!row.encounter && lane === row.exitLane)) continue;
                    const key = row.skin?.[slot] ?? (row.encounter?.id === 'protest-line'
                        ? { slideGate: 'policeTape', jumpGate: 'fallenPlacard', gateBlock: 'marchBarrier' }[slot] ?? slot : slot);
                    keys.add(key);
                    assert.ok(traffic.models[key] && traffic.pool[key], key);
                    const x = (lane - 1) * 3;
                    const object = traffic.obstacles.find(obj => obj.key === key && (key === 'deliveryDolly'
                        ? Math.abs(obj.mesh.position.x - x) < .3 && Math.abs(obj.mesh.position.z) < 1e-6
                        : at(obj, x, row.distance)));
                    assert.ok(object, key);
                    assert.equal(object.mesh.getObjectByName('tutorialSign')?.visible ?? false,
                        !!row.tutorial && (key === 'jumpGate' || key === 'slideGate'), key);
                }
            }
        }
    }
    assert.deepEqual([...keys].sort(), Object.keys(traffic.models).sort());
});

test('even the fastest Overtime gates enter the scene at least 1.55 seconds ahead', () => {
    const speed = courseSpeed(60000, 'night') * 1.1;
    for (const hz of [20, 30, 60, 120]) {
        const traffic = createTraffic();
        traffic.course = streetCourse(seededRandom(9), 'night');
        do { traffic.nextRow = traffic.course.next().value; } while (traffic.nextRow.distance < 60000);
        const seen = new Set();
        const start = traffic.nextRow.distance - speed * 2;
        for (let distance = start; distance < start + 1800; distance += speed / hz) {
            traffic.update(1 / hz, speed, distance);
            for (const item of traffic.obstacles) {
                const obstacle = item.gate || (item.moving ? item : null);
                if (!obstacle || item.key === 'coin' || seen.has(obstacle)) continue;
                assert.ok(-item.mesh.position.z / speed >= 1.55 - 1e-8);
                seen.add(obstacle);
            }
        }
        assert.ok(seen.size >= 10);
    }
});

test('road power-ups spawn alone in the marked lane and fit the food stamp dimensions', () => {
    const traffic = createTraffic();
    const stamp = new Box3().setFromObject(traffic.models.coin, true).getSize(new Vector3());
    for (const type of traffic.powerups.types) {
        traffic.course = [{ distance: Infinity }].values();
        traffic.nextRow = { distance: 100, pickupLane: 2, pickup: type };
        traffic.fillCourse(80);
        assert.equal(traffic.obstacles.length, 0);
        assert.equal(traffic.powerups.powerups.length, 1);
        const [{ mesh }] = traffic.powerups.powerups;
        assert.equal(mesh.position.x, 3);
        assert.equal(mesh.position.z, -20);
        assert.equal(mesh.children[0].isMesh, true);
        assert.deepEqual(mesh.children.slice(1).map(child => [child.name, child.material.color.getHex(), child.material.depthWrite]),
            [['halo', pickupGlow[type], false], ['glowPool', pickupGlow[type], false]]);
        const size = new Box3().setFromObject(mesh.children[0], true).getSize(new Vector3());
        const scale = Math.max(size.x / stamp.x, size.y / stamp.y);
        assert.ok(Math.abs(scale - 1) < 1e-6, type);
        traffic.powerups.reset();
    }
});

test('a standing runner cannot slip between stunt lanes or take two strikes from one gate', () => {
    const traffic = createTraffic();
    const row = layout(9, 30).find(row => row.gate === 'choice');
    traffic.course = layout(9, 40).filter(event => event.distance > row.distance).values();
    traffic.nextRow = row;
    traffic.fillCourse(row.distance);
    const player = { mesh: new Group(), slideTimer: 0 };
    player.mesh.position.x = -1.5;
    assert.ok(['jumpGate', 'slideGate', 'gateBlock'].includes(traffic.checkCollisions(player)));
    player.mesh.position.x = 1.5;
    assert.equal(traffic.checkCollisions(player), null);
});

function createPlayer() {
    const player = Object.assign(Object.create(Player.prototype), {
        mesh: new Group(),
        shadow: Object.assign(new Group(), { material: {} }),
        rig: { pose: noOp, wear: noOp, material: { emissive: { setHex: noOp, setRGB: noOp } } },
        stumble: { reset: noOp, restore: noOp, update: noOp },
        scarf: {}, sash: {}, mask: {}, flagAura: {}, bottleStars: {}
    });
    player.reset();
    return player;
}

test('the ice uses swept foot contact, preserves ordinary collision results, and slips only once', () => {
    const traffic = createTraffic();
    const player = createPlayer();
    for (const speed of [31, 93.5]) {
        for (const hz of [20, 30, 60, 120]) {
            for (const [x, y, slipped] of [[0, 0, true], [0, .7, false], [3, 0, false]]) {
                traffic.reset();
                while (traffic.obstacles.length) traffic.remove(traffic.obstacles.length - 1);
                traffic.nextRow = { distance: 1e9 };
                player.mesh.position.set(x, y, 0);
                const patch = traffic.add('rentIce', 0, -8);
                traffic.checkCollisions(player);
                let slips = 0;
                while (patch.mesh.position.z < 4) {
                    traffic.update(1 / hz, speed, 0);
                    assert.equal(traffic.checkCollisions(player), null);
                    slips += Number(traffic.slippedOnIce);
                }
                assert.equal(slips, Number(slipped), `${speed} ${hz} ${x} ${y}`);
            }
        }
    }
});

test('an ice skid consumes side presses while a jump or duck still responds', () => {
    const player = createPlayer();
    for (const hz of [20, 30, 60, 120]) {
        for (const vertical of ['up', 'down']) {
            player.reset();
            player.iceTimer = ICE_STEERING_SECONDS;
            const keys = new Set(['right', vertical]);
            const input = { isJustPressed: key => keys.delete(key) };
            player.update(1 / hz, input, 93.5);
            assert.ok(player.events.includes(vertical === 'up' ? 'jump' : 'slide'));
            assert.equal(player.currentLane, 1);
            assert.equal(keys.size, 0);
            while (player.iceTimer > 0) player.update(1 / hz, input, 93.5);
            player.update(1 / hz, input, 93.5);
            assert.equal(player.currentLane, 1);
            keys.add('left');
            player.update(1 / hz, input, 93.5);
            assert.equal(player.currentLane, 0);
        }
    }
    player.iceTimer = ICE_STEERING_SECONDS;
    player.reset();
    assert.equal(player.iceTimer, 0);
});

test('the planted foot recovers smoothly when a duck ends during a lane change', async () => {
    const loader = new GLTFLoader().register(() => ({
        name: 'untextured-rig',
        loadMaterial: () => Promise.resolve(new MeshStandardMaterial())
    }));
    const load = async name => {
        const bytes = await readFile(new URL('../public/models/' + name + '.glb', import.meta.url));
        return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    };
    const [mayor, apparel] = await Promise.all([load('mayor'), load('apparel')]);
    const player = createPlayer();
    player.rig = new RunnerModel({ ...mayor, apparel: apparel.scene });
    player.mesh = player.rig.root;
    player.mesh.scale.setScalar(1.1);
    player.reset();
    const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map(name =>
        player.rig.figure.getObjectByName('mixamorig' + name)
    );
    const inputs = new Map([[105, ['left']], [121, ['up', 'right']], [141, ['left']], [168, ['down', 'right']]]);
    let previous, distance = 0;
    for (let tick = 0; tick < 232; tick++) {
        const speed = courseSpeed(distance, 'day');
        distance += speed * step;
        player.update(step, { isJustPressed: key => inputs.get(tick)?.includes(key) ?? false }, speed);
        const feetNow = feet.map(bone => bone.getWorldPosition(new Vector3()).sub(player.mesh.position));
        if (tick === 215) assert.ok(player.slideTimer > 0);
        if (tick >= 216) {
            assert.equal(player.slideTimer, 0);
            // At 60 Hz the two release frames used to snap a shoe 35 cm, then 16 cm.
            const limit = tick < 218 ? .035 : .13;
            for (let i = 0; i < feet.length; i++) {
                assert.ok(feetNow[i].distanceTo(previous[i]) < limit, feet[i].name + ' at tick ' + tick);
            }
        }
        previous = feetNow;
    }
});

test('one ticket rail pays one stamp and move for either clear, and hits a standing runner', () => {
    const traffic = createTraffic();
    for (const mode of ['day', 'night']) {
        const row = layout(9, 40, mode).find(row => row.gate === 'rail');
        const railLane = row.lanes.indexOf('railGate');
        const speed = courseSpeed(120000, mode) * 1.1;
        for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20]) {
            for (const [action, move] of [['up', 'jump'], ['down', 'slide'], [null, null]]) {
                traffic.reset(mode, seededRandom(9));
                while (traffic.obstacles.length) traffic.remove(traffic.obstacles.length - 1);
                traffic.nextRow = row;
                traffic.course = [{ distance: row.distance + 1000 }].values();
                const player = createPlayer();
                player.currentLane = railLane;
                player.mesh.position.x = (railLane - 1) * 3;
                let distance = row.distance - 44;
                let inputUsed = false;
                const outcomes = [];
                const stunts = [];
                while (distance < row.distance + 6) {
                    const trigger = !inputUsed && (row.distance - distance) / speed <= (action === 'up' ? 0.35 : 0.26);
                    let pressed = trigger ? action : null;
                    if (trigger) inputUsed = true;
                    distance += speed * dt;
                    player.update(dt, { isJustPressed: key => {
                        if (key !== pressed) return false;
                        pressed = null;
                        return true;
                    } }, speed);
                    traffic.update(dt, speed, distance);
                    const hit = traffic.checkCollisions(player);
                    if (hit) outcomes.push(hit);
                    if (traffic.lastStunt) stunts.push(traffic.lastStunt);
                }
                assert.deepEqual(outcomes, [move ? 'coin' : 'railGate'], `${mode} ${dt} ${move}`);
                assert.deepEqual(stunts, move ? [move] : []);
            }
        }
    }
});

function courseTrial(seed, mode, { at = 0, size = 36, strategy = 'jumpChoice', dt = step,
    overtime = false, jumpLead = 0.35, actionInterval = 0, takeBonus = false, theme, level } = {}) {
    const source = streetCourse(seededRandom(seed), mode, () => overtime);
    let first;
    do { first = source.next().value; } while (!first.lanes || first.distance < at ||
        theme && first.stretch?.id !== theme || level && first.stretch?.level < level);
    const events = [first];
    while (events.filter(event => event.lanes).length < size + 8) {
        const event = source.next().value;
        // Loose stamps are extra. This counts the one each row promises.
        if (!event.trail) events.push(event);
    }
    const rows = events.filter(row => row.lanes).slice(0, size - 4);
    const world = worldWithoutScenery(mode);
    world.overtime = overtime;
    world.distance = Math.max(0, first.distance - 1.3 * courseSpeed(first.distance, mode));
    world.speed = courseSpeed(world.distance, mode) * (overtime ? 1.1 : 1);
    const traffic = createTraffic();
    traffic.course = events.values();
    traffic.nextRow = traffic.course.next().value;
    const player = createPlayer();
    const cleared = new Set(), strikes = [];
    let time = 0, lastAction = -Infinity, stamps = 0;
    for (const row of rows) {
        const { distance, exitLane } = row;
        const boom = row.encounter?.id === 'signal-boom' ? row.actionLane : -1;
        const jumpLane = row.encounter?.position === 'low' ? boom : row.lanes.indexOf('jumpGate');
        const slideLane = row.encounter?.position === 'high' ? boom : row.lanes.indexOf('slideGate');
        const railLane = row.lanes.indexOf('railGate');
        const inEveryLane = everyLane(row);
        const takeSlide = railLane >= 0 ? strategy === 'slideChoice' :
            jumpLane < 0 || (strategy === 'slideChoice' && slideLane >= 0);
        const preferred = strategy === 'slideChoice' ? slideLane : jumpLane;
        const detour = takeBonus && row.bonusLane !== undefined;
        const target = detour ? row.bonusLane : inEveryLane || row.lesson && player.currentLane !== 1 ? player.currentLane : row.gate ? (railLane >= 0 ? railLane : takeSlide ? slideLane : jumpLane)
            : boom >= 0 && preferred >= 0 && strategy !== 'laneOnly' ? preferred : exitLane;
        const action = detour ? (jumpProps.includes(row.lanes[target]) ? 'up' : 'down') :
            strategy !== 'laneOnly' && (row.gate || target === boom || target === preferred && boom >= 0)
            ? (row.gate ? (takeSlide ? 'down' : 'up') : target === slideLane ? 'down' : 'up') : null;
        let acted = false;
        while (world.distance < distance + 2.1) {
            const untilRow = (distance - world.distance) / world.speed;
            const pressed = new Set();
            if (untilRow <= 0.56 && player.currentLane !== target)
                pressed.add(player.currentLane < target ? 'right' : 'left');
            if (action && !acted && time >= lastAction + actionInterval && untilRow <= (action === 'up' ? jumpLead : 0.26)) {
                pressed.add(action);
                lastAction = time;
                acted = true;
            }
            world.update(dt);
            player.update(dt, { isJustPressed: key => pressed.delete(key) }, world.speed);
            player.events.length = 0;
            traffic.update(dt, world.speed, world.distance);
            const hit = traffic.checkCollisions(player);
            if (hit && hit !== 'coin') strikes.push({ distance, time, hit });
            if (hit === 'coin') stamps++;
            if (traffic.lastStunt && (row.gate || row.encounter)) {
                const type = target === boom ? 'signal-boom' : row.gate ?? 'paired-gate';
                cleared.add(type + ':' + traffic.lastStunt);
            }
            time += dt;
        }
    }
    return { stamps, rows: rows.length, bonusRows: rows.filter(row => row.bonusLane !== undefined).length, cleared, strikes };
}

test('the stunt detour pays a second stamp and rejoins the next row from either lane', () => {
    for (const mode of ['day', 'night']) for (const at of [500, 5000, 60000]) {
        for (const takeBonus of [false, true]) {
            const trial = courseTrial(19, mode, { at, size: 160, overtime: true, dt: 1/20, takeBonus });
            assert.ok(trial.bonusRows > 0);
            assert.deepEqual(trial.strikes, [], mode + ' ' + at);
            assert.equal(trial.stamps, trial.rows + (takeBonus ? trial.bonusRows : 0), mode + ' ' + at);
        }
    }
});

test('unchanged player physics clear both routes through every tier and the Overtime cap', () => {
    for (const mode of ['day', 'night']) {
        const clears = new Set();
        for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20]) {
            for (const [at, overtime] of [[0], [500], [2000], [5000], [5000, true],
                [10000], [30000], [60000], [90000, true]]) {
                for (const seed of [9, 19, 52]) {
                    for (const strategy of ['jumpChoice', 'slideChoice']) {
                        const result = courseTrial(seed, mode, { at, strategy, dt, overtime,
                            jumpLead: strategy === 'jumpChoice' ? 0.30 : 0.40 });
                        assert.deepEqual(result.strikes, [], `${mode} at ${at}m, ${dt}s, ${strategy}, seed ${seed}`);
                        assert.equal(result.stamps, result.rows, `${mode} at ${at}m, ${dt}s, ${strategy}, seed ${seed}`);
                        for (const clear of result.cleared) clears.add(clear);
                    }
                }
            }
        }
        for (const path of ['choice:jump', 'choice:slide', 'rail:jump', 'rail:slide', 'jumpAll:jump', 'slideAll:slide',
            'signal-boom:jump', 'signal-boom:slide']) {
            assert.ok(clears.has(path), `${mode} ${path}`);
        }
    }
});

test('a runner can clear every theme at its first and its highest levels, at the cap and in Overtime', () => {
    for (const mode of ['day', 'night']) for (const { id } of stretchThemes) {
        for (const [at, level, overtime] of [[0, 1], [9000, 2], [24000, 4], [60000, 8], [60000, 8, true]]) {
            for (const seed of [3, 11]) for (const strategy of ['jumpChoice', 'slideChoice']) {
                const result = courseTrial(seed, mode, { at, theme: id, level, overtime, strategy, dt: 1 / 30, size: 22,
                    jumpLead: strategy === 'jumpChoice' ? .32 : .38, takeBonus: seed === 11 });
                assert.deepEqual(result.strikes, [], `${mode} ${id} ${level} at ${at}m, seed ${seed} ${strategy}`);
            }
        }
    }
});

test('a runner who needs 1.2s between vertical inputs survives onboarding and loses the late chase', () => {
    for (const mode of ['day', 'night']) {
        for (const seed of [1, 9, 23, 52]) {
            const laneOnly = courseTrial(seed, mode, { strategy: 'laneOnly', size: 18 });
            assert.equal(laneOnly.strikes[0].hit, 'jumpGate');
            const early = courseTrial(seed, mode, { actionInterval: 1.2, size: 15 });
            assert.deepEqual(early.strikes, []);
            for (const at of [10000, 30000, 60000]) {
                const late = courseTrial(seed, mode, { at, actionInterval: 1.2 });
                assert.ok(late.strikes.some((hit, i) => i && hit.time - late.strikes[i - 1].time < 7),
                    `${mode} at ${at}m, seed ${seed}: ${JSON.stringify(late.strikes)}`);
            }
        }
    }
});

test('a full-speed wearable sweep samples the runner alongside the item and resets pooled history', () => {
    const powers = new PowerupManager(new Scene());
    const player = { mesh: new Group() };
    const speed = courseSpeed(60000, 'night') * 1.1;
    for (const hz of [20, 30, 60, 120]) {
        const step = speed / hz;
        for (const type of powers.types) {
            powers.reset();
            player.mesh.position.set(3, 0, 0);
            powers.checkCollisions(player);
            powers.spawnPowerup(3, -step / 2, type);
            powers.update(1 / hz, speed);
            assert.equal(powers.checkCollisions(player), type);
            assert.equal(powers.pool[type].length, 1);
            assert.equal(powers.checkCollisions(player), null);
        }
    }
    function cross(fromX, fromY, toX, toY) {
        powers.reset();
        player.mesh.position.set(fromX, fromY, 0);
        powers.checkCollisions(player);
        const step = speed / 20;
        powers.spawnPowerup(0, -step * 0.15, 'rainbow');
        powers.update(1 / 20, speed);
        player.mesh.position.set(toX, toY, 0);
        return powers.checkCollisions(player);
    }
    assert.equal(cross(0, 0, 3, 0), 'rainbow');
    assert.equal(cross(3, 0, 0, 0), null);
    assert.equal(cross(0, 2.3, 0, 0), null);
    assert.equal(cross(0, 0, 0, 2.1), 'rainbow');
    assert.equal(cross(3, 0, 3, 0), null);
    for (let i = 0; i < 5; i++) powers.update(1 / 20, speed);
    assert.equal(powers.powerups.length, 0);
    assert.equal(powers.pool.rainbow.length, 1);
});
