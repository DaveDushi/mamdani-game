import test from 'node:test';
import assert from 'node:assert/strict';
import { crossingAt, streetClear } from '../game/Crossings.js';

test('crossings replace whole street blocks and keep all three landmark footprints on streets', () => {
    const bridges = ['Brooklyn Bridge', 'Manhattan Bridge'];
    const tunnels = ['Queens–Midtown Tunnel', 'Brooklyn–Battery Tunnel'];
    for (let lap = 0; lap < 80; lap++) {
        const start = lap * 720;
        for (const [offset, name] of [[129, bridges[lap % 2]], [561, tunnels[lap % 2]]]) {
            const enter = start + offset, exit = enter + 96;
            assert.equal((enter + 15) % 48, 0);
            assert.equal(crossingAt(enter - 0.01), '');
            assert.equal(crossingAt(enter), name);
            assert.equal(crossingAt(exit - 0.01), name);
            assert.equal(crossingAt(exit), '');
            assert.equal(streetClear(enter - 20, exit + 20), false);
            assert.equal(streetClear(enter - 10, enter), false);
            assert.equal(streetClear(exit, exit + 10), true);
        }
        for (const landmark of [32, 272, 512])
            assert.equal(streetClear(start + landmark - 5, start + landmark + 30), true);
        assert.equal(streetClear(start + 700, start + 720 + 129), false);
    }
});
