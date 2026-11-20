import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Group, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { courseSpeed, streetCourse } from '../game/Course.js';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { Player } from '../game/Player.js';
import { RunnerModel } from '../game/RunnerModel.js';
import { PowerupManager } from '../game/PowerupManager.js';
import { World } from '../game/World.js';

const step = 1 / 60;
const lanes = [0, 1, 2];
const noOp = () => {};

test('both courses introduce an actual compulsory stunt after the opening', () => {
    for (const mode of ['day', 'night']) {
        const events = layout(1, 15, mode);
        const first = events.find(row => row.gate);
        assert.equal(first?.gate, 'jump', mode);
        assert.ok(first.distance < (mode === 'day' ? 190 : 120), mode);
        assert.equal(first.exitLane, undefined);
    }
});

function seededRandom(seed) {
    let state = seed * 0x9e3779b9;
    return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function layout(seed, size, mode = 'day') {
    const course = streetCourse(seededRandom(seed), mode);
    return Array.from({ length: size }, () => course.next().value);
}

function worldWithoutScenery(mode = 'day') {
    const world = Object.assign(Object.create(World.prototype), {
        blocks: [],
        landmarks: { update: noOp },
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

test('six openings give the starting lane time to react and still close every fixed lane', () => {
    const openings = new Set();
    for (let seed = 1; seed <= 64; seed++) {
        const events = layout(seed, 700);
        const rows = events.filter(row => row.lanes);
        const opening = rows.slice(0, 4);
        openings.add(opening.map(row => row.lanes.join(',').replace(/protest[0-2]/g, 'protest')).join('/'));
        assert.ok(opening[0].distance >= 28);
        assert.equal(opening[0].lanes[1], null);
        assert.equal(opening[0].lanes.filter((key, lane) => key && lane !== opening[0].exitLane).length, 1);
        for (let i = 1; i < opening.length; i++) {
            assert.ok(opening[i].distance - opening[i - 1].distance >= 32);
        }
        assert.equal(new Set(opening.map(row => row.exitLane)).size, 3);
        for (const lane of lanes) {
            const hits = rows.filter(row => lane !== row.exitLane && row.lanes[lane] && row.lanes[lane] !== 'alcohol');
            assert.ok(hits[1].distance <= opening.at(-1).distance, `seed ${seed}, opening lane ${lane}`);
            if (lane === 1) {
                assert.ok(hits[0].distance >= 60 && hits[1].distance >= 120, `seed ${seed}, starting lane runway`);
            }
        }
    }
    assert.equal(openings.size, 6);
});

test('stunt cards get denser, pair different actions, and still give each row time', () => {
    const expected = {
        jump: ['gateBlock', 'gateBlock', 'jumpGate'],
        slide: ['gateBlock', 'gateBlock', 'slideGate'],
        choice: ['gateBlock', 'jumpGate', 'slideGate'],
        rail: ['gateBlock', 'gateBlock', 'railGate']
    };
    for (const mode of ['day', 'night']) {
        for (let seed = 1; seed <= 64; seed++) {
            const rows = layout(seed, 1400, mode).filter(row => row.lanes);
            if (mode === 'night') {
                assert.equal(rows[0].distance, 42);
                assert.equal(rows[0].lanes.filter((key, lane) => key && lane !== rows[0].exitLane).length, 2);
            }
            const early = rows.filter(row => row.distance < 500);
            assert.ok(early.filter(row => row.gate).length / early.length < 0.7);
            const late = rows.filter(row => row.distance > 1700);
            assert.ok(late.filter(row => row.gate).length / late.length > 0.78);
            const combined = late.filter((row, i) => row.gate && late[i + 1]?.gate && late[i + 1].gate !== row.gate);
            assert.ok(combined.length / late.length > 0.45);
            const routes = row => row.gate ? lanes.filter(lane => row.lanes[lane] !== 'gateBlock') : [row.exitLane];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i], last = rows[i - 1];
                const seconds = (row.distance - last.distance) / (courseSpeed(row.distance, mode) * 1.1);
                const canJump = r => ['jump', 'rail', 'choice'].includes(r.gate);
                assert.ok(seconds >= (canJump(last) && canJump(row) ? 0.89 : 0.53));
                for (const a of routes(last)) for (const b of routes(row)) assert.ok(Math.abs(a - b) <= 1);
            }
            const stunts = rows.filter(row => row.gate);
            assert.deepEqual(stunts.slice(0, 4).map(row => [row.gate, row.tutorial]), [
                ['jump', true], ['slide', true], ['choice', true], ['rail', false]
            ]);
            assert.ok(stunts.slice(3).every(row => row.tutorial === false));
            const railRate = late.filter(row => row.gate === 'rail').length / late.length;
            assert.ok(railRate > 0.1 && railRate < 0.24);
            for (const row of stunts) {
                assert.deepEqual([...row.lanes].sort(), expected[row.gate]);
            }
        }
    }
});

test('compulsory actions per second keep rising past the old cap on both shifts', () => {
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
                    totals[index].gates += Number(!!row.gate);
                    totals[index].seconds += (row.distance - previous) / courseSpeed(row.distance, mode);
                }
                previous = row.distance;
            }
        }
        const rates = totals.map(t => t.gates / t.seconds);
        for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1] + 0.02, mode + ' ' + rates);
        assert.ok(rates.at(-1) > 1.1);
    }
});

test('winning the final lengthens the next stunt set on the live course', () => {
    for (const mode of ['day', 'night']) {
        let overtime = false;
        const normal = streetCourse(seededRandom(9), mode);
        const live = streetCourse(seededRandom(9), mode, () => overtime);
        let row;
        do {
            row = normal.next().value;
            assert.deepEqual(live.next().value, row);
        } while (row.distance < 4000);
        overtime = true;
        function lengths(course) {
            const sets = [];
            let length = 0;
            for (const row of course) {
                if (!row.lanes) continue;
                if (row.gate) length++;
                else {
                    sets.push(length);
                    length = 0;
                    if (sets.length === 5) return sets.slice(1);
                }
            }
        }
        const regular = lengths(normal), extra = lengths(live);
        assert.ok(Math.max(...regular) <= 6, mode + ' ' + regular);
        assert.ok(Math.min(...extra) >= 6, mode + ' ' + extra);
        assert.ok(extra.some(length => length > 6), mode + ' ' + extra);
    }
});

test('even collecting every scheduled protection leaves most of the run exposed', () => {
    for (const mode of ['day', 'night']) {
        for (const seed of [1, 9, 23, 52]) {
            const pickups = layout(seed, 500, mode).filter(row => row.pickup);
            assert.ok(pickups[0].distance >= (mode === 'night' ? 820 : 300));
            let pickupIndex = 0;
            let duration = 0;
            let protectedTime = 0;
            let frames = 0;
            const world = worldWithoutScenery(mode);
            while (world.distance < 10000) {
                world.update(step);
                const pickup = pickups[pickupIndex];
                if (world.distance >= pickup.distance) {
                    const effect = { updateWearables: noOp };
                    Player.prototype.activatePowerup.call(effect, pickup.pickup);
                    duration = effect[pickup.pickup + 'Timer'];
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
            assert.ok(protectedTime / (frames * step) < (mode === 'night' ? 0.21 : 0.25));
        }
    }
});

test('the first protection varies, then each run cycles through all three', () => {
    for (const mode of ['day', 'night']) {
        const firstPickups = new Set();
        for (let seed = 1; seed <= 64; seed++) {
            const pickups = layout(seed, 500, mode).filter(row => row.pickup);
            const cycle = pickups.slice(0, 3).map(row => row.pickup);
            firstPickups.add(cycle[0]);
            assert.deepEqual([...cycle].sort(), ['covidMask', 'kafiyeh', 'rainbow']);
            for (const [i, pickup] of pickups.entries()) {
                assert.equal(pickup.pickup, cycle[i % 3]);
                if (i > 0) assert.ok(pickup.distance - pickups[i - 1].distance >= (mode === 'night' ? 1650 : 1200));
            }
        }
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
            const rows = layout(seed, 400, mode).filter(row => row.lanes);
            assert.ok(traffic.obstacles.every(obj => obj.type !== 'coin' || -obj.mesh.position.z >= rows[0].distance));
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
                if (!row.gate) marks.set(row.exitLane, ['laneCue', 1.02, 0]);
                for (const [lane, key] of row.lanes.entries()) {
                    if (key === 'jumpGate') marks.set(lane, ['jumpCue', 2.42, 0]);
                    if (key === 'slideGate') marks.set(lane, ['slideCue', 0.55, 0]);
                    if (key === 'railGate') marks.set(lane, ['laneCue', 1.31, 0.35]);
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
                        assert.ok(objects.every(obj => obj.type !== 'coin' || obj.mesh.material !== traffic.stampMaterials.route));
                    }
                    const stamps = traffic.obstacles.filter(obj => obj.type === 'coin' &&
                        obj.mesh.material === traffic.stampMaterials.route && at(obj, x, row.distance - lead));
                    assert.equal(stamps.length, 1);
                    assert.equal(stamps[0].height, height);
                }
                advanceTo(row.distance);
                for (const [lane, key] of row.lanes.entries()) {
                    if (!key || lane === row.exitLane) continue;
                    keys.add(key);
                    assert.ok(traffic.models[key] && traffic.pool[key], key);
                    const x = (lane - 1) * 3;
                    const object = traffic.obstacles.find(obj => obj.key === key && at(obj, x, row.distance));
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
                if (!item.gate || item.key === 'coin' || seen.has(item.gate)) continue;
                assert.ok(-item.mesh.position.z / speed >= 1.55 - 1e-8);
                seen.add(item.gate);
            }
        }
        assert.ok(seen.size >= 16);
    }
});

test('both pickup escorts collect as stamps and pooled escorts return to the route style', () => {
    const seed = 9;
    const traffic = createTraffic();
    traffic.reset('day', seededRandom(seed));
    const pickup = layout(seed, 100).find(row => row.pickup === 'kafiyeh');
    const viewDistance = pickup.distance - 20;
    traffic.fillCourse(viewDistance);
    const escorts = traffic.obstacles.filter(({ type, mesh }) =>
        type === 'coin' && mesh.material === traffic.stampMaterials.kafiyeh
    );
    assert.deepEqual(escorts.map(({ mesh }) => [mesh.position.x, viewDistance - mesh.position.z]), [
        [(pickup.pickupLane - 1) * 3, pickup.distance - 5],
        [(pickup.pickupLane - 1) * 3, pickup.distance + 5]
    ]);
    for (const escort of escorts) {
        escort.mesh.position.set(0, 1.02, 0);
        assert.equal(traffic.checkCollisions({ mesh: new Group() }), 'coin');
        traffic.add('coin', 0, -8);
        assert.equal(traffic.obstacles.at(-1), escort);
        assert.equal(escort.mesh.material, traffic.stampMaterials.route);
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
    overtime = false, jumpLead = 0.35, actionInterval = 0 } = {}) {
    const source = streetCourse(seededRandom(seed), mode, () => overtime);
    let first;
    do { first = source.next().value; } while (!first.lanes || first.distance < at);
    const events = [first];
    while (events.length < size + 8) events.push(source.next().value);
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
        const jumpLane = row.lanes.indexOf('jumpGate');
        const slideLane = row.lanes.indexOf('slideGate');
        const railLane = row.lanes.indexOf('railGate');
        const takeSlide = railLane >= 0 ? strategy === 'slideChoice' :
            jumpLane < 0 || (strategy === 'slideChoice' && slideLane >= 0);
        const target = exitLane ?? (railLane >= 0 ? railLane : takeSlide ? slideLane : jumpLane);
        const action = row.gate && strategy !== 'laneOnly' ? (takeSlide ? 'down' : 'up') : null;
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
            if (hit === 'coin' && traffic.pool.coin.at(-1).mesh.material === traffic.stampMaterials.route) stamps++;
            if (traffic.lastStunt && row.gate) cleared.add(row.gate + ':' + traffic.lastStunt);
            time += dt;
        }
    }
    return { stamps, rows: rows.length, cleared, strikes };
}

test('unchanged player physics clear both routes through every tier and the Overtime cap', () => {
    for (const mode of ['day', 'night']) {
        for (const dt of [1 / 120, 1 / 60, 1 / 30, 1 / 20]) {
            for (const [at, overtime] of [[0], [500], [2000], [5000], [5000, true],
                [10000], [30000], [60000], [90000, true]]) {
                for (const strategy of ['jumpChoice', 'slideChoice']) {
                    const result = courseTrial(9, mode, { at, strategy, dt, overtime,
                        jumpLead: strategy === 'jumpChoice' ? 0.30 : 0.40 });
                    assert.deepEqual(result.strikes, [], `${mode} at ${at}m, ${dt}s, ${strategy}`);
                    assert.equal(result.stamps, result.rows);
                    if (at === 0 || at === 90000) {
                        assert.ok(result.cleared.has(strategy === 'jumpChoice' ? 'rail:jump' : 'rail:slide'));
                        assert.ok(result.cleared.has(strategy === 'jumpChoice' ? 'choice:jump' : 'choice:slide'));
                    }
                }
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
                assert.ok(late.strikes.some((hit, i) => i && hit.time - late.strikes[i - 1].time < 5),
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
