import * as THREE from 'three';
import { Batch } from './Geometry.js';

const face = new THREE.PlaneGeometry();
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
const cone = new THREE.ConeGeometry(1, 1, 10);
const dough = new THREE.TorusGeometry(1.37, 0.7, 12, 40);
const seed = new THREE.SphereGeometry(1, 6, 3);
const ink = 0x293c40, brass = 0xcf9650, ivory = 0xf7e7bc, red = 0xb6362d, spruce = 0x225c51;

// Letterpress plates and a white swatch share one texture, including on moving props.
const plates = [
    ['strike', 'TRANSIT LOCAL 7', 'FARE STRIKE', '#9e2925', '#ffedc6', 2.9],
    ['pay', '', 'PAY UP', '#f4d262', '#372f29', 2],
    ['walk', '', 'WE WALK', '#f9e9c7', '#8a251d', 2.4],
    ['tv', '', 'LIVE 5', '#ae3029', '#fff1d7', 2.8],
    ['van', 'CITY WIRE TELEVISION', 'SPIN UNIT', '#f4e5c3', '#203e4b', 3.5],
    ['bagel', 'OFFICE OF BREAKFAST', 'BAGEL BAILOUT', '#193f41', '#ffe0a1', 5],
    ['counter', 'DAYS SINCE', 'LAST SCANDAL', '#243d3f', '#ffe4a4', 3.5],
    ['zero', '', '0', '#182e31', '#ffe4a4', 0.73],
    ['one', '', '1', '#182e31', '#ffe4a4', 0.73],
    ['permit', 'DEPT. OF PAPERWORK', 'PERMIT OFFICE', '#344d56', '#ffe4aa', 4.6],
    ['denied', '', 'DENIED', '#a73024', '#fff1d8', 3.3]
];
const tiles = {};
const paint = [0.51, 0.008, 0.48, 0.108];
const crust = [0.51, 0.133, 0.48, 0.108];

function paintMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 1024, 1024);
    let noise = 42;
    const random = () => ((noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0) / 4294967296);
    // Grain on the painted props and blisters on the bagel skin also read on the unlit sides.
    for (const [y, bake] of [[896, false], [768, true]]) {
        const gradient = ctx.createLinearGradient(0, y, 0, y + 128);
        gradient.addColorStop(0, bake ? '#d99150' : '#faf8f2');
        gradient.addColorStop(0.45, bake ? '#fac184' : '#ffffff');
        gradient.addColorStop(1, bake ? '#bd733d' : '#f2f0eb');
        ctx.fillStyle = gradient;
        ctx.fillRect(512, y, 512, 128);
        for (let i = 0; i < 2700; i++) {
            ctx.fillStyle = bake ? (i % 3 ? '#83472138' : '#ffdeb65c') : '#987d5e12';
            ctx.fillRect(512 + random() * 510, y + random() * 126, random() * 4 + 0.5, random() * 2 + 0.5);
        }
    }
    plates.forEach(([key, kicker, headline, paper, color, aspect], i) => {
        const x = (i % 2) * 512, y = Math.floor(i / 2) * 128, w = 128 * aspect;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(512 / w, 1);
        ctx.fillStyle = paper;
        ctx.fillRect(0, 0, w, 128);
        ctx.strokeStyle = ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(7, 6, w - 14, 116);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (kicker) {
            ctx.font = 'bold 21px Condensed, Arial';
            ctx.fillText(kicker, w / 2, 25, w - 32);
        }
        ctx.font = 'bold ' + (kicker ? 86 : 110) + 'px Condensed, Arial';
        ctx.fillText(headline, w / 2, kicker ? 78 : 65, w - 22);
        ctx.restore();
        tiles[key] = [(x + 2) / 1024, 1 - (y + 126) / 1024, 508 / 1024, 124 / 1024];
    });
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return new THREE.MeshLambertMaterial({ map, vertexColors: true });
}

class PaintedBatch extends Batch {
    shape(source, color, x, y, z, sx, sy, sz, rx, ry, rz, tile = paint) {
        super.shape(source, color, x, y, z, sx, sy, sz, rx, ry, rz, tile);
    }
    plate(key, x, y, z, w, h, angle = 0) {
        this.shape(face, 0xffffff, x, y, z, w, h, 1, 0, angle, 0, tiles[key]);
    }
    rod(color, x, y, z, ex, ey, ez, radius) {
        const dx = ex - x, dy = ey - y, dz = ez - z;
        const length = Math.hypot(dx, dy, dz);
        this.shape(cylinder, color, x + dx / 2, y + dy / 2, z + dz / 2,
            radius, length, radius, Math.atan2(dz, dy), 0, -Math.asin(dx / length));
    }
}

function piece(group, material, draw) {
    const paint = new PaintedBatch();
    draw(paint);
    const mesh = paint.mesh(material);
    group.add(mesh);
    return mesh;
}

function worker(b, x, z, coat, skin, sign, phase) {
    const stagger = phase ? 0.19 : -0.19;
    for (const side of [-1, 1]) {
        b.rod(ink, x + side * 0.17, 0.92, z, x + side * 0.23, 0.25, z + side * stagger, 0.115);
        b.oval(0x403830, x + side * 0.23, 0.2, z + side * stagger + 0.07, 0.15, 0.1, 0.22);
    }
    b.oval(coat, x, 1.2, z, 0.39, 0.49, 0.25);
    b.box(ivory, x, 1.18, z + 0.245, 0.59, 0.07, 0.025);
    for (const s of [-1, 1]) b.box(0xf2c873, x + s * 0.175, 1.38, z + 0.218, 0.068, 0.36, 0.07, 0, 0, -s * 0.14);
    b.oval(skin, x, 1.86, z, 0.23, 0.285, 0.22);
    b.oval(skin, x, 1.85, z + 0.187, 0.061, 0.072, 0.068);
    for (const s of [-1, 1]) b.box(ink, x + s * 0.088, 1.921, z + 0.199, 0.048, 0.026, 0.024);
    b.oval(coat, x, 2.03, z, 0.25, 0.15, 0.24);
    b.box(coat, x, 2.01, z + 0.16, 0.49, 0.045, 0.27);
    b.rod(coat, x - 0.27, 1.44, z, x - 0.43, 1.04, z + 0.16, 0.115);
    b.rod(coat, x + 0.27, 1.43, z, x + 0.36, 1.65, z + 0.17, 0.115);
    b.oval(skin, x + 0.36, 1.71, z + 0.17, 0.1, 0.13, 0.1);
    b.rod(brass, x + 0.37, 1.48, z + 0.17, x + 0.37, 2.7, z + 0.17, 0.038);
    const width = sign === 'strike' ? 2.05 : 1.4;
    b.box(0xc7aa78, x + 0.37, 2.73, z + 0.17, width + 0.01, 0.68, 0.06);
    b.plate(sign, x + 0.37, 2.73, z + 0.205, width, 0.675);
}

function picket(group, mat) {
    // The inflatable leans toward the avenue, with its tail tucked along the curb.
    const rat = piece(group, mat, b => {
        const hide = 0x766d64, belly = 0xc1a68a, pink = 0xd38474;
        b.oval(hide, 0, 2.12, 0, 1.13, 1.91, 1.08);
        b.oval(belly, 0, 1.99, 0.56, 0.86, 1.45, 0.66);
        b.oval(hide, 0, 4.12, 0.12, 1.02, 1.04, 0.88);
        for (const s of [-1, 1]) {
            b.oval(hide, s * 0.79, 4.96, -0.05, 0.49, 0.57, 0.2);
            b.oval(pink, s * 0.81, 4.99, 0.095, 0.35, 0.4, 0.11);
            b.oval(0xffcf75, s * 0.39, 4.27, 0.88, 0.21, 0.175, 0.09);
            b.oval(ink, s * 0.36, 4.26, 0.957, 0.085, 0.11, 0.05);
            b.box(0x483f3a, s * 0.41, 4.45, 0.95, 0.5, 0.11, 0.13, 0, 0, s * 0.24);
            b.oval(hide, s * 0.95, 2.87, 0.25, 0.32, 0.7, 0.3, -0.36, 0, s * 0.34);
            b.oval(pink, s * 1.14, 2.37, 0.52, 0.3, 0.19, 0.29);
            b.oval(hide, s * 0.68, 0.35, 0.27, 0.49, 0.26, 0.74);
            b.box(ivory, s * 0.14, 3.54, 1.21, 0.245, 0.41, 0.15, 0, 0, -s * 0.05);
            b.oval(belly, s * 0.27, 3.87, 0.89, 0.43, 0.36, 0.51);
            for (let i = 0; i < 3; i++)
                b.rod(0x594942, s * 0.45, 3.89, 1.21, s * 1.25, 3.71 + i * 0.19, 1.15, 0.021);
        }
        b.oval(pink, 0, 4.08, 1.34, 0.255, 0.16, 0.135);
        b.rod(pink, -0.45, 0.44, -0.18, -1.06, 0.29, -1.65, 0.12);
        b.rod(pink, -1.06, 0.29, -1.65, -0.64, 0.33, -2.48, 0.085);
    });
    rat.position.set(-6.63, 0.12, 2.65);
    rat.scale.setScalar(0.82);
    rat.rotation.y = 0.3;
    const marches = [0, 1].map(row => piece(group, mat, b => {
        for (let i = 0; i < 3; i++) {
            const x = row ? -6.45 : 5.92;
            const sign = !row && i === 0 ? 'strike' : i % 2 ? 'walk' : 'pay';
            worker(b, x + (i % 2) * 0.18, (row ? -1 : 5.9) - i * 2.17,
                [0xcc6e39, spruce, 0x526c83][(row + i) % 3], [0xaf7154, 0xdbac84, 0x795346][i], sign, i % 2);
        }
    }));
    return (t, reduced) => {
        rat.scale.y = 0.82 + (reduced ? 0 : 0.015 * Math.sin(2.2 * t));
        for (let i = 0; i < 2; i++) {
            marches[i].position.z = reduced ? 0 : Math.sin(t * 0.79 + i * 2.6) * 1.52;
            marches[i].position.y = reduced ? 0 : Math.abs(Math.sin(t * 5 + i)) * 0.055;
        }
    };
}

function broadcast(group, mat, lamps) {
    const van = piece(group, mat, b => {
        b.box(ink, 0, 0.62, 0, 4.45, 0.3, 1.76);
        b.box(ivory, -0.42, 1.44, 0, 3.6, 1.67, 1.9);
        b.box(ivory, 1.46, 1.15, 0, 1.19, 0.92, 1.86);
        b.box(0x35535e, 1.23, 1.84, 0, 0.92, 0.66, 1.75, 0, 0, -0.16);
        b.box(red, -0.16, 0.87, 0.965, 4.08, 0.16, 0.04);
        b.plate('van', -0.51, 1.62, 0.955, 3.19, 0.92);
        for (const x of [-1.48, 1.28]) {
            b.shape(cylinder, ink, x, 0.52, 0, 0.48, 2.0, 0.48, Math.PI / 2);
            b.shape(cylinder, brass, x, 0.52, 1.02, 0.22, 0.06, 0.22, Math.PI / 2);
        }
        b.rod(ink, -0.3, 2.29, 0, -0.4, 2.93, 0, 0.1);
        b.oval(ivory, -0.56, 3.14, 0, 0.99, 0.15, 0.82, 0.38, 0, 0.47);
        b.rod(ink, -0.54, 3.19, 0, -0.96, 3.86, 0.27, 0.04);
    });
    const heli = new THREE.Group();
    group.add(heli);
    piece(heli, mat, b => {
        b.oval(red, 0, 0, 0, 1.72, 0.76, 0.81);
        b.oval(0x345762, 0.75, 0.16, 0, 1.12, 0.68, 0.79);
        b.oval(0x769899, 0.84, 0.31, 0.56, 0.62, 0.32, 0.18, 0, 0, -0.16);
        b.rod(ivory, 0.78, 0.69, 0.46, 0.98, 0.02, 0.78, 0.042);
        b.rod(ivory, 0.95, 0.02, 0.78, 1.57, -0.16, 0.48, 0.038);
        b.oval(ivory, -0.65, 0.36, 0, 0.94, 0.55, 0.67);
        b.rod(red, -0.84, 0.06, 0, -3.47, 0.64, 0, 0.205);
        b.box(red, -3.33, 0.84, 0, 0.4, 1.12, 0.12, 0, 0, -0.29);
        for (const a of [-0.66, 0.91]) b.box(ink, -3.38, 0.95, 0.14, 0.93, 0.071, 0.065, 0, 0, a);
        b.oval(brass, -3.38, 0.95, 0.2, 0.12, 0.12, 0.045);
        b.box(ivory, -2.87, 0.56, 0, 0.57, 0.075, 1.12);
        b.box(ink, -0.2, 0.94, 0, 0.15, 0.42, 0.16);
        b.box(ivory, -0.31, -0.04, 0.77, 1.61, 0.61, 0.045);
        b.plate('tv', -0.31, -0.04, 0.8, 1.6, 0.6);
        b.oval(ink, 0.9, -0.56, 0.22, 0.28, 0.29, 0.28);
        b.oval(0x93cbc5, 0.94, -0.58, 0.443, 0.13, 0.135, 0.08);
        for (const s of [-1, 1]) {
            for (const x of [-0.82, 0.74])
                b.rod(ink, x, -0.46, s * 0.48, x - 0.1, -0.98, s * 0.83, 0.054);
            b.rod(ivory, -1.46, -0.98, s * 0.83, 1.23, -0.98, s * 0.83, 0.065);
            b.rod(ivory, 1.23, -0.98, s * 0.83, 1.53, -0.81, s * 0.83, 0.065);
        }
    });
    const rotor = piece(heli, mat, b => {
        for (let i = 0; i < 3; i++) {
            const a = i * Math.PI * 2 / 3;
            b.box(ink, 1.66 * Math.cos(a), 0, -1.66 * Math.sin(a), 3.32, 0.036, 0.17, 0, a);
            b.box(brass, 3.25 * Math.cos(a), 0.014, -3.25 * Math.sin(a), 0.17, 0.042, 0.17, 0, a);
        }
    });
    rotor.position.set(-0.2, 1.14, 0);
    heli.scale.setScalar(0.82);
    piece(group, mat, b => {
        for (let i = 0; i < 3; i++) {
            const x = 5.58 + i * 1.36, z = 0.6 - i * 0.39, y = 1.73 + (i % 2) * 0.26;
            for (const dx of [-0.4, 0.4]) b.rod(ink, x + dx, 0.12, z + 0.15, x, y, z, 0.042);
            b.rod(ink, x, 0.12, z - 0.45, x, y, z, 0.045);
            b.box(ink, x, y, z, 0.57, 0.44, 0.7);
            b.oval(0x658ba0, x, y, z + 0.36, 0.17, 0.17, 0.06);
            b.box(ivory, x - 0.14, y + 0.31, z + 0.1, 0.28, 0.17, 0.19);
        }
    });
    const glints = new Batch();
    for (let i = 0; i < 3; i++) glints.shape(face, 0xffe0af, 5.44 + i * 1.36,
        2.04 + (i % 2) * 0.26, 0.82 - i * 0.39, 0.6, 0.6, 1);
    const flash = glints.mesh(lamps.clone());
    group.add(flash);
    return (t, reduced) => {
        van.position.x = -7.45 - (reduced ? 0.3 : 1.5 + 1.5 * Math.cos(t * 0.68));
        heli.position.set(-12.8 + (reduced ? 0 : Math.sin(t * 0.45) * 0.65),
            19.5 + (reduced ? 0 : Math.sin(t * 0.83) * 0.14), -1);
        heli.rotation.set(0.04, -0.22, reduced ? 0 : Math.cos(t * 0.7) * 0.06);
        rotor.rotation.y = reduced ? 0.4 : t * 11;
        flash.visible = lamps.visible;
        // Each flare stays on the camera head. The night shift can also run with steady lamps.
        const glow = reduced ? 0.7 : 0.5 + Math.pow((1 + Math.sin(t * 2.9)) / 2, 6) * 1.25;
        flash.material.opacity = lamps.opacity * glow;
    };
}

function market(group, mat) {
    const x = 6.72;
    piece(group, mat, b => {
        for (const side of [-1, 1]) {
            for (const end of [-1, 1])
                b.rod(spruce, x + side * 1.12, 0.14, end * 2.08,
                    x + side * 1.12, 2.85, end * 2.08, 0.056);
            for (let i = 0; i < 9; i++) {
                const z = (i - 4) * 0.52, stripe = i % 2 ? ivory : 0xd65438;
                b.box(stripe, x + side * 0.68, 3.06, z, 1.55, 0.09, 0.524, 0, 0, -side * 0.46);
                b.box(stripe, x + side * 1.36, 2.61, z, 0.08, 0.34, 0.52);
            }
        }
        b.box(spruce, x, 0.7, 0.2, 2.17, 1.2, 3.71);
        b.box(brass, x, 1.35, 0.2, 2.32, 0.12, 3.84);
        for (let i = 0; i < 7; i++) {
            b.box(0xb87949, x - 0.74, 1.48, 1.67 - i * 0.51, 0.65, 0.19, 0.48);
            b.oval(0xe69b4f, x - 0.74, 1.64, 1.67 - i * 0.51, 0.28, 0.16, 0.2);
        }
        b.rod(brass, x, 3.32, 1.7, x, 3.73, 1.7, 0.075);
        b.box(spruce, x, 2.78, 2.36, 2.7, 0.57, 0.1);
        b.plate('bagel', x, 2.78, 2.415, 2.67, 0.55);
    });
    const bagel = piece(group, mat, b => {
        b.shape(dough, 0xffe2ae, 0, 0, 0, 1.19, 0.96, 0.85, 0, 0, 0, crust);
        // A baked crust with two staggered rows of sesame seeds around the front.
        for (let i = 0; i < 72; i++) {
            const a = i * 2.39996, tube = 0.65 + ((i * 7) % 17) / 10;
            const r = 1.37 + 0.7 * Math.cos(tube);
            b.shape(seed, i % 4 ? ivory : 0xffca77, Math.cos(a) * r * 1.19, Math.sin(a) * r * 0.96,
                Math.sin(tube) * 0.595, 0.083, 0.038, 0.03, 0, 0, a * 2);
        }
    });
    bagel.scale.setScalar(0.46);
    bagel.position.set(x, 4.48, 1.7);
    return (t, reduced) => {
        bagel.rotation.y = -0.25 + (reduced ? 0 : Math.sin(t * 0.8) * 0.3);
    };
}

function scandalClock(group, mat, lamps) {
    group.position.x = -6.72;
    group.rotation.y = 0.3;
    const bulbs = new Batch();
    piece(group, mat, b => {
        for (const x of [-0.88, 0.88]) {
            b.box(spruce, x, 0.92, 0, 0.26, 1.84, 0.47);
            b.box(brass, x, 0.93, 0.24, 0.065, 1.66, 0.04);
        }
        b.box(0x813c34, 0, 2.98, 0, 2.62, 2.5, 0.48);
        b.box(ink, 0, 2.59, 0.25, 2.43, 1.35, 0.05);
        b.plate('counter', 0, 3.7, 0.25, 2.56, 0.79);
        for (const y of [1.78, 4.19]) {
            b.box(brass, 0, y, 0.19, 2.73, 0.11, 0.3);
            for (let i = -3; i <= 3; i++) {
                const x = i * 0.37;
                b.shape(seed, 0xffdb8b, x, y, 0.35, 0.057, 0.058, 0.047);
                bulbs.shape(face, 0xffc36c, x, y, 0.41, 0.3, 0.3, 1);
            }
        }
        b.plate('zero', -0.48, 2.59, 0.28, 0.81, 1.15);
    });
    const drum = piece(group, mat, b => {
        // Four faces rotate about a physical axle, advancing to one then back to zero.
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2;
            b.shape(face, 0xffffff, 0, -Math.sin(a) * 0.83, Math.cos(a) * 0.83,
                1.28, 1.66, 1, a, 0, 0, tiles[i % 2 ? 'one' : 'zero']);
        }
    });
    drum.scale.set(0.63, 0.69, 0.69);
    drum.position.set(0.48, 2.59, -0.24);
    const trim = bulbs.mesh(lamps);
    group.add(trim);
    return (t, reduced) => {
        const phase = t % 3.6;
        const tick = THREE.MathUtils.smoothstep(phase, 1.5, 1.94) + THREE.MathUtils.smoothstep(phase, 2.6, 2.98);
        drum.rotation.x = reduced ? 0 : tick * Math.PI / 2;
        trim.visible = lamps.visible;
    };
}

function paperwork(group, mat) {
    piece(group, mat, b => {
        for (const s of [-1, 1]) {
            const x = s * 6.59;
            b.box(0x524d43, x, 0.66, 0, 2.66, 0.99, 4.31);
            for (let i = 0; i < 13; i++) {
                b.box(i % 3 ? 0xe9d9ac : 0xd2b88d, x + Math.sin(i * 4.7) * 0.06,
                    1.23 + i * 0.111, 0, 2.67, 0.105, 3.88, 0, Math.sin(i * 3.4) * 0.06);
            }
        }
        b.box(ink, -6.59, 1.76, 2.09, 2.53, 0.62, 0.09);
        b.plate('permit', -6.59, 1.76, 2.14, 2.49, 0.59);
        b.rod(ink, 6.65, 2.6, -1.14, 6.65, 4.23, -1.14, 0.13);
    });
    const stamp = piece(group, mat, b => {
        b.box(ink, 0, 0.16, 0, 2.94, 0.31, 2.48);
        b.box(0x9b4f32, 0, 0.67, 0, 3.03, 0.78, 2.54);
        b.plate('denied', 0, 0.66, 1.275, 2.8, 0.73);
        b.shape(cylinder, brass, 0, 1.14, 0, 0.72, 0.3, 0.72);
        b.shape(cone, 0x8b3327, 0, 1.84, 0, 0.83, 1.39, 0.83);
        b.shape(cylinder, 0x8b3327, 0, 2.04, 0, 0.39, 1.64, 0.39);
        b.oval(red, 0, 2.94, 0, 1.02, 0.88, 0.98);
    });
    stamp.scale.setScalar(0.78);
    stamp.position.x = 6.65;
    stamp.rotation.y = -0.22;
    return (t, reduced) => {
        const p = t % 2.85;
        const lift = THREE.MathUtils.smoothstep(p, 0.4, 1.75) * (1 - THREE.MathUtils.smoothstep(p, 2.3, 2.52));
        stamp.position.y = 2.62 + (reduced ? 0 : 0.78 * lift);
    };
}

const events = [
    ['Fare strike', picket], ['Spin unit', broadcast], ['Bagel bailout', market],
    ['Scandal clock', scandalClock], ['Permit office', paperwork]
];
const editions = [0, 1, 2, 3, 4, 1, 3, 0, 4, 2, 3, 1, 4, 0, 2];
const horizon = 158;
const maxEarlier = 96;
const curbOffsets = [0, 24, -24, 48, -48, 72, -72, 96, -96, 120];
const crossStreetOffsets = [0, 48, -48, 96, -96, 144];

export class CityEvents {
    constructor(scene, lamps, streetClear) {
        this.isClear = streetClear;
        this.motion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const mat = paintMaterial();
        this.sets = events.map(([label, build], id) => {
            const group = new THREE.Group();
            group.name = label;
            const animate = build(group, mat, lamps);
            scene.add(group);
            return { group, label, animate, id, at: -Infinity };
        });
    }

    place(set, station, speed) {
        set.at = -Infinity;
        const minGap = speed * (!this.night && this.index === 1 ? 3.4 : 4.7);
        // Assign once, in route order. Even a relocated van stays in a cross street.
        for (const offset of (set.id === 1 ? crossStreetOffsets : curbOffsets)) {
            const at = station + offset;
            if (at < 10 || at - this.lastPlaced < minGap) continue;
            // Give the entrance name a longer approach and leave the exit arch clear behind us.
            if (this.isClear && !this.isClear(at - 24, at + 36)) continue;
            set.at = this.lastPlaced = at;
            break;
        }
    }

    reset(mode, speed) {
        this.time = 0;
        this.index = 0;
        this.night = mode === 'night';
        this.next = this.night ? 23 : 21;
        this.lastPlaced = -Infinity;
        for (const set of this.sets) set.at = -Infinity;
        this.update(0, 0, speed);
    }

    update(dt, distance, speed) {
        this.time += dt;
        while (this.next <= distance + horizon + maxEarlier) {
            const edition = (this.index + (this.night ? 10 : 0)) % editions.length;
            const id = editions[edition];
            let at = this.next;
            // Cross streets start 15 m behind the spawn, then recur every 48 m.
            if (id === 1) at = 35.5 + Math.round((at - 35.5) / 48) * 48;
            this.place(this.sets[id], at, speed);
            this.index++;
            if (this.index === 1) this.next = this.night ? 179.5 : 131.5;
            // The opening bakery sign comes into view past the east-side tree.
            else if (this.index === 2 && !this.night) this.next = 264;
            else this.next = at + speed * (5.8 + (edition % 4) * 0.46);
        }
        let closest = Infinity;
        this.currentEventLabel = '';
        for (const set of this.sets) {
            const ahead = set.at - distance;
            set.group.visible = ahead >= -20 && ahead <= horizon;
            if (!set.group.visible) continue;
            set.group.position.z = -ahead;
            set.animate(this.time, this.motion.matches);
            if (ahead >= -3 && ahead < closest && ahead < 80) {
                this.currentEventLabel = set.label;
                closest = ahead;
            }
        }
    }
}
