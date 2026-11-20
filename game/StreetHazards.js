import { Color, Group } from 'three';
import { StreetMesh, tile } from './StreetHazardMesh.js';
import { placards } from './Posters.js';

const white = 0xffffff,
    rubber = 0x303738,
    alloy = 0xa8b5b6,
    bright = 0xdbe4df;
const gold = 0xffb819,
    forest = 0x2f5d46;

export function yellowCab() {
    const m = new StreetMesh();
    // A short-wheelbase four-door cab. The roof lamp is the very top of the jump volume.
    const sections = [
        [-1.656, 0.65, 0.26, 0.611],
        [-1.48, 0.74, 0.28, 0.66],
        [-0.98, 0.77, 0.34, 0.71],
        [-0.6, 0.774, 0.36, 0.735],
        [0.63, 0.774, 0.36, 0.725],
        [1.12, 0.764, 0.32, 0.67],
        [1.51, 0.728, 0.26, 0.627],
        [1.657, 0.682, 0.237, 0.595]
    ];
    const rings = sections.map(([z, w, b, t]) => [
        [-w * 0.9, b, z],
        [w * 0.9, b, z],
        [w, b + 0.1, z],
        [w, t - 0.07, z],
        [w * 0.89, t, z],
        [-w * 0.89, t, z],
        [-w, t - 0.07, z],
        [-w, b + 0.1, z]
    ]);
    // Paint the actual fascia and hood polygons so no decal can disappear into the curved shell.
    for (const [end, texture] of [
        [0, tile.trunk],
        [rings.length - 1, tile.grille]
    ]) {
        const [, w, b, t] = sections[end];
        const pts = end === 0 ? [...rings[end]].reverse() : rings[end];
        m.face(
            pts,
            texture,
            white,
            pts.map(([x, y]) => [0.5 + (x / (2 * w)) * (end === 0 ? -1 : 1), (y - b) / (t - b)])
        );
    }
    for (let n = 1; n < rings.length; n++) {
        const a = rings[n - 1],
            b = rings[n];
        for (let j = 0; j < 8; j++) {
            const k = (j + 1) % 8;
            if (j === 4 && sections[n - 1][0] >= 0.63) {
                const pts = [b[5], b[4], a[4], a[5]];
                m.face(
                    pts,
                    tile.hood,
                    white,
                    pts.map(([x, y, z]) => [0.5 + x / 1.45, (1.65 - z) / 1.02])
                );
            } else m.face([a[j], a[k], b[k], b[j]], 0, gold);
        }
    }
    const cabin = [
        [-1.13, 0.69, 0.704],
        [-0.64, 0.552, 1.133],
        [-0.35, 0.548, 1.161],
        [0.15, 0.548, 1.153],
        [0.71, 0.68, 0.715]
    ];
    const roof = cabin.map(([z, w, t]) => [
        [-0.693, 0.683, z],
        [0.693, 0.683, z],
        [w, t, z],
        [-w, t, z]
    ]);
    for (let n = 1; n < roof.length; n++) {
        const a = roof[n - 1],
            b = roof[n];
        const texture = n === 1 ? tile.sideGlass : n === 4 ? tile.windscreen : tile.paint;
        m.face([b[3], b[2], a[2], a[3]], texture, texture === tile.paint ? gold : white);
        for (const [lo, hi] of [
            [1, 2],
            [3, 0]
        ])
            m.face([a[lo], b[lo], b[hi], a[hi]].reverse(), 0, gold);
    }
    for (const side of [-1, 1]) {
        function sideFace(points, texture, color) {
            const vertices = points.map(([x, y, z]) => [side * x, y, z]);
            const [a, b, c, d] = vertices;
            m.face(side < 0 ? [b, a, d, c] : vertices, texture, color);
        }
        sideFace(
            [
                [0.694, 0.734, 0.632],
                [0.694, 0.734, -0.16],
                [0.559, 1.123, -0.16],
                [0.559, 1.119, 0.125]
            ],
            tile.sideGlass
        );
        sideFace(
            [
                [0.694, 0.734, -0.205],
                [0.694, 0.734, -1.03],
                [0.563, 1.095, -0.615],
                [0.559, 1.123, -0.205]
            ],
            tile.sideGlass
        );
        sideFace(
            [
                [0.775, 0.241, 0.72],
                [0.775, 0.241, -0.72],
                [0.775, 0.681, -0.72],
                [0.775, 0.681, 0.72]
            ],
            tile.doors
        );
        m.box(side * 0.758, 0.239, 0, 0.041, 0.048, 1.49, 0x565049);
        m.tube([side * 0.66, 0.735, 0.48], [side * 0.762, 0.781, 0.49], 0.022, rubber, 6);
        m.box(side * 0.774, 0.789, 0.48, 0.101, 0.073, 0.116, gold);
        for (const z of [-1.055, 1.03]) {
            m.wheel(side * 0.761, 0.27, z, 0.27, 0.13);
            // A folded wing lip follows each wheel without hiding the tire or hub.
            for (let i = 0; i < 8; i++) {
                const arc = (a, r) => [side * 0.795, 0.27 + Math.sin(a) * r, z + Math.cos(a) * r];
                const a = (i * Math.PI) / 8,
                    b = ((i + 1) * Math.PI) / 8;
                const p = [arc(a, 0.278), arc(a, 0.311), arc(b, 0.311), arc(b, 0.278)];
                m.face(side > 0 ? p.reverse() : p, 0, gold);
            }
        }
    }
    m.box(0, 1.176, -0.12, 0.415, 0.034, 0.221, rubber);
    m.box(0, 1.233, -0.12, 0.395, 0.094, 0.196, white, { front: tile.roofLamp, back: tile.roofLamp });
    return m.group();
}

export function halalCart() {
    const m = new StreetMesh();
    // The raised stainless cabinet starts exactly at the crouch clearance.
    for (const side of [-1, 1])
        for (const z of [-0.58, 0.58]) {
            const x = side * 1.047;
            m.wheel(side * 1.087, 0.185, z, 0.185, 0.095);
            m.box(x, 0.312, z, 0.1, 0.18, 0.1, 0x626e6c);
            m.tube([x, 0.32, z], [x, 1.4, z], 0.046, alloy);
            m.tube([x, 0.63, z], [x, 0.71, z], 0.057, bright);
        }
    for (const s of [-1, 1]) {
        m.tube([s * 1.048, 0.51, -0.58], [s * 1.048, 0.51, 0.58], 0.036, alloy);
        m.box(s * 1.042, 1.16, 0, 0.104, 0.4, 1.18, white, { side: tile.cabinet });
        m.tube([s * 1.048, 0.51, -0.58], [s * 1.048, 1.01, 0.54], 0.024, alloy);
    }
    m.box(0, 1.612, 0, 2.23, 0.504, 1.39, white, {
        front: tile.menu,
        back: tile.cabinet,
        side: tile.cabinet,
        top: tile.steel
    });
    m.box(0, 1.875, 0, 2.3, 0.045, 1.48, bright, { side: tile.steel, front: tile.steel });
    // Sneeze guard cheeks, the spit under its hood, hot pans and squeeze bottles.
    m.box(-0.58, 1.922, 0.27, 0.73, 0.058, 0.61, white, { top: tile.griddle, front: tile.steel });
    m.box(0.02, 1.922, 0.31, 0.38, 0.055, 0.48, 0xe1e3d8, { top: tile.steel });
    m.box(0.02, 1.96, 0.31, 0.13, 0.027, 0.031, rubber);
    m.box(0.665, 2.117, -0.282, 0.58, 0.46, 0.105, 0x87999a, { front: tile.corrugated });
    m.tube([0.675, 1.9, -0.032], [0.675, 2.413, -0.032], 0.023, bright);
    for (let i = 0; i < 7; i++) {
        const r = 0.097 + Math.sin((i / 9) * Math.PI) * 0.064;
        m.tube(
            [0.675, 1.96 + i * 0.05, -0.032],
            [0.675, 2.01 + i * 0.05, -0.032],
            r,
            [0xa94d24, 0xc37a40, 0x984526][i % 3],
            10,
            r + 0.007
        );
    }
    for (const [x, c] of [
        [-0.91, 0xa92c20],
        [-0.75, 0xffdf79],
        [-0.59, 0xf7f3d6]
    ]) {
        m.tube([x, 1.9, -0.34], [x, 2.049, -0.34], 0.045, c);
        m.tube([x, 2.049, -0.34], [x, 2.109, -0.34], 0.035, 0xece8ce, 8, 0.012);
    }
    const cx = -0.04,
        cz = -0.03;
    m.tube([cx, 1.89, cz], [cx, 3.05, cz], 0.032, alloy);
    const cloth = [0xffc03c, 0x9d2632, 0xffc03c, 0xf6e5bd];
    const canopy = (i, scale, y) => [
        cx + Math.cos((i * Math.PI) / 4 + Math.PI / 8) * 1.238 * scale,
        y,
        cz + Math.sin((i * Math.PI) / 4 + Math.PI / 8) * 0.815 * scale
    ];
    for (let i = 0; i < 8; i++) {
        const c = cloth[i % 4],
            tip = [cx, 3.041, cz],
            a = canopy(i, 1, 2.661),
            b = canopy(i + 1, 1, 2.661);
        const k = canopy(i, 0.62, 2.855),
            l = canopy(i + 1, 0.62, 2.855);
        m.face([tip, l, k], tile.canvas, c, [
            [0.5, 1],
            [1, 0],
            [0, 0]
        ]);
        m.face([k, l, b, a], tile.canvas, c);
        m.face([a, b, [b[0], 2.548, b[2]], [a[0], 2.548, a[2]]], tile.canvas, c);
        m.face([a, b, tip], tile.paint, 0xd4b498);
        m.tube([cx, 2.49, cz], k, 0.009, bright, 4);
    }
    return m.group();
}

export function sidewalkShed() {
    const m = new StreetMesh();
    for (const s of [-1, 1]) {
        const x = s * 1.102;
        for (const z of [-0.655, 0.655]) {
            m.box(x, 0.029, z, 0.205, 0.058, 0.233, 0x797e76);
            m.tube([x, 0.058, z], [x, 1.7, z], 0.049, alloy);
            for (const y of [0.29, 1.26]) m.tube([x, y, z], [x, y + 0.074, z], 0.066, 0x73847e);
        }
        m.tube([x, 0.29, -0.655], [x, 1.39, 0.655], 0.026, alloy);
        m.tube([x, 0.29, 0.655], [x, 1.39, -0.655], 0.026, bright);
        m.box(x, 1.53, 0, 0.13, 0.16, 1.55, forest);
    }
    // Flanges and web of the front and rear steel beams carry the timber deck.
    for (const z of [-0.665, 0.665]) {
        m.box(0, 1.384, z, 2.38, 0.048, 0.154, 0x557965);
        m.box(0, 1.474, z, 2.34, 0.14, 0.075, 0x345443);
        m.box(0, 1.567, z, 2.39, 0.046, 0.16, 0x75907a);
        m.box(0, 1.421, z + 0.043, 0.56, 0.066, 0.016, 0xfff2ce);
    }
    m.box(0, 1.648, 0, 2.42, 0.111, 1.6, white, { top: tile.planks, front: tile.planks, side: tile.planks });
    for (const s of [-1, 1]) {
        m.box(0, 1.936, s * 0.756, 2.42, 0.474, 0.073, white, {
            front: s === 1 ? tile.shed : tile.plywood,
            back: tile.plywood,
            side: tile.plywood,
            top: tile.plywood
        });
        m.box(s * 1.174, 1.936, 0, 0.072, 0.474, 1.44, white, {
            side: tile.permit,
            front: tile.plywood,
            top: tile.plywood
        });
    }
    m.box(0, 2.181, 0.754, 2.42, 0.038, 0.083, 0x729079);
    m.box(0, 2.181, -0.754, 2.42, 0.038, 0.083, 0x729079);
    return m.group();
}

export function signHolder(person, index) {
    const m = new StreetMesh();
    // The lath meets the existing hand. The board stays within the sign holder's lane footprint.
    const hand = index === 1 ? [0.252, 0.71, 0.079] : index === 2 ? [0.205, 0.71, 0.042] : [0.202, 0.71, -0.012];
    m.tube(hand, [0.302, 2.68, 0.183], 0.022, 0x9d754d, 4);
    const dye = new Color([0xbcdbcf, 0xa4bfd0, 0xdbaba3][index]);
    person.traverse((part) => {
        if (!part.isMesh || !part.name.toLowerCase().startsWith('outfit')) return;
        part.material = part.material.clone();
        part.material.color.multiply(dye);
    });
    const lean = [-0.037, 0.031, -0.017][index];
    const onBoard = (x, y, z) => [x + lean * (y - 2.39), y - lean * x, z];
    const board = (w, b, t, z) => [onBoard(-w, b, z), onBoard(w, b, z), onBoard(w, t, z), onBoard(-w, t, z)];
    const back = board(0.492, 2.017, 2.775, 0.189),
        front = board(0.492, 2.017, 2.775, 0.212);
    m.loft([back, front], 0xa58663);
    m.face(board(0.487, 2.023, 2.77, 0.214), tile.placard + index);
    // A canvas shoulder bag on the first holder. The other two wear lapel buttons.
    if (index === 0) {
        m.tube([-0.149, 1.38, 0.092], [-0.308, 0.78, 0.096], 0.019, 0x9b805d, 5);
        m.tube([-0.149, 1.38, 0.092], [-0.297, 0.78, -0.055], 0.019, 0x9b805d, 5);
        m.box(-0.289, 0.714, 0.075, 0.255, 0.253, 0.14, 0xfff4dc, { front: tile.tote });
    } else {
        const badgeCenter = index === 1 ? [-0.081, 1.315, 0.107] : [-0.115, 1.315, 0.094];
        const [x, y, z] = badgeCenter;
        m.tube([x + 0.003, y, z - 0.009], [x, y, z], 0.037, index === 1 ? 0xffc647 : 0xae4053, 10);
        m.face(
            [
                [x - 0.022, y - 0.005, z + 0.003],
                [x + 0.022, y - 0.005, z + 0.003],
                [x + 0.022, y + 0.004, z + 0.003],
                [x - 0.022, y + 0.004, z + 0.003]
            ],
            0,
            0xfff4d7
        );
    }
    const group = new Group();
    group.add(person, m.finish());
    group.userData.placard = placards[index].join(' / ');
    return group;
}
