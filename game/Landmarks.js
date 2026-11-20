import * as THREE from 'three';
import { Batch, labelMaterial } from './Geometry.js';

export const BLOCKS_PER_DISTRICT = 5;
export const DISTRICT_LENGTH = 48 * BLOCKS_PER_DISTRICT;
export const districts = ['Canal Street', 'Union Square', 'City Hall'];
export const districtAt = (metres) => Math.floor(Math.max(0, metres) / DISTRICT_LENGTH) % districts.length;

const round = new THREE.CylinderGeometry(1, 1, 1, 12);
const face = new THREE.PlaneGeometry();
const bronze = 0x88633c;
const gilt = 0xf5ba56;
const lacquer = 0xa32d27;
const jade = 0x21695d;
const stone = 0xc8bda8;
const trim = 0xe1d7bc;

function sign(group, text, bg, ink, x, y, z, w, h, angle = 0) {
    const plate = new THREE.Mesh(face, labelMaterial(text, bg, ink, 768, Math.round(768 * h / w)));
    plate.scale.set(w, h, 1);
    plate.position.set(x, y, z);
    plate.rotation.y = angle;
    group.add(plate);
}

function lantern(b, x, y, z, size) {
    b.oval(0xd9472a, x, y, z, size * 0.68, size * 0.82, size * 0.63);
    for (const level of [-0.55, 0, 0.55]) {
        const radius = size * (level ? 0.5 : 0.69);
        b.shape(round, 0xb13228, x, y + level * size, z, radius, 0.027, radius * 0.95);
    }
    for (const side of [-1, 1])
        b.shape(round, gilt, x, y + 0.78 * size * side, z, size * 0.33, 0.08, size * 0.32);
    b.box(gilt, x, y - size * 1.04, z, 0.075, size * 0.45, 0.08);
}

function tiledRoof(b, y, width, depth) {
    // Linked segments form the upswept eaves. Individual tile ridges catch the sunlight.
    const rise = (x) => 0.58 * Math.pow(Math.abs(x) / (width / 2), 4);
    for (let i = 0; i < 24; i++) {
        const x = ((i + 0.5) * width) / 24 - width / 2;
        const left = x - width / 48,
            right = x + width / 48;
        const slope = Math.atan2(rise(right) - rise(left), width / 24);
        for (const end of [-1, 1]) {
            b.box(
                i % 3 ? jade : 0x347768,
                x,
                y + rise(x),
                end * depth * 0.25,
                width / 24 + 0.025,
                0.18,
                depth * 0.57,
                end * 0.3,
                0,
                slope
            );
            b.shape(
                round,
                0x467e68,
                x,
                y + rise(x) + 0.12,
                end * depth * 0.25,
                0.065,
                depth * 0.55,
                0.065,
                Math.PI / 2 + end * 0.3
            );
            b.box(
                gilt,
                x,
                y + rise(x) - 0.18,
                end * depth * 0.52,
                width / 24 + 0.018,
                0.1,
                0.09,
                0,
                0,
                slope
            );
        }
    }
    b.box(0xba9152, 0, y + 0.34, 0, width * 0.93, 0.14, 0.18);
}

function canal(b, group) {
    for (const side of [-1, 1]) {
        const x = side * 5.55;
        b.box(0x827b6e, x, 0.34, 0, 1.05, 0.68, 1.13);
        b.shape(round, lacquer, x, 3.38, 0, 0.36, 5.6, 0.36);
        for (const y of [0.75, 4.9, 5.46]) b.shape(round, gilt, x, y, 0, 0.4, 0.11, 0.4);
        for (let i = 0; i < 3; i++)
            b.box(i % 2 ? jade : lacquer, x, 5.2 + i * 0.22, 0, 0.96 + i * 0.38, 0.21, 0.96 + i * 0.18);
        for (const z of [-12, -25]) b.box(0x5d5450, side * 6, 2.9, z, 0.065, 5.8, 0.065);
    }
    b.box(lacquer, 0, 5.45, 0, 12.1, 0.57, 0.75);
    b.box(gilt, 0, 5.28, 0.4, 11.95, 0.073, 0.07);
    b.box(jade, 0, 6.15, 0, 11.7, 0.68, 0.72);
    tiledRoof(b, 6.72, 13.2, 2.47);
    b.box(lacquer, 0, 7.13, 0, 6.8, 0.78, 1.05);
    tiledRoof(b, 7.62, 8.65, 2.36);
    sign(group, ['CANAL STREET'], '#1c514d', '#f7ce74', 0, 6.03, 0.4, 5.25, 0.82);
    for (const z of [-12, -25]) {
        for (let i = -4; i <= 4; i++) {
            const x = i * 1.32,
                y = 4.9 + i * i * 0.046;
            b.box(0x645548, x, y + 0.49, z, 1.39, 0.032, 0.033, 0, 0, i * 0.068);
            lantern(b, x, y, z, i % 2 ? 0.42 : 0.49);
        }
    }
}

function theatre(b, group) {
    const oxblood = 0x763d34;
    for (const side of [-1, 1]) {
        const x = side * 6.6;
        b.box(oxblood, x, 4.7, 0, 1.2, 9.4, 1);
        for (const k of [-0.46, 0.46]) b.box(bronze, x + k, 4.8, 0.55, 0.09, 9.6, 0.1);
        for (let j = 0; j < 3; j++) {
            b.box(0xcd9552, x, 9.25 + j * 0.36, 0, 1.35 - j * 0.32, 0.48, 1.18 - j * 0.19);
        }
        b.box(0x1f413d, x, 6.7, 0.63, 0.86, 3.96, 0.12);
        for (let j = 0; j < 9; j++)
            b.oval(0xffdc89, x + side * 0.47, 5.06 + j * 0.41, 0.74, 0.06, 0.06, 0.045);
    }
    b.box(oxblood, 0, 5.5, 0, 13.8, 1.28, 1.9);
    for (const y of [4.87, 6.18]) {
        b.box(bronze, 0, y, 0.05, 14.1, 0.16, 2.03);
        for (let j = 0; j < 28; j++) b.oval(0xffdf9b, (j - 13.5) * 0.48, y, 1.09, 0.075, 0.068, 0.04);
    }
    sign(
        group,
        ['UNION SQUARE   •   RENT: THE MUSICAL'],
        '#f0ddad',
        '#552f2b',
        0,
        5.52,
        0.98,
        12.9,
        1.09
    );
    for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const x = side * (5.65 + i * 0.49);
            b.shape(round, gilt, x, 0.58, 3, 0.075, 1.16, 0.075);
            b.oval(bronze, x, 1.2, 3, 0.114, 0.114, 0.114);
        }
    }
}

function cityHall(b, group) {
    for (const side of [-1, 1]) {
        const x = side * 6.55;
        b.box(stone, x, 3, 0, 2.78, 6, 2.28);
        b.box(trim, x, 0.26, 0, 3.14, 0.48, 2.62);
        for (const offset of [-0.9, 0.9]) {
            const cx = x + offset;
            b.shape(round, trim, cx, 3.05, 1.25, 0.34, 5.2, 0.34);
            for (const y of [0.65, 0.86, 5.48, 5.68]) b.shape(round, 0xb5a68e, cx, y, 1.25, 0.43, 0.14, 0.43);
            for (const dx of [-0.16, 0, 0.16]) b.box(0xae9f87, cx + dx, 3.14, 1.56, 0.028, 4.43, 0.029);
        }
        b.box(trim, x, 5.9, 0, 3.13, 0.34, 2.88);
        b.oval(0x608278, x, 7.46, -0.2, 0.43, 0.63, 0.43);
    }
    for (let i = 0; i < 21; i++) {
        const a = ((i + 0.5) * Math.PI) / 21;
        b.box(
            i % 3 ? trim : stone,
            5.12 * Math.cos(a),
            2.76 + 5.12 * Math.sin(a),
            0,
            0.8,
            0.84,
            1.86,
            0,
            0,
            a - Math.PI / 2
        );
    }
    b.box(0xa2957a, 0, 8.06, 0, 14.5, 0.73, 1.95);
    b.box(trim, 0, 8.52, 0, 14.9, 0.23, 2.21);
    sign(group, ['CITY HALL   •   BUDGET HEARING'], '#ffefc9', '#302922', 0, 8.07, 1.0, 10.3, 0.62);
    b.box(0x637975, 0, 8.82, 0, 7.45, 0.32, 1.79);
    b.shape(round, bronze, 0, 9.95, 0, 0.046, 2.3, 0.046);
    b.box(0xb74739, 0.47, 10.51, 0, 0.93, 0.54, 0.065);
}

export class Landmarks {
    constructor(scene, material) {
        this.groups = [canal, theatre, cityHall].map((build) => {
            const group = new THREE.Group(),
                batch = new Batch();
            build(batch, group);
            const structure = batch.mesh(material);
            structure.receiveShadow = true;
            group.add(structure);
            scene.add(group);
            return group;
        });
    }
    update(distance) {
        const loop = DISTRICT_LENGTH * districts.length;
        this.groups.forEach((group, i) => {
            const next = i * DISTRICT_LENGTH + 32;
            const lap = Math.max(0, Math.ceil((distance - next - 48) / loop));
            group.position.z = distance - (next + lap * loop);
            group.visible = group.position.z > -155 && group.position.z < 48;
        });
    }
}
