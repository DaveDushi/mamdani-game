import * as THREE from 'three';
import { Batch, labelMaterial, profile } from './Geometry.js';

const tire = new THREE.CylinderGeometry(1, 1, 1, 16);
const gold = 0xe1a237,
    rubber = 0x30343b,
    glass = 0x445d65;
function plate(group, lines, paper, ink, x, y, z, w, h) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), labelMaterial(lines, paper, ink));
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
}

function carShell(sections, color) {
    const pos = [],
        uv = [];
    for (let i = 1; i < sections.length; i++) {
        const ring = ([z, w, b, t]) => [
            [-w * 0.88, b, z],
            [-w, b + 0.12, z],
            [-w * 0.98, t - 0.09, z],
            [-w * 0.83, t, z],
            [w * 0.83, t, z],
            [w * 0.98, t - 0.09, z],
            [w, b + 0.12, z],
            [w * 0.88, b, z]
        ];
        const a = ring(sections[i - 1]),
            b = ring(sections[i]);
        for (let j = 0; j < 8; j++) {
            const k = (j + 1) % 8;
            for (const p of [a[j], b[j], b[k], a[j], b[k], a[k]]) pos.push(...p);
        }
        if (i === sections.length - 1 || i === 1) {
            for (const [end, flip] of [
                [a, i === 1],
                [b, false]
            ]) {
                if (end === b && i !== sections.length - 1) continue;
                if (end === a && i !== 1) continue;
                for (let j = 1; j < 7; j++)
                    for (const n of flip ? [0, j, j + 1] : [0, j + 1, j]) pos.push(...end[n]);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    geometry.computeVertexNormals();
    const batch = new Batch();
    batch.shape(geometry, color, 0, 0, 0);
    return batch;
}

function taxi() {
    const car = new THREE.Group();
    const b = carShell(
        [
            [-1.79, 0.76, 0.26, 0.69],
            [-1.49, 0.89, 0.26, 0.83],
            [-0.73, 0.91, 0.26, 0.85],
            [0.72, 0.91, 0.26, 0.81],
            [1.43, 0.86, 0.27, 0.72],
            [1.8, 0.75, 0.31, 0.66]
        ],
        gold
    );
    const cabin = carShell(
        [
            [-1.15, 0.74, 0.76, 0.81],
            [-0.6, 0.72, 0.78, 1.26],
            [0.32, 0.7, 0.78, 1.28],
            [0.91, 0.76, 0.77, 0.82]
        ],
        glass
    );
    b.parts.push(...cabin.parts);
    b.box(gold, 0, 1.273, -0.14, 1.17, 0.059, 0.9);
    for (const s of [-1, 1]) {
        b.box(gold, s * 0.72, 1.04, -0.12, 0.055, 0.49, 0.075, 0.05, 0, s * 0.08);
        b.box(gold, s * 0.87, 0.88, 0.52, 0.2, 0.1, 0.14);
        b.box(0x503b2d, s * 0.916, 0.65, 0, 0.01, 0.031, 1.64);
        for (let k = 0; k < 8; k++)
            b.box(k % 2 ? cream : rubber, s * 0.913, 0.747, -0.7 + k * 0.17, 0.017, 0.065, 0.17);
        for (const z of [-1.07, 1.09]) {
            b.shape(tire, rubber, s * 0.85, 0.33, z, 0.306, 0.18, 0.306, 0, 0, Math.PI / 2);
            b.shape(tire, 0x8a9090, s * 0.95, 0.33, z, 0.18, 0.027, 0.18, 0, 0, Math.PI / 2);
            b.shape(tire, 0xb7b2a4, s * 0.967, 0.33, z, 0.095, 0.014, 0.095, 0, 0, Math.PI / 2);
        }
        b.box(0xf3e5b7, s * 0.56, 0.57, 1.791, 0.34, 0.135, 0.045);
        b.box(0xa83d31, s * 0.58, 0.575, -1.783, 0.31, 0.125, 0.048);
    }
    b.box(0x383e40, 0, 0.4, 1.809, 0.9, 0.13, 0.03);
    b.box(0xecca81, 0, 0.397, 1.83, 0.3, 0.09, 0.015);
    b.box(0x4c5350, 0, 1.34, -0.16, 0.55, 0.11, 0.29);
    b.box(cream, 0, 1.43, -0.16, 0.51, 0.145, 0.24);
    car.add(b.mesh());
    plate(car, ['TAXI'], '#f0d394', '#292a2a', 0, 1.43, -0.032, 0.46, 0.12);
    return car;
}

const cream = 0xe1d6b9;
function overhead(type) {
    const mesh = new THREE.Group(),
        b = new Batch();
    const cart = type === 'halal',
        metal = cart ? 0x888f88 : 0x546d68;
    for (const s of [-1, 1])
        for (const z of [-0.7, 0.7]) {
            b.box(metal, s * 1.12, 0.91, z, 0.09, 1.82, 0.09);
            if (cart) b.shape(tire, rubber, s * 1.12, 0.18, z, 0.17, 0.1, 0.17, 0, 0, Math.PI / 2);
        }
    const y = cart ? 1.36 : 1.57;
    b.box(metal, 0, y + 0.24, 0, 2.39, 0.49, 1.64);
    b.box(cart ? 0xc5c4b0 : 0x89907c, 0, y + 0.5, 0, 2.48, 0.095, 1.72);
    if (cart) {
        b.box(metal, 0.27, 2.22, 0, 0.06, 1.0, 0.06);
        const wedge = new THREE.ConeGeometry(1.38, 0.5, 8, 1, false, 0, Math.PI / 4);
        for (let i = 0; i < 8; i++)
            b.shape(wedge, i % 2 ? 0xc55038 : 0xecc379, 0.27, 2.83, 0, 1, 1, 1, 0, (i * Math.PI) / 4);
    } else {
        for (const x of [-0.85, 0, 0.85]) b.box(0xead3a1, x, y + 0.2, 0.84, 0.28, 0.37, 0.025, 0, 0, -0.57);
        for (const s of [-1, 1]) b.box(metal, s * 1.12, 1.01, 0, 0.055, 1.82, 0.054, 0.88);
    }
    mesh.add(b.mesh());
    plate(
        mesh,
        cart ? ['HALAL • GRILL'] : ['SIDEWALK SHED'],
        cart ? '#a34c39' : '#254d45',
        '#f4e4bf',
        0,
        y + 0.25,
        0.864,
        cart ? 1.8 : 1.27,
        0.29
    );
    return mesh;
}

export function pedestrian(cast, index) {
    const person = cast[index % 2 ? 'commuter' : 'new-yorker'].scene.clone(true);
    if (index === 2) person.rotation.y = -0.24;
    return person;
}

function protestor(cast, index) {
    const b = new Batch();
    b.box(0x8a6849, 0.28, 1.49, 0.3, 0.052, 1.68, 0.048);
    b.box(0xb4a388, 0.28, 2.27, 0.29, 1.22, 0.82, 0.055);
    const group = new THREE.Group();
    group.add(pedestrian(cast, index), b.mesh());
    const lines = [
        ['FREE PALESTINE', 'FREE MEGAPHONES'],
        ['PROTEST THE', 'LAST PROTEST'],
        ['NATIONALIZE', 'BRUNCH']
    ][index];
    plate(group, lines, '#e5d6b7', '#783c32', 0.28, 2.27, 0.325, 1.18, 0.79);
    return group;
}

function bottle() {
    const b = new Batch();
    b.shape(
        profile(
            [
                [0, 0.19, 0.19],
                [0.04, 0.22, 0.22],
                [0.55, 0.22, 0.22],
                [0.71, 0.091, 0.091],
                [0.92, 0.073, 0.073],
                [0.96, 0.087, 0.087]
            ],
            14
        ),
        0x416b50,
        0,
        0,
        0
    );
    b.shape(tire, 0xe8c99b, 0, 0.37, 0, 0.223, 0.235, 0.223);
    b.shape(tire, 0xa76744, 0, 0.97, 0, 0.088, 0.071, 0.088);
    return b.mesh();
}

function stamp() {
    return new THREE.Mesh(
        new THREE.BoxGeometry(0.79, 0.49, 0.075),
        labelMaterial(['NYC', 'FOOD STAMP'], '#f6d77f', '#613d24', 256, 144)
    );
}

export function streetProps(cast) {
    return {
        taxi: taxi(),
        scaffold: overhead('scaffold'),
        halal: overhead('halal'),
        alcohol: bottle(),
        coin: stamp(),
        protest0: protestor(cast, 0),
        protest1: protestor(cast, 1),
        protest2: protestor(cast, 2)
    };
}
