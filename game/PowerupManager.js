import * as THREE from 'three';
import { foodStampSize, roadPickup } from './PickupArt.js';
import { cityBusModel } from './CityBusArt.js';

export const pickupGlow = { fastFreeBus: 0x6fc6ff, rainbow: 0xff86d4, kafiyeh: 0xffd25e, covidMask: 0x62f0f2 };
const FLOAT = 1.14;
let haloMap, poolShape;

// A soft disc whose color adds light while its alpha tints, so it reads on pale day
// asphalt as well as on a wet night street.
function glowTexture() {
    if (haloMap) return haloMap;
    const size = 64, data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - 31.5, y - 31.5) / 31.5;
        const soft = Math.max(0, 1 - r) ** 1.7;
        const ring = Math.max(0, 1 - Math.abs(r - .62) / .16) * .34;
        const light = Math.min(1, soft * .6 + ring);
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = Math.round(255 * light);
        data[i + 3] = Math.round(255 * light * .55);
    }
    haloMap = new THREE.DataTexture(data, size, size);
    haloMap.magFilter = haloMap.minFilter = THREE.LinearFilter;
    haloMap.needsUpdate = true;
    return haloMap;
}

function glowStyle(color) {
    return {
        map: glowTexture(), color, transparent: true, depthWrite: false, fog: false, toneMapped: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
    };
}

function addGlow(group, color) {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial(glowStyle(color)));
    halo.name = 'halo';
    halo.position.z = -.3;
    halo.scale.setScalar(2);
    poolShape ??= new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pool = new THREE.Mesh(poolShape, new THREE.MeshBasicMaterial(glowStyle(color)));
    pool.name = 'glowPool';
    pool.position.y = .045 - FLOAT;
    pool.scale.set(2.3, 1, 2.9);
    group.add(halo, pool);
}

function stampSizedPickup(model, angle = 0) {
    model.rotation.y = angle;
    model.castShadow = false;
    const bounds = new THREE.Box3().setFromObject(model, true);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = Math.min(foodStampSize.width / size.x, foodStampSize.height / size.y);
    model.scale.setScalar(scale);
    bounds.getCenter(model.position).multiplyScalar(-scale);
    const group = new THREE.Group();
    group.add(model);
    return group;
}

// Intersect the portion of the step spent alongside the pickup with its lane and height.
function crossedPickup(pickup, fromX, fromY, to) {
    const pos = pickup.mesh.position;
    const fromZ = pickup.previousZ;
    if (fromZ >= 0.68 || pos.z <= -0.68) return false;
    const dz = pos.z - fromZ;
    let enter = dz ? Math.max(0, (-0.68 - fromZ) / dz) : 0;
    let leave = dz ? Math.min(1, (0.68 - fromZ) / dz) : 1;
    const dx = to.x - fromX;
    if (dx) {
        const a = (pos.x - 0.84 - fromX) / dx;
        const b = (pos.x + 0.84 - fromX) / dx;
        enter = Math.max(enter, Math.min(a, b));
        leave = Math.min(leave, Math.max(a, b));
    } else if (Math.abs(fromX - pos.x) >= 0.84) return false;
    return enter < leave && fromY + (to.y - fromY) * (to.y < fromY ? leave : enter) < 1.5;
}

export class PowerupManager {
    constructor(scene) {
        this.scene = scene;
        this.busModel = cityBusModel();
        this.models = {
            fastFreeBus: stampSizedPickup(this.busModel.clone(), -.94),
            rainbow: stampSizedPickup(roadPickup('rainbow')),
            kafiyeh: stampSizedPickup(roadPickup('kafiyeh')),
            covidMask: stampSizedPickup(roadPickup('covidMask'))
        };
        for (const [type, model] of Object.entries(this.models)) addGlow(model, pickupGlow[type]);
        this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.pulse = 0;
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
        this.previousPlayerX = this.previousPlayerY = undefined;
    }
    spawnPowerup(lane, z, type = this.types[Math.floor(Math.random() * this.types.length)]) {
        const pickup = this.pool[type].pop() || { mesh: this.models[type].clone(), type };
        pickup.halo ??= pickup.mesh.getObjectByName('halo');
        pickup.pool ??= pickup.mesh.getObjectByName('glowPool');
        pickup.mesh.position.set(lane, FLOAT, z);
        pickup.previousZ = z;
        this.scene.add(pickup.mesh);
        this.powerups.push(pickup);
    }
    update(dt, speed) {
        if (!this.reducedMotion) this.pulse = (this.pulse + dt * 3.4) % (2 * Math.PI);
        const breath = Math.sin(this.pulse);
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pickup = this.powerups[i];
            const m = pickup.mesh;
            pickup.previousZ = m.position.z;
            m.position.z += speed * dt;
            m.position.y = this.reducedMotion ? FLOAT : 1.15 + 0.095 * Math.sin(m.position.z * 0.27);
            pickup.pool.position.y = .045 - m.position.y;
            pickup.halo.scale.setScalar(2 + .2 * breath);
            pickup.pool.scale.set(2.3 - .14 * breath, 1, 2.9 - .18 * breath);
            if (pickup.previousZ > 10) this.remove(i);
        }
    }
    checkCollisions(player) {
        const q = player.mesh.position;
        const fromX = this.previousPlayerX ?? q.x;
        const fromY = this.previousPlayerY ?? q.y;
        this.previousPlayerX = q.x;
        this.previousPlayerY = q.y;
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            if (crossedPickup(p, fromX, fromY, q)) {
                this.remove(i);
                return p.type;
            }
        }
        return null;
    }
}
