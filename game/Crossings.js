import * as THREE from 'three';
import { Batch, labelMaterial } from './Geometry.js';

const BRIDGE = 129, TUNNEL = 561, LENGTH = 96, LAP = 720;
const names = ['Brooklyn Bridge', 'Queens–Midtown Tunnel', 'Manhattan Bridge', 'Brooklyn–Battery Tunnel'];
const sides = [-1, 1];
const plane = new THREE.PlaneGeometry();
const rod = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
const dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const orientation = new THREE.Quaternion(), euler = new THREE.Euler();

export function crossingAt(metres) {
    if (metres < 0) return '';
    const lap = Math.floor(metres / LAP), local = metres - lap * LAP;
    const variant = (lap % 2) * 2;
    if (local >= BRIDGE && local < BRIDGE + LENGTH) return names[variant];
    if (local >= TUNNEL && local < TUNNEL + LENGTH) return names[variant + 1];
    return '';
}

// The interval includes both endpoints. Also catches scenery that straddles a whole crossing.
export function streetClear(from, to) {
    if (to < 0) return true;
    const lap = Math.max(0, Math.floor(from / LAP)) * LAP;
    return !(to >= lap + BRIDGE && from < lap + BRIDGE + LENGTH ||
        to >= lap + TUNNEL && from < lap + TUNNEL + LENGTH || to >= lap + LAP + BRIDGE);
}

function beam(b, color, x, y, z, ex, ey, ez, radius, rectangular = false) {
    dir.set(ex - x, ey - y, ez - z);
    const length = dir.length();
    orientation.setFromUnitVectors(up, dir.multiplyScalar(1 / length));
    euler.setFromQuaternion(orientation);
    const dims = [(x + ex) / 2, (y + ey) / 2, (z + ez) / 2];
    if (rectangular) b.box(color, ...dims, radius * 2, length, radius * 2, euler.x, euler.y, euler.z);
    else b.shape(rod, color, ...dims, radius, length, radius, euler.x, euler.y, euler.z);
}

// Rectangular UV grid, with optional baked brightness at each vertex. Used for the vault and
// solid Gothic spandrels so the arches have an actual opening all the way through.
function surface(columns, rows, sample) {
    const positions = [], uv = [], colors = [], indices = [];
    for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= columns; i++) {
            const [x, y, z, u, v, light = 1] = sample(i / columns, j / rows);
            positions.push(x, y, z);
            uv.push(u, v);
            colors.push(light, light, light);
            if (i && j) {
                const d = j * (columns + 1) + i, a = d - columns - 2;
                indices.push(a, a + 1, d, a, d, d - 1);
            }
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
}

function texture(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    paint(ctx, w, h);
    const map = new THREE.CanvasTexture(c);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
}

function random(seed) {
    return () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 4294967296);
}

function roadway(inside) {
    const map = texture(512, 512, (c, w, h) => {
        const noise = random(3183);
        c.fillStyle = inside ? '#343b41' : '#51575a';
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 12500; i++) {
            c.fillStyle = i % 3 ? 'rgba(211,206,189,.095)' : 'rgba(9,21,28,.21)';
            c.fillRect(noise() * w, noise() * h, 0.7 + noise() * 1.4, 0.7 + noise() * 1.9);
        }
        for (const side of sides) {
            const x = w * (0.5 + side * 0.39);
            if (inside) {
                for (let j = 0; j < 450; j++) {
                    const v = noise(), spread = (noise() + noise() - 1);
                    c.fillStyle = 'rgba(230,175,99,' + (0.04 + 0.2 * (1 - Math.abs(spread)) * Math.sin(Math.PI * v)) + ')';
                    c.fillRect(x + 29 * spread + 6 * Math.sin(v * 11), v * h, 1 + noise() * 6, 1 + noise() * 2);
                }
            }
            c.fillStyle = inside ? '#a49c85' : '#c7b48a';
            c.fillRect(w * (0.5 + side * 0.46) - 1.5, 0, 3, h);
            c.fillStyle = inside ? '#c3c0aa' : '#d4d2c2';
            c.fillRect(w * (0.5 + side * 0.148) - 1.6, 50, 3.2, 156);
        }
    });
    map.repeat.y = LENGTH / 8;
    return new THREE.MeshLambertMaterial({ map });
}

function road(group, material) {
    const mesh = new THREE.Mesh(plane, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(10.8, LENGTH, 1);
    mesh.position.z = -LENGTH / 2;
    mesh.receiveShadow = true;
    group.add(mesh);
}

function plaque(group, material, x, y, z, width, height) {
    const sign = new THREE.Mesh(plane, material);
    sign.position.set(x, y, z);
    sign.scale.set(width, height, 1);
    group.add(sign);
}

function waterMaterial() {
    const map = texture(512, 256, (c, w, h) => {
        const noise = random(47052);
        c.fillStyle = '#568990';
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 3300; i++) {
            const x = noise() * w, y = noise() * h, len = 2 + 21 * noise();
            c.strokeStyle = ['#66979b', '#497e88', '#48828a', '#76a3a0', '#92b1a6'][i % 5];
            c.globalAlpha = 0.22 + noise() * 0.54;
            c.lineWidth = 0.5 + noise() * 1.5;
            for (const offset of [0, -w]) {
                c.beginPath();
                c.moveTo(x + offset, y);
                c.quadraticCurveTo(x + offset + len * 0.55, y + 2, x + offset + len, y - 0.5);
                c.stroke();
            }
        }
    });
    map.repeat.set(9, 7);
    return new THREE.MeshBasicMaterial({ map });
}

function stoneMaterial() {
    const map = texture(256, 256, (c, w, h) => {
        const noise = random(144);
        c.fillStyle = '#887e70';
        c.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 32) {
            for (let x = (y % 64 ? -32 : 0); x < w; x += 64) {
                const n = Math.floor(noise() * 16);
                c.fillStyle = 'rgb(' + [192 + n, 172 + n, 147 + n].join(',') + ')';
                c.fillRect(x + 1, y + 1, 62, 30);
                c.fillStyle = 'rgba(255,242,214,.36)';
                c.fillRect(x + 1, y + 1, 62, 1.6);
                c.fillStyle = 'rgba(92,78,70,.15)';
                c.fillRect(x + 2, y + 29, 61, 1);
            }
        }
        for (let i = 0; i < 2000; i++) {
            c.fillStyle = i % 2 ? '#ffffff12' : '#59483e13';
            c.fillRect(noise() * w, noise() * h, noise() * 4 + 1, 1);
        }
    });
    return new THREE.MeshLambertMaterial({ map, vertexColors: true, side: THREE.DoubleSide });
}

// Two adjacent pointed openings share the middle pier. All three playable lanes go through
// one opening, as do the camera and the chase car. The parallel carriageway is across the pier.
function gothicTower(group, b, material, z) {
    const pitch = 13.75, radius = 5.65, spring = 5.45, peak = 12.65, crown = 14.65;
    for (const center of [0, -pitch]) {
        // A pair of circular arcs meet at the cusp, with vertical tangents at the springline.
        const rise = peak - spring, r = (rise * rise + radius * radius) / (2 * radius);
        const arch = x => spring + Math.sqrt(Math.max(0, r * r - (Math.abs(x) + r - radius) ** 2));
        for (const side of sides) {
            const f = (u, v) => {
                const x = side * radius * (1 - u * u), y = arch(x);
                return [x + center, y + (crown - y) * v];
            };
            for (const end of sides) {
                const wall = surface(10, 1, (u, v) => {
                    const [x, y] = f(u, v);
                    return [x, y, z + end * 1.12, x / 5.6, y / 3.1];
                });
                b.shape(wall, 0xffffff, 0, 0, 0);
                wall.dispose();
            }
            const soffit = surface(10, 1, (u, v) => {
                const [x, y] = f(u, 0);
                return [x, y, z + (v - 0.5) * 2.24, u * 2.5, v];
            });
            b.shape(soffit, 0xcbbda8, 0, 0, 0);
            soffit.dispose();
        }
    }
}

function masonryTower(group, details, stone, z) {
    gothicTower(group, stone, null, z);
    const trim = 0xb99e7e, lip = 0xd3baa0;
    for (const x of [-20.625, -6.875, 6.875]) {
        const w = 2.45;
        // Project the ashlar in metres on each face regardless of the pier proportions.
        const pier = new THREE.BoxGeometry(w, 20, 2.24).toNonIndexed();
        const p = pier.attributes.position, n = pier.attributes.normal, uv = pier.attributes.uv;
        for (let i = 0; i < p.count; i++) {
            uv.setXY(i, (Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / 5.6, p.getY(i) / 3.1);
        }
        stone.shape(pier, 0xffffff, x, 4.65, z);
        pier.dispose();
        for (const [y, h, width, depth] of [
            [0.5, 0.95, w + 0.48, 2.8], [5.45, 0.27, w + 0.26, 2.57],
            [14.35, 0.32, w + 0.44, 2.72], [14.85, 0.52, w + 0.18, 2.47],
            [15.21, 0.2, w + 0.45, 2.79], [15.48, 0.33, w - 0.36, 2.05]
        ]) details.box(trim, x, y, z, width, h, depth);
    }
    for (const [y, height, depth] of [[13.01, 0.14, 2.43], [14.46, 0.17, 2.64], [14.72, 0.17, 2.76]])
        details.box(lip, -6.875, y, z, 29.95, height, depth);
    // The three saddles stand proud of the granite cornice.
    for (const x of [-20.625, -6.875, 6.875]) details.box(0x665850, x, 15.71, z, 0.83, 0.31, 1.83);
}

function steelTower(b, z) {
    const blue = 0x537584, light = 0x87a1a6, dark = 0x3e5f71;
    for (const side of sides) {
        for (const offset of [-0.84, 0.84]) {
            const x = side * 6.8 + offset;
            b.box(dark, x, 7.4, z, 0.31, 18.2, 1.76);
            b.box(light, x, 7.9, z + 0.92, 0.46, 17.2, 0.13);
        }
        for (let y = 0; y < 16; y += 2) {
            beam(b, blue, side * 6.8 - 0.82, y, z + 0.87, side * 6.8 + 0.82, y + 2, z + 0.87, 0.09, true);
            beam(b, blue, side * 6.8 + 0.82, y, z + 0.87, side * 6.8 - 0.82, y + 2, z + 0.87, 0.09, true);
        }
        b.box(light, side * 6.8, 16.53, z, 2.27, 0.38, 2.35);
        b.box(dark, side * 6.8, 16.93, z, 1.6, 0.46, 1.8);
        b.box(blue, side * 6.8, 17.34, z, 0.8, 0.39, 1.1);
    }
    for (const y of [9, 11, 14.5, 16.1]) b.box(blue, 0, y, z, 15.52, 0.31, 1.88);
    for (let n = 0; n < 8; n++) {
        const x = -6 + n * 1.5;
        for (const [bottom, top] of [[9, 11], [14.5, 16.1]])
            beam(b, light, x, n % 2 ? top : bottom, z + 0.87, x + 1.5, n % 2 ? bottom : top, z + 0.87, 0.103, true);
    }
    for (const s of sides) {
        beam(b, dark, s * 5.9, 11.05, z, 0, 14.5, z, 0.19, true);
        beam(b, dark, s * 5.9, 14.5, z, 0, 11.05, z, 0.19, true);
    }
}

function ferry(b) {
    const x = 19, z = -49;
    b.box(0x304e58, x, -2.76, z, 7.3, 0.76, 2.6);
    b.box(0xd1a066, x, -2.46, z, 7.64, 0.19, 2.76);
    b.box(0xd0bf9c, x - 0.2, -1.99, z, 6.44, 0.82, 2.3);
    b.box(0xe3d9bc, x, -1.49, z, 6.85, 0.18, 2.54);
    b.box(0xc3925a, x + 1.98, -1.13, z, 1.42, 0.64, 1.75);
    for (const side of sides)
        for (let i = 0; i < 8; i++) b.box(0x3e5c64, x - 2.97 + i * 0.79, -1.94, z + side * 1.16, 0.54, 0.4, 0.04);
}

function bridge(group, mats, steel) {
    const b = new Batch(), stone = new Batch(), bulbs = new Batch();
    const iron = steel ? 0x496773 : 0x60534c, cable = steel ? 0x728995 : 0x796859;
    road(group, mats.bridgeRoad);
    const river = new THREE.Mesh(plane, mats.water);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, -3.1, -LENGTH / 2);
    river.scale.set(450, LENGTH, 1);
    group.add(river);
    b.box(iron, 0, -0.35, -48, 11.95, 0.67, LENGTH);
    for (const end of [0, -LENGTH])
        b.box(0x756f65, 0, -1.74, end, 450, 3.45, 0.32);
    for (const z of [-20, -76]) {
        if (steel) steelTower(b, z);
        else masonryTower(group, b, stone, z);
    }
    if (!steel) {
        group.add(stone.mesh(mats.stone));
        b.box(iron, -13.75, -0.53, -48, 8.8, 0.92, LENGTH);
        for (const x of [-18, -9.49]) {
            b.box(iron, x, 0.89, -48, 0.12, 0.14, LENGTH);
            for (let d = 0.5; d < LENGTH; d += 4)
                b.box(iron, x, 0.41, -d, 0.09, 0.98, 0.09);
        }
    }
    const sign = mats.signs[steel ? 2 : 0];
    plaque(group, sign, 0, steel ? 10 : 13.73, -18.83, 8.2, 0.97);
    const height = steel ? 16.5 : 15.5;
    const cableY = d => {
        if (d < 20) return 1.45 + (height - 1.45) * (d / 20) ** 1.26;
        if (d > 76) return 1.45 + (height - 1.45) * ((96 - d) / 20) ** 1.26;
        return 5.05 + (height - 5.05) * ((d - 48) / 28) ** 2;
    };
    const lines = steel ? [-6.8, 6.8] : [-20.625, -6.875, 6.875];
    const left = lines[0], right = lines[lines.length - 1];
    // Floor beams carry both carriageways out to the cable planes. The hangers land on
    // continuous edge girders, including between floor beams where the fan stays attach.
    for (let d = 2; d < LENGTH; d += 4)
        b.box(iron, (left + right) / 2, -0.39, -d, right - left + 0.3, 0.34, 0.36);
    for (const x of lines) {
        b.box(iron, x, -0.24, -LENGTH / 2, 0.33, 0.62, LENGTH);
        for (const z of [-0.28, -LENGTH + 0.28])
            b.box(iron, x, 0.68, z, 0.51, 1.57, 0.57);
        for (let d = 0; d < LENGTH; d += 4) {
            beam(b, cable, x, cableY(d), -d, x, cableY(d + 4), -d - 4, 0.142);
            if (d > 0) beam(b, iron, x, 0.03, -d, x, cableY(d), -d, 0.055);
        }
        if (!steel) {
            for (const tower of [20, 76])
                for (const offset of [-20, -13, -7, 7, 13, 20])
                    beam(b, cable, x, height - 0.3, -tower, x, 0.03, -(tower + offset), 0.048);
        }
    }
    for (const side of sides) {
        const x = side * 5.52;
        b.box(0x9c9787, x, 0.1, -48, 0.47, 0.2, LENGTH);
        for (const y of [0.35, 0.72, 1.13]) b.box(iron, x, y, -48, 0.095, y === 1.13 ? 0.12 : 0.063, LENGTH);
        for (let d = 0.5; d < LENGTH; d += 2)
            b.box(iron, x, 0.61, -d, 0.092, 1.12, 0.095);
        for (let d = 8; d < LENGTH; d += 16) {
            b.box(iron, x, 1.73, -d, 0.13, 3.46, 0.13);
            b.box(iron, x, 3.65, -d, 0.33, 0.15, 0.33);
            bulbs.box(0xffdc9e, x, 3.44, -d, 0.23, 0.32, 0.23);
        }
    }
    ferry(b);
    group.add(b.mesh(mats.structural), bulbs.mesh(mats.bulbs));
}

function tileMaterial(battery) {
    const map = texture(512, 512, (c, w, h) => {
        const noise = random(889), cols = 16, rows = 40;
        const tw = w / cols, th = h / rows;
        c.fillStyle = '#6b7370';
        c.fillRect(0, 0, w, h);
        for (let row = 0; row < rows; row++) {
            const v = row / rows;
            for (let col = -1; col < cols; col++) {
                const x = (col + (row % 2) * 0.5) * tw, n = Math.floor(noise() * 13);
                let rgb = [185, 188, 174];
                if (v < 0.13) rgb = [81, 92, 89];
                else if (v < 0.21 || row === 11) rgb = battery ? [128, 88, 57] : [55, 104, 102];
                else if (v < 0.27) rgb = battery ? [182, 142, 86] : [101, 144, 133];
                c.fillStyle = 'rgb(' + rgb.map(value => value + n).join(',') + ')';
                c.fillRect(x + 0.6, h - (row + 1) * th + 0.7, tw - 1.15, th - 1.2);
                c.fillStyle = 'rgba(247,236,205,.22)';
                c.fillRect(x + 1, h - (row + 1) * th + 1, tw - 2, 1);
            }
        }
        const shade = c.createLinearGradient(0, 0, 0, h);
        shade.addColorStop(0, battery ? 'rgba(25,32,39,.76)' : 'rgba(26,43,47,.78)');
        shade.addColorStop(0.29, 'rgba(31,43,46,.51)');
        shade.addColorStop(0.6, 'rgba(27,47,51,.32)');
        shade.addColorStop(1, 'rgba(25,39,44,.57)');
        c.fillStyle = shade;
        c.fillRect(0, 0, w, h);
        // Periodic illumination is baked into the ceramic, independent of camera distance.
        c.save();
        c.translate(w / 2, h * (battery ? 0.39 : 0.57));
        c.scale(w * 0.51, h * 0.49);
        const wash = c.createRadialGradient(0, 0, 0, 0, 0, 1);
        wash.addColorStop(0, 'rgba(255,216,149,.70)');
        wash.addColorStop(0.23, 'rgba(253,192,111,.42)');
        wash.addColorStop(0.62, 'rgba(245,174,95,.15)');
        wash.addColorStop(1, 'rgba(242,174,88,0)');
        c.fillStyle = wash;
        c.fillRect(-1, -1, 2, 2);
        c.restore();
    });
    return new THREE.MeshBasicMaterial({ map, vertexColors: true, side: THREE.DoubleSide });
}

// The first quarter of the unfolded wall is vertical. The rest sweeps over the camera.
function vaultPoint(side, v, inset = 0) {
    if (v < 0.25) return [side * (5.95 - inset), v * 11.6];
    const angle = (v - 0.25) * Math.PI / 1.5;
    return [side * (5.95 - inset) * Math.cos(angle), 2.9 + (5.1 - inset) * Math.sin(angle)];
}

function portal(b, group, sign, z, entrance, battery) {
    const pale = battery ? 0xbdab91 : 0xc5c2b0, shadow = battery ? 0x937d66 : 0x919990;
    const trim = battery ? 0x8d6447 : 0x567a74;
    // The upper facade follows the vault opening. Its solid rear face reads from inside the bore.
    for (const side of sides) {
        const cap = surface(14, 1, (u, v) => {
            const a = u * Math.PI / 2, x = side * Math.cos(a) * 5.95, y = 2.9 + Math.sin(a) * 5.1;
            return [x, y + (10.15 - y) * v, z, u, v];
        });
        b.shape(cap, pale, 0, 0, 0);
        cap.dispose();
        b.box(pale, side * 8.07, 4.88, z - 0.36, 4.24, 9.76, 1.12);
        b.box(shadow, side * 11.7, 2.4, z - 0.5, 3.3, 4.8, 1.44);
        b.box(trim, side * 11.7, 4.84, z - 0.5, 3.5, 0.26, 1.63);
        for (const sx of [6.48, 7.01, 9.64])
            b.box(shadow, side * sx, 4.63, z + 0.23, 0.2, 9.26, 0.47);
        b.box(trim, side * 8.42, 8.17, z + 0.39, 2.02, 0.13, 0.11);
        for (let i = 0; i < 5; i++)
            b.box(0x5a6966, side * 8.42, 7.79 - i * 0.28, z + 0.23, 1.66, 0.12, 0.11);
        b.box(pale, side * 8.14, 9.78, z - 0.33, 4.62, 0.37, 1.42);
        const rim = surface(17, 1, (u, v) => {
            const a = u * Math.PI / 2;
            return [side * Math.cos(a) * (5.95 + v * 0.49), 2.9 + Math.sin(a) * (5.1 + v * 0.49),
                z + (entrance ? 0.26 : -0.21), u, v];
        });
        b.shape(rim, shadow, 0, 0, 0);
        rim.dispose();
    }
    b.box(shadow, 0, 9.13, z - 0.13, 12.24, 1.57, 1.13);
    b.box(pale, 0, 10.03, z - 0.13, 12.89, 0.26, 1.45);
    b.box(trim, 0, 10.25, z - 0.16, 13.04, 0.15, 1.51);
    if (entrance) plaque(group, sign, 0, 9.15, z + 0.45, 11.66, 1.31);
}

function tunnel(group, mats, battery) {
    const b = new Batch(), lights = new Batch(), panels = new Batch();
    const spacing = battery ? 12 : 8;
    road(group, mats.tunnelRoad);
    for (const s of sides) {
        const shell = surface(24, 20, (u, v) => {
            const [x, y] = vaultPoint(s, v);
            const daylight = 1 - THREE.MathUtils.smoothstep(Math.min(u, 1 - u) * LENGTH, 0, 18);
            return [x, y, -u * LENGTH, u * LENGTH / spacing, v, 0.78 + 0.65 * daylight];
        });
        group.add(new THREE.Mesh(shell, mats.tiles[battery ? 1 : 0]));
        b.box(0x8a8a79, s * 5.61, 0.085, -48, 0.65, 0.17, LENGTH);
        for (let d = 0.5; d < LENGTH; d += spacing) {
            const z = -(d + spacing / 2 - 0.5), v = battery ? 0.61 : 0.43;
            const [x, y] = vaultPoint(s, v, 0.09);
            b.box(0x485252, x, y + 0.04, z, 0.42, 0.25, battery ? 2.65 : 1.28);
            lights.box(battery ? 0xffb564 : 0xffda95, x - s * 0.07, y - 0.06, z,
                0.38, 0.18, battery ? 2.48 : 1.08);
            if (battery) lights.box(0xffe0a8, x - s * 0.07, y - 0.08, z - 1.66, 0.28, 0.12, 0.38);
        }
        const [cx, cy] = vaultPoint(s, battery ? 0.6 : 0.43);
        b.box(0x56605d, cx - s * 0.035, cy + 0.14, -48, 0.12, 0.1, LENGTH);
        // Inset maintenance doors and a low cable trough establish the scale of the bore.
        for (let d = s < 0 ? 24 : 40; d < LENGTH - 5; d += 48) {
            b.box(0x344b4e, s * 5.88, 1.39, -d, 0.14, 2.47, 1.44);
            b.box(0x637875, s * 5.77, 1.36, -d, 0.08, 2.25, 1.21);
            b.box(0xb59d72, s * 5.71, 1.2, -d - 0.38, 0.08, 0.09, 0.2);
            b.box(0x4c796b, s * 5.79, 2.81, -d, 0.12, 0.24, 0.65);
        }
    }
    portal(panels, group, mats.signs[battery ? 3 : 1], -0.4, true, battery);
    portal(panels, group, null, -95.55, false, battery);
    group.add(b.mesh(mats.structural), panels.mesh(mats.portal), lights.mesh(mats.bulbs));
}

const dayWater = new THREE.Color(0xffffff), nightWater = new THREE.Color(0x4e6983);
const dayTiles = new THREE.Color(0xffffff), nightTiles = new THREE.Color(0xaea6a1);
const dayRoad = new THREE.Color(0xcdc6b3), nightRoad = new THREE.Color(0x979fae);

export class Crossings {
    constructor(scene) {
        const mats = {
            structural: new THREE.MeshLambertMaterial({ vertexColors: true }),
            portal: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
            bulbs: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
            water: waterMaterial(), stone: stoneMaterial(),
            bridgeRoad: roadway(false), tunnelRoad: roadway(true),
            tiles: [tileMaterial(false), tileMaterial(true)],
            signs: names.map((name, i) => labelMaterial([name.toUpperCase()],
                ['#394c48', '#245551', '#344e60', '#624b39'][i], '#fff3ce', 1024, 120))
        };
        this.materials = mats;
        this.riverStart = { value: -BRIDGE };
        this.groups = names.map((name, i) => {
            const group = new THREE.Group();
            group.name = name;
            if (i % 2 === 0) bridge(group, mats, i === 2);
            else tunnel(group, mats, i === 3);
            scene.add(group);
            return group;
        });
        this.update(0, 0);
    }

    // Cut a riverbed into World's flat ground plane. The local Z uniform stays small even
    // on very long runs, and each bank meets the true end of its neighboring street block.
    maskGround(ground) {
        const origin = this.riverStart;
        ground.material.onBeforeCompile = shader => {
            shader.uniforms.riverStart = origin;
            shader.vertexShader = 'varying float bankZ;\n' + shader.vertexShader.replace('#include <begin_vertex>',
                '#include <begin_vertex>\nbankZ = (modelMatrix * vec4(position, 1.0)).z;');
            shader.fragmentShader = 'uniform float riverStart; varying float bankZ;\n' +
                shader.fragmentShader.replace('#include <clipping_planes_fragment>',
                    '#include <clipping_planes_fragment>\nif(bankZ < riverStart && bankZ > riverStart - ' + LENGTH.toFixed(1) + ') discard;');
        };
        ground.material.needsUpdate = true;
    }

    coversBlock(midpoint) {
        return crossingAt(midpoint) !== '';
    }

    update(distance, night) {
        this.currentName = crossingAt(distance);
        const lap = Math.max(0, Math.floor((distance - BRIDGE + LAP / 2 - LENGTH / 2) / LAP));
        this.riverStart.value = distance - (BRIDGE + lap * LAP);
        for (let i = 0; i < 4; i++) {
            const start = (i % 2 ? TUNNEL : BRIDGE) + (i >= 2 ? LAP : 0);
            const cycle = Math.max(0, Math.floor((distance - start + LAP) / (2 * LAP)));
            const z = distance - (start + cycle * 2 * LAP);
            const group = this.groups[i];
            group.visible = z > -240 && z < LENGTH + 34;
            group.position.z = z;
        }
        if (night !== this.lastNight) {
            this.lastNight = night;
            const m = this.materials;
            m.water.color.lerpColors(dayWater, nightWater, night);
            m.tunnelRoad.color.lerpColors(dayRoad, nightRoad, night);
            m.tiles[0].color.lerpColors(dayTiles, nightTiles, night);
            m.tiles[1].color.copy(m.tiles[0].color);
            m.bulbs.color.setScalar(0.94 + 0.4 * night);
        }
    }
}
