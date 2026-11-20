import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneRig } from 'three/addons/utils/SkeletonUtils.js';
import { Batch } from './Geometry.js';
import { groundShadow } from './Player.js';
import { WinnerPose } from './RaceFinish.js';
import { movementClip } from './Locomotion.js';
import { grandstands } from './RaceCrowd.js';

const COURSE = 50;
const BASE = import.meta.env.BASE_URL;
const plank = new THREE.PlaneGeometry();
const runnerSize = { junior: 1.08, ivanka: 1.07, eric: 1.14, tiffany: 1.01, barron: 1.21 };
const ink = 0x17374b;
const steel = 0x758995;
const cream = 0xffecd0;

function spareFrame() {
    return new Promise(resolve => requestAnimationFrame(() => {
        if (window.requestIdleCallback) window.requestIdleCallback(resolve, { timeout: 80 });
        else resolve();
    }));
}

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
        ['BROOKLYN   /   FINISH', '#f0ae38', '#173449'],
        ['BROOKLYN  /  NYC', '#18384b', '#f7e7bf'],
        ['EAST RIVER TRACK CLUB', '#e3ae4b', '#1d3745'],
        ['CITY WIRE   /   SPORT', '#efe6d5', '#19364b'],
        ['MAMDANI', '#154e47', '#fff3d3'],
        ['TEAM TRUMP', '#742e3e', '#fff3d3']
    ];
    rows.forEach(([title, paper, text], i) => {
        const y = i * 128;
        g.fillStyle = paper;
        g.fillRect(0, y, 1024, 128);
        g.fillStyle = text;
        if (i === 5 || i === 6) {
            g.save();
            g.translate(0, y);
            g.scale(1024 / 400, 1);
            g.font = 'italic 900 83px Condensed, Impact, sans-serif';
            g.fillText(title, 200, 68, 372);
            g.restore();
            return;
        }
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
    const names = ['AOC', 'TLAIB', 'OMAR', 'RUBIO', 'DESANTIS', 'SHAPIRO'];
    const cell = canvas.width / names.length;
    names.forEach((name, i) => {
        const x = i * cell, y = 7 * 128;
        g.save();
        g.translate(x, y);
        g.scale(cell / 340, 128 / 100);
        g.fillStyle = i < 3 ? '#153e39' : '#572b35';
        g.fillRect(0, 0, 340, 100);
        g.fillStyle = '#ffedcb';
        g.font = '700 85px Condensed, Impact, sans-serif';
        g.fillText(name, 170, 53, 324);
        g.restore();
    });
    return new THREE.MeshBasicMaterial({ map: canvasMap(canvas), side: THREE.DoubleSide });
}

function sign(batch, row, x, y, z, width, height, angle = 0, column = 0, columns = 1) {
    batch.shape(plank, 0xffffff, x, y, z, width, height, 1, 0, angle, 0,
        [column / columns + .002, (7 - row) / 8 + .002, 1 / columns - .004, 1 / 8 - .004]);
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
    const structure = new Batch(), boards = new Batch();
    const startZ = -4.8;
    for (const [z, finish] of [[startZ, false], [COURSE, true]]) {
        const height = finish ? 3.53 : 4.36;
        const beam = finish ? .59 : .32;
        for (const side of [-1, 1]) {
            const x = side * 2.62;
            structure.box(ink, x, height / 2, z, .28, height, .27);
            structure.box(0xf2bc50, x, 2.72, z + .15, .29, .13, .025);
            structure.box(steel, x, .045, z, .60, .09, .56);
        }
        structure.box(ink, 0, height, z, 5.53, beam, .26);
        sign(boards, finish ? 1 : 0, 0, height, z + .141, 5.51, beam - .035);
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
        }
        for (let k = 0; k < 10; k++) {
            const z = k * 5;
            structure.box(cream, side * 1.88, .008, z, .40, .008, .05);
        }
    }
    const crowd = grandstands(scene, structure, (...args) => sign(boards, ...args));
    scene.add(track(), structure.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })), boards.mesh(signSheet()));
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

function laneDistance(dx, dz, sin, cos, clearance, viewWidth) {
    return dx * sin + dz * cos + (Math.abs(dx * cos - dz * sin) + clearance) / viewWidth;
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
        this.run = this.mixer.clipAction(movementClip(figure, THREE.AnimationClip.findByName(animations, 'Run'))).play();
        const leg = figure.getObjectByName('mixamorigLeftLeg').position.length();
        const shin = figure.getObjectByName('mixamorigLeftFoot').position.length();
        // The shared countdown idle was captured on the mayor's shorter legs.
        this.idleHeight = Math.max(0, leg + shin - .796);
        this.finish = new WinnerPose(figure);
        this.resetStride();
    }

    resetStride() {
        this.travel = this.stride = this.running = 0;
    }

    pose(distance, dt, waiting, clock, offset) {
        const advance = Math.max(0, distance - this.travel);
        this.travel = distance;
        this.stride += Math.min(2.25 * dt, advance / (2.40 * this.root.scale.x));
        this.running += ((waiting ? 0 : 1) - this.running) * (1 - Math.exp(-18 * dt));
        this.figure.position.y = this.idleHeight * (1 - this.running);
        this.stand.enabled = this.running < .999;
        this.run.enabled = this.running > .001;
        this.stand.setEffectiveWeight(1 - this.running);
        this.run.setEffectiveWeight(this.running);
        this.stand.time = clock % this.stand.getClip().duration;
        this.run.time = ((this.stride + offset) % 1) * this.run.getClip().duration;
        this.mixer.update(0);
    }
}

export class RaceStage {
    constructor(cast, player, renderer) {
        this.cast = cast;
        this.renderer = renderer;
        this.viewport = new THREE.Vector2();
        this.warmedTextures = new WeakSet();
        this.warmedMeshes = new WeakSet();
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
        this.crowd = venue(this.scene);
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
        this.ready = Promise.all([attach(this.back, 'race-waterfront'), this.crowd.ready]);
        const figure = cloneRig(player.rig.figure);
        // Preloading a race can clone the street runner halfway through his glance.
        player.stumble.restore(figure);
        this.player = new Athlete(figure, cast.mayor.animations, player.mesh.scale.x);
        const originals = [], copies = [];
        player.rig.figure.traverse(p => originals.push(p));
        figure.traverse(p => copies.push(p));
        this.wardrobe = originals.map((part, i) => [part, copies[i]]);
        this.scene.add(this.player.root);
        this.shadows = [groundShadow(this.scene, 1.1, 1.2), groundShadow(this.scene, 1.1, 1.2)];
    }

    addOutfit(pieces) {
        // A player can visit the fitting room after this independent race rig was created.
        const formal = this.player.figure.getObjectByName('Outfit_formal');
        for (const source of pieces) {
            const copy = source.clone(true);
            copy.traverse(part => {
                if (part.isSkinnedMesh) part.bind(formal.skeleton, formal.bindMatrix);
            });
            this.player.figure.add(copy);
            this.wardrobe.push([source, copy]);
        }
    }

    prepare(rival) {
        if (!this.pending.has(rival.id)) {
            const loading = Promise.all([this.loadAthlete(rival.id), this.ready]).then(async ([athlete]) => {
                if (this.renderer) await this.warm(athlete);
                this.cache.set(rival.id, athlete);
            });
            this.pending.set(rival.id, loading.catch(error => {
                this.pending.delete(rival.id);
                throw error;
            }));
        }
        return this.pending.get(rival.id);
    }

    async warm(athlete) {
        const renderer = this.renderer, scene = this.scene, camera = this.camera;
        await spareFrame();
        if (!this.active) for (const [original, copy] of this.wardrobe) copy.visible = original.visible;
        const previous = new Set(renderer.info.programs || []);
        await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(athlete.root, camera, scene)]);

        // Three normally looks up uniforms between first draws. On ANGLE each lookup can then
        // wait for the previous draw. Resolve the new programs before submitting any geometry.
        for (const program of renderer.info.programs || []) {
            if (previous.has(program) || !program.getUniforms) continue;
            await spareFrame();
            program.getUniforms();
        }
        const textures = new Set(), meshes = [];
        const collect = object => {
            if (!object.isMesh) return;
            // Link the cutout shadow first, before the driver queues any new vertex pipelines.
            if (object.castShadow && object.material.alphaTest > 0) meshes.unshift(object);
            else meshes.push(object);
            for (const value of Object.values(object.material)) {
                if (value?.isTexture && !this.warmedTextures.has(value)) textures.add(value);
            }
        };
        scene.traverseVisible(collect);
        athlete.root.traverseVisible(collect);
        for (const texture of textures) {
            await spareFrame();
            renderer.initTexture(texture);
            this.warmedTextures.add(texture);
        }

        // First draws build vertex pipelines even with an empty scissor. Submit a pair per frame
        // so the driver can process them between street renders without changing any screen pixels.
        const pending = meshes.filter(mesh => !this.warmedMeshes.has(mesh));
        const scissor = new THREE.Vector4();
        for (let i = 0; i < pending.length; i += 2) {
            await spareFrame();
            const pair = pending.slice(i, i + 2);
            const masks = meshes.map(mesh => mesh.layers.mask);
            const enabled = renderer.getScissorTest(), addRival = !athlete.root.parent;
            renderer.getScissor(scissor);
            if (addRival) scene.add(athlete.root);
            try {
                for (const mesh of meshes) if (!pair.includes(mesh)) mesh.layers.disableAll();
                renderer.setScissor(0, 0, 0, 0);
                renderer.setScissorTest(true);
                renderer.render(scene, camera);
                for (const mesh of pair) this.warmedMeshes.add(mesh);
            } finally {
                renderer.setScissor(scissor);
                renderer.setScissorTest(enabled);
                meshes.forEach((mesh, index) => { mesh.layers.mask = masks[index]; });
                if (addRival) scene.remove(athlete.root);
            }
        }
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
        this.player.resetStride();
        for (const [original, copy] of this.wardrobe) copy.visible = original.visible;
        this.rival = this.cache.get(rival.id);
        if (this.rival) {
            this.rival.resetStride();
            this.scene.add(this.rival.root);
        }
        else this.prepare(rival).then(() => {
            if (this.active === rival && !this.rival) {
                this.rival = this.cache.get(rival.id);
                this.rival.resetStride();
                this.scene.add(this.rival.root);
            }
        });
        this.idle = 0;
        this.finishTime = 0;
        this.crowd.clock.value = 0;
    }

    render(renderer, race, dt, reducedMotion) {
        if (!this.active) return;
        const { x: w, y: h } = renderer.getSize(this.viewport);
        const aspect = w / h, portrait = aspect < .82;
        const p = race.playerProgress, r = race.rivalProgress;
        const winnerLane = race.phase === 'won' ? 0 : race.phase === 'lost' ? 1 : -1;
        const done = winnerLane !== -1;
        if (done) this.finishTime += dt;
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
        const courseAngle = THREE.MathUtils.smoothstep(lead, .02, .16);
        const finishFrame = reducedMotion ? 1 : THREE.MathUtils.smoothstep(lead, .84, .99);
        const finishAngle = reducedMotion ? 0 : (portrait ? .24 : .36) * THREE.MathUtils.smoothstep(this.finishTime, 0, .4);
        const angle = Math.max((portrait ? .08 : .20) * courseAngle, finishAngle) * close;
        const sin = Math.sin(angle), cos = Math.cos(angle);
        const leaderX = reducedMotion ? 0 : .40 * THREE.MathUtils.clamp((r - p) * COURSE, -1, 1);
        const aimX = (portrait ? 0 : -.20 * courseAngle) + finishFrame * leaderX;
        const halfFov = Math.tan(THREE.MathUtils.degToRad(fov / 2));
        const viewWidth = halfFov * aspect * .88;
        const clearance = .48 + .57 * finishFrame;
        const shortPortrait = portrait ? THREE.MathUtils.clamp((780 - h) / 212, 0, 1) : 0;
        const base = portrait ? Math.max(6.45, 4.5 / aspect) + 3.3 * shortPortrait : (h < 500 ? 6.9 : 6.1);
        // Reserve the strip below the standings for the winner's hands and Donald's raised case.
        const dist = Math.max(base + (portrait ? 0 : 3.1) * finishFrame,
            laneDistance(-.86 - aimX, p * COURSE - focus, sin, cos, clearance, viewWidth),
            laneDistance(.86 - aimX, r * COURSE - focus, sin, cos, clearance, viewWidth));
        camera.position.set(aimX + dist * sin, portrait ? 1.70 : 1.53, focus + dist * cos);
        // Leave the countdown clear above the flags and a full stride below the athletes.
        const lift = reducedMotion ? (portrait ? .65 : .40) :
            ((portrait || h < 500 ? .65 : .27) + .46 * shortPortrait) * (1 - courseAngle) +
            (portrait ? .50 * shortPortrait : .18) * finishFrame;
        camera.lookAt(aimX, (h < 500 ? .98 : 1.02) + lift, focus);
        // The distant skyline tracks the broadcast camera; the near rail and spectators have true parallax.
        const far = 100, viewHeight = 2 * far * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const backH = Math.max(viewHeight * .75, viewHeight * aspect / 2.7);
        this.back.scale.set(backH * 3.0, backH, 1);
        this.back.position.set(-backH * .14, viewHeight * .21, -far);
        this.sun.position.set(-3.1, 6.5, focus + 3.6);
        this.sun.target.position.set(0, 0, focus);
        if (!done && dt > 0) this.idle += Math.min(.1, dt);
        this.crowd.clock.value = reducedMotion ? 0 : this.crowd.clock.value + Math.min(dt, .1);
        for (let i = 0; i < 2; i++) {
            const athlete = i ? this.rival : this.player;
            const lane = i ? .86 : -.86, progress = i ? r : p;
            if (!athlete) continue;
            const z = progress * COURSE;
            athlete.root.position.set(lane, 0, z);
            const waiting = intro || (!i && race.speed < .3);
            if (!athlete.finish.active) athlete.pose(z, dt, waiting, this.idle + .7 * i, i ? .36 : .09);
            if (i === winnerLane) athlete.finish.lift(this.finishTime, reducedMotion);
            this.shadows[i].position.set(lane - .035, .018, z - .04);
        }
        this.updateRibbon(lead, done, reducedMotion);
        renderer.render(this.scene, camera);
    }

    stop() {
        this.player.finish.reset();
        this.rival?.finish.reset();
        if (this.rival) this.rival.root.removeFromParent();
        this.rival = null;
        this.active = null;
    }
}
