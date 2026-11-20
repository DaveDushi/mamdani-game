import * as THREE from 'three';
import { Batch } from './Geometry.js';

const stripeColors = [0xd53c43, 0xf08937, 0xf2d65a, 0x4b9c67, 0x438dc3, 0x855a9e];
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const loop = new THREE.TorusGeometry(1, 0.1, 5, 22);
const fabricMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

function clothBand(color, left, right, top, bottom, wave, batch) {
    const panel = new THREE.PlaneGeometry(right - left, top - bottom, 12, 1);
    panel.translate((left + right) / 2, (top + bottom) / 2, 0);
    const v = panel.attributes.position;
    for (let i = 0; i < v.count; i++) {
        const t = (v.getX(i) - left) / (right - left);
        v.setXYZ(
            i,
            v.getX(i),
            v.getY(i) - wave * t * t * 0.21,
            wave * Math.sin(t * Math.PI * 2 - 0.3) * 0.12 * t
        );
    }
    panel.computeVertexNormals();
    batch.shape(panel, color, 0, 0, 0);
    panel.dispose();
}

function flag() {
    const b = new Batch();
    b.shape(cylinder, 0xb58b4b, -0.55, -0.05, 0, 0.036, 1.33, 0.036);
    b.oval(0xf9d887, -0.55, 0.65, 0, 0.076, 0.076, 0.076);
    stripeColors.forEach((color, i) =>
        clothBand(color, -0.52, 0.68, 0.55 - i * 0.135, 0.55 - (i + 1) * 0.135, 1, b)
    );
    return b.mesh(fabricMaterial);
}

function scarf() {
    const b = new Batch();
    for (let i = 0; i < 10; i++) {
        const w = (1 - i / 11) * 0.62,
            top = 0.48 - i * 0.094;
        clothBand(0xf0e4c8, -w, w, top, top - 0.095, 0.42, b);
        for (let j = -4; j <= 4; j++) {
            const x = j * 0.137 + (i % 2) * 0.062;
            if (Math.abs(x) < w - 0.055)
                b.box(0x303336, x, top - 0.047, 0.035, 0.088, 0.055, 0.014, 0, 0, (i % 2 ? 1 : -1) * 0.46);
        }
    }
    for (let i = 0; i < 9; i++) {
        const x = (i - 4) * 0.14;
        b.box(0xd1c5a8, x, -0.43 + Math.abs(x) * 1.36, 0.01, 0.028, 0.105, 0.025, 0, 0, x);
    }
    return b.mesh(fabricMaterial);
}

function mask() {
    const b = new Batch();
    for (const side of [-1, 1]) b.shape(loop, 0xf5f2e0, side * 0.51, 0.02, -0.015, 0.22, 0.25, 0.19);
    b.oval(0x7fc1ce, 0, 0, 0, 0.55, 0.32, 0.135);
    for (const y of [-0.135, -0.02, 0.095]) b.box(0xd1e3db, 0, y, 0.121, 0.83, 0.027, 0.017);
    b.box(0xeff0dc, 0, 0.235, 0.08, 0.71, 0.044, 0.035);
    return b.mesh(fabricMaterial);
}

function markedPickup(model, atlas, column) {
    const map = atlas.clone();
    map.repeat.x = 1 / 3;
    map.offset.x = column / 3;
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map, toneMapped: false, depthWrite: false }));
    marker.position.y = 2.58;
    marker.scale.setScalar(1.05);
    const group = new THREE.Group();
    group.add(model, marker);
    return group;
}

export class PowerupManager {
    constructor(scene, markers = new THREE.Texture()) {
        this.scene = scene;
        this.models = {
            rainbow: markedPickup(flag(), markers, 0),
            kafiyeh: markedPickup(scarf(), markers, 1),
            covidMask: markedPickup(mask(), markers, 2)
        };
        this.types = Object.keys(this.models);
        this.pool = Object.fromEntries(this.types.map((type) => [type, []]));
        this.powerups = [];
    }
    remove(index) {
        const [pickup] = this.powerups.splice(index, 1);
        this.scene.remove(pickup.mesh);
        this.pool[pickup.type].push(pickup);
    }
    reset() {
        for (let i = this.powerups.length - 1; i >= 0; i--) this.remove(i);
    }
    spawnPowerup(lane, z, type = this.types[Math.floor(Math.random() * this.types.length)]) {
        const pickup = this.pool[type].pop() || { mesh: this.models[type].clone(), type };
        pickup.mesh.position.set(lane, 1.14, z);
        pickup.mesh.rotation.set(0, 0, 0);
        this.scene.add(pickup.mesh);
        this.powerups.push(pickup);
    }
    update(dt, speed) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const m = this.powerups[i].mesh;
            m.position.z += speed * dt;
            m.rotation.y = 0.36 * Math.sin(m.position.z * 0.16);
            m.rotation.z = 0.07 * Math.sin(m.position.z * 0.22);
            m.position.y = 1.15 + 0.095 * Math.sin(m.position.z * 0.27);
            if (m.position.z > 10) this.remove(i);
        }
    }
    checkCollisions(player) {
        const q = player.mesh.position;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i],
                pos = p.mesh.position;
            if (Math.abs(pos.z) < 0.68 && Math.abs(pos.x - q.x) < 0.84 && q.y < 1.5) {
                this.remove(i);
                return p.type;
            }
        }
        return null;
    }
}
