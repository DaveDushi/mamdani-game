import * as THREE from 'three';
import { Batch, artTexture, labelMaterial } from './Geometry.js';
import { bikeLaneX, PARK_LENGTH, pathBend, pathWidth } from './ParkRoute.js';

const metal = new THREE.MeshLambertMaterial({ vertexColors: true });
const rod = new THREE.CylinderGeometry(1, 1, 1, 8);
const canopy = new THREE.IcosahedronGeometry(1, 1);
const shrub = new THREE.SphereGeometry(1, 7, 5);
const cube = new THREE.BoxGeometry();
const tile = new THREE.PlaneGeometry();
const ink = 0x203631, green = 0x215d48, brass = 0xb19a67, blue = 0x1989b4;

function tube(b, color, x, y, z, ex, ey, ez, radius) {
    const dx = ex - x, dy = ey - y, dz = ez - z;
    const length = Math.hypot(dx, dy, dz);
    b.shape(rod, color, (x + ex) / 2, (y + ey) / 2, (z + ez) / 2, radius, length, radius,
        Math.atan2(dz, dy), 0, -Math.asin(dx / length));
}

export function parkBike() {
    const b = new Batch(), radius = .365;
    const tyre = new THREE.TorusGeometry(radius, .049, 6, 32);
    const rim = new THREE.TorusGeometry(radius - .053, .019, 5, 32);
    const fender = new THREE.TorusGeometry(radius + .062, .040, 5, 20, Math.PI * .88);
    for (const z of [-.66, .66]) {
        b.shape(tyre, 0x202b30, 0, .415, z, 1, 1, 1, 0, Math.PI / 2);
        b.shape(rim, 0xb9c6be, 0, .415, z, 1, 1, 1, 0, Math.PI / 2);
        b.shape(fender, blue, 0, .415, z, 1, 1, 1.55, 0, Math.PI / 2, .17);
        for (let j = 0; j < 12; j++) {
            const a = j * Math.PI / 6;
            tube(b, 0x98aaa5, (j % 2 ? 1 : -1) * .039, .415, z, 0,
                .415 + .31 * Math.cos(a), z + .31 * Math.sin(a), .008);
        }
        b.shape(rod, ink, 0, .415, z, .071, .17, .071, 0, 0, Math.PI / 2);
    }
    tyre.dispose(); rim.dispose(); fender.dispose();
    for (const s of [-1, 1]) {
        tube(b, blue, .083 * s, .415, .66, .07 * s, .38, -.06, .031);
        tube(b, blue, .083 * s, .415, .66, .06 * s, .78, .17, .032);
        tube(b, 0xa8bdba, .085 * s, .415, -.66, .045 * s, .83, -.48, .039);
    }
    tube(b, blue, 0, .40, -.08, 0, .85, -.49, .082);
    tube(b, blue, 0, .4, -.08, 0, .79, .17, .067);
    tube(b, 0x29383c, 0, .48, -.17, 0, .72, -.40, .08);
    tube(b, ink, 0, .76, .16, 0, .93, .22, .037);
    b.oval(ink, 0, .94, .18, .16, .055, .19);
    tube(b, blue, 0, .80, -.47, 0, 1.15, -.40, .046);
    tube(b, 0xbac8bc, -.27, 1.16, -.40, .27, 1.16, -.40, .026);
    for (const s of [-1, 1]) tube(b, ink, s * .26, 1.16, -.40, s * .32, 1.15, -.31, .031);
    b.box(0x415561, 0, .88, -.72, .51, .048, .35);
    for (const y of [.91, 1.05]) {
        b.box(ink, 0, y, -.91, .53, .028, .025);
        for (const s of [-1, 1]) b.box(ink, .25 * s, y, -.735, .024, .028, .35);
    }
    for (const x of [-.24, -.12, 0, .12, .24]) b.box(ink, x, .98, -.91, .018, .15, .022);
    b.box(0xf7e3a4, 0, .89, -.925, .115, .07, .04);
    b.box(0xb33d2f, 0, .76, .95, .108, .064, .042);
    const bike = b.mesh(metal);
    bike.castShadow = true;
    return bike;
}

// Benches run along the paths. The back is on the side away from the one they face.
function bench(b, x, z, facing) {
    for (const dz of [-.82, .82]) {
        b.box(ink, x, .36, z + dz, .55, .68, .10);
        b.box(ink, x - facing * .28, .68, z + dz, .07, .85, .075);
    }
    for (const dx of [-.19, 0, .19]) b.box(0x967249, x + dx, .61, z, .16, .075, 2.1);
    for (const y of [.81, 1.01]) b.box(0x917149, x - facing * .29, y, z, .066, .14, 2.1);
}

// A cast-iron park lamp, with its halo in the street's shared glow material.
function parkLamp(b, glows, x, z) {
    b.shape(rod, ink, x, .24, z, .15, .48, .15);
    b.shape(rod, ink, x, 1.75, z, .062, 3.2, .062);
    b.oval(0xf8e3ae, x, 3.50, z, .21, .29, .21);
    b.oval(green, x, 3.79, z, .24, .075, .24);
    glows.shape(tile, 0xffcb75, x, 3.5, z + .24, 1.7, 1.7, 1);
    glows.shape(tile, 0xc08044, x + .6, .045, z, 4.2, 6.6, 1, -Math.PI / 2);
}

function sign(group, lines, x, y, z, w, h) {
    const panel = new THREE.Mesh(tile, labelMaterial(lines, '#194d3e', '#fff5d7', 640, Math.round(640 * h / w)));
    panel.position.set(x, y, z); panel.scale.set(w, h, 1);
    group.add(panel);
}

// Grass, cycle-track and paving grain. Batched ground tiles these in metres.
function surfaceMap(kind) {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    let state = 114;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    const dab = (fill, count, w, h) => {
        ctx.fillStyle = fill;
        for (let i = 0; i < count; i++) ctx.fillRect(random() * size, random() * size, w * (.5 + random()), h * (.5 + random()));
    };
    if (kind === 'turf') {
        ctx.fillStyle = '#74904c';
        ctx.fillRect(0, 0, size, size);
        for (const tint of ['rgba(44,76,32,.17)', 'rgba(150,164,84,.15)']) dab(tint, 70, 26, 18);
        for (const tint of ['rgba(34,63,27,.34)', 'rgba(190,200,118,.30)', 'rgba(60,98,44,.4)', 'rgba(122,146,72,.45)']) dab(tint, 1500, 1.5, 6);
        dab('rgba(236,226,170,.5)', 46, 2.2, 2.2);
    } else if (kind === 'track') {
        ctx.fillStyle = '#679381';
        ctx.fillRect(0, 0, size, size);
        dab('rgba(21,52,29,.14)', 3800, 1.4, 2);
        dab('rgba(231,222,167,.17)', 3800, 1.4, 2);
    } else {
        // Two square metres of flagstones, four slabs each way.
        ctx.fillStyle = '#b9b09f';
        ctx.fillRect(0, 0, size, size);
        for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
            const v = random();
            ctx.fillStyle = v < .5 ? 'rgba(88,76,64,' + (.04 + v * .22) + ')' : 'rgba(255,244,220,' + (v - .5) * .34 + ')';
            ctx.fillRect(col * 64, row * 64, 64, 64);
        }
        dab('rgba(70,62,55,.16)', 2400, 1.6, 1.6);
        dab('rgba(255,246,224,.2)', 1800, 1.5, 1.5);
        dab('rgba(60,52,46,.07)', 18, 34, 24);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = 'rgba(74,64,56,.62)';
            ctx.fillRect(i * 64, 0, 2.4, size);
            ctx.fillRect(0, i * 64, size, 2.4);
            ctx.fillStyle = 'rgba(255,246,226,.3)';
            ctx.fillRect(i * 64 + 2.4, 0, 1.4, size);
            ctx.fillRect(0, i * 64 + 2.4, size, 1.4);
        }
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 8;
    return map;
}

const LAWN_WIDTH = 88, LAWN_EDGE = -6.9;
// The cycle loop stays level. Beyond the footpath the meadow rises around the pond.
function meadowHeight(x, z) {
    const rise = THREE.MathUtils.smoothstep(-x, 27, 58);
    const pond = THREE.MathUtils.smoothstep(Math.hypot((x + 32) / 14, (z + 156) / 60), .95, 1.5);
    const ends = THREE.MathUtils.smoothstep(Math.min(-z, PARK_LENGTH + z), 0, 40);
    return rise * pond * ends * (3.1 + 1.5 * Math.sin(z * .041 + 1) + .7 * Math.sin(z * .11 + x * .16));
}

function meadow() {
    const geo = new THREE.PlaneGeometry(LAWN_WIDTH, PARK_LENGTH, 22, 84);
    geo.rotateX(-Math.PI / 2);
    geo.translate(LAWN_EDGE - LAWN_WIDTH / 2, 0, -PARK_LENGTH / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    const colors = new Float32Array(p.count * 3), tint = new THREE.Color();
    const sun = new THREE.Color(0xf6f3c4), shade = new THREE.Color(0x8fa87c), worn = new THREE.Color(0xd2bd8e);
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        p.setY(i, .006 + meadowHeight(x, z));
        // Broad mown bands, tree shade and dry patches break the lawn up at running speed.
        const drift = Math.sin(x * .31 + Math.sin(z * .071) * 2.2) + Math.sin(z * .153 + x * .09) + .8 * Math.sin(z * .37 - x * .5);
        tint.lerpColors(shade, sun, THREE.MathUtils.clamp(.5 + drift * .21, 0, 1));
        tint.lerp(worn, THREE.MathUtils.smoothstep(Math.sin(x * .83 + 2) * Math.sin(z * .093 + x * .05), .62, 1) * .75);
        if (x > LAWN_EDGE - 3) tint.lerp(shade, .6);
        tint.toArray(colors, i * 3);
        uv.setXY(i, x / 4.1, z / 4.1);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const lawn = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: surfaceMap('turf'), vertexColors: true }));
    lawn.receiveShadow = true;
    return lawn;
}

// Cards are lit as open canopy, so trees take the same dusk as the stone beside them.
function skyward(geometry) {
    const normal = geometry.attributes.normal;
    for (let i = 0; i < normal.count; i++) normal.setXYZ(i, 0, 1, 0);
    return geometry;
}

const wholeTree = [0, 0, 1, 1], mirroredTree = [1, 0, -1, 1], leaves = [.27, .50, .43, .30];
function tree(b, x, y, z, height, mirrored, angle, tint = 0xffffff) {
    b.shape(tile, tint, x, y + height / 2 - .1, z, height * .94, height, 1, 0, angle, 0, mirrored ? mirroredTree : wholeTree);
}

// Fifth Avenue keeps the street's own block: a cross street, then three buildings.
function avenue(land, fronts, civic, flags, foliage, glows, block) {
    const base = -block * 48;
    land.box(0x676360, 12, -.045, base - 2.48, 70, .08, 5.04);
    land.box(0x97928a, 9.2, .05, base - 26.5, 8.4, .14, 43);
    land.box(0xd7c7ac, 5.09, .1, base - 26.5, .2, .2, 43);
    flags.shape(tile, 0xffffff, 9.3, .128, base - 26.5, 8.2, 43, 1, -Math.PI / 2, 0, 0, [0, 0, 4.1, 21.5]);
    for (let j = 0; j < 3; j++) {
        const k = block * 3 + j, cell = (k * 5 + Math.floor(k / 4)) % 6, z = base - 12.2 - j * 14.05;
        const height = [13.6, 17, 15, 19, 14, 16][cell] + (k % 4 === 0 ? 3 : 0), depth = 13.7;
        const wall = 8.7 + (k % 3) * .5, width = 11, x = wall + width / 2;
        const limestone = k % 3 === 0;
        (limestone ? civic : fronts).shape(cube, 0xffffff, x, height / 2 + .12, z, width, height, depth, 0, 0, 0,
            limestone ? [2 / 3 + .001, (k % 2) * .5 + .001, 1 / 3 - .002, .498]
                : [(cell % 3) / 3 + .001, 1 - (Math.floor(cell / 3) + 1) / 2 + .001, 1 / 3 - .002, .498]);
        land.box(0x847869, x, height + .19, z, width + .28, .24, depth + .24);
        land.box(0xe5d3ac, x, height + .37, z, width + .42, .14, depth + .34);
        land.box(0x6a6a61, x, height + .46, z, width, .12, depth);
        land.box(0x928a79, x + 1, height + .95, z + 2, 2.5, 1, 1.6);
        const canvas = [0x395e4d, 0x854746, 0x4f6264, 0x6d3b36, 0x2f4d5a, 0x756f61][cell];
        if (limestone) {
            // A doorman's canopy reaches the curb on brass posts.
            land.box(canvas, wall - 1.35, 2.75, z, 2.7, .14, 2.1);
            land.box(canvas, wall - 2.68, 2.58, z, .07, .36, 2.1);
            for (const dz of [-.92, .92]) land.box(brass, wall - 2.6, 1.4, z + dz, .07, 2.6, .07);
        } else {
            land.box(canvas, wall - .46, height * .22, z, .98, .135, depth * .74, 0, 0, .2);
            land.box(canvas, wall - .93, height * .22 - .15, z, .08, .22, depth * .74);
        }
        for (const dz of [-4.6, 4.6]) {
            land.box(0x8b8273, wall - .45, .4, z + dz, .62, .56, 1.5);
            land.shape(shrub, 0x4d7446, wall - .45, .86, z + dz, .4, .36, .74);
        }
        // Set back behind the front row, so the block has depth from the river.
        fronts.shape(cube, 0xd3cdc9, x + 12.6, height * .62 + 2, z, 13, height * 1.24 + 4, depth, 0, 0, 0,
            [((k + 1) % 3) / 3 + .001, .501, 1 / 3 - .002, .498]);
        fronts.shape(cube, 0xc4bec0, x + 28, height * .8 + 2, z, 15, height * 1.6 + 4, depth, 0, 0, 0,
            [((k + 2) % 3) / 3 + .001, .001, 1 / 3 - .002, .498]);
        const tz = z + 5.6;
        land.box(0x4c5045, 6.05, .141, tz, 1.1, .026, 1.15);
        tree(foliage, 6.05, .14, tz, 5.4 + k % 3 * .5, k % 2, -.27);
        if (j === 1) {
            land.box(0x42616b, 6.14, .59, z - 2.2, .72, 1.12, .58);
            land.box(0xc4bba4, 6.14, .77, z - 1.89, .5, .46, .04);
            land.shape(rod, 0x445951, 6.15, .47, z - 4.4, .31, .86, .31);
            bench(land, 6.6, z + 1.2, -1);
        } else {
            land.shape(rod, 0x9e4a3c, 5.67, .47, z - 1, .16, .76, .16);
            land.oval(0xad5141, 5.67, .84, z - 1, .183, .16, .183);
        }
    }
    for (const z of [base - 5.8, base - 33]) {
        const x = 5.4;
        land.shape(rod, 0x475655, x, 2.28, z, .067, 4.56, .067);
        land.shape(rod, 0x36494a, x, .23, z, .165, .46, .165);
        land.box(0x475655, x - .51, 4.53, z, 1.07, .093, .1, 0, 0, .09);
        land.box(0xf5d199, x - 1.02, 4.42, z, .44, .06, .24);
        glows.shape(tile, 0xffcb75, x - 1.02, 4.41, z + .15, 1.35, 1.13, 1);
        glows.shape(tile, 0xe69c51, x - 1.66, .023, z, 4.1, 7.4, 1, -Math.PI / 2);
    }
}

function riverRail(b, z, from, to) {
    const width = to - from, x = (from + to) / 2;
    b.box(0x989888, x, .26, z, width, .62, .5);
    b.box(0xb1ad94, x, .6, z, width, .1, .62);
    for (const y of [.86, 1.34]) b.box(green, x, y, z, width, .06, .06);
    for (let at = from + .5; at < to; at += 2) b.box(green, at, .98, z, .06, .74, .06);
}

// One bay of the avenue wall: curb, dwarf wall, coping, railing and the hedge's core.
// Instanced along the park except where the loop's two curb cuts pass through it.
const BAY = 6, BAYS = PARK_LENGTH / BAY;
function wallBay() {
    const b = new Batch();
    b.box(0xd7c7ac, -5.09, .1, 0, .2, .2, BAY);
    b.box(0x989888, -7.2, .32, 0, .46, .62, BAY);
    b.box(0xb1ad94, -7.2, .67, 0, .6, .12, BAY);
    for (let post = 0; post < 4; post++) b.box(green, -7.2, 1.05, -2.25 + post * 1.5, .06, .74, .06);
    for (const y of [.86, 1.4]) b.box(green, -7.2, y, 0, .065, .065, BAY);
    b.box(0xa5a290, -7.2, .56, -BAY / 2, .74, 1.12, .74);
    b.box(0xc1bca4, -7.2, 1.16, -BAY / 2, .86, .12, .86);
    b.box(0x3d5c34, -8, .48, 0, .7, .95, BAY);
    return b.mesh(metal).geometry;
}

function hedgeBay() {
    const b = new Batch();
    for (let i = 0; i < 4; i++) {
        const z = -2.25 + i * 1.5;
        b.shape(tile, 0xb9cf9c, -7.62, .74, z, 1.85, 1.15, 1, 0, Math.PI / 2 - .12, 0, leaves);
        b.shape(tile, 0x9db884, -8, 1.02, z + .5, 1.5, .85, 1, 0, .35, 0, leaves);
        b.shape(tile, 0xa5bf8c, -8.42, .74, z, 1.85, 1.15, 1, 0, -Math.PI / 2 + .12, 0, leaves);
    }
    return skyward(b.mesh(metal).geometry);
}

function curbTree() {
    const pit = new Batch(), crown = new Batch();
    pit.box(0x4c5045, -6.3, .034, 0, 1.05, .02, 1.3);
    tree(crown, -6.3, 0, 0, 6, false, .14);
    return [pit.mesh(metal).geometry, skyward(crown.mesh(metal).geometry)];
}

function parkGround(roadMaterial) {
    const group = new THREE.Group();
    const [land, fronts, civic, road, foliage, flags, glows] = Array.from({ length: 7 }, () => new Batch());
    group.add(meadow());
    for (let i = 0; i < 7; i++) {
        road.shape(tile, 0xffffff, 0, .002, -24 - i * 48, 10, 48, 1, -Math.PI / 2);
        avenue(land, fronts, civic, flags, foliage, glows, i);
        // The promenade is flush, because the cycle loop crosses it at either curb cut.
        flags.shape(tile, 0xd5d0c6, -6, .014, -24 - i * 48, 2, 48, 1, -Math.PI / 2, 0, 0, [0, 0, 1, 24]);
    }
    // A gravel footpath winds between the loop and the pond.
    const bend = z => -24.7 + 1.6 * Math.sin(z * .035);
    for (let i = 0; i < 84; i++) {
        const z = -2 - i * 4;
        if (z < -100 && z > -214) continue;
        flags.shape(tile, 0xd9c49c, bend(z), .02, z, 2.5, 4.2, 1, -Math.PI / 2, 0,
            Math.atan2(bend(z + 2) - bend(z - 2), 4), [0, 0, 1.25, 2.1]);
    }
    for (let i = 0; i < 28; i++) {
        const z = -6 - i * 12;
        // Two rows of trees around the pond, and a far belt that closes the horizon.
        for (let j = 0; j < 2; j++) {
            const x = j ? -36 - i * 7 % 13 : -27.5 - i * 3 % 5, tz = z - j * 4;
            if (Math.hypot((x + 32) / 9.6, (tz + 156) / 54) < 1) continue;
            tree(foliage, x, meadowHeight(x, tz), tz, 9.1 + i % 4, i % 2, (i % 5 - 2) * .18, j ? 0xd9e2c8 : 0xffffff);
        }
        for (let j = 0; j < 3; j++) {
            const x = -56 - j * 12 - i * 5 % 9, tz = z + j * 3;
            tree(foliage, x, meadowHeight(x, tz) - .4, tz, 12.5 + (i + j) % 4 * 1.2, (i + j) % 2, .1 * (j - 1), 0xaebd9c);
        }
        if (i % 3 === 1) {
            bench(land, -21.5, z, 1);
            parkLamp(land, glows, -21.4, z - 2.4);
        }
        if (i % 4 === 2) {
            const x = -30 - i % 5 * 3;
            land.shape(shrub, 0x587d45, x, meadowHeight(x, z + 3) + .5, z + 3, 2.1, 1.1, 1.6);
        }
        if (i > 8 && i < 17) {
            land.oval(0x719e99, -32, .018, z, 8.8, .027, 10);
            land.shape(shrub, 0x98938a, -22.9 - i % 2 * .5, .29, z - 3, 1.5 + i % 3 * .3, .8, 1.44);
            // Sunk to the canopy, the same tree makes the pond's scrub.
            for (let j = 0; j < 3; j++) tree(foliage, -23.7 - j * .5, -1.05 - j * .1, z + j * 4, 2.5 + (i + j) % 3 * .3, (i + j) % 2, .2, 0xc3cf9a);
        }
    }
    // A shallow cast-iron footbridge over the pond, with a curved deck and balustrades.
    for (let i = 0; i < 14; i++) {
        const x = -40.5 + i * 1.25, y = .5 + 1.45 * Math.sin(Math.PI * (i + .5) / 14);
        land.box(0xbebba1, x, y, -151, 1.29, .32, 2.0);
        for (const side of [-1, 1]) {
            const z = -151 + side * 1.02;
            land.box(0xe1d9bb, x, y + .5, z, .085, 1, .085);
            land.box(0xdad4b6, x, y + 1.03, z, 1.29, .095, .1);
            tube(land, 0xa3ad94, x - .58, y + .15, z, x + .58, y + .77, z, .035);
        }
    }
    riverRail(land, -.5, -94, -18.8);
    riverRail(land, -.5, 7, 60);
    // The tunnel's retaining walls carry on across the top of the park, under a bank of trees.
    for (const [from, to] of [[-95, -13.4], [13.4, 62]]) {
        const x = (from + to) / 2, width = to - from;
        land.box(0x98968a, x, 2.1, -335.4, width, 4.2, 1);
        land.box(0xb4b09c, x, 4.3, -335.4, width, .26, 1.3);
        for (let i = 0; i * 7 < width - 3; i++) {
            const at = from + 3 + i * 7;
            land.box(0x8a887d, at, 2.1, -334.8, .9, 4.2, .3);
            if (from < 0) tree(foliage, at, 2, -336.6, 8.5 + i % 4, i % 2, 0, 0xb9c7a8);
        }
    }
    const street = road.mesh(roadMaterial);
    const paving = flags.mesh(new THREE.MeshLambertMaterial({ map: surfaceMap('flags'), vertexColors: true }));
    const garden = land.mesh(metal);
    street.receiveShadow = paving.receiveShadow = garden.receiveShadow = true;
    const leafy = new THREE.MeshLambertMaterial({ map: artTexture('locust'), alphaTest: .42, vertexColors: true });
    const trees = foliage.mesh(leafy);
    skyward(trees.geometry);
    group.add(street, paving, garden, trees,
        fronts.mesh(new THREE.MeshLambertMaterial({ map: artTexture('facades'), vertexColors: true })),
        civic.mesh(new THREE.MeshLambertMaterial({ map: artTexture('districts'), vertexColors: true })));
    if (roadMaterial.userData.lamps) group.add(glows.mesh(roadMaterial.userData.lamps));
    const [pit, crown] = curbTree();
    const bays = [new THREE.InstancedMesh(wallBay(), metal, BAYS), new THREE.InstancedMesh(hedgeBay(), leafy, BAYS),
        new THREE.InstancedMesh(pit, metal, BAYS / 2), new THREE.InstancedMesh(crown, leafy, BAYS / 2)];
    group.add(...bays);
    return { group, bays };
}

function dock() {
    const group = new THREE.Group(), b = new Batch();
    for (const x of [-7.6, -4.95]) {
        b.box(0x918674, x, .48, 0, .52, .96, .58);
        b.box(0xc7b79a, x, 1.00, 0, .67, .12, .7);
    }
    for (const x of [-7.4, -5.2]) b.box(green, x, 1.56, -.6, .115, 3.12, .12);
    sign(group, ['CENTRAL PARK', 'E-BIKE LOOP'], -6.3, 2.76, -.53, 3.30, 1.19);
    for (let i = 0; i < 4; i++) {
        b.box(0x32595b, -8.8 - i * .65, .40, 1.7, .23, .80, .57);
        b.box(0xcce1ca, -8.8 - i * .65, .83, 1.7, .26, .10, .52);
    }
    group.add(b.mesh(metal));
    return group;
}

function barrier(style) {
    const b = new Batch();
    if (style === 0) {
        b.box(0x916b45, 0, .34, 0, 1.86, .64, .80);
        for (const x of [-.89, .89]) b.box(0x4e5946, x, .35, 0, .075, .70, .86);
        b.box(0xc5ac7a, 0, .68, 0, 1.95, .09, .91);
        b.shape(canopy, 0x487a49, 0, .84, 0, .91, .39, .38);
        for (const x of [-.55, -.22, .28, .58]) b.oval(0xf2b453, x, 1.07, .02, .095, .10, .09);
    } else {
        for (const x of [-.75, .75]) {
            b.box(ink, x, .08, 0, .42, .15, .63);
            b.box(style === 1 ? green : 0xc36838, x, .58, 0, .19, 1.08, .20);
        }
        b.box(style === 1 ? green : 0xcb7341, 0, .81, 0, 1.85, .34, .16);
        for (const x of [-.61, 0, .61]) b.box(0xffe7b2, x, .81, .086, .18, .34, .018, 0, 0, -.28);
    }
    return b.mesh(metal);
}

// The route changes to meet the actual street rows. Reuse the ribbon buffers
// and the six pairs of gates for every appearance, including retries.
const sections = 80;
function stripe(color, left, right, dashed = false, map = null) {
    const geo = new THREE.BufferGeometry(), positions = new THREE.Float32BufferAttribute(new Float32Array((sections + 1) * 6), 3);
    geo.setAttribute('position', positions);
    const uv = new THREE.Float32BufferAttribute(new Float32Array((sections + 1) * 4), 2);
    for (let i = 0; i <= sections; i++) {
        uv.setXY(i * 2, 0, i * .65); uv.setXY(i * 2 + 1, 2, i * .65);
    }
    geo.setAttribute('uv', uv);
    const indices = [];
    for (let i = 0; i < sections; i++) if (!dashed || i % 3 === 0) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, map }));
    mesh.userData = { left, right, dashed };
    return mesh;
}

const place = new THREE.Matrix4();
// True where the loop, its dock or its exit needs the strip from the curb to the hedge.
export function crossesWall(plan, from, to) {
    if (!plan) return false;
    for (let at = from; at <= to; at += .5) {
        if (Math.abs(at - plan.entry) < 5 || Math.abs(at - plan.exit) < 3.5) return true;
        if (at < plan.entry || at > plan.exit) continue;
        const width = pathWidth(plan, at), center = bikeLaneX(1, width) + pathBend(plan, at, width);
        const half = 1.48 * (.42 + 2.23 * width);
        if (center - half < -4.9 && center + half > -8.9) return true;
    }
    return false;
}

export class ParkArt {
    constructor(scene, roadMaterial, stampModel) {
        const { group, bays } = parkGround(roadMaterial);
        this.ground = group;
        this.bays = bays;
        this.openWall(null, 0);
        this.route = new THREE.Group();
        this.ground.add(this.route);
        this.ribbon = [stripe(0xffffff, -1.48, 1.48, false, surfaceMap('track')), stripe(0xf6e5b2, -1.48, -1.43), stripe(0xf6e5b2, 1.43, 1.48),
            stripe(0xc6d8bc, -.515, -.485, true), stripe(0xc6d8bc, .485, .515, true)];
        this.entrance = dock();
        this.parked = parkBike();
        this.parked.rotation.y = -.68; this.parked.scale.setScalar(1.14);
        this.entrance.add(this.parked);
        this.parked.position.set(-4.45, .05, .55);
        this.exit = new THREE.Group();
        sign(this.exit, ['PARK EXIT', '5 AVENUE'], -7.3, 1.72, 0, 2.65, .97);
        const post = new Batch();
        post.box(ink, -7.3, .88, -.08, .13, 1.76, .13); this.exit.add(post.mesh(metal));
        this.route.add(...this.ribbon, this.entrance, this.exit);
        const models = [0, 1, 2].map(barrier);
        this.gates = Array.from({ length: 6 }, () => {
            const group = new THREE.Group(), pair = [models[0].clone(), models[1].clone()];
            const stamp = stampModel.clone();
            stamp.position.y = 1.04;
            group.add(...pair, stamp); this.route.add(group);
            return group;
        });
        this.models = models;
        this.ground.visible = false;
        scene.add(this.ground);
    }
    setRoute(plan, start) {
        this.route.visible = !!plan;
        this.openWall(plan, start);
        if (!plan) return;
        this.entrance.position.z = start - plan.entry;
        this.parked.visible = true;
        this.exit.position.z = start - plan.exit;
        this.ribbon.forEach((mesh, index) => {
            const p = mesh.geometry.attributes.position, { left, right } = mesh.userData;
            for (let i = 0; i <= sections; i++) {
                const at = plan.entry + (plan.exit - plan.entry) * i / sections;
                const width = pathWidth(plan, at);
                const center = bikeLaneX(1, width) + pathBend(plan, at, width), span = .42 + 2.23 * width;
                p.setXYZ(i * 2, center + left * span, .032 + index * .003, start - at);
                p.setXYZ(i * 2 + 1, center + right * span, .032 + index * .003, start - at);
            }
            p.needsUpdate = true;
            mesh.geometry.computeBoundingSphere();
        });
        this.gates.forEach((group, i) => {
            const gate = plan.gates[i];
            group.visible = !!gate;
            if (!gate) return;
            group.position.z = start - gate.at;
            group.position.x = pathBend(plan, gate.at, 1);
            group.children[2].position.x = bikeLaneX(gate.lane, 1);
            group.children.forEach(child => { child.visible = true; });
            let index = 0;
            for (let lane = 0; lane < 3; lane++) if (lane !== gate.lane) {
                const child = group.children[index++];
                child.position.x = bikeLaneX(lane, 1);
                child.geometry = this.models[(gate.style + lane) % 3].geometry;
            }
        });
    }
    // Lay the wall in every bay that the planned loop does not ride through.
    openWall(plan, start) {
        const counts = [0, 0, 0, 0];
        for (let i = 0; i < BAYS; i++) {
            const z = -BAY * (i + .5), at = start - z;
            if (crossesWall(plan, at - BAY / 2 - 1.5, at + BAY / 2 + 1.5)) continue;
            place.makeTranslation(0, 0, z);
            this.bays[0].setMatrixAt(counts[0]++, place);
            this.bays[1].setMatrixAt(counts[1]++, place);
            if (i % 2) continue;
            this.bays[2].setMatrixAt(counts[2]++, place);
            this.bays[3].setMatrixAt(counts[3]++, place);
        }
        this.bays.forEach((mesh, i) => {
            mesh.count = counts[i];
            mesh.instanceMatrix.needsUpdate = true;
            mesh.computeBoundingSphere();
        });
    }
    update(distance, start) {
        this.ground.position.z = distance - start;
        this.ground.visible = distance > start - 210 && distance < start + PARK_LENGTH + 40;
    }
}
