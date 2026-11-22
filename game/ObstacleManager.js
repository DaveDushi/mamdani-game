import { streetProps } from './StreetProps.js';
import { streetCourse } from './Course.js';
import { wallContact } from './StreetWall.js';
import { courseCueModels, railClearance, railInnerFoot, skillGateBounds, skillGateModels, slideClearance } from './SkillGates.js';
import { encounterModels } from './StreetEncounterArt.js';
import { configureEncounter, encounterContact, moveEncounter } from './StreetEncounters.js';
import { rentIceModel, touchesRentIce } from './RentIce.js';
import { civicContact, civicGateKey, civicModels, configureCivic, moveCarriage } from './CivicEncounters.js';
import { busyStreet } from './StreetFiller.js';
import { fairClearance, stretchBounds, stretchModels } from './StretchArt.js';

// Traffic is laid beyond the point where street fog closes, so none of it appears in view.
const LOOKAHEAD = 235;
const LOOKAHEAD_SECONDS = 3;
const bounds = {
    taxi: [0.83, 1.28, 1.66],
    halal: [1.2, 3.05, 0.8],
    scaffold: [1.21, 2.2, 0.8],
    protestor: [0.51, 2.8, 0.33],
    alcohol: [0.25, 1.02, 0.25],
    coin: [0.47, 0.4, 0.24],
    ...skillGateBounds,
    ...stretchBounds
};
const floorClearance = {
    halal: 1.36,
    scaffold: 1.36,
    slideGate: slideClearance,
    railGate: railClearance,
    fairBanner: fairClearance
};
const jumpProps = new Set(['taxi', 'trashPile']);

export class ObstacleManager {
    constructor(scene, powerups, cast) {
        this.scene = scene;
        this.powerups = powerups;
        this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        this.models = { ...streetProps(cast), ...skillGateModels(), ...courseCueModels(), ...encounterModels(), ...civicModels(), ...stretchModels(), rentIce: rentIceModel() };
        for (const [key, g] of Object.entries(this.models)) {
            if (key !== 'coin' && key !== 'rentIce' && !key.endsWith('Cue'))
                g.traverse((part) => {
                    part.castShadow = part.isMesh && part.name !== 'deliveryBay';
                });
        }
        this.pool = Object.fromEntries(Object.keys(this.models).map((key) => [key, []]));
        this.obstacles = [];
        this.previewRows = [];
        this.laidRows = [];
        this.stretches = [];
    }
    add(key, x, z, height = 1.02, encounter = null) {
        const obj = this.pool[key].pop() || {
            mesh: this.models[key].clone(),
            key,
            type: key === 'marchBarrier' ? 'gateBlock' : key.startsWith('protest') ? 'protestor' : key.endsWith('Cue') ? 'cue' : key,
            civic: key === 'policeTape' || key === 'fallenPlacard' || key === 'horseCarriage'
        };
        obj.mesh.position.set(x, key === 'coin' ? height : 0, z);
        obj.mesh.rotation.y = 0;
        obj.height = height;
        obj.stampReach = null;
        obj.previousZ = z;
        obj.gate = null;
        obj.stunt = null;
        obj.passed = false;
        obj.cueLead = 0;
        obj.busYieldX = undefined;
        if (obj.stencil) obj.stencil.position.x = 0;
        if (obj.busBroken) {
            for (const part of obj.mesh.children) part.visible = true;
            obj.busBroken = false;
        }
        obj.moving = key === 'deliveryDolly' || key === 'signalBoom';
        if (obj.moving) configureEncounter(obj, encounter, this.reducedMotion);
        if (obj.civic) configureCivic(obj, encounter, this.reducedMotion);
        this.scene.add(obj.mesh);
        this.obstacles.push(obj);
        return obj;
    }
    remove(index) {
        const [obj] = this.obstacles.splice(index, 1);
        this.scene.remove(obj.mesh);
        this.pool[obj.key].push(obj);
    }
    reset(mode = 'day', random = Math.random, isOvertime, firstRun = false) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) this.remove(i);
        this.previousRunnerX = this.previousRunnerY = 0;
        this.course = busyStreet(streetCourse(random, mode, isOvertime, firstRun), mode);
        this.previewRows = [];
        this.laidRows = [];
        this.stretches = [];
        this.nextRow = this.pullRow();
        this.fillCourse(0);
        this.lastStunt = null;
        this.slippedOnIce = false;
    }
    pullRow() {
        const row = this.course.next().value;
        if (row?.stretch && this.stretches?.at(-1) !== row.stretch) this.stretches.push(row.stretch);
        return row;
    }
    stretchAt(distance) {
        while (this.stretches.length && this.stretches[0].until < distance) this.stretches.shift();
        const stretch = this.stretches[0];
        return stretch && stretch.at <= distance ? stretch : null;
    }
    peekRowsThrough(distance) {
        while ((this.previewRows.at(-1) ?? this.nextRow).distance < distance) this.previewRows.push(this.pullRow());
        // Loose stamps and roadside traffic never close a curb cut.
        return [...this.laidRows, this.nextRow, ...this.previewRows].filter(row => !row.trail && !row.fill);
    }
    markLane(x, z, row, cue = 'laneCue') {
        const leads = row.gate ? [4, 3] : [3, 2];
        for (const lead of leads) {
            const offset = lead * row.cueStep;
            this.add(cue, x, z + offset).cueLead = offset;
        }
    }
    fillCourse(distance, speed = 0) {
        const horizon = Math.max(LOOKAHEAD, speed * LOOKAHEAD_SECONDS);
        this.laidRows ??= [];
        while (this.laidRows.length && this.laidRows[0].distance < distance) this.laidRows.shift();
        while (this.nextRow.distance <= distance + horizon) {
            const row = this.nextRow;
            const z = distance - row.distance;
            if (row.lesson) {
                const cue = this.add(row.lesson.cue, 0, z + row.lesson.lead);
                cue.cueLead = row.lesson.lead;
            }
            if (row.fill) {
                for (const { lane, key } of row.fill) this.add(key, (lane - 1) * 3, z);
            } else if (row.trail) {
                row.trail.forEach((lane, i) => this.add('coin', (lane - 1) * 3, z - i * row.spacing));
            } else if (row.gate) {
                const gate = { hit: false, lanes: row.lanes };
                row.lanes.forEach((key, lane) => {
                    const x = (lane - 1) * 3;
                    const model = row.skin?.[key] ?? civicGateKey(key, row.encounter);
                    const obstacle = this.add(model, x, z, 1.02, row.encounter);
                    obstacle.gate = gate;
                    if (key === 'gateBlock') return;
                    const jump = key === 'jumpGate';
                    const guide = obstacle.mesh.getObjectByName('tutorialSign');
                    if (guide) guide.visible = row.tutorial;
                    const cue = key === 'railGate' ? 'laneCue' : jump ? 'jumpCue' : 'slideCue';
                    this.markLane(x, z, row, cue);
                    if (key === 'railGate') {
                        // One ticket on the rail is reachable above or below the bar.
                        const stamp = this.add('coin', x, z + 0.35, 1.31);
                        stamp.stampReach = 0.58;
                        stamp.gate = gate;
                    } else {
                        this.add('coin', x, z, jump ? 2.42 : 0.55);
                    }
                });
            } else if (row.lanes) {
                const open = !row.encounter || !row.lanes[row.exitLane];
                row.lanes.forEach((key, lane) => {
                    if (!key || (open && lane === row.exitLane)) return;
                    const x = (lane - 1) * 3;
                    const obstacle = this.add(key, x, z, 1.02, row.encounter);
                    const guide = obstacle.mesh.getObjectByName('tutorialSign');
                    if (guide) guide.visible = false;
                    if (lane === row.bonusLane) {
                        const jump = jumpProps.has(key);
                        const height = jump ? 2.42 : .55;
                        this.markLane(x, z, row, jump ? 'jumpCue' : 'slideCue');
                        this.add('coin', x, z + row.cueStep, height);
                        obstacle.gate = { hit: false, lanes: row.lanes };
                        this.add('coin', x, z, height).gate = obstacle.gate;
                    } else if (key === 'signalBoom' && lane === row.actionLane) {
                        const jump = row.encounter.position === 'low';
                        this.markLane(x, z, row, jump ? 'jumpCue' : 'slideCue');
                        this.add('coin', x, z, jump ? 2.42 : .54);
                    } else if (lane === row.exitLane) {
                        const jump = key === 'jumpGate';
                        this.markLane(x, z, row, jump ? 'jumpCue' : 'slideCue');
                        this.add('coin', x, z, jump ? 2.42 : .55);
                    }
                });
                if (open) {
                    const x = (row.exitLane - 1) * 3;
                    this.markLane(x, z, row);
                    this.add('coin', x, z);
                }
            } else {
                const x = (row.pickupLane - 1) * 3;
                this.powerups.spawnPowerup(x, z, row.pickup);
            }
            this.laidRows.push(row);
            this.nextRow = this.previewRows.shift() ?? this.pullRow();
        }
    }
    // Sweeps the road the runner can reach. Traffic beyond `reach` metres stays.
    clear(reach = Infinity) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const { type, mesh } = this.obstacles[i];
            if (type !== 'coin' && mesh.position.z > -reach) this.remove(i);
        }
    }
    clearFinishChute(distance) {
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const { type, mesh, cueLead } = this.obstacles[i];
            const rowZ = mesh.position.z - cueLead;
            if (type !== 'coin' && rowZ > -distance && rowZ < 2) this.remove(i);
        }
    }
    update(dt, speed, distance) {
        const step = speed * dt;
        this.carriageBell = false;
        this.fillCourse(distance - step, speed);
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            obj.previousZ = obj.mesh.position.z;
            if (obj.moving) obj.previousX = obj.mesh.position.x;
            obj.mesh.position.z += step;
            if (obj.moving) moveEncounter(obj);
            if (obj.type === 'horseCarriage' && moveCarriage(obj)) this.carriageBell = true;
            if (obj.type === 'coin') {
                obj.mesh.rotation.y = 0.5 * Math.sin(distance * 0.085 + obj.mesh.position.z * 0.2);
                obj.mesh.rotation.z = 0.13;
                obj.mesh.position.y = obj.height + 0.095 * Math.sin(distance * 0.17 + obj.mesh.position.z * 0.39);
            }
            if (obj.previousZ > 11) this.remove(i);
        }
    }
    checkCollisions(player, stampsOnly = false) {
        const p = player.mesh.position;
        const startX = this.previousRunnerX ?? p.x, startY = this.previousRunnerY ?? p.y;
        this.previousRunnerX = p.x;
        this.previousRunnerY = p.y;
        this.lastStunt = null;
        this.slippedOnIce = false;
        let collected = -1;
        // Check the board at the point of contact before testing adjacent jump
        // and slide lanes against the runner's position at the end of the step.
        let wallIndex = -1;
        let wallHit;
        for (let i = stampsOnly ? -1 : this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            if (obj.type !== 'gateBlock' || obj.gate?.hit) continue;
            const hit = wallContact(obj, bounds.gateBlock[0], startX, startY, p);
            if (hit) {
                wallIndex = i;
                wallHit = hit;
                if (hit === 'wall') break;
            }
        }
        if (wallIndex !== -1) {
            const gate = this.obstacles[wallIndex].gate;
            if (gate) gate.hit = true;
            this.remove(wallIndex);
            return wallHit;
        }
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obj = this.obstacles[i];
            const isStamp = obj.type === 'coin';
            if ((stampsOnly && !isStamp) || obj.busBroken) continue;
            if (obj.type === 'cue' || obj.type === 'gateBlock' || (obj.gate?.hit && !(isStamp && player.invincible))) continue;
            const q = obj.mesh.position;
            if (obj.type === 'rentIce') {
                if (!obj.passed && touchesRentIce(obj, p, startX, startY)) {
                    obj.passed = true;
                    this.slippedOnIce = true;
                }
                continue;
            }
            if (obj.moving || obj.civic) {
                const carriage = obj.type === 'horseCarriage';
                if (carriage && obj.passed) continue;
                const contact = obj.civic ? civicContact(obj, player, startX, startY) : encounterContact(obj, player, startX, startY);
                if (contact === 'hit') {
                    if (obj.gate) obj.gate.hit = true;
                    if (carriage) obj.passed = true;
                    else this.remove(i);
                    return obj.type;
                }
                if (contact && !player.invincible) obj.stunt = contact;
                if (q.z > (carriage ? 3.1 : .82) && !obj.passed) {
                    obj.passed = true;
                    if (obj.stunt && !player.invincible) this.lastStunt = obj.stunt;
                }
                continue;
            }
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
                if (obj.type === 'jumpGate' || obj.type === 'railGate' || obj.type === 'trashPile') obj.stunt = 'jump';
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
