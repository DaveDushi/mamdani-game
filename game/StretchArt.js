import { Group, Mesh, PlaneGeometry } from 'three';
import { roadStencil } from './CivicSigns.js';
import { Batch, labelMaterial } from './Geometry.js';
import { StreetMesh, tile } from './StreetHazardMesh.js';

export const fairClearance = 1.38;
export const stretchBounds = { trashPile: [1.2, 1.0, .6], fairBanner: [1.42, 2.52, .3] };

const roadYellow = 0xffd45c, roadEdge = 0x2b2f33;

// A bent lane arrow lying flat on the asphalt. `side` is the lane it points to.
export function laneArrow(side, reach = 1) {
    const m = new StreetMesh();
    const flat = (points, y, color) => {
        const ring = points.map(([x, z]) => [side * x * reach, y, z]);
        m.face(side > 0 ? ring.reverse() : ring, tile.paint, color);
    };
    for (const [grow, y, color] of [[.11, .036, roadEdge], [0, .042, roadYellow]]) {
        flat([[-.36 - grow, 2.2 + grow], [-.36 - grow, .3 - grow], [.02 + grow, .3], [.02 + grow, 2.2 + grow]], y, color);
        flat([[-.36 - grow, .3], [.44, -1.1 - grow], [.8 + grow, -.8], [.02 + grow, .5 + grow]], y, color);
        flat([[.18 - grow * 1.4, -1.5 - grow], [1.28 + grow * 1.4, -2.0 - grow], [1.02 + grow, -.36 + grow]], y, color);
    }
    return m.finish(true);
}

function moveCue(side) {
    const group = new Group();
    group.add(laneArrow(side));
    return group;
}

function everyLane(name) {
    const group = new Group();
    for (const x of [-3, 0, 3]) {
        const sign = roadStencil(name);
        sign.position.x = x;
        group.add(sign);
    }
    return group;
}

function trashPile() {
    const b = new Batch();
    const black = 0x3b414b, shine = 0x59616d, blue = 0x5fa3c9, pale = 0xd9e0dc;
    const bags = [
        [-.84, .30, .10, .35, .31, .40, black], [-.31, .33, .16, .36, .34, .41, blue], [.27, .31, .13, .37, .32, .42, black],
        [.85, .29, .09, .34, .30, .40, pale], [-.58, .30, -.27, .36, .31, .31, shine], [.55, .31, -.28, .37, .32, .30, black],
        [-.50, .66, -.02, .33, .27, .33, black], [.08, .70, -.04, .34, .25, .34, shine], [.60, .64, .02, .31, .27, .32, blue]
    ];
    for (const [x, y, z, w, h, d, color] of bags) {
        b.oval(color, x, y, z, w, h, d, .12 * Math.sin(x * 9), x, .1 * Math.cos(x * 7));
        if (y < .6) continue;
        b.box(color, x, y + h * .9, z, .09, .09, .08, .2, .3, .5);
    }
    // Flattened cartons, a pizza box and the block's most confident resident.
    b.box(0xc08a52, -1.0, .36, .33, .07, .70, .48, .1, 0, -.26);
    b.box(0xd3a36a, 1.04, .30, .36, .06, .56, .40, .1, 0, .24);
    b.box(0xf0e2c4, .12, .06, .50, .48, .06, .18, 0, .1, 0);
    b.box(0xbd4a35, .12, .094, .50, .30, .012, .11, 0, .1, 0);
    b.oval(0x8d7f78, .33, .955, .06, .075, .042, .14);
    b.oval(0x8d7f78, .33, .965, .20, .045, .035, .06);
    b.box(0xd7a3a0, .33, .945, -.12, .016, .016, .18, 0, .3, 0);
    const group = new Group();
    group.add(b.mesh());
    return group;
}

function fairBanner() {
    const b = new Batch();
    const [w, top] = stretchBounds.fairBanner;
    for (const s of [-1, 1]) {
        const x = s * (w - .11);
        b.box(0x59636a, x, .05, 0, .2, .1, .56);
        b.box(0xf4ead2, x, top / 2, 0, .09, top, .09);
        b.box(0xd8493c, x, .72, 0, .1, .3, .1);
        b.box(0xd8493c, x, 1.62, 0, .1, .3, .1);
    }
    b.box(0xd8493c, 0, 1.70, 0, 2 * (w - .15), .60, .05);
    // Alternating pennants stop exactly at the crouch line.
    const colors = [0xffc53d, 0x2f9c8f, 0xf4ead2, 0x3b6fb5];
    for (let i = 0; i < 12; i++) {
        const x = -1.2 + i * .218;
        b.box(colors[i % 4], x, fairClearance + .075, .035, .15, .15, .03);
        b.box(colors[(i + 2) % 4], x, 2.17, .02, .15, .18, .03);
    }
    b.box(0xf4ead2, 0, 2.28, 0, 2 * (w - .15), .035, .035);
    const sign = new Mesh(new PlaneGeometry(2.36, .46), labelMaterial(['STREET FAIR'], '#fff0c9', '#a92f27', 512, 104));
    sign.position.set(0, 1.73, .031);
    const group = new Group();
    group.add(b.mesh(), sign);
    return group;
}

export function stretchModels() {
    return {
        trashPile: trashPile(), fairBanner: fairBanner(),
        moveLeftCue: moveCue(-1), moveRightCue: moveCue(1),
        hopCue: everyLane('jump'), duckCue: everyLane('duck')
    };
}
