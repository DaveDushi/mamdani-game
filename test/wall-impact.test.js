import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { frontPage } from '../game/CityWire.js';

function sweep(startX, endX, startZ, travel, steps = 1, lanes = [null, 'gateBlock', null], y = 0) {
    const traffic = Object.assign(Object.create(ObstacleManager.prototype), {
        scene: new Group(), models: { gateBlock: new Group(), jumpGate: new Group() },
        pool: { gateBlock: [], jumpGate: [] }, obstacles: [], fillCourse() {}
    });
    const runner = { mesh: new Group(), slideTimer: 0 };
    runner.mesh.position.set(startX, y, 0);
    traffic.checkCollisions(runner);
    const gate = { hit: false, lanes };
    lanes.forEach((key, lane) => {
        if (key) traffic.add(key, (lane - 1) * 3, startZ).gate = gate;
    });
    for (let frame = 1; frame <= steps; frame++) {
        runner.mesh.position.x = startX + (endX - startX) * frame / steps;
        traffic.update(1 / steps, travel, frame * travel / steps);
        const hit = traffic.checkCollisions(runner);
        if (hit) {
            assert.equal(traffic.checkCollisions(runner), null, 'one hit per gate');
            return hit;
        }
    }
    return null;
}

test('a STREET CLOSED wall stops a frontal impact, while the outer shoulder can glance or clear', () => {
    for (const steps of [1, 3, 8]) {
        assert.equal(sweep(0, 0, -3, 4.675, steps), 'wall');
        assert.equal(sweep(1.4, 1.4, -3, 4.675, steps), 'gateBlock');
        assert.equal(sweep(1.8, 1.8, -3, 4.675, steps), null);
        assert.equal(sweep(0, 0, -3, 4.675, steps, undefined, 3), null);
    }
});

test('severity follows the runner at the face, including lateral movement across a whole wall in one Overtime step', () => {
    for (const steps of [1, 3, 8]) {
        assert.equal(sweep(2.8, -2, -3, 4.675, steps), 'wall', 'crossed the face then left');
        assert.equal(sweep(0, 3, -3.6, 4.675, steps), null, 'left before the face arrived');
        assert.equal(sweep(3, -2, -1, 4.675, steps), 'gateBlock', 'grazed the side after the front passed');
        assert.equal(sweep(3, 0, -1, 4.675, steps), null, 'entered the lane after the wall passed');
    }
    assert.equal(sweep(0, 0, -3, 16), 'wall', 'retire a crossed obstacle only after collision checks');
});

test('a pair of closed panels has no passable seam; an adjoining hurdle keeps its own rules', () => {
    assert.equal(sweep(1.5, 1.5, -3, 4.675, 1, [null, 'gateBlock', 'gateBlock']), 'wall');
    assert.equal(sweep(1.5, 1.5, -3, 4.675, 1, [null, 'gateBlock', 'jumpGate']), 'gateBlock');
    assert.equal(sweep(3, 3, -3, 4.675, 1, [null, 'gateBlock', 'jumpGate']), 'jumpGate');
    assert.equal(sweep(-1, 3, -2, 4.675, 1, [null, 'gateBlock', 'jumpGate']), 'wall');
});

test('the wall report names the crash and runs beneath the ordinary or Overtime headline', () => {
    for (const overtime of [false, true]) {
        const [headline, copy] = frontPage('wall', 3, overtime);
        assert.equal(headline, overtime ? 'Mamdani keeps NYC.' : 'Trump returns.');
        assert.match(copy, /head-on into a STREET CLOSED wall/);
    }
});
