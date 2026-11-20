import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Mesh, MeshBasicMaterial, Scene } from 'three';
import { CentralPark } from '../game/CentralPark.js';
import { parkRoute, PARK_LENGTH, parkStart } from '../game/ParkRoute.js';
import { ParkArt } from '../game/ParkArt.js';
import { courseSpeed, streetCourse } from '../game/Course.js';
import { streetClear } from '../game/Crossings.js';

function fixture() {
    const start = parkStart(33351);
    let seed = 24010;
    const rows = [];
    for (const row of streetCourse(() => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296), 'night', () => true)) {
        if (row.distance >= start - 160) rows.push(row);
        if (row.distance > start + PARK_LENGTH + 100) break;
    }
    const speed = courseSpeed(start, 'night') * 1.1;
    const plan = parkRoute(start, rows, 'night', true);
    assert.equal(rows.find(row => row.distance === 33351).lanes[0], 'railGate');
    assert.ok(plan && plan.entry > 33351 && plan.entry < 33432);
    const ctx = { fillRect() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 100 }) };
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    let art;
    try { art = new ParkArt(new Scene(), new MeshBasicMaterial(), new Mesh()); }
    finally { delete globalThis.document; }
    art.setRoute(plan, start);
    let boards = 0;
    const ride = Object.assign(Object.create(CentralPark.prototype), {
        start, plan, art, bike: new Group(), width: 0, bend: 0, armed: false, active: false, lastAt: plan.entry - 4,
        cycle: { reset() { return this; }, play() { boards++; }, stop() {} }
    });
    const player = { currentLane: 0, mesh: new Group(), isGrounded: true, slideTimer: 1 / 60, iceTimer: 0, confusionTimer: 0 };
    player.mesh.position.x = -2.98;
    const run = { world: { distance: plan.entry - 1, speed }, player, input: { pressed: new Set(['left']) },
        raceSchedule: { rivals: [] }, familyWins: 6, busRide: { active: false }, notify() {} };
    return { ride, run, plan, boards: () => boards };
}

test('the signed night Overtime dock accepts a grounded slide across a coarse step exactly once', () => {
    const { run, ride, plan, boards } = fixture();
    assert.ok(streetClear(plan.entry, plan.exit));
    ride.update(run);
    assert.ok(ride.armed && !ride.active);
    run.input.pressed.clear();
    run.world.distance += run.world.speed / 20;
    ride.update(run);
    assert.ok(ride.active && ride.bike.visible);
    assert.equal(run.player.slideTimer, 1 / 60);
    ride.update(run);
    assert.equal(boards(), 1);
    run.world.distance = plan.exit + 1;
    ride.update(run);
    assert.deepEqual([ride.active, ride.bike.visible, run.player.mesh.position.x], [false, false, -3]);
});

test('passing the dock in the left lane or driving a bus stays on the street', () => {
    const { run, ride, plan, boards } = fixture();
    run.input.pressed.clear();
    ride.update(run);
    run.world.distance = plan.entry + 1;
    ride.update(run);
    assert.equal(boards(), 0);
    run.input.pressed.add('left');
    run.busRide.active = true;
    ride.lastAt = run.world.distance = plan.entry - 1;
    ride.update(run);
    run.world.distance = plan.entry + 1;
    ride.update(run);
    assert.equal(boards(), 0);
});
