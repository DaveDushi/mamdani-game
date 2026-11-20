import * as THREE from 'three';
import { RIVALS } from './FamilyRace.js';
import { raceDistance } from './RaceSchedule.js';
import { Batch, labelMaterial } from './Geometry.js';

export const APPROACH_SECONDS = 9.5;
const CHECK_IN_LEAD = 18;
const SIGHT_DISTANCE = 135;
const FINAL = RIVALS.length - 1;

export function approachCopy(schedule, rival, metres, speed, chasing, trackReady) {
    if (schedule.initialRecordPending) {
        return { tone: 'quiet', label: 'Family race', name: 'Checking season record', detail: '' };
    }
    if (!rival) {
        return { tone: 'quiet', label: '100% takeover', name: 'Overtime', detail: '' };
    }
    const final = rival.index === FINAL;
    const waitingForRecord = final && !schedule.qualified;
    const remaining = Math.max(0, rival.at - metres);
    const close = remaining <= speed * APPROACH_SECONDS;
    const label = waitingForRecord ? 'Record challenge' : close ? 'Race ahead' : 'Next race';
    let detail;
    if (!close) detail = waitingForRecord ? `Beat ${raceDistance(schedule.target)} to race` : `At ${raceDistance(rival.at)}`;
    else if (remaining) detail = `${raceDistance(remaining)} ${waitingForRecord ? 'minimum' : 'to go'}`;
    else if (waitingForRecord) detail = schedule.retryClaim && !schedule.claiming ? 'Retrying record check' : 'Checking your record';
    else if (chasing) detail = 'Clear the chase';
    else if (schedule.elapsed < schedule.nextHeatAt) detail = 'After the street stretch';
    else if (!trackReady) detail = 'Preparing the track';
    else detail = 'Next clear stretch';
    return { tone: close ? 'approach' : 'quiet', label, name: rival.name, detail };
}

function makeCheckIn(scene) {
    const group = new THREE.Group();
    group.name = 'Race check-in';
    const supports = new Batch();
    const face = new THREE.PlaneGeometry(1.28, 1.08);
    const materials = [
        labelMaterial(['RACE', 'CHECK-IN'], '#ffcb52', '#162831', 256, 160),
        labelMaterial(['RECORD', 'CHECK'], '#ffcb52', '#162831', 256, 160)
    ];
    const boards = [];
    for (const side of [-1, 1]) {
        const x = side * 5.28;
        supports.box(0x172a37, x, .88, 0, .13, 1.76, .13);
        supports.box(0x62666a, x, .10, 0, .42, .20, .43);
        supports.box(0x182b39, x, 1.90, 0, 1.34, 1.16, .09);
        supports.box(0xffe49c, x, 2.50, 0, 1.34, .06, .1);
        const board = new THREE.Mesh(face, materials[0]);
        board.position.set(x, 1.90, .051);
        boards.push(board);
        group.add(board);
    }
    group.add(supports.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
    scene.add(group);
    return { group, boards, materials };
}

function write(node, value) {
    if (node.textContent !== value) node.textContent = value;
}

export class RaceApproach {
    constructor(element, scene) {
        this.element = element;
        this.scene = scene;
        this.hud = element.closest('#hud');
        this.label = element.querySelector('[data-approach-label]');
        this.name = element.querySelector('[data-approach-name]');
        this.detail = element.querySelector('[data-approach-detail]');
        const home = this.hud.querySelector('.hud-lower');
        const footer = home.querySelector('.hud-foot');
        const pause = this.hud.querySelector('#pause-btn');
        const compact = matchMedia('(orientation: landscape) and (max-height: 430px)');
        const dock = () => {
            if (compact.matches) pause.parentElement.insertBefore(element, pause);
            else home.insertBefore(element, footer);
        };
        compact.addEventListener('change', dock);
        dock();
    }

    paint(state, chasing) {
        const { element } = this;
        if (element.dataset.tone !== state.tone) element.dataset.tone = state.tone;
        this.hud.classList.toggle('race-priority', state.tone === 'approach' || chasing);
        write(this.label, state.label);
        write(this.name, state.name);
        write(this.detail, state.detail);
        if (element.hidden) element.hidden = false;
    }

    place(rival, distance, recordPending, qualified) {
        const z = rival ? distance - (rival.at - CHECK_IN_LEAD) : Infinity;
        if (recordPending || z < -SIGHT_DISTANCE || z > 2) {
            if (this.checkIn) this.checkIn.group.visible = false;
            return;
        }
        this.checkIn ??= makeCheckIn(this.scene);
        const { group, boards, materials } = this.checkIn;
        group.visible = true;
        group.position.z = z;
        const material = materials[rival.index === FINAL && !qualified ? 1 : 0];
        for (const board of boards) board.material = material;
    }

    hide() {
        this.element.hidden = true;
        this.hud.classList.remove('race-priority');
        if (this.checkIn) this.checkIn.group.visible = false;
    }
}
