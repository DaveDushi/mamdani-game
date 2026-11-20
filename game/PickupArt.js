import * as THREE from 'three';
import { artTexture } from './Geometry.js';

// Texel rectangles in artwork/bake-pickup-atlas.py. Each island has a mipmap gutter.
const scarf = [4, 4, 248, 248],
    flag = [260, 4, 248, 144],
    mask = [260, 156, 248, 104];
const glass = [4, 264, 248, 244],
    label = [260, 270, 248, 120],
    metal = [260, 396, 248, 72];
const wovenBorder = [260, 478, 216, 30],
    white = [488, 478, 20, 30];
const TAU = 2 * Math.PI;

// The cloth, hems, knots and hardware share one indexed mesh per road object.
class Surface {
    positions = [];
    colors = [];
    uvs = [];
    indices = [];

    grid(cols, rows, tile, sample, tint = 0xffffff) {
        const first = this.positions.length / 3;
        const color = new THREE.Color(tint);
        const [x, y, width, height] = tile;
        for (let row = 0; row <= rows; row++) {
            for (let col = 0; col <= cols; col++) {
                const u = col / cols,
                    v = row / rows;
                const [px, py, pz, s = u, t = v, occlusion = 1] = sample(u, v, row);
                this.positions.push(px, py, pz);
                this.colors.push(color.r * occlusion, color.g * occlusion, color.b * occlusion);
                this.uvs.push((x + 0.5 + s * (width - 1)) / 512, 1 - (y + 0.5 + (1 - t) * (height - 1)) / 512);
                if (row && col) {
                    const d = first + row * (cols + 1) + col,
                        b = d - cols - 1;
                    this.indices.push(b - 1, b, d, b - 1, d, d - 1);
                }
            }
        }
    }

    turned(rings, sides, tile, tint = 0xffffff, cx = 0, cz = 0) {
        const bottom = rings[0][0],
            height = rings.at(-1)[0] - bottom;
        this.grid(
            sides,
            rings.length - 1,
            tile,
            (u, v, row) => {
                const [y, r] = rings[row],
                    a = (u - 0.5) * TAU;
                return [cx + r * Math.sin(a), y, cz + r * Math.cos(a), u, (y - bottom) / height];
            },
            tint
        );
    }

    cord(points, radius, tint, steps, sides = 5, taper = 0) {
        const path = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
        const rings = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps,
                direction = path.getTangent(t);
            const normal = new THREE.Vector3(direction.y, -direction.x, 0).normalize();
            rings.push([path.getPoint(t), normal, new THREE.Vector3().crossVectors(direction, normal)]);
        }
        this.grid(
            sides,
            steps,
            white,
            (u, v, row) => {
                const [p, a, b] = rings[row],
                    r = radius * (1 - taper * v);
                const c = Math.cos(TAU * u) * r,
                    s = Math.sin(TAU * u) * r;
                return [p.x + c * a.x + s * b.x, p.y + c * a.y + s * b.y, p.z + c * a.z + s * b.z];
            },
            tint
        );
    }

    geometry() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
        g.setIndex(this.indices);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        return g;
    }
}

function flagGeometry() {
    const b = new Surface(),
        pole = -0.68;
    b.turned(
        [
            [-0.74, 0.022],
            [-0.72, 0.028],
            [0.63, 0.028],
            [0.65, 0.022]
        ],
        10,
        white,
        0xac8153,
        pole
    );
    b.turned(
        [
            [0.61, 0.032],
            [0.65, 0.038],
            [0.665, 0.029],
            [0.679, 0.048],
            [0.708, 0.052],
            [0.749, 0.025],
            [0.759, 0.002]
        ],
        12,
        white,
        0xe6bc70,
        pole
    );
    // The hoist stays straight. The lower fly droops and twists away from the pole.
    b.grid(24, 7, flag, (u, v) => {
        const angle = u * 9.4 + v * 0.88 - 0.7;
        const billow = Math.sin(angle) * (0.052 + 0.177 * u) + 0.041 * Math.sin(angle * 1.9);
        const crease = 0.98 - 0.21 * Math.pow(Math.max(0, -Math.sin(angle)), 3);
        return [
            pole + 0.013 + 1.44 * u - 0.048 * u * Math.cos(angle),
            0.566 - 0.83 * (1 - v) - 0.23 * u * u - 0.068 * u * Math.sin(u * 5.4 + v * 0.8),
            0.029 + billow * Math.min(1, 5 * u) + 0.085 * u * (1 - v),
            u,
            v,
            crease
        ];
    });
    for (const y of [-0.255, 0.542])
        b.turned(
            [
                [y - 0.012, 0.032],
                [y + 0.012, 0.032]
            ],
            10,
            white,
            0xccab76,
            pole
        );
    return b.geometry();
}

function scarfPoint(s, v) {
    const width = 0.014 + 0.65 * v;
    const ridge = Math.sin(s * 8.7 + 1.3 * v);
    return [
        -0.07 * (1 - v) + s * width,
        -0.59 + v * (0.9 + 0.19 * s * s + 0.036 * s),
        0.11 + 0.102 * ridge * (0.35 + 0.65 * v) + 0.073 * (1 - v) - 0.093 * s * s
    ];
}

function scarfGeometry() {
    const b = new Surface();
    b.grid(24, 12, scarf, (u, v) => {
        const s = 2 * u - 1;
        const crease = 0.96 - 0.14 * Math.pow(Math.max(0, -Math.sin(s * 8.7 + 1.3 * v)), 2);
        return [...scarfPoint(s, v), 0.5 + 0.5 * s * v, v, crease];
    });
    // A second folded corner peeks out from behind the front triangle at the left hem.
    b.grid(12, 7, scarf, (u, v) => {
        const [x, y, z] = scarfPoint(u * 2 - 1, v);
        return [x * 0.85 - 0.12, y * 0.82 + 0.04, z - 0.18, 0.5 + (u - 0.5) * v, v, 0.77];
    });
    // Uneven concentric folds leave a soft opening at the neck, above the pointed bib.
    const folds = [
        [0.62, 0.19, 0.0],
        [0.68, 0.25, 0.042],
        [0.64, 0.2, 0.106],
        [0.56, 0.16, 0.097],
        [0.49, 0.13, 0.14],
        [0.37, 0.09, 0.13],
        [0.34, 0.08, 0.058]
    ];
    b.grid(38, folds.length - 1, wovenBorder, (u, v, row) => {
        const a = (u - 0.5) * TAU,
            [rx, rz, lift] = folds[row];
        const x = rx * Math.sin(a),
            front = Math.cos(a);
        const wrinkle = Math.sin(3 * a + 0.9 * v);
        return [
            x + 0.036 * wrinkle,
            0.39 + lift - 0.16 * front + 0.052 * x + 0.053 * wrinkle,
            0.02 + rz * front + 0.042 * Math.sin(4 * a + v),
            u,
            v,
            row === 3 || row === 6 ? 0.75 : 1
        ];
    });
    for (const side of [-1, 1]) {
        for (let i = 0; i < 8; i++) {
            const v = 0.068 + i * 0.122,
                [x, y, z] = scarfPoint(side, v);
            const twist = Math.sin(3 * i + side),
                length = 0.106 + 0.038 * twist;
            const knot = [x + 0.021 * side, y - 0.027, z + 0.009];
            b.cord(
                [[x - 0.012 * side, y + 0.012, z], knot, [x + 0.057 * side, y - length, z + 0.027 * twist]],
                0.017,
                i % 3 === 1 ? 0x333435 : 0xd4c5a6,
                3,
                5,
                0.53
            );
            b.cord(
                [knot, [x + 0.065 * side, y - 0.064, z + 0.012], [x + 0.077 * side, y - length * 0.89, z + 0.022]],
                0.01,
                i % 3 === 1 ? 0x58544b : 0xeee6ce,
                3,
                4,
                0.63
            );
        }
    }
    return b.geometry();
}

function maskGeometry() {
    const b = new Surface();
    for (const side of [-1, 1]) {
        const points = [
            [0.49, 0.188, 0],
            [0.645, 0.261, -0.048],
            [0.789, 0.235, -0.095],
            [0.837, 0.096, -0.13],
            [0.806, -0.055, -0.14],
            [0.696, -0.185, -0.095],
            [0.585, -0.212, -0.046],
            [0.493, -0.174, 0]
        ];
        b.cord(
            points.map(([x, y, z]) => [side * x, y, z]),
            0.021,
            0xf3f2e6,
            21,
            6
        );
    }
    // Each pleat doubles back behind its lip and pinches flat at the sonic-welded ends.
    const rows = [
        [0, 0],
        [0.045, 0.014],
        [0.21, 0.028],
        [0.283, 0.062],
        [0.27, 0.01],
        [0.43, 0.026],
        [0.506, 0.065],
        [0.493, 0.008],
        [0.65, 0.025],
        [0.748, 0.062],
        [0.736, 0.01],
        [0.9, 0.024],
        [0.967, 0.016],
        [1, 0]
    ];
    const face = (u, h, fold) => {
        const s = 2 * u - 1,
            dome = 1 - s * s;
        return [
            s * (0.529 - 0.023 * Math.pow(Math.abs(2 * h - 1), 6)),
            (2 * h - 1) * (0.209 + 0.102 * dome) + 0.012 * s,
            0.014 + dome * (0.142 + 0.039 * Math.cos((h - 0.5) * Math.PI)) + fold * Math.min(1, dome * 2.5)
        ];
    };
    b.grid(20, rows.length - 1, mask, (u, v, row) => {
        const [h, depth] = rows[row];
        return [...face(u, h, depth), u, h];
    });
    const strip = Array.from({ length: 9 }, (_, i) => {
        const [x, y, z] = face(0.125 + i * 0.09375, 0.953, 0.015);
        return [x, y, z + 0.008];
    });
    b.cord(strip, 0.0135, 0xe3ebe5, 14, 6);
    return b.geometry();
}

function bottleGeometry() {
    const b = new Surface();
    b.turned(
        [
            [0, 0.17],
            [0.009, 0.196],
            [0.026, 0.216],
            [0.048, 0.228],
            [0.075, 0.232],
            [0.135, 0.231],
            [0.49, 0.231],
            [0.533, 0.229],
            [0.568, 0.219],
            [0.605, 0.197],
            [0.647, 0.16],
            [0.685, 0.119],
            [0.714, 0.094],
            [0.748, 0.083],
            [0.825, 0.078],
            [0.864, 0.081],
            [0.875, 0.091],
            [0.898, 0.091],
            [0.904, 0.079],
            [0.945, 0.077]
        ],
        24,
        glass
    );
    // The paper stands off the glass and wraps two-thirds of the way round the cylindrical body.
    b.grid(20, 1, label, (u, v) => {
        const a = (u - 0.5) * 3.96,
            r = 0.2335;
        const corner = Math.pow(Math.abs(2 * u - 1), 12) * 0.012;
        return [r * Math.sin(a), 0.145 + v * 0.342 + (1 - 2 * v) * corner, r * Math.cos(a)];
    });
    b.turned(
        [
            [0.902, 0.081],
            [0.908, 0.091],
            [0.925, 0.091],
            [0.932, 0.083],
            [0.937, 0.093],
            [0.95, 0.096],
            [0.998, 0.096],
            [1.007, 0.091],
            [1.014, 0.078],
            [1.016, 0.001]
        ],
        20,
        metal
    );
    return b.geometry();
}

const builders = { rainbow: flagGeometry, kafiyeh: scarfGeometry, covidMask: maskGeometry, alcohol: bottleGeometry };
const geometryCache = new Map(),
    materialCache = new Map();

export function roadPickup(type) {
    if (!geometryCache.has(type)) geometryCache.set(type, builders[type]());
    const finish = type === 'alcohol' ? 'glass' : 'cloth';
    if (!materialCache.has(finish)) {
        // Headless course simulations need only geometry. Vite supplies the registered art base in game.
        const map = import.meta.env?.BASE_URL !== undefined ? artTexture('pickup-surfaces') : null;
        materialCache.set(
            finish,
            new THREE.MeshStandardMaterial({
                map,
                vertexColors: true,
                side: finish === 'glass' ? THREE.FrontSide : THREE.DoubleSide,
                roughness: finish === 'glass' ? 0.28 : 0.85,
                metalness: finish === 'glass' ? 0.1 : 0
            })
        );
    }
    return new THREE.Mesh(geometryCache.get(type), materialCache.get(finish));
}
