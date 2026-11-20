import { streetProps } from './StreetProps.js';

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
    reset() {
        for (let i = this.obstacles.length - 1; i >= 0; i--) this.remove(i);
        for (let i = 0; i < 4; i++) this.add('coin', 0, -9 - i * 2.7);
        this.add('taxi', -3, -24);
        this.add('protest0', 0, -42);
        this.add('scaffold', 3, -57);
        this.spawnIn = 0;
        this.pattern = 0;
        this.powerIndex = 0;
        this.lastStunt = null;
    }
    clear() {
        for (let i = this.obstacles.length - 1; i >= 0; i--)
            if (this.obstacles[i].type !== 'coin') this.remove(i);
    }
    update(dt, speed, distance) {
        this.spawnIn -= speed * dt;
        if (this.spawnIn <= 0) {
            const lane = (Math.floor(Math.random() * 3) - 1) * 3;
            const roll = Math.random(),
                z = -83;
            if (this.pattern % 6 === 0) {
                const type = ['rainbow', 'kafiyeh', 'covidMask'][this.powerIndex++ % 3];
                this.powerups.spawnPowerup(this.pattern === 0 ? 3 : lane, z, type);
            } else if (roll < 0.31) {
                for (let j = 0; j < 4; j++) this.add('coin', lane, z - j * 2.6);
            } else {
                const kind =
                    roll < 0.54
                        ? 'taxi'
                        : roll < 0.67
                          ? 'halal'
                          : roll < 0.8
                            ? 'scaffold'
                            : roll < 0.86
                              ? 'alcohol'
                              : 'protest' +
                                ((Math.floor(distance / 1000) + Math.floor(Math.random() * 3)) % 3);
                this.add(kind, lane, z);
                if (distance > 95 && this.pattern % 3 === 1) {
                    const nextLane = lane === 3 ? 0 : lane + 3;
                    this.add(kind === 'taxi' ? 'scaffold' : 'taxi', nextLane, z);
                    // A stamp trail leads into the open lane before a two-obstacle gate.
                    const openLane = -lane - nextLane;
                    for (let j = 0; j < 3; j++) this.add('coin', openLane, z + 7 - j * 2.6);
                }
            }
            this.pattern++;
            this.spawnIn = Math.max(17, speed * 0.82) + Math.random() * 4;
        }
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            obj.mesh.position.z += speed * dt;
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
