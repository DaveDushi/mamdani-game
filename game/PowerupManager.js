import * as THREE from 'three';
import { foodStampSize, roadPickup } from './PickupArt.js';
import { cityBusModel } from './CityBusArt.js';

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
        this.scene.add(pickup.mesh);
        this.powerups.push(pickup);
    }
    update(dt, speed) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const pickup = this.powerups[i];
            const m = pickup.mesh;
            pickup.previousZ = m.position.z;
            m.position.z += speed * dt;
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
