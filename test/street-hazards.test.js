import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { halalCart, sidewalkShed, signHolder, yellowCab } from '../game/StreetHazards.js';
import { railClearance, railInnerFoot, skillGateBounds, skillGateModels, slideClearance } from '../game/SkillGates.js';

const gates = skillGateModels();
const street = { taxi: yellowCab(), halal: halalCart(), scaffold: sidewalkShed() };
const near = (a, b) => Math.abs(a - b) < 0.001;
const alongLane = new Vector3(0, 0, -1);

function blocks(model, x, y) {
    model.updateMatrixWorld(true);
    return new Raycaster(new Vector3(x, y, 3), alongLane).intersectObject(model).length > 0;
}

test('visible gate width, height and foot depth teach the collision dimensions', () => {
    for (const [key, [w, top, d]] of Object.entries(skillGateBounds)) {
        const box = new Box3().setFromObject(gates[key]);
        for (const [value, expected] of [[box.min.x, -w], [box.max.x, w], [box.min.y, 0],
            [box.max.y, top], [box.min.z, -d], [box.max.z, d]]) {
            assert.ok(near(value, expected), key + ' ' + value + ' vs ' + expected);
        }
    }
    for (const x of [-0.72, 0, 0.72]) {
        assert.ok(blocks(gates.jumpGate, x, 0.2));
        assert.ok(!blocks(gates.jumpGate, x, 1.09));
        assert.ok(!blocks(gates.slideGate, x, slideClearance - 0.01));
        assert.ok(blocks(gates.slideGate, x, slideClearance + 0.01));
        assert.ok(blocks(gates.gateBlock, x, 0.7));
        assert.ok(blocks(gates.gateBlock, x, 2.05));
        assert.ok(!blocks(gates.railGate, x, railClearance - 0.01));
        assert.ok(blocks(gates.railGate, x, railClearance + 0.01));
        assert.ok(!blocks(gates.railGate, x, 1.29));
    }
    for (const side of [-1, 1]) {
        assert.ok(!blocks(gates.railGate, side * (railInnerFoot - 0.01), 0.05));
        assert.ok(blocks(gates.railGate, side * (railInnerFoot + 0.01), 0.05));
    }
    for (const key of ['jumpGate', 'slideGate']) {
        const clone = gates[key].clone();
        clone.getObjectByName('tutorialSign').visible = false;
        assert.ok(gates[key].getObjectByName('tutorialSign').visible);
    }
});

test('street furniture leaves the crouch path open and the cab roof light clears at jump height', () => {
    for (const model of [street.halal, street.scaffold]) {
        for (const x of [-0.7, 0, 0.7]) {
            assert.ok(!blocks(model, x, 1.35));
            assert.ok(blocks(model, x, 1.37));
        }
    }
    assert.ok(blocks(street.taxi, 0, 1.27));
    assert.ok(!blocks(street.taxi, 0, 1.29));
    for (const [model, w, d, h] of [[street.taxi, 0.83, 1.66, 1.28], [street.halal, 1.2, 0.8, 3.05],
        [street.scaffold, 1.21, 0.8, 2.2], ...[0, 1, 2].map(i => [signHolder(new Group(), i), 0.51, 0.33, 2.8])]) {
        const b = new Box3().setFromObject(model);
        assert.ok(b.min.x >= -w - 0.001 && b.max.x <= w + 0.001);
        assert.ok(b.min.z >= -d - 0.001 && b.max.z <= d + 0.001);
        assert.ok(b.max.y <= h + 0.001);
    }
});

