import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, MeshBasicMaterial, Scene } from 'three';
import { streetCourse } from '../game/Course.js';
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

function layout(seed, size) {
    const course = streetCourse(seededRandom(seed));
    return Array.from({ length: size }, () => course.next().value);
}

function worldWithoutScenery() {
    const world = Object.assign(Object.create(World.prototype), {
        blocks: [],
        landmarks: { update: noOp },
        light: { update: noOp }
    });
    world.reset();
    return world;
}

const cappedWorld = worldWithoutScenery();
for (let frame = 0; frame < 60 / step; frame++) cappedWorld.update(step);
const maxSpeed = cappedWorld.speed;

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
            const atCap = hits.filter(row => row.distance > 800);
            for (let i = 1; i < atCap.length; i++) {
                assert.ok(atCap[i].distance - atCap[i - 1].distance < maxSpeed * 5 - 4, `seed ${seed}, late lane ${lane}`);
            }
        }
        const pickups = events.filter(row => row.pickup);
        assert.deepEqual(pickups.slice(0, 6).map(row => row.pickup), [
            'rainbow', 'kafiyeh', 'covidMask', 'rainbow', 'kafiyeh', 'covidMask'
        ]);
    }
    assert.equal(openings.size, 6);
});

function trafficFor(seed) {
    const scene = new Scene();
    const traffic = Object.assign(Object.create(ObstacleManager.prototype), {
        scene,
        powerups: new PowerupManager(scene),
        models: Object.fromEntries(models.map(key => [key, new Group()])),
        pool: Object.fromEntries(models.map(key => [key, []])),
        stampMaterials: Object.fromEntries(['route', 'rainbow', 'kafiyeh', 'covidMask'].map(key => [key, new MeshBasicMaterial()])),
        obstacles: []
    });
    traffic.reset(seededRandom(seed));
    return traffic;
}

test('both pickup escorts collect as stamps and pooled escorts return to the route style', () => {
    const seed = 9;
    const traffic = trafficFor(seed);
    const pickup = layout(seed, 20).find(row => row.pickup === 'kafiyeh');
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

function courseTrial(seed, takeStunts) {
    const world = worldWithoutScenery();
    const traffic = trafficFor(seed);
    const player = Object.assign(Object.create(Player.prototype), {
        mesh: new Group(),
        shadow: Object.assign(new Group(), { material: {} }),
        rig: { pose: noOp, wear: noOp, material: { emissive: { setHex: noOp, setRGB: noOp } } },
        scarf: {}, sash: {}, mask: {}, flagAura: {}, bottleStars: {}
    });
    player.reset();
    const rows = layout(seed, 270).filter(row => row.lanes);
    const stuntsAtCap = new Set();
    let time = 0;
    let nextLaneInput = 0;
    let stamps = 0;
    for (const [i, row] of rows.entries()) {
        const { distance, exitLane } = row;
        for (const lead of [12, 8, 4]) {
            assert.ok(traffic.obstacles.some(({ type, mesh }) =>
                type === 'coin' && mesh.material === traffic.stampMaterials.route &&
                mesh.position.x === (exitLane - 1) * 3 &&
                Math.abs(world.distance - mesh.position.z - (distance - lead)) < 1e-6
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
    for (const seed of [1, 9, 23, 52]) {
        assert.ok(courseTrial(seed, false).stamps > 400);
        const { stuntsAtCap } = courseTrial(seed, true);
        assert.ok(stuntsAtCap.has('cab') && stuntsAtCap.has('slide'), `seed ${seed}`);
    }
});
