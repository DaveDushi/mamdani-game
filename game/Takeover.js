import * as THREE from 'three';
import { Batch } from './Geometry.js';

const slab = new THREE.BoxGeometry();
const windows = [0.003, 0.004, 0.743, 0.992];
const concrete = [0.756, 0.004, 0.235, 0.992];
let slabMaterial;

function precastMaterial() {
    if (slabMaterial) return slabMaterial;
    const sheet = document.createElement('canvas');
    sheet.width = 512;
    sheet.height = 256;
    const ctx = sheet.getContext('2d');
    ctx.fillStyle = '#a6aaa5';
    ctx.fillRect(0, 0, sheet.width, sheet.height);
    for (let i = 0; i < 2800; i++) {
        ctx.fillStyle = i % 3 ? '#8c948f' : '#bec0b7';
        ctx.fillRect((i * 193 + i % 11 * 41) % 511, (i * 47 + i % 13 * 17) % 255, 1, 2);
    }
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 6; col++) {
            const x = col * 64, y = row * 32;
            ctx.fillStyle = '#777f7b';
            ctx.fillRect(x, y, 1, 32);
            ctx.fillRect(x, y + 31, 64, 1);
            ctx.fillStyle = '#727c7e';
            ctx.fillRect(x + 8, y + 5, 47, 19);
            ctx.fillStyle = '#303f49';
            ctx.fillRect(x + 9, y + 6, 45, 15);
            ctx.fillStyle = (row + col * 3) % 7 === 0 ? '#788385' : '#52636a';
            ctx.fillRect(x + 11, y + 9, 19, 11);
            ctx.fillRect(x + 33, y + 9, 19, 11);
            ctx.fillStyle = '#c1c2b6';
            ctx.fillRect(x + 7, y + 23, 49, 2);
        }
    }
    const map = new THREE.CanvasTexture(sheet);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    slabMaterial = new THREE.MeshLambertMaterial({ map, vertexColors: true });
    return slabMaterial;
}

function buildSlab(batch, { side, z, stage }) {
    const w = 10.7, d = 13.5;
    const height = 17.4 + (stage % 3) * 1.55;
    const x = side * (8.15 + w / 2);
    const box = (tint, cx, cy, cz, width, h, depth, uv = concrete) =>
        batch.shape(slab, tint, cx, cy, cz, width, h, depth, 0, 0, 0, uv);
    // A recessed plinth and full-height concrete stairwell replace the shop and its water tower.
    box(0x657378, x, 1.33, z, w - 0.4, 2.64, d - 0.4);
    box(0x929c9f, x, 2.68, z, w + 0.32, 0.4, d + 0.32);
    box(0xc6cbcb, x, 2.85 + height / 2, z, w, height, d, windows);
    box(0x9fa8a8, side * 8.04, (height + 3.32) / 2, z - 3.7, 0.6, height + 3.32, 1.65);
    box(0x707f84, side * 7.72, height * 0.5 + 2.3, z - 3.7, 0.08, height - 1.2, 0.28);
    box(0xb0b6b3, x, height + 3.02, z, w + 0.18, 0.32, d + 0.18);
    box(0x49575e, side * 8.32, 1.09, z + 1.65, 0.16, 2.18, 2.3);
    box(0xa6acaa, side * 8.29, 1.09, z + 1.65, 0.18, 2.18, 0.12);
}

// Each block still draws its original opaque batches once. Sorting the triangles once
// lets a draw range remove whole facades and roof fittings at each successive win.
function sortOriginal({ mesh, removals }) {
    const geometry = mesh.geometry;
    const count = geometry.attributes.position.count;
    const grouped = Array.from({ length: 7 }, () => []);
    let cursor = 0;
    for (const { start, end, stage } of removals) {
        grouped[0].push([cursor, start]);
        grouped[stage].push([start, end]);
        cursor = end;
    }
    grouped[0].push([cursor, count]);
    const indices = count <= 65535 ? new Uint16Array(count) : new Uint32Array(count);
    const ends = [];
    cursor = 0;
    for (const stage of [0, 6, 5, 4, 3, 2, 1]) {
        for (const [start, end] of grouped[stage]) {
            for (let i = start; i < end; i++) indices[cursor++] = i;
        }
        ends[stage === 0 ? 6 : stage - 1] = cursor;
    }
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    return ends;
}

export class TakeoverBlock {
    constructor() {
        this.plots = [];
        this.batches = new Map();
        this.original = [];
    }

    replaceParts(batch, start, stage) {
        if (!this.batches.has(batch)) this.batches.set(batch, []);
        this.batches.get(batch).push({ start, end: batch.parts.length, stage });
    }

    bake(batch, material) {
        const offsets = [0];
        for (const part of batch.parts) offsets.push(offsets.at(-1) + part.attributes.position.count);
        const removals = this.batches.get(batch).map(({ start, end, stage }) => ({
            start: offsets[start], end: offsets[end], stage
        }));
        const mesh = batch.mesh(material);
        this.original.push({ mesh, removals });
        this.batches.delete(batch);
        return mesh;
    }

    set(stage, group) {
        if (!this.converted) {
            if (!stage) return;
            const batch = new Batch();
            let count = 0;
            this.ends = [0];
            for (const plot of this.plots.sort((a, b) => a.stage - b.stage)) {
                const first = batch.parts.length;
                buildSlab(batch, plot);
                for (let i = first; i < batch.parts.length; i++) count += batch.parts[i].attributes.position.count;
                this.ends.push(count);
            }
            this.converted = batch.mesh(precastMaterial());
            this.converted.receiveShadow = true;
            group.add(this.converted);
            for (const entry of this.original) entry.ends = sortOriginal(entry);
        }
        for (const { mesh, ends } of this.original) {
            mesh.geometry.setDrawRange(0, ends[stage]);
            mesh.visible = ends[stage] > 0;
        }
        this.converted.geometry.setDrawRange(0, this.ends[stage]);
        this.converted.visible = stage > 0;
    }
}
