import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { Batch } from './Geometry.js';
import { groundShadow } from './Player.js';

const COURSE = 50;
const BASE = import.meta.env.BASE_URL;
const plank = new THREE.PlaneGeometry();
const footprint = new THREE.CircleGeometry(1, 8);
const runnerSize = { junior: 1.08, ivanka: 1.07, eric: 1.14, tiffany: 1.01, barron: 1.21 };
const ink = 0x17374b;
const steel = 0x758995;
const cream = 0xffecd0;

function canvasMap(canvas) {
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
}

function signSheet() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const g = canvas.getContext('2d');
    const rows = [
        ['EAST RIVER SPRINT', '#152f43', '#ffe4a1'],
        ['100 M   /   FINISH', '#f0ae38', '#173449'],
        ['BROOKLYN  /  NYC', '#18384b', '#f7e7bf'],
        ['EAST RIVER TRACK CLUB', '#e3ae4b', '#1d3745'],
        ['CITY WIRE   /   SPORT', '#efe6d5', '#19364b'],
        ['START', '#17394e', '#fff1cf'],
        ['100 M', '#f3b442', '#153447'],
        ['FINISH', '#fff1ce', '#19364b']
    ];
    rows.forEach(([title, paper, text], i) => {
        const y = i * 128;
        g.fillStyle = paper;
        g.fillRect(0, y, 1024, 128);
        g.fillStyle = text;
        for (let j = 0; j < 4; j++) {
            g.beginPath();
            g.moveTo(15 + j * 16, y + 96);
            g.lineTo(46 + j * 16, y + 32);
            g.lineTo(56 + j * 16, y + 32);
            g.lineTo(25 + j * 16, y + 96);
            g.fill();
        }
        g.font = 'italic 900 85px Condensed, Impact, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(title, 565, y + 69, 836);
    });
    return new THREE.MeshBasicMaterial({ map: canvasMap(canvas), side: THREE.DoubleSide });
}

function sign(batch, row, x, y, z, width, height, angle = 0) {
    batch.shape(plank, 0xffffff, x, y, z, width, height, 1, 0, angle, 0,
        [0.002, (7 - row) / 8 + 0.002, 0.996, 1 / 8 - 0.004]);
}

function track() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d');
    const pixels = g.createImageData(c.width, c.height);
    let seed = 6235;
    for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const n = (seed >>> 24) / 255 * 26 - 13;
        pixels.data[i] = 158 + n;
        pixels.data[i + 1] = 76 + n;
        pixels.data[i + 2] = 60 + n;
        pixels.data[i + 3] = 255;
    }
    g.putImageData(pixels, 0, 0);
    g.fillStyle = '#eddfc4';
    for (const x of [20, 256, 492]) g.fillRect(x - 2.5, 0, 5, 512);
    for (const edge of [0, 495]) {
        g.fillStyle = '#354a50';
        g.fillRect(edge, 0, 17, 512);
    }
    const rubber = canvasMap(c);
    rubber.wrapT = THREE.RepeatWrapping;
    rubber.repeat.y = 15;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 80),
        new THREE.MeshLambertMaterial({ map: rubber }));
    road.rotation.x = -Math.PI / 2;
    road.position.z = COURSE / 2;
    road.receiveShadow = true;
    return road;
}

function venue(scene) {
    const structure = new Batch(), boards = new Batch(), fans = new Batch();
    const startZ = -1.9;
    for (const [z, finish] of [[startZ, false], [COURSE, true]]) {
        for (const side of [-1, 1]) {
            const x = side * 2.62;
            structure.box(ink, x, 1.8, z, .28, 3.6, .27);
            structure.box(0xf2bc50, x, 2.72, z + .15, .29, .13, .025);
            structure.box(steel, x, .045, z, .60, .09, .56);
        }
        structure.box(ink, 0, 3.53, z, 5.53, .59, .26);
        sign(boards, finish ? 1 : 0, 0, 3.53, z + .141, 5.51, .55);
    }
    for (const z of [0, COURSE]) {
        structure.box(cream, 0, .008, z, 4.26, .008, .15);
    }
    for (let i = 0; i < 20; i++) {
        for (let row = 0; row < 2; row++) {
            structure.box((i + row) % 2 ? ink : cream, (i - 9.5) * .212, .010, COURSE - .28 + row * .17,
                .213, .008, .18);
        }
    }
    for (const side of [-1, 1]) {
        const x = side * 2.93;
        structure.box(0xc1b5a1, side * 5.8, -.095, 25, 7.08, .16, 82);
        structure.box(steel, x, .78, 25, .045, .055, 80);
        structure.box(steel, x, .28, 25, .032, .032, 80);
        structure.box(0x7a8886, side * 6.55, .85, 25, .05, .065, 79);
        for (let n = 0; n < 28; n++) {
            const z = -13 + n * 2.85;
            structure.box(0xa79f92, side * 5.8, -.012, z, 7.04, .002, .018);
            structure.box(steel, x, .44, z, .046, .88, .054);
            structure.box(steel, x, .036, z, .44, .072, .22);
            structure.box(0x71817c, side * 6.55, .43, z, .05, .86, .05);
            if (n % 2 === 0) sign(boards, 2 + ((n / 2 + (side > 0 ? 1 : 0)) % 3),
                x - side * .038, .53, z + 1.42, 2.65, .50, -side * Math.PI / 2);
            const choice = (n * (side > 0 ? 3 : 5) + (side > 0 ? 1 : 4)) % 8;
            const h = 1.65 + ((n * 31) % 11) * .024;
            if (side === 1 && Math.abs(z - COURSE) < 4) continue;
            const fanX = side * (3.56 + (n % 3) * .13), fanZ = z + (n % 4) * .27;
            structure.shape(footprint, 0xa99e8c, fanX, -.010, fanZ, .35, .19, 1, -Math.PI / 2);
            fans.shape(plank, 0xffffff, fanX, h / 2, fanZ,
                h * .4, h, 1, 0, -side * .77, 0, [choice / 8 + .0005, 0, .124, 1]);
        }
        for (let k = 0; k < 10; k++) {
            const z = k * 5;
            structure.box(cream, side * 1.88, .008, z, .40, .008, .05);
            if (k % 2) continue;
            const poleX = side * 4.0;
            structure.box(steel, poleX, 1.5, z - 2.0, .038, 3, .04);
            structure.box(k % 4 ? 0xeeae39 : 0x287383, poleX, 2.65, z - 2.02, .36, .88, .025, 0, -side * .55, -.045);
        }
    }
    scene.add(track(), structure.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), boards.mesh(signSheet()));
    const crowd = fans.mesh(new THREE.MeshBasicMaterial({ transparent: false, alphaTest: .48, side: THREE.DoubleSide }));
    crowd.visible = false;
    scene.add(crowd);
    return crowd;
}

function ribbon(scene) {
    const vertices = new Float32Array(2 * 9 * 2 * 3);
    const indices = [];
    const uv = [];
    for (let half = 0; half < 2; half++) {
        for (let k = 0; k <= 8; k++) {
            const i = half * 18 + k * 2;
            const u = half === 0 ? k / 8 : 1 - k / 8;
            uv.push(u, 0, u, 1);
            if (k < 8) indices.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 48;
    const pen = canvas.getContext('2d');
    pen.fillStyle = '#f4b638';
    pen.fillRect(0, 0, 1024, 48);
    pen.fillStyle = '#203746';
    pen.font = 'italic 900 37px Condensed, Impact, sans-serif';
    for (let i = 0; i < 4; i++) pen.fillText('NYC  /  FINISH', 16 + i * 256, 36, 216);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: canvasMap(canvas), side: THREE.DoubleSide }));
    mesh.frustumCulled = false;
    mesh.position.z = COURSE;
    scene.add(mesh);
    return (p, finished, reduced) => {
        const fold = finished ? 1 : THREE.MathUtils.smoothstep(p, .988, 1);
        for (let half = 0; half < 2; half++) {
            const side = half === 0 ? -1 : 1;
            for (let k = 0; k <= 8; k++) {
                const t = k / 8;
                const x = side * (2.6 - (2.60 - fold * .88) * t);
                const y = 1.03 - .10 * Math.sin(t * Math.PI / 2) - fold * t * .44;
                const z = fold * t * t * (reduced ? .5 : 1.34) + .05 * Math.sin(Math.PI * t);
                const i = (half * 9 + k) * 2;
                geometry.attributes.position.setXYZ(i, x, y - .042, z);
                geometry.attributes.position.setXYZ(i + 1, x, y + .042, z);
            }
        }
        geometry.attributes.position.needsUpdate = true;
    };
}

class Athlete {
    constructor(figure, animations, scale) {
        this.figure = figure;
        this.root = new THREE.Group();
        this.root.scale.setScalar(scale);
        this.root.add(figure);
        figure.rotation.set(0, 0, 0);
        figure.traverse(part => {
            if (part.isMesh) {
                part.castShadow = true;
                part.frustumCulled = false;
            }
        });
        this.mixer = new THREE.AnimationMixer(figure);
        this.stand = this.mixer.clipAction(THREE.AnimationClip.findByName(animations, 'Idle')).play();
        this.run = this.mixer.clipAction(THREE.AnimationClip.findByName(animations, 'Run')).play();
    }

    pose(stride, idle) {
        this.stand.enabled = idle;
        this.run.enabled = !idle;
        this.stand.time = stride % this.stand.getClip().duration;
        this.run.time = (stride % 1) * this.run.getClip().duration;
        this.mixer.update(0);
    }
}

export class RaceStage {
    constructor(cast, player) {
        this.cast = cast;
        this.loader = new GLTFLoader();
        this.cache = new Map();
        this.pending = new Map();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xadcfde);
        this.scene.fog = new THREE.Fog(0xd6dfd9, 26, 90);
        this.camera = new THREE.PerspectiveCamera(40, 1, .08, 150);
        this.scene.add(this.camera);
        this.scene.add(new THREE.HemisphereLight(0xfff7e4, 0xc0cbd1, 1.59));
        this.sun = new THREE.DirectionalLight(0xffebca, 2.25);
        this.sun.castShadow = true;
        Object.assign(this.sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .2, far: 21 });
        this.sun.shadow.mapSize.set(512, 512);
        this.sun.shadow.normalBias = .008;
        this.sun.shadow.bias = -.00035;
        this.scene.add(this.sun, this.sun.target);
        const fill = new THREE.DirectionalLight(0xc3e7ff, .8);
        fill.position.set(2, 3, -4);
        this.scene.add(fill);
        const crowd = venue(this.scene);
        this.updateRibbon = ribbon(this.scene);
        this.back = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ fog: false, depthWrite: false }));
        this.back.visible = false;
        this.back.renderOrder = -10;
        this.camera.add(this.back);
        const textures = new THREE.TextureLoader();
        const attach = (mesh, path) => textures.loadAsync(BASE + 'art/' + path + '.webp').then(map => {
            map.colorSpace = THREE.SRGBColorSpace;
            mesh.material.map = map;
            mesh.material.needsUpdate = true;
            mesh.visible = true;
        }).catch(() => {});
        this.ready = Promise.all([attach(this.back, 'race-waterfront'), attach(crowd, 'race-crowd')]);
        const figure = cloneRig(player.rig.figure);
        this.player = new Athlete(figure, cast.mayor.animations, player.mesh.scale.x);
        const originals = [], copies = [];
        player.rig.figure.traverse(p => originals.push(p));
        figure.traverse(p => copies.push(p));
        this.wardrobe = originals.map((part, i) => [part, copies[i]]);
        this.scene.add(this.player.root);
        this.shadows = [groundShadow(this.scene, 1.1, 1.2), groundShadow(this.scene, 1.1, 1.2)];
    }

    prepare(rival) {
        if (!this.pending.has(rival.id)) {
            this.pending.set(rival.id, this.loadAthlete(rival.id).then(athlete => this.cache.set(rival.id, athlete)));
        }
        return Promise.all([this.ready, this.pending.get(rival.id)]);
    }

    async loadAthlete(id) {
        if (id === 'donald') return new Athlete(cloneRig(this.cast.chaser.scene), this.cast.chaser.animations, 1.1);
        try {
            const asset = await this.loader.loadAsync(BASE + 'models/race/' + id + '.glb');
            return new Athlete(asset.scene, this.cast.chaser.animations, runnerSize[id]);
        } catch {
            // The base-game rigs are already resident if an optional race file fails offline.
            const standIn = cloneRig(this.cast.chaser.scene);
            const suit = standIn.getObjectByName('Outfit_original');
            suit.material = suit.material.clone();
            suit.material.color.set({ junior: 0x77936f, ivanka: 0xe3d9af, eric: 0x93c3de,
                tiffany: 0xbd91bc, barron: 0x778caa }[id]);
            standIn.getObjectByName('mixamorigLeftHand')?.traverse(part => {
                if (part.isMesh) part.visible = false;
            });
            return new Athlete(standIn, this.cast.chaser.animations, runnerSize[id]);
        }
    }

    start(rival) {
        this.stop();
        this.active = rival;
        for (const [original, copy] of this.wardrobe) copy.visible = original.visible;
        this.rival = this.cache.get(rival.id);
        if (this.rival) this.scene.add(this.rival.root);
        else this.prepare(rival).then(() => {
            if (this.active === rival && !this.rival) {
                this.rival = this.cache.get(rival.id);
                this.scene.add(this.rival.root);
            }
        });
        this.idle = 0;
    }

    render(renderer, race, dt, reducedMotion) {
        if (!this.active) return;
        const w = renderer.domElement.clientWidth || innerWidth;
        const h = renderer.domElement.clientHeight || innerHeight;
        const aspect = w / h, portrait = aspect < .82;
        const p = race.playerProgress, r = race.rivalProgress;
        const done = race.phase === 'won' || race.phase === 'lost';
        const intro = race.phase === 'intro';
        const lead = Math.max(p, r), gap = Math.abs(p - r) * COURSE;
        const focus = lead * COURSE - Math.min(gap * .46, 1.3);
        const close = 1 / (1 + gap * .28);
        const camera = this.camera;
        const fov = portrait ? 36 : 33;
        if (camera.aspect !== aspect || camera.fov !== fov) {
            camera.aspect = aspect;
            camera.fov = fov;
            camera.updateProjectionMatrix();
        }
        const finishAngle = done && !reducedMotion ? (portrait ? .49 : 1.03) : 0;
        const angle = Math.max(portrait ? .14 : .41, finishAngle) * close;
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const aimX = portrait ? 0 : -.49;
        const halfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2));
        const viewWidth = halfFov * aspect * .88;
        // Keep limb clearance in both lanes, including the nearer runner when the lead changes hands.
        const fit = (x, z) => {
            const dx = x - aimX, dz = z - focus;
            return dx * sin + dz * cos + (Math.abs(dx * cos - dz * sin) + .48) / viewWidth;
        };
        const base = portrait ? Math.max(6.45, 4.5 / aspect) : (h < 500 ? 10.6 : 5.8);
        const dist = Math.max(base, fit(-.86, p * COURSE), fit(.86, r * COURSE));
        camera.position.set(aimX + dist * sin, portrait ? 1.70 : 1.53, focus + dist * cos);
        camera.lookAt(aimX, h < 500 ? .98 : 1.02, focus);
        // The distant skyline tracks the broadcast camera; the near rail and spectators have true parallax.
        const far = 100, viewHeight = 2 * far * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const backH = Math.max(viewHeight * .75, viewHeight * aspect / 2.7);
        this.back.scale.set(backH * 3.0, backH, 1);
        this.back.position.set(-backH * .14, viewHeight * .21, -far);
        this.sun.position.set(-3.1, 6.5, focus + 3.6);
        this.sun.target.position.set(0, 0, focus);
        if (!done && dt > 0) this.idle += Math.min(.1, dt);
        for (let i = 0; i < 2; i++) {
            const athlete = i ? this.rival : this.player;
            const lane = i ? .86 : -.86, progress = i ? r : p;
            if (!athlete) continue;
            const z = progress * COURSE;
            athlete.root.position.set(lane, 0, z);
            const waiting = intro || (!i && race.speed < .3 && !done);
            const stride = waiting ? this.idle + .7 * i : progress * 34 + (i ? .36 : .09);
            athlete.pose(stride, waiting);
            this.shadows[i].position.set(lane - .035, .018, z - .04);
        }
        this.updateRibbon(lead, done, reducedMotion);
        renderer.render(this.scene, camera);
    }

    stop() {
        if (this.rival) this.rival.root.removeFromParent();
        this.rival = null;
        this.active = null;
    }
}
