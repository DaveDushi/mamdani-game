import { streetProps } from './StreetProps.js';
import { streetCourse } from './Course.js';

const LOOKAHEAD = 83;

const bounds = {
    taxi: [0.83, 1.28, 1.66],
    halal: [1.2, 3.05, 0.8],
    scaffold: [1.21, 2.2, 0.8],
    protestor: [0.51, 2.8, 0.33],
    alcohol: [0.25, 1.02, 0.25],
    coin: [0.47, 0.4, 0.24]
};

export class ObstacleManager {
    constructor(scene, powerups, cast) {
        this.scene = scene;
        this.powerups = powerups;
        this.models = streetProps(cast);
        for (const [key, g] of Object.entries(this.models)) {
            if (key !== 'coin')
                g.traverse((part) => {
                    part.castShadow = part.isMesh;
                });
        }
        this.pool = Object.fromEntries(Object.keys(this.models).map((key) => [key, []]));
        this.obstacles = [];
    }
    add(key, x, z) {
        const obj = this.pool[key].pop() || {
            mesh: this.models[key].clone(),
            key,
            type: key.startsWith('protest') ? 'protestor' : key
        };
        obj.mesh.position.set(x, key === 'coin' ? 1.02 : 0, z);
        obj.mesh.rotation.y = 0;
        obj.stunt = null;
        obj.passed = false;
        this.scene.add(obj.mesh);
        this.obstacles.push(obj);
    }
    remove(index) {
        const [obj] = this.obstacles.splice(index, 1);
        this.scene.remove(obj.mesh);
        this.pool[obj.key].push(obj);
    }
    reset(random = Math.random) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) this.remove(i);
        this.course = streetCourse(random);
        this.nextRow = this.course.next().value;
        this.add('coin', 0, -5);
        this.add('coin', 0, -8.5);
        this.fillCourse(0);
        this.lastStunt = null;
    }
    fillCourse(distance) {
        while (this.nextRow.distance <= distance + LOOKAHEAD) {
            const row = this.nextRow;
            const z = distance - row.distance;
            if (row.lanes) {
                row.lanes.forEach((key, lane) => {
                    if (key && lane !== row.exitLane) this.add(key, (lane - 1) * 3, z);
                });
                const x = (row.exitLane - 1) * 3;
                for (const lead of [12, 8, 4]) this.add('coin', x, z + lead);
            } else {
                const x = (row.pickupLane - 1) * 3;
                this.add('coin', x, z + 5);
                this.powerups.spawnPowerup(x, z, row.pickup);
                this.add('coin', x, z - 5);
            }
            this.nextRow = this.course.next().value;
        }
    }
    clear() {
        for (let i = this.obstacles.length - 1; i >= 0; i--)
            if (this.obstacles[i].type !== 'coin') this.remove(i);
    }
    update(dt, speed, distance) {
        const step = speed * dt;
        this.fillCourse(distance - step);
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            obj.mesh.position.z += step;
            if (obj.type === 'coin') {
                obj.mesh.rotation.y = 0.5 * Math.sin(distance * 0.085 + obj.mesh.position.z * 0.2);
                obj.mesh.rotation.z = 0.13;
                obj.mesh.position.y = 1 + 0.095 * Math.sin(distance * 0.17 + obj.mesh.position.z * 0.39);
            }
            if (obj.mesh.position.z > 11) this.remove(i);
        }
    }
    checkCollisions(player) {
        const p = player.mesh.position;
        this.lastStunt = null;
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i],
                q = obj.mesh.position,
                [w, h, d] = bounds[obj.type];
            const dz = d + 0.27,
                dx = Math.abs(p.x - q.x);
            if (q.z > dz && !obj.passed) {
                obj.passed = true;
                if (obj.stunt && !player.invincible) this.lastStunt = obj.stunt;
            }
            if (Math.abs(q.z) > dz) continue;
            if (dx > w + 0.24) {
                if (obj.type !== 'coin' && obj.type !== 'alcohol' && dx < w + 0.67 && !player.invincible)
                    obj.stunt = 'sidestep';
                continue;
            }
            if (obj.type === 'coin') {
                if (q.y + h < p.y + 0.1 || q.y - h > p.y + (player.slideTimer > 0 ? 0.87 : 1.87)) continue;
            } else {
                if (p.y + 0.09 > h) {
                    if (obj.type === 'taxi') obj.stunt = 'cab';
                    continue;
                }
                if (
                    (obj.type === 'halal' || obj.type === 'scaffold') &&
                    player.slideTimer > 0 &&
                    p.y + 0.89 < 1.36
                ) {
                    obj.stunt = 'slide';
                    continue;
                }
            }
            this.remove(i);
            return obj.type;
        }
        return null;
    }
}
