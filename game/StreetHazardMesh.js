import {
    BufferGeometry,
    Color,
    Float32BufferAttribute,
    Group,
    Mesh,
    MeshBasicMaterial,
    MeshLambertMaterial,
    Vector3
} from 'three';
import { artTexture } from './Geometry.js';

// Every rigid template is one indexed mesh. Printed surfaces and plain paint share the atlas.
export const tile = {
    paint: 0,
    windscreen: 1,
    doors: 2,
    grille: 3,
    hood: 4,
    wheel: 5,
    roofLamp: 6,
    trunk: 7,
    menu: 8,
    cabinet: 9,
    canvas: 10,
    steel: 11,
    shed: 12,
    permit: 13,
    planks: 14,
    corrugated: 15,
    workStripe: 16,
    barrier: 17,
    plywood: 19,
    closed: 20,
    tickets: 21,
    jump: 22,
    slide: 23,
    placard: 24,
    griddle: 29,
    tote: 30,
    sideGlass: 31
};
const uvSquare = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
];
const tint = new Color();
let enamel, reflective;
function surface(unlit) {
    const map = artTexture('street-hazards');
    if (unlit) return (reflective ??= new MeshBasicMaterial({ map, vertexColors: true, toneMapped: false }));
    return (enamel ??= new MeshLambertMaterial({ map, vertexColors: true, emissive: 0x17191a }));
}

export class StreetMesh {
    positions = [];
    uvs = [];
    colors = [];
    indices = [];

    face(points, texture = tile.paint, color = 0xffffff, uvs = uvSquare) {
        const offset = this.positions.length / 3;
        const left = (texture % 4) * 256 + 4.5;
        const bottom = 1024 - (Math.floor(texture / 4) + 1) * 128 + 4.5;
        tint.setHex(color);
        for (let i = 0; i < points.length; i++) {
            this.positions.push(...points[i]);
            this.colors.push(tint.r, tint.g, tint.b);
            const [u, v] = texture === tile.paint ? [0.5, 0.5] : uvs[i];
            this.uvs.push((left + u * 247) / 1024, (bottom + v * 119) / 1024);
            if (i >= 2) this.indices.push(offset, offset + i - 1, offset + i);
        }
    }

    box(x, y, z, w, h, d, color, skins = {}) {
        const l = x - w / 2,
            r = x + w / 2,
            b = y - h / 2,
            t = y + h / 2;
        const f = z + d / 2,
            k = z - d / 2;
        this.face(
            [
                [l, b, f],
                [r, b, f],
                [r, t, f],
                [l, t, f]
            ],
            skins.front,
            color
        );
        this.face(
            [
                [r, b, k],
                [l, b, k],
                [l, t, k],
                [r, t, k]
            ],
            skins.back,
            color
        );
        this.face(
            [
                [r, b, f],
                [r, b, k],
                [r, t, k],
                [r, t, f]
            ],
            skins.side,
            color
        );
        this.face(
            [
                [l, b, k],
                [l, b, f],
                [l, t, f],
                [l, t, k]
            ],
            skins.side,
            color
        );
        this.face(
            [
                [l, t, f],
                [r, t, f],
                [r, t, k],
                [l, t, k]
            ],
            skins.top,
            color
        );
        this.face(
            [
                [l, b, k],
                [r, b, k],
                [r, b, f],
                [l, b, f]
            ],
            undefined,
            color
        );
    }

    // Closed section rings are counterclockwise when seen from the positive end of the axis.
    loft(rings, color) {
        this.face([...rings[0]].reverse(), tile.paint, color);
        this.face(rings.at(-1), tile.paint, color);
        for (let i = 1; i < rings.length; i++) {
            const a = rings[i - 1],
                b = rings[i];
            for (let j = 0; j < a.length; j++) {
                const k = (j + 1) % a.length;
                this.face([a[j], a[k], b[k], b[j]], tile.paint, color);
            }
        }
    }

    tube(start, end, radius, color, sides = 6, endRadius = radius) {
        const a = new Vector3(...start),
            b = new Vector3(...end);
        const axis = b.clone().sub(a).normalize();
        const u = new Vector3(0, Math.abs(axis.y) < 0.85 ? 1 : 0, Math.abs(axis.y) < 0.85 ? 0 : 1)
            .cross(axis)
            .normalize();
        const v = axis.clone().cross(u);
        const ring = (center, r) =>
            Array.from({ length: sides }, (_, i) => {
                const angle = (i * Math.PI * 2) / sides;
                return center
                    .clone()
                    .addScaledVector(u, r * Math.cos(angle))
                    .addScaledVector(v, r * Math.sin(angle))
                    .toArray();
            });
        const bottom = ring(a, radius),
            top = ring(b, endRadius);
        const offset = this.positions.length / 3;
        tint.setHex(color);
        // Share the rim along each tube for smooth steel highlights. Caps have separate flat normals.
        for (const point of [...bottom, ...top]) {
            this.positions.push(...point);
            this.colors.push(tint.r, tint.g, tint.b);
            this.uvs.push(0.125, 0.9375);
        }
        for (let i = 0; i < sides; i++) {
            const j = (i + 1) % sides;
            this.indices.push(
                offset + i,
                offset + j,
                offset + sides + j,
                offset + i,
                offset + sides + j,
                offset + sides + i
            );
        }
        this.face(bottom.reverse(), tile.paint, color);
        this.face(top, tile.paint, color);
    }

    wheel(x, y, z, radius, thickness) {
        const side = Math.sign(x);
        const a = x - (side * thickness) / 2,
            b = x + (side * thickness) / 2;
        this.tube([a, y, z], [b, y, z], radius, 0x242a2b, 16);
        const pts = [],
            uvs = [];
        for (let i = 0; i < 16; i++) {
            const angle = (side * i * Math.PI) / 8;
            const cy = Math.sin(angle),
                cz = -Math.cos(angle);
            pts.push([b + side * 0.001, y + cy * radius * 0.98, z + cz * radius * 0.98]);
            uvs.push([0.5 + cz * 0.5, 0.5 + cy * 0.5]);
        }
        this.face(pts, tile.wheel, 0xffffff, uvs);
    }

    group() {
        const group = new Group();
        group.add(this.finish());
        return group;
    }

    finish(unlit = false) {
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
        geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2));
        geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
        geometry.setIndex(this.indices);
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        return new Mesh(geometry, surface(unlit));
    }
}
