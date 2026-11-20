import * as THREE from 'three';
import { Batch, artTexture, labelMaterial } from './Geometry.js';
import { bikeLaneX, PARK_LENGTH, pathBend, pathWidth } from './ParkRoute.js';

const metal = new THREE.MeshLambertMaterial({ vertexColors: true });
const rod = new THREE.CylinderGeometry(1, 1, 1, 8);
const canopy = new THREE.IcosahedronGeometry(1, 1);
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

function bench(b, x, z) {
    for (const dx of [-.82, .82]) {
        b.box(ink, x + dx, .36, z, .10, .68, .55);
        b.box(ink, x + dx, .68, z - .28, .075, .85, .07);
    }
    for (const dz of [-.19, 0, .19]) b.box(0x967249, x, .61, z + dz, 2.1, .075, .16);
    for (const y of [.81, 1.01]) b.box(0x917149, x, y, z - .29, 2.1, .14, .066);
}

function sign(group, lines, x, y, z, w, h) {
    const panel = new THREE.Mesh(tile, labelMaterial(lines, '#194d3e', '#fff5d7', 640, Math.round(640 * h / w)));
    panel.position.set(x, y, z); panel.scale.set(w, h, 1);
    group.add(panel);
}

function surfaceMap(turf) {
    const c = document.createElement('canvas');
    c.width = c.height = 192;
    const ctx = c.getContext('2d');
    let state = 114;
    const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
    ctx.fillStyle = turf ? '#859c59' : '#679381';
    ctx.fillRect(0, 0, 192, 192);
    for (let i = 0; i < 4300; i++) {
        const v = random();
        ctx.fillStyle = v < .5 ? 'rgba(21,52,29,.14)' : 'rgba(231,222,167,.17)';
        ctx.fillRect(random() * 192, random() * 192, turf ? 1.7 : 1, turf ? v * 5 + 1 : 1.5);
    }
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    return map;
}

function parkGround(roadMaterial) {
    const group = new THREE.Group(), land = new Batch(), fronts = new Batch(), road = new Batch(), foliage = new Batch();
    const turf = surfaceMap(true);
    turf.repeat.set(12, 75);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(53, 336), new THREE.MeshLambertMaterial({map:turf}));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(-31, .01, -168);
    lawn.receiveShadow = true;
    group.add(lawn);
    land.box(0xb5a994, 9, .005, -168, 8, .07, 336);
    for (let i = 0; i < 7; i++) {
        road.shape(tile, 0xffffff, 0, .002, -24 - i * 48, 10, 48, 1, -Math.PI / 2);
    }
    for (let i = 0; i < 28; i++) {
        const z = -6 - i * 12, height = 12 + i * 11 % 14;
        fronts.box(i % 3 === 0 ? 0xd8bda5 : 0xe4cbb7, 18, height / 2, z, 11, height, 11.9);
        land.box(0xbfa88d, 18, height, z, 11.55, .44, 12);
        for (let j = 0; j < 2; j++) {
            const x = j ? -35 - i * 7 % 13 : -25 - i * 3 % 5, tz = z - j * 4;
            const h = 4.1 + i % 4;
            const treeH = h + 5;
            foliage.shape(tile, 0xffffff, x, treeH / 2, tz, (i % 2 ? -1 : 1) * treeH * .94, treeH, 1, 0, (i % 5 - 2) * .18);
        }
        if (i > 9 && i < 19) {
            const x = -6.7;
            foliage.shape(tile, 0xffffff, x - 1, 4.4, z, 7.7, 8.8, 1, 0, -.12);
            land.box(0x989888, x, .3, z, .48, .59, 12);
            land.box(0xb1ad94, x, .64, z, .58, .12, 12);
            for (let post = 0; post < 6; post++) land.box(green, x, 1.04, z - 5 + post * 2, .065, .76, .065);
            land.box(green, x, 1.36, z, .075, .075, 12);
        }
        if (i % 3 === 1) {
            bench(land, -20.9, z);
            tube(land, ink, -21.1, 0, z - 2, -21.1, 3.3, z - 2, .07);
            land.oval(0xf8e3ae, -21.1, 3.50, z - 2, .21, .29, .21);
            land.oval(green, -21.1, 3.79, z - 2, .24, .075, .24);
        }
        if (i > 8 && i < 17) {
            land.oval(0x719e99, -32, .018, z, 8.8, .027, 10);
            land.shape(canopy, 0x98938a, -22.9, .29, z - 3, 1.9, .94, 1.44);
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
    const street = road.mesh(roadMaterial);
    street.receiveShadow = true;
    const garden = land.mesh(metal);
    garden.receiveShadow = true;
    group.add(street, garden, fronts.mesh(new THREE.MeshLambertMaterial({ map: artTexture('facades'), vertexColors: true })),
        foliage.mesh(new THREE.MeshBasicMaterial({map:artTexture('locust'), alphaTest:.42, vertexColors:true, side:THREE.DoubleSide})));
    return group;
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

export class ParkArt {
    constructor(scene, roadMaterial, stampModel) {
        this.ground = parkGround(roadMaterial);
        this.route = new THREE.Group();
        this.ground.add(this.route);
        this.ribbon = [stripe(0xffffff, -1.48, 1.48, false, surfaceMap(false)), stripe(0xf6e5b2, -1.48, -1.43), stripe(0xf6e5b2, 1.43, 1.48),
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
    update(distance, start) {
        this.ground.position.z = distance - start;
        this.ground.visible = distance > start - 210 && distance < start + PARK_LENGTH + 40;
    }
}
