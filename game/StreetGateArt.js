import { Group } from 'three';
import { StreetMesh, tile } from './StreetHazardMesh.js';

const white = 0xffffff,
    orange = 0xf88b3a,
    yellow = 0xffdc63,
    cyan = 0xa4f1ed;
const steel = 0xa5b7b8,
    dark = 0x414b4a;
function sign(m, x, y, z, w, h, texture, color = white) {
    m.face(
        [
            [x - w / 2, y - h / 2, z],
            [x + w / 2, y - h / 2, z],
            [x + w / 2, y + h / 2, z],
            [x - w / 2, y + h / 2, z]
        ],
        texture,
        color
    );
}
function withTutorial(m, y, z, w, h, texture) {
    const plate = new StreetMesh();
    sign(plate, 0, y, z, w, h, texture);
    const guide = plate.finish(true);
    guide.name = 'tutorialSign';
    const group = new Group();
    group.add(m.finish(), guide);
    return group;
}

function jumpBarricade(w, top, depth) {
    const m = new StreetMesh();
    // Water-filled traffic separator: a splayed base, sloping shoulder and a narrow cap.
    const section = [
        [0, depth],
        [0, -depth],
        [0.19, -depth],
        [0.54, -0.265],
        [top - 0.08, -0.18],
        [top, -0.13],
        [top, 0.13],
        [top - 0.08, 0.18],
        [0.54, 0.265],
        [0.19, depth]
    ];
    const [left, right] = [-w, w].map(x => section.map(([y, z]) => [x, y, z]));
    m.face([...left].reverse(), tile.paint, orange);
    m.face(right, tile.paint, orange);
    for (let i = 0; i < section.length; i++) {
        const next = (i + 1) % section.length;
        // Molded ribs belong on the sloping front of the separator.
        if (i === 8) m.face([left[next], right[next], right[i], left[i]], tile.barrier);
        else m.face([left[i], left[next], right[next], right[i]], tile.paint, orange);
    }
    for (const s of [-1, 1]) {
        const x = s * 0.996;
        m.face(
            [
                [x - 0.43, 0.57, 0.264],
                [x + 0.43, 0.57, 0.264],
                [x + 0.43, 0.965, 0.19],
                [x - 0.43, 0.965, 0.19]
            ],
            tile.workStripe
        );
        m.box(s * (w - 0.13), top - 0.063, 0, 0.17, 0.094, 0.253, yellow);
    }
    return withTutorial(m, 0.8, 0.272, 1.49, 0.438, tile.jump);
}

function slidePortal(w, top, depth, clearance) {
    const m = new StreetMesh();
    for (const side of [-1, 1]) {
        const x = side * (w - 0.13);
        m.box(x, 0.046, 0, 0.254, 0.092, depth * 2, dark);
        for (const z of [-0.443, 0.443]) {
            m.box(x, top / 2, z, 0.144, top, 0.123, steel, { front: tile.steel, side: tile.steel });
            m.box(x, 0.495, z + 0.067, 0.104, 0.72, 0.014, cyan);
        }
        m.tube([x, 0.21, -0.443], [x, 1.38, 0.443], 0.034, steel, 6);
    }
    m.box(0, top - 0.054, 0, w * 2, 0.108, 1.01, steel, { front: tile.steel, top: tile.steel, side: tile.steel });
    const headerH = top - clearance - 0.19;
    m.box(0, clearance + headerH / 2, 0, w * 2 - 0.16, headerH, 0.82, 0xe0e6db, {
        front: tile.corrugated,
        back: tile.corrugated,
        side: tile.steel,
        top: tile.steel
    });
    m.box(0, clearance + 0.066, 0.428, w * 2 - 0.14, 0.132, 0.055, cyan);
    const y = clearance + 0.49;
    return withTutorial(m, y, 0.414, 1.61, 0.56, tile.slide);
}

function closedFence(w, top, depth) {
    const m = new StreetMesh();
    for (const s of [-1, 1]) {
        const x = s * (w - 0.156);
        m.box(x, 0.086, 0, 0.303, 0.172, depth * 2, 0x47473f);
        m.box(x, 1.266, 0, 0.118, 2.36, 0.113, steel);
        m.tube([x, 0.111, -0.498], [x, 1.55, -0.051], 0.041, steel);
        m.box(x, top - 0.159, 0, 0.233, 0.082, 0.204, dark);
        m.tube([x, top - 0.118, 0], [x, top, 0], 0.08, 0xffbc43, 10, 0.065);
    }
    m.box(0, 1.332, 0, 2 * w - 0.05, 2.357, 0.137, white, {
        front: tile.plywood,
        side: tile.plywood,
        back: tile.plywood,
        top: tile.plywood
    });
    for (const s of [-1, 1]) {
        m.tube([s * (w - 0.13), 0.43, 0.1], [-s * (w - 0.13), 2.36, 0.1], 0.045, 0x96a18c, 4);
    }
    for (const y of [0.402, 2.332]) {
        m.box(0, y, 0.14, 2 * w, 0.214, 0.079, white, {
            front: tile.workStripe,
            back: tile.workStripe,
            top: tile.steel,
            side: tile.steel
        });
    }
    m.box(0, 1.42, 0.161, 1.58, 0.877, 0.028, white, { front: tile.closed });
    return m.group();
}

function admissionRail(w, top, depth, clearance, innerFoot) {
    const m = new StreetMesh();
    const beamR = (top - clearance) / 2,
        center = clearance + beamR;
    for (const side of [-1, 1]) {
        const x = side * (innerFoot + 0.179);
        m.box(x, 0.047, 0, 0.358, 0.094, depth * 2, 0x596665, { top: tile.steel, side: tile.steel });
        m.tube([x, 0.09, 0], [x, center, 0], 0.061, steel, 10);
        for (const z of [-0.45, 0.45]) m.tube([x, 0.091, z], [x, 0.4, 0], 0.029, steel, 6);
        m.tube([x, 0.14, 0], [x, 0.285, 0], 0.074, 0x526364);
        m.tube([x, 0.49, 0], [x, 0.77, 0], 0.064, white);
        m.tube([x, center - 0.069, 0], [x, center + 0.069, 0], 0.105, 0x627577);
    }
    m.tube([-w, center, 0], [w, center, 0], beamR, 0xb4c1c0, 12);
    for (const s of [-1, 1]) {
        m.tube([s * 0.43, center, 0], [s * 0.87, center, 0], beamR, s === -1 ? yellow : cyan, 12);
        m.box(s * 1.054, center, 0, 0.176, 0.171, 0.181, white, { front: tile.workStripe });
    }
    sign(m, 0, center, beamR + 0.001, 0.66, 0.154, tile.tickets);
    return m.group();
}

export function streetGateArt(bounds, slideClearance, railClearance, innerFoot) {
    return {
        jumpGate: jumpBarricade(...bounds.jumpGate),
        slideGate: slidePortal(...bounds.slideGate, slideClearance),
        railGate: admissionRail(...bounds.railGate, railClearance, innerFoot),
        gateBlock: closedFence(...bounds.gateBlock)
    };
}
