import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const boxShape = new THREE.BoxGeometry();
const sphereShape = new THREE.SphereGeometry(1, 10, 7);
const transform = new THREE.Object3D();
const tint = new THREE.Color();

export const painted = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.87 });

/** Bake rigid details together. Each moving joint or street block becomes one draw. */
export class Batch {
    constructor() {
        this.parts = [];
    }

    shape(source, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, uvTile) {
        const geometry = source.index ? source.toNonIndexed() : source.clone();
        transform.position.set(x, y, z);
        transform.rotation.set(rx, ry, rz);
        transform.scale.set(sx, sy, sz);
        transform.updateMatrix();
        geometry.applyMatrix4(transform.matrix);
        const count = geometry.attributes.position.count;
        tint.set(color);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) tint.toArray(colors, i * 3);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        if (uvTile) {
            const uv = geometry.attributes.uv;
            const [u, v, w, h] = uvTile;
            for (let i = 0; i < count; i++) uv.setXY(i, u + uv.getX(i) * w, v + uv.getY(i) * h);
        }
        this.parts.push(geometry);
    }

    box(color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
        this.shape(boxShape, color, x, y, z, w, h, d, rx, ry, rz);
    }

    oval(color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
        this.shape(sphereShape, color, x, y, z, w, h, d, rx, ry, rz);
    }

    mesh(material = painted) {
        const geometry = mergeGeometries(this.parts);
        for (const part of this.parts) part.dispose();
        this.parts.length = 0;
        geometry.computeBoundingSphere();
        return new THREE.Mesh(geometry, material);
    }
}

// Elliptical cross-sections give clothes, faces and limbs their own silhouettes.
export function profile(rings, sides = 16) {
    const positions = [],
        uv = [],
        indices = [];
    for (let row = 0; row < rings.length; row++) {
        const [y, xRadius, zRadius, zCenter = 0] = rings[row];
        for (let j = 0; j <= sides; j++) {
            const a = (j / sides) * Math.PI * 2;
            positions.push(Math.sin(a) * xRadius, y, Math.cos(a) * zRadius + zCenter);
            uv.push(j / sides, row / (rings.length - 1));
            if (row && j) {
                const i = row * (sides + 1) + j,
                    k = i - sides - 1;
                indices.push(k - 1, k, i, k - 1, i, i - 1);
            }
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
}

export function labelMaterial(lines, paper, ink, width = 512, height = 160) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = ink;
    const inset = Math.max(3, Math.round(height * 0.035));
    ctx.lineWidth = Math.max(2, inset * 0.5);
    ctx.strokeRect(inset, inset, width - 2 * inset, height - 2 * inset);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ink;
    lines.forEach((line, i) => {
        const size = (height * 0.92) / lines.length;
        ctx.font = '700 ' + size + 'px Condensed, Arial';
        const fit = Math.min(1, (width - 4 * inset) / ctx.measureText(line).width);
        ctx.font = '700 ' + Math.floor(size * fit) + 'px Condensed, Arial';
        ctx.fillText(line, width / 2, height * (0.09 + (0.82 * (i + 0.5)) / lines.length));
    });
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return new THREE.MeshBasicMaterial({ map, toneMapped: false });
}

export const artLoads = [];
export function artTexture(name) {
    let finish;
    artLoads.push(
        new Promise((resolve) => {
            finish = resolve;
        })
    );
    const map = new THREE.TextureLoader().load(
        import.meta.env.BASE_URL + 'art/' + name + '.webp',
        finish,
        undefined,
        finish
    );
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
}
