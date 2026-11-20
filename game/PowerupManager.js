import * as THREE from 'three';
import { roadPickup } from './PickupArt.js';

function markedPickup(model, atlas, column) {
    const map = atlas.clone();
    map.repeat.x = 1 / 3;
    map.offset.x = column / 3;
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map, toneMapped: false, depthWrite: false, fog: false }));
    marker.position.y = 2.58;
    marker.scale.setScalar(1.05);
    const group = new THREE.Group();
    group.add(model, marker);
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
    constructor(scene, markers = new THREE.Texture()) {
        this.scene = scene;
        this.models = {
            rainbow: markedPickup(roadPickup('rainbow'), markers, 0),
            kafiyeh: markedPickup(roadPickup('kafiyeh'), markers, 1),
            covidMask: markedPickup(roadPickup('covidMask'), markers, 2)
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
        this.previousPlayerX = this.previousPlayerY = undefined;
    }
    spawnPowerup(lane, z, type = this.types[Math.floor(Math.random() * this.types.length)]) {
        const pickup = this.pool[type].pop() || { mesh: this.models[type].clone(), type };
        pickup.mesh.position.set(lane, 1.14, z);
        pickup.previousZ = z;
        pickup.mesh.rotation.set(0, 0, 0);
        this.scene.add(pickup.mesh);
        this.powerups.push(pickup);
    }
    update(dt, speed) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pickup = this.powerups[i];
            const m = pickup.mesh;
            pickup.previousZ = m.position.z;
            m.position.z += speed * dt;
            m.rotation.y = 0.36 * Math.sin(m.position.z * 0.16);
            m.rotation.z = 0.07 * Math.sin(m.position.z * 0.22);
            m.position.y = 1.15 + 0.095 * Math.sin(m.position.z * 0.27);
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
