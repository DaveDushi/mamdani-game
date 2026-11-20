import assert from 'node:assert/strict';
import test from 'node:test';
import { MeshBasicMaterial, Scene, Vector3 } from 'three';
import { CityEvents } from '../game/CityEvents.js';

function buildEvents(scene, motion) {
    const noop = () => {};
    const ctx = {
        save: noop, restore: noop, translate: noop, scale: noop,
        fillRect: noop, strokeRect: noop, fillText: noop,
        createLinearGradient: () => ({ addColorStop: noop })
    };
    globalThis.window = { matchMedia: () => motion };
    globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
    try {
        return new CityEvents(scene, new MeshBasicMaterial());
    } finally {
        delete globalThis.window;
        delete globalThis.document;
    }
}

test('animated city scenery stays beyond the five-metre curb on either side, at every height', () => {
    const scene = new Scene(), motion = { matches: false }, events = buildEvents(scene, motion);
    const p = new Vector3(), seen = new Set();
    for (const reduced of [false, true]) {
        motion.matches = reduced;
        events.reset('day', 24);
        for (let tick = 0; tick < 160; tick++) {
            events.update(0.25, tick * 6, 24);
            scene.updateMatrixWorld();
            for (const group of scene.children) {
                if (!group.visible || Math.abs(group.position.z) > 24) continue;
                seen.add(group.name);
                group.traverseVisible(mesh => {
                    if (!mesh.isMesh) return;
                    const geometry = mesh.geometry, points = geometry.getAttribute('position');
                    const count = geometry.index?.count ?? points.count;
                    for (let i = 0; i < count; i += 3) {
                        let left = Infinity, right = -Infinity;
                        for (let j = i; j < i + 3; j++) {
                            p.fromBufferAttribute(points, geometry.index ? geometry.index.getX(j) : j)
                                .applyMatrix4(mesh.matrixWorld);
                            left = Math.min(left, p.x);
                            right = Math.max(right, p.x);
                        }
                        // A billboard can span all three lanes even with every corner on a sidewalk.
                        if (left < 5 && right > -5) assert.fail(group.name + ' crosses the street');
                    }
                });
            }
        }
    }
    assert.equal(seen.size, 5);
});
