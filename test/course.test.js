import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, MeshBasicMaterial, Scene } from 'three';
import { courseSpeed, streetCourse } from '../game/Course.js';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { Player } from '../game/Player.js';
import { PowerupManager } from '../game/PowerupManager.js';
import { World } from '../game/World.js';

const step = 1 / 60;
const lanes = [0, 1, 2];
const models = ['taxi', 'scaffold', 'halal', 'alcohol', 'protest0', 'protest1', 'protest2', 'coin'];
const noOp = () => {};

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
        light: { update: noOp }
    });
    world.reset(mode);
    return world;
}

test('day keeps gaining speed past three kilometres and Night Shift starts faster', () => {
    for (const mode of ['day', 'night']) {
        const world = worldWithoutScenery(mode);
        assert.equal(world.speed, mode === 'day' ? 17.5 : 29);
        let priorSpeed = world.speed;
        for (const checkpoint of [1000, 2000, 3000]) {
            while (world.distance < checkpoint) world.update(step);
            assert.ok(world.speed > priorSpeed + 6);
            priorSpeed = world.speed;
        }
        while (world.distance < 6000) world.update(step);
        assert.equal(world.speed, mode === 'day' ? 58 : 62);
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

test('late cards change sides, leave a readable gap, and block idle lanes in both modes', () => {
    for (const mode of ['day', 'night']) {
        for (let seed = 1; seed <= 64; seed++) {
            const rows = layout(seed, 700, mode).filter(row => row.lanes);
            if (mode === 'night') {
                assert.equal(rows[0].distance, 42);
                assert.equal(rows[0].lanes.filter((key, lane) => key && lane !== rows[0].exitLane).length, 2);
            }
            const late = rows.filter(row => row.distance > (mode === 'night' ? 0 : 1200));
            for (let i = 1; i < late.length; i++) {
                const { distance } = late[i];
                assert.ok((distance - late[i - 1].distance) / courseSpeed(distance, mode) >= 0.82);
            }
            for (let i = 0; i < late.length - 9; i++) {
                assert.ok(late.slice(i + 1, i + 9).some((row, offset) => Math.abs(row.exitLane - late[i + offset].exitLane) === 2));
            }
            for (const lane of lanes) {
                const hits = late.filter(row => lane !== row.exitLane && row.lanes[lane] && row.lanes[lane] !== 'alcohol');
                for (let i = 1; i < hits.length; i++) {
                    const previous = hits[i - 1].distance;
                    assert.ok((hits[i].distance - previous + 4) / courseSpeed(previous, mode) < 5);
                }
            }
        }
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
                    if (pickup.pickup === 'covidMask') duration += 83 / world.speed;
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

function trafficFor(seed, mode = 'day') {
    const scene = new Scene();
    const traffic = Object.assign(Object.create(ObstacleManager.prototype), {
        scene,
        powerups: new PowerupManager(scene),
        models: Object.fromEntries(models.map(key => [key, new Group()])),
        pool: Object.fromEntries(models.map(key => [key, []])),
        stampMaterials: Object.fromEntries(['route', 'rainbow', 'kafiyeh', 'covidMask'].map(key => [key, new MeshBasicMaterial()])),
        obstacles: []
    });
    traffic.reset(mode, seededRandom(seed));
    return traffic;
}

test('both pickup escorts collect as stamps and pooled escorts return to the route style', () => {
    const seed = 9;
    const traffic = trafficFor(seed);
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

function courseTrial(seed, mode, takeStunts) {
    const world = worldWithoutScenery(mode);
    const traffic = trafficFor(seed, mode);
    const player = Object.assign(Object.create(Player.prototype), {
        mesh: new Group(),
        shadow: Object.assign(new Group(), { material: {} }),
        rig: { pose: noOp, wear: noOp, material: { emissive: { setHex: noOp, setRGB: noOp } } },
        scarf: {}, sash: {}, mask: {}, flagAura: {}, bottleStars: {}
    });
    player.reset();
    const rows = layout(seed, 270, mode).filter(row => row.lanes);
    const maxSpeed = courseSpeed(10000, mode);
    const stuntsAtCap = new Set();
    let time = 0;
    let nextLaneInput = 0;
    let stamps = 0;
    for (const [i, row] of rows.entries()) {
        const { distance, exitLane } = row;
        for (const lead of [3, 2, 1]) {
            assert.ok(traffic.obstacles.some(({ type, mesh }) =>
                type === 'coin' && mesh.material === traffic.stampMaterials.route &&
                mesh.position.x === (exitLane - 1) * 3 &&
                Math.abs(world.distance - mesh.position.z - (distance - lead * row.stampStep)) < 1e-6
            ), `seed ${seed}, missing stamp cue for ${distance}m`);
        }
        const stuntLanes = lanes.filter(lane => ['taxi', 'scaffold', 'halal'].includes(row.lanes[lane]));
        const target = takeStunts && stuntLanes.length ? stuntLanes[i % stuntLanes.length] : exitLane;
        const action = target === exitLane ? null : row.lanes[target] === 'taxi' ? 'up' : 'down';
        let acted = false;
        while (world.distance < distance + 2.1) {
            const untilRow = (distance - world.distance) / world.speed;
            const pressed = new Set();
            if (untilRow <= 0.55 && time >= nextLaneInput && player.currentLane !== target) {
                pressed.add(player.currentLane < target ? 'right' : 'left');
                nextLaneInput = time + 0.13;
            }
            if (action && !acted && untilRow <= (action === 'up' ? 0.37 : 0.27)) {
                pressed.add(action);
                acted = true;
            }
            world.update(step);
            player.update(step, { isJustPressed: key => pressed.delete(key) }, world.speed);
            player.events.length = 0;
            traffic.update(step, world.speed, world.distance);
            traffic.powerups.update(step, world.speed);
            const hit = traffic.checkCollisions(player);
            assert.ok(hit === null || hit === 'coin', `seed ${seed}, row ${distance}m, lane ${target}, collision ${hit}`);
            if (hit === 'coin') stamps++;
            if (world.speed === maxSpeed && traffic.lastStunt) stuntsAtCap.add(traffic.lastStunt);
            time += step;
        }
    }
    return { stamps, stuntsAtCap };
}

test('stamp routes and deliberate stunts clear real collisions all the way to top speed', () => {
    for (const mode of ['day', 'night']) {
        for (const seed of [1, 9, 23, 52]) {
            assert.ok(courseTrial(seed, mode, false).stamps > 400);
            const { stuntsAtCap } = courseTrial(seed, mode, true);
            assert.ok(stuntsAtCap.has('cab') && stuntsAtCap.has('slide'), `${mode}, seed ${seed}`);
        }
    }
});
