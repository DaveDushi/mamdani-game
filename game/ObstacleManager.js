import { streetProps } from './StreetProps.js';
import { streetCourse } from './Course.js';
import { labelMaterial } from './Geometry.js';
import { courseCueModels, railClearance, railInnerFoot, skillGateBounds, skillGateModels, slideClearance } from './SkillGates.js';

const LOOKAHEAD = 83;
const escortStampColors = {
    kafiyeh: ['#e9f5f7', '#233b45'],
    covidMask: ['#a1ecf0', '#174952'],
    rainbow: ['#ffb6e6', '#632755']
};

const bounds = {
    taxi: [0.83, 1.28, 1.66],
    halal: [1.2, 3.05, 0.8],
    scaffold: [1.21, 2.2, 0.8],
    protestor: [0.51, 2.8, 0.33],
    alcohol: [0.25, 1.02, 0.25],
    coin: [0.47, 0.4, 0.24],
    ...skillGateBounds
};
const floorClearance = {
    halal: 1.36,
    scaffold: 1.36,
    slideGate: slideClearance,
    railGate: railClearance
};

export class ObstacleManager {
    constructor(scene, powerups, cast) {
        this.scene = scene;
        this.powerups = powerups;
        this.models = { ...streetProps(cast), ...skillGateModels(), ...courseCueModels() };
        this.stampMaterials = { route: this.models.coin.material };
        for (const [key, [paper, ink]] of Object.entries(escortStampColors)) {
            this.stampMaterials[key] = labelMaterial(['NYC', 'FOOD STAMP'], paper, ink, 256, 144);
        }
        for (const [key, g] of Object.entries(this.models)) {
            if (key !== 'coin' && !key.endsWith('Cue'))
                g.traverse((part) => {
                    part.castShadow = part.isMesh;
                });
        }
        this.pool = Object.fromEntries(Object.keys(this.models).map((key) => [key, []]));
        this.obstacles = [];
    }
    add(key, x, z, stampStyle = 'route', height = 1.02) {
        const obj = this.pool[key].pop() || {
            mesh: this.models[key].clone(),
            key,
            type: key.startsWith('protest') ? 'protestor' : key.endsWith('Cue') ? 'cue' : key
        };
        if (key === 'coin') obj.mesh.material = this.stampMaterials[stampStyle];
        obj.mesh.position.set(x, key === 'coin' ? height : 0, z);
        obj.mesh.rotation.y = 0;
        obj.height = height;
        obj.stampReach = null;
        obj.previousZ = z;
        obj.gate = null;
        obj.stunt = null;
        obj.passed = false;
        this.scene.add(obj.mesh);
        this.obstacles.push(obj);
        return obj;
    }
    remove(index) {
        const [obj] = this.obstacles.splice(index, 1);
        this.scene.remove(obj.mesh);
        this.pool[obj.key].push(obj);
    }
    reset(mode = 'day', random = Math.random) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) this.remove(i);
        this.course = streetCourse(random, mode);
        this.nextRow = this.course.next().value;
        this.fillCourse(0);
        this.lastStunt = null;
    }
    markLane(x, z, row, cue = 'laneCue') {
        const leads = row.gate ? [4, 3] : [3, 2];
        for (const lead of leads) this.add(cue, x, z + lead * row.cueStep);
    }
    fillCourse(distance) {
        while (this.nextRow.distance <= distance + LOOKAHEAD) {
            const row = this.nextRow;
            const z = distance - row.distance;
            if (row.gate) {
                const gate = { hit: false };
                row.lanes.forEach((key, lane) => {
                    const x = (lane - 1) * 3;
                    const obstacle = this.add(key, x, z);
                    obstacle.gate = gate;
                    if (key === 'gateBlock') return;
                    const jump = key === 'jumpGate';
                    const guide = obstacle.mesh.getObjectByName('tutorialSign');
                    if (guide) guide.visible = row.tutorial;
                    this.markLane(x, z, row, row.tutorial ? (jump ? 'jumpCue' : 'slideCue') : 'laneCue');
                    if (key === 'railGate') {
                        // One ticket on the rail is reachable above or below the bar.
                        const stamp = this.add('coin', x, z + 0.35, 'route', 1.31);
                        stamp.stampReach = 0.58;
                        stamp.gate = gate;
                    } else {
                        this.add('coin', x, z, 'route', jump ? 2.42 : 0.55);
                    }
                });
            } else if (row.lanes) {
                row.lanes.forEach((key, lane) => {
                    if (key && lane !== row.exitLane) this.add(key, (lane - 1) * 3, z);
                });
                const x = (row.exitLane - 1) * 3;
                this.markLane(x, z, row);
                this.add('coin', x, z);
            } else {
                const x = (row.pickupLane - 1) * 3;
                this.add('coin', x, z + 5, row.pickup);
                this.powerups.spawnPowerup(x, z, row.pickup);
                this.add('coin', x, z - 5, row.pickup);
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
            obj.previousZ = obj.mesh.position.z;
            obj.mesh.position.z += step;
            if (obj.type === 'coin') {
                obj.mesh.rotation.y = 0.5 * Math.sin(distance * 0.085 + obj.mesh.position.z * 0.2);
                obj.mesh.rotation.z = 0.13;
                obj.mesh.position.y = obj.height + 0.095 * Math.sin(distance * 0.17 + obj.mesh.position.z * 0.39);
            }
            if (obj.mesh.position.z > 11) this.remove(i);
        }
    }
    checkCollisions(player) {
        const p = player.mesh.position;
        this.lastStunt = null;
        let collected = -1;
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            const isStamp = obj.type === 'coin';
            if (obj.type === 'cue' || (obj.gate?.hit && !(isStamp && player.invincible))) continue;
            const q = obj.mesh.position;
            const [w, h, d] = bounds[obj.type];
            const dz = d + 0.27,
                dx = Math.abs(p.x - q.x);
            // At coarse timesteps the whole collision window can pass between updates.
            const crossed = q.z > dz && obj.previousZ < -dz;
            if (q.z > dz && !crossed) {
                if (!obj.passed) {
                    obj.passed = true;
                    if (obj.stunt && !player.invincible) this.lastStunt = obj.stunt;
                }
                continue;
            }
            if (q.z < -dz) continue;
            if (dx > w + 0.24) {
                if (!obj.gate && obj.type !== 'coin' && obj.type !== 'alcohol' && dx < w + 0.67 && !player.invincible)
                    obj.stunt = 'sidestep';
                continue;
            }
            if (isStamp) {
                const reach = obj.stampReach ?? h;
                if (q.y + reach < p.y + 0.1 || q.y - reach > p.y + (player.slideTimer > 0 ? 0.87 : 1.87))
                    continue;
                if (collected === -1) collected = i;
                continue;
            }
            if (p.y + 0.09 > h) {
                if (obj.type === 'taxi') obj.stunt = 'cab';
                if (obj.type === 'jumpGate' || obj.type === 'railGate') obj.stunt = 'jump';
                continue;
            }
            const clearance = floorClearance[obj.type] ?? 0;
            const betweenFeet = obj.type !== 'railGate' || dx + 0.24 < railInnerFoot;
            if (player.slideTimer > 0 && p.y + 0.89 < clearance && betweenFeet) {
                obj.stunt = 'slide';
                continue;
            }
            // One failed gate should spend one strike, even if the runner clips two lanes.
            if (obj.gate) obj.gate.hit = true;
            this.remove(i);
            return obj.type;
        }
        if (collected !== -1) {
            this.remove(collected);
            return 'coin';
        }
        return null;
    }
}
