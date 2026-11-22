import * as THREE from 'three';
import { artLoads } from './Geometry.js';
import { Wardrobe, createRenderer, sizeRenderer } from './Wardrobe.js';
import { impact } from './Native.js';
import { World } from './World.js';
import { CentralPark } from './CentralPark.js';
import { streetClear } from './Crossings.js';
import { StreetLight } from './StreetLight.js';
import { Player } from './Player.js';
import { Trump, taunts } from './Trump.js';
import { CATCH_GAP, GAP_MAX } from './Pursuit.js';
import { Input } from './Input.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ObstacleManager } from './ObstacleManager.js';
import { PowerupManager } from './PowerupManager.js';
import { BusRide } from './BusRide.js';
import { powerupSeconds } from './Progression.js';
import { CLEAN_MOVE_POINTS, FAMILY_WIN_POINTS, FAMILY_WIN_STAMPS, STAMP_POINTS, ScoreManager, stampReceipt } from './ScoreManager.js';
import { Heatwave } from './Heatwave.js';
import { ICE_STEERING_SECONDS } from './RentIce.js';
import { editionLines, stuntLines } from './CityWire.js';
import { captions } from './Posters.js';
import { FamilyRace, RIVALS, takeoverPercent } from './FamilyRace.js';
import { RaceSchedule } from './RaceSchedule.js';
import { approachCopy, RaceApproach } from './RaceApproach.js';
import { RacePanel } from './RacePanel.js';
import { RaceStage } from './RaceStage.js';
import { CITY_REVEAL, DANCE_HOLD, FINISH_HOLD, RACE_RUNOUT, frameOpenBlock } from './RaceFinish.js';
import { courseSpeed } from './Course.js';
import { stretchLine } from './Stretches.js';

const STEP = 1 / 60;
const RACE_WARNING_SECONDS = 3;
const RACE_DELAY_METRES = 150;
const STREET_RECOVERY_SECONDS = 1;
const SLOW_FINISH = .35;
const RACE_TUTORIAL_KEY = 'mamdani_race_tutorial_seen';
const FIRST_RUN_KEY = 'mamdani_first_run_done';
// Anyone with one of these has finished a run on an earlier version.
const VETERAN_KEYS = [FIRST_RUN_KEY, 'mamdani_edition', 'mamdani_best_score'];
const FIRST_RUN_SAFE_SECONDS = 10;
const TAUNT_SECONDS = 22;
const PARK_STAMPS = 3;
const RUNNER_FEET = .51, CHASE_FEET = .36;
const pickups = {
    fastFreeBus: { title: 'Fast & Free', detail: 'Steer into barriers for up to 8 stamps', short: 'Bus ride' },
    kafiyeh: { title: 'Allah Akbar', detail: 'Keffiyeh · Collision shield', short: 'Keffiyeh shield' },
    rainbow: { title: 'Full spectrum immunity', detail: 'Rainbow · Invincible + magnet', short: 'Invincible + magnet' },
    covidMask: { title: 'listen to Fauci', detail: 'COVID mask · Traffic cleared', short: 'Clear street' }
};
const moveNames = { cab: 'Clean jump', jump: 'Clean jump', slide: 'Clean slide', sidestep: 'Clean dodge' };

export class Run {
    constructor(canvas, sound, onEnd, cast, fittingRoom) {
        this.sound = sound;
        this.cast = cast;
        this.preparedRivals = new Set();
        this.onEnd = onEnd;
        this.mode = 'menu';
        this.renderer = fittingRoom?.renderer ?? createRenderer(canvas);
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf4d9b1);
        this.scene.fog = new THREE.FogExp2(0xf2d4af, 0.011);
        this.camera = new THREE.PerspectiveCamera(53, 1, 0.12, 320);
        const skyLight = new THREE.HemisphereLight(0xfff0d5, 0xb5b8bd, 1.45);
        this.scene.add(skyLight);
        const sun = new THREE.DirectionalLight(0xffe1b2, 2.0);
        sun.position.set(-9, 13, -9);
        sun.castShadow = true;
        sun.target.position.set(0, 0, -2);
        Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 11, bottom: -10, near: 0.5, far: 40 });
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.normalBias = 0.016;
        sun.shadow.bias = -0.00025;
        this.scene.add(sun, sun.target);
        const fill = new THREE.DirectionalLight(0xd4e7ff, 0.74);
        fill.position.set(3, 5, 10);
        this.scene.add(fill);
        this.world = new World(this.scene, cast, new StreetLight(this.scene, skyLight, sun, fill));
        this.player = fittingRoom?.player ?? new Player(this.scene, cast.mayor);
        if (fittingRoom) this.scene.add(this.player.mesh, this.player.shadow);
        this.pickupRing = new THREE.Mesh(
            new THREE.RingGeometry(0.84, 1, 40),
            new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
        );
        this.pickupRing.rotation.x = -Math.PI / 2;
        this.pickupRing.position.y = 0.085;
        this.pickupRing.visible = false;
        this.player.mesh.add(this.pickupRing);
        this.trump = new Trump(this.scene, cast.chaser);
        this.wardrobe = fittingRoom ?? new Wardrobe(this.renderer, this.player);
        this.powerupManager = new PowerupManager(this.scene);
        this.busRide = new BusRide(this.scene, this.powerupManager.busModel);
        this.obstacleManager = new ObstacleManager(this.scene, this.powerupManager, cast);
        this.parkRide = new CentralPark(this);
        this.scoreManager = new ScoreManager();
        this.particles = new ParticleSystem(this.scene);
        this.input = new Input(canvas, () => this.mode === 'playing' && !this.race && !this.capture);
        this.captureBanner = document.getElementById('capture-banner');
        this.racePanel = new RacePanel(document.getElementById('hud'), side => this.tapRace(side),
            () => this.leaveRace(), () => this.readyForRace());
        try {
            this.raceTutorialSeen = localStorage.getItem(RACE_TUTORIAL_KEY) === '1';
        } catch {
            this.raceTutorialSeen = false;
        }
        try {
            this.veteran = VETERAN_KEYS.some(key => localStorage.getItem(key) !== null);
        } catch {
            this.veteran = false;
        }
        this.raceApproach = new RaceApproach(document.getElementById('race-checkpoint'), this.scene);
        this.magnet = new THREE.Vector3();
        this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.hud = Object.fromEntries(
            [
                'score',
                'metres',
                'multiplier',
                'multiplier-level',
                'multiplier-ring',
                'trump-gap',
                'gap-lead',
                'gap-metres',
                'danger',
                'resume-count',
                'count-digit',
                'food-stamps',
                'district',
                'effect',
                'notice',
                'pickup-card',
                'pickup-title',
                'pickup-detail',
                'pickup-seconds',
                'pickup-meter',
                'wire-flash',
                'wire-copy',
                'wire-source',
                'pause-print'
            ].map((id) => [id, document.getElementById(id)])
        );
        this.frame = this.frame.bind(this);
        this.countFrame = this.countFrame.bind(this);
        this.quality = 1;
        this.frameId = 0;
        this.ready = this.prepareStreet();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    async prepareStreet() {
        // Stage the first stamp burst, collision and pickup before the run clock starts.
        const encounters = new THREE.Group();
        encounters.add(...Object.values(this.obstacleManager.models), ...Object.values(this.powerupManager.models));
        await Promise.all([
            this.renderer.compileAsync(this.scene, this.camera),
            this.renderer.compileAsync(encounters, this.camera, this.scene),
            ...artLoads
        ]);
        // Query linked programs before their first draw can queue more GPU work.
        for (const program of this.renderer.info.programs || []) program.getUniforms?.();
        // iOS also uploads the skinned vertices and shadow variants on the first actual draw.
        this.scene.add(encounters);
        this.trump.startChase(0);
        this.player.rig.wear(true, true, true);
        this.camera.position.set(0, 2.7, 9);
        this.camera.lookAt(0, 1.6, 0);
        this.renderer.render(this.scene, this.camera);
        this.trump.reset();
        this.player.reset();
        this.scene.remove(encounters);
        encounters.clear();
    }

    resize() {
        const w = innerWidth,
            h = innerHeight;
        if (this.wardrobe.active) return;
        sizeRenderer(this.renderer, this.quality);
        this.camera.aspect = w / h;
        this.baseFov = this.camera.aspect < 0.8 ? 59 : 53;
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
        if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'countdown') {
            this.renderCourse(this.race || this.capture ? 0 : 1);
        }
    }

    start(mode = 'day', speedLevel = 0, recordProvider, powerLevels = {}) {
        this.stop();
        this.runType = mode;
        this.speedLevel = speedLevel;
        this.heatwave = new Heatwave();
        this.raceSchedule = new RaceSchedule(recordProvider);
        this.familyWins = 0;
        this.preparingRival = null;
        this.raceRetryAt = 0;
        this.world.light.setShift(mode);
        this.world.reset(mode);
        this.player.reset();
        this.player.powerLevels = powerLevels;
        this.trump.reset();
        this.powerupManager.reset();
        this.firstRun = !this.veteran;
        this.obstacleManager.reset(mode, Math.random, () => this.world.overtime, this.firstRun);
        this.particles.reset();
        this.scoreManager.reset();
        this.reportedAuditGross = 0;
        this.elapsed = 0;
        this.noticeTime = 0;
        this.pulseTime = 0;
        this.pickupRing.visible = false;
        this.pickupOrder = [];
        this.pickupDuration = {};
        this.hud['pickup-card'].hidden = true;
        this.hud['pickup-card'].removeAttribute('data-kind');
        this.cleanMoves = 0;
        this.nextTauntAt = 0;
        this.tauntCount = 0;
        this.tension = -1;
        this.hud.multiplier.dataset.level = '1';
        this.pursuitFrame = 0;
        this.lastDistrict = this.world.district;
        this.stretch = null;
        this.stretchReport = '';
        this.wireTime = 0;
        this.nextPrintAt = 0.8;
        this.lastPrint = '';
        this.hud['pause-print'].hidden = true;
        this.hud['wire-flash'].hidden = true;
        this.hud.notice.textContent = '';
        this.hud.notice.removeAttribute('data-tone');
        this.hudTimer = 0;
        this.shake = 0;
        this.slow = 0;
        this.fast = 0;
        this.mode = 'playing';
        this.streetCameraX = 0;
        this.camera.position.x = 0;
        this.resize();
        this.updateHud();
        this.beginMotion();
    }

    follow(dt) {
        const x = this.player.mesh.position.x;
        const portrait = this.camera.aspect < 0.8;
        const fov = this.baseFov + (this.reduce ? 0 : THREE.MathUtils.clamp((this.world.speed - 17.5) * 0.15, 0, 4.8));
        if (Math.abs(fov - this.camera.fov) > 0.22) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
        const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
        const halfWidth = this.camera.aspect * Math.tan(halfFov);
        this.pursuitFrame += ((this.trump.isChasing ? 1 : 0) - this.pursuitFrame) * (1 - Math.exp(-5 * dt));
        const base = Math.max(5.9, 3.46 / halfWidth);
        const z = base + this.pursuitFrame * 1.25;
        // Trump can trail this far back before the bottom of the frame cuts him off.
        this.chaseReach = portrait ? Math.max(2.2, base * .33) : 2.2;
        const stumble = this.player.stumble;
        this.busRide.cameraBlend += ((this.busRide.active ? 1 : 0) - this.busRide.cameraBlend) * (1 - Math.exp(-6*dt));
        const busFrame = this.busRide.cameraBlend;
        const frame = stumble.framing * (1-busFrame);
        const parkX = this.parkRide.cameraOffset;
        const targetX = this.reduce ? 0 : (x - parkX) * (portrait ? 0.43 : 0.23);
        this.streetCameraX += (targetX - this.streetCameraX) * (1 - Math.exp(-5 * dt));
        const impact = this.reduce ? 0 : Math.sin(this.shake * 95) * this.shake * 0.13;
        const height = (portrait ? Math.max(5.2, base * .5) : 4.55) + this.pursuitFrame * .33;
        const y = height + this.player.mesh.position.y * .115 + impact;
        let aim = 1.05;
        if (portrait) {
            // Stand the runner low in a tall frame to show more of the street. Lift him to make room for Trump.
            const feet = THREE.MathUtils.lerp(RUNNER_FEET, CHASE_FEET, this.pursuitFrame);
            aim = height - (z + 7.3) * Math.tan(Math.atan2(height, z) - Math.atan(feet * Math.tan(halfFov)));
        }
        // Leave room for the pursuer to catch up horizontally after a swipe.
        const gap = this.trump.mesh.position.x - x;
        const extra = Math.max(0, Math.abs(gap) - .95);
        const pairX = x + Math.sign(gap) * extra * .55;
        const closeZ = portrait ? 6.2 + extra / (2 * halfWidth) : 5.5;
        this.camera.position.set(
            THREE.MathUtils.lerp(parkX + this.streetCameraX + 1.45 * this.parkRide.width, pairX + stumble.shoulder * .25, frame),
            THREE.MathUtils.lerp(y, 2.85 + this.player.mesh.position.y * .20, frame) + .74*busFrame,
            THREE.MathUtils.lerp(z, closeZ, frame) + 2.4*busFrame
        );
        this.camera.lookAt(THREE.MathUtils.lerp(parkX + this.streetCameraX * .52, pairX, frame),
            THREE.MathUtils.lerp(aim, 1.05, frame), THREE.MathUtils.lerp(-7.3, -3, frame));
    }

    showOutfit() {
        this.stop();
        this.mode = 'outfits';
        this.player.reset();
        this.wardrobe.open();
    }

    stop() {
        if (this.capture) {
            this.trump.reset();
            this.player.mesh.visible = this.capture.playerVisible;
            this.player.shadow.visible = this.capture.shadowVisible;
            this.capture = null;
            this.captureBanner.hidden = true;
        }
        this.parkRide.reset();
        this.busRide.reset(this.player);
        this.race = null;
        this.upcomingRace = null;
        this.raceWarning = null;
        this.raceStage?.stop();
        this.racePanel.hide();
        this.raceApproach.hide();
        this.setTension(0);
        this.sound.music(false, true);
        this.wardrobe.close(this.scene);
        cancelAnimationFrame(this.frameId);
        this.frameId = 0;
        this.mode = 'menu';
        this.hud['resume-count'].hidden = true;
        this.input.reset();
        for (const o of this.obstacleManager.obstacles) o.mesh.visible = true;
    }
    pause() {
        if (this.mode === 'playing' || this.mode === 'countdown') {
            this.sound.music(false);
            this.mode = 'paused';
            if (this.race) this.racePanel.setPaused(true);
            cancelAnimationFrame(this.frameId);
            this.frameId = 0;
            this.hud['resume-count'].hidden = true;
            this.input.reset();
        }
    }
    resume() {
        if (this.mode !== 'paused') return;
        this.mode = 'countdown';
        this.input.reset();
        this.countValue = 0;
        this.countEnd = performance.now() + 3000;
        this.hud['resume-count'].hidden = false;
        this.countFrame(performance.now());
    }
    countFrame(now) {
        if (this.mode !== 'countdown') return;
        const value = Math.ceil((this.countEnd - now) / 1000);
        if (value <= 0) {
            this.hud['resume-count'].hidden = true;
            this.sound.play('go');
            this.beginMotion();
            return;
        }
        if (value !== this.countValue) {
            this.countValue = value;
            this.hud['count-digit'].textContent = value;
            this.sound.play('count');
        }
        this.frameId = requestAnimationFrame(this.countFrame);
    }
    beginMotion() {
        if (!this.capture) this.sound.music(true);
        this.mode = 'playing';
        if (this.race) this.racePanel.setPaused(false);
        this.input.reset();
        this.last = performance.now();
        this.acc = 0;
        this.frameId = requestAnimationFrame(this.frame);
    }
    notify(message, tone = 'gold') {
        this.hud.notice.dataset.tone = tone;
        this.hud.notice.textContent = message;
        this.noticeTime = 1.3;
    }
    bulletin(message, source = 'City wire', urgent = false) {
        if (!urgent && this.wireTime > 0) {
            if (this.wireUrgent) return false;
            if (source !== 'Stamp audit' && (this.hud['wire-source'].textContent !== 'City wire' || this.wireTime > 1.8)) return false;
        }
        this.hud['wire-source'].textContent = source;
        this.hud['wire-copy'].textContent = message;
        this.hud['wire-flash'].hidden = false;
        this.hud['wire-flash'].toggleAttribute('data-audit', source === 'Stamp audit');
        this.hud['wire-flash'].toggleAttribute('data-ambient', !urgent && source !== 'Stamp audit');
        this.wireUrgent = urgent;
        this.wireTime = source === 'City wire' ? 3.6 : 4.3;
        return true;
    }
    readStreet() {
        if (this.elapsed < this.nextPrintAt || this.wireTime > 0) return;
        let source = 'Placard';
        let message = '';
        let nearest = -Infinity;
        for (const object of this.obstacleManager.obstacles) {
            const z = object.mesh.position.z;
            if (object.type === 'protestor' && z > -45 && z < -3 && z > nearest) {
                nearest = z;
                message = object.mesh.userData.placard;
            }
        }
        if (!message || message === this.lastPrint) {
            source = 'Poster';
            message = captions[this.world.approachingPoster()];
        }
        if (!message || message === this.lastPrint) return;
        this.bulletin(message, source);
        this.lastPrint = message;
        this.nextPrintAt = this.elapsed + 7;
        this.hud['pause-print'].textContent = source + ' · ' + message;
        this.hud['pause-print'].hidden = false;
    }
    updateHud() {
        const p = this.player;
        const auditedGross = this.scoreManager.auditedGross;
        if (auditedGross > this.reportedAuditGross && !this.trump.hot && p.confusionTimer <= 0 && this.pulseTime <= 0) {
            const { gross, tax, keptTenths } = stampReceipt(auditedGross - this.reportedAuditGross);
            if (this.bulletin(gross + ' collected · ' + tax + ' tax · ' + keptTenths / 10 + ' kept', 'Stamp audit')) {
                this.reportedAuditGross = auditedGross;
            }
        }
        const card = this.hud['pickup-card'];
        const active = this.pickupOrder.filter(type => p[type + 'Timer'] > 0);
        const primary = active[active.length - 1];
        card.hidden = !primary;
        if (primary) {
            const remaining = p[primary + 'Timer'];
            if (card.dataset.kind !== primary) {
                card.dataset.kind = primary;
                this.hud['pickup-title'].textContent = pickups[primary].title;
                this.hud['pickup-detail'].textContent = pickups[primary].detail;
            }
            const seconds = Math.ceil(remaining) + 's';
            if (this.hud['pickup-seconds'].textContent !== seconds) this.hud['pickup-seconds'].textContent = seconds;
            this.hud['pickup-meter'].style.transform = 'scaleX(' + remaining / this.pickupDuration[primary] + ')';
        }
        const secondary = active.slice(0, -1).map(type => pickups[type].short + ' · ' + Math.ceil(p[type + 'Timer']) + 's');
        if (p.confusionTimer > 0) secondary.push('Haram! Reversed · ' + Math.ceil(p.confusionTimer) + 's');
        if (this.heatwave.active) {
            secondary.push('78° Heatwave · ' + Math.ceil(this.heatwave.remaining) + 's', '2× style · 5-stamp streaks');
        }
        const effect = secondary.join('\n');
        const schedule = this.raceSchedule;
        const next = schedule.rivals[this.familyWins];
        this.raceApproach.paint(approachCopy(
            schedule, next, this.scoreManager.metres, this.world.speed,
            this.trump.hot, this.preparedRivals.has(next?.id)
        ), this.trump.hot);
        this.paintChase();
        for (const [key, value] of [
            ['score', this.scoreManager.getDisplayScore()],
            ['metres', this.scoreManager.metres],
            ['food-stamps', this.scoreManager.foodStamps],
            ['district', this.parkRide.label || this.world.crossings?.currentName || this.stretch?.name || this.world.currentEventLabel || this.world.district],
            ['effect', effect]
        ]) {
            if (this.hud[key].textContent !== String(value)) this.hud[key].textContent = value;
        }
    }

    paintChase() {
        const { hud, trump, scoreManager: score } = this;
        const riding = this.busRide.active || this.parkRide.active;
        const metres = Math.floor(trump.gap) + ' m';
        if (hud['gap-metres'].textContent !== metres) hud['gap-metres'].textContent = metres;
        hud['gap-lead'].style.transform = 'scaleX(' + (trump.gap / GAP_MAX).toFixed(3) + ')';
        hud['trump-gap'].toggleAttribute('data-danger', trump.isChasing);
        hud['trump-gap'].toggleAttribute('data-frozen', riding);
        // The closer he is, the redder the edge of the frame.
        const danger = trump.isChasing && !this.player.invincible && !this.busRide.active ? 1 - .55 * trump.gap / CATCH_GAP : 0;
        hud.danger.style.opacity = danger.toFixed(2);
        const level = 'x' + score.multiplier;
        if (hud['multiplier-level'].textContent !== level) {
            hud['multiplier-level'].textContent = level;
            hud.multiplier.dataset.level = score.multiplier;
        }
        hud.multiplier.dataset.chain = score.chain;
        hud['multiplier-ring'].style.strokeDashoffset = (1.02 - 1.02 * score.chainTime).toFixed(3);
    }

    setTension(value) {
        if (Math.abs(value - this.tension) < .02 && (value || !this.tension)) return;
        this.tension = value;
        this.sound.setIntensity?.(value);
    }

    taunt(kind) {
        if (this.elapsed < this.nextTauntAt) return;
        const lines = taunts[kind];
        if (this.bulletin(lines[this.tauntCount % lines.length])) {
            this.tauntCount++;
            this.nextTauntAt = this.elapsed + TAUNT_SECONDS;
        }
    }

    popMultiplier() {
        this.sound.play('multiplier', this.scoreManager.multiplier);
        this.paintChase();
        if (!this.reduce) {
            this.hud.multiplier.animate(
                [{ transform: 'scale(1.7) rotate(-9deg)' }, { transform: 'scale(.92)', offset: .6 }, { transform: 'none' }],
                { duration: 420, easing: 'ease-out' }
            );
        }
    }

    // A family win pays once, in gross stamps and points. Returns what it paid for the race panel.
    awardRace(index) {
        const stamps = FAMILY_WIN_STAMPS[index] ?? 0;
        this.scoreManager.addFoodStamps(stamps);
        this.scoreManager.addBonus(FAMILY_WIN_POINTS);
        return { stamps, points: FAMILY_WIN_POINTS };
    }

    finishFirstRun() {
        if (this.veteran) return;
        this.veteran = true;
        try {
            localStorage.setItem(FIRST_RUN_KEY, '1');
        } catch {
            // Without storage the next visit is treated as a first run again.
        }
    }

    canStartRace(requireClearStreet = true) {
        const { player, world } = this;
        if (this.parkRide?.active) return false;
        const laneX = (player.currentLane - 1) * 3;
        if (this.trump.hot || !player.isGrounded || player.slideTimer > 0 ||
            player.confusionTimer > 0 || Math.abs(player.mesh.position.x - laneX) > .35) return false;
        if (!requireClearStreet || this.familyWins === RIVALS.length - 1) return true;
        const ahead = world.speed * .65;
        return !this.obstacleManager.obstacles.some(({ type, mesh }) =>
            type !== 'coin' && type !== 'cue' && mesh.position.z > -ahead && mesh.position.z < 2
        );
    }

    checkRaceEntry(rival, metres) {
        const eligible = rival && this.preparedRivals.has(rival.id) && this.raceSchedule.canEnter(rival, metres);
        if (this.raceWarning) {
            const interrupted = this.trump.hot || this.parkRide.active;
            if (eligible && this.raceWarning.rival === rival && !interrupted) {
                if (this.elapsed >= this.raceWarning.startAt && this.canStartRace(false)) this.startRace(rival);
                return;
            }
            this.raceWarning = null;
            this.raceApproach.warn(null);
        }
        // A busy street may hold a race back this far. The start clears its own chute.
        if (!eligible || !this.canStartRace(metres < rival.at + RACE_DELAY_METRES)) return;
        this.raceWarning = { rival, startAt: this.elapsed + RACE_WARNING_SECONDS };
        this.raceApproach.warn(rival);
    }

    clearRaceChute() {
        const { distance, speed, overtime } = this.world;
        const recoverySpeed = courseSpeed(distance + speed * STREET_RECOVERY_SECONDS, this.runType) * (overtime ? 1.1 : 1);
        this.obstacleManager.clearFinishChute(Math.max(speed, recoverySpeed) * STREET_RECOVERY_SECONDS + 6);
    }

    drawRace(rival) {
        return new FamilyRace(rival, this.speedLevel, true, { seed: 1 + Math.floor(Math.random() * 1e6) });
    }

    startRace(rival) {
        this.updateHeatwave(0, false);
        this.player.stumble.reset();
        this.player.iceTimer = 0;
        this.input.reset();
        // Race check-in is the last stop.
        if (this.busRide.active) this.busRide.leave(this.obstacleManager, this.player, this.world.speed);
        this.clearRaceChute();
        this.raceWarning = null;
        this.raceApproach.hide();
        this.race = this.upcomingRace?.rival === rival
            ? this.upcomingRace : this.drawRace(rival);
        this.racePlayerLed = false;
        this.sound.setMood('race');
        this.raceStage.start(this.race.rival);
        this.racePanel.show(this.race, !this.raceTutorialSeen);
        // Give the introductory artwork a full first frame on phones that compile a new shader here.
        this.acc = 0;
        this.last = performance.now();
    }

    readyForRace() {
        if (this.mode !== 'playing' || !this.race?.ready()) return;
        if (!this.raceTutorialSeen) {
            this.raceTutorialSeen = true;
            try {
                localStorage.setItem(RACE_TUTORIAL_KEY, '1');
            } catch {
                // Keep the tutorial dismissed for this session when storage is unavailable.
            }
        }
        this.racePanel.paint(this.race);
        this.racePanel.focusControl();
        this.sound.play('count');
    }

    prepareRace(rival) {
        if (this.preparingRival === rival.id || this.preparedRivals.has(rival.id) || this.elapsed < this.raceRetryAt) return;
        this.preparingRival = rival.id;
        const schedule = this.raceSchedule;
        this.raceStage ??= new RaceStage(this.cast, this.player, this.renderer);
        this.raceStage.prepare(rival).then(() => {
            this.preparedRivals.add(rival.id);
        }).catch(() => {
            if (this.raceSchedule !== schedule || this.preparingRival !== rival.id) return;
            this.preparingRival = null;
            this.raceRetryAt = this.elapsed + 5;
        });
    }

    tapRace(side) {
        const race = this.race;
        if (this.mode !== 'playing' || !race) return;
        const result = race.tap(side);
        if (result === 'step') {
            this.sound.play('stride');
            if (race.taps % 16 === 0) this.sound.play('crowd');
        } else if (result) {
            this.sound.play('rhythmMiss');
            impact();
        }
    }

    raceStep(dt) {
        const race = this.race;
        const phase = race.phase;
        if (phase === 'ready' || phase === 'won' || phase === 'lost') return;
        const count = race.countdown;
        if (race.closeFinish && !this.reduce) dt *= SLOW_FINISH;
        this.elapsed += dt;
        const { mode, pad } = race;
        race.update(dt);
        if (race.mode !== mode) {
            const cue = { warn: 'count', stop: 'haram', gold: 'multiplier', feet: 'count' }[race.mode];
            if (cue) this.sound.play(cue);
        } else if (mode === 'side' && race.pad !== pad) this.sound.play('rhythmGood');
        if (race.phase === 'racing' && this.racePlayerLed !== race.gap > (this.racePlayerLed ? -.4 : .4)) {
            this.racePlayerLed = !this.racePlayerLed;
            if (race.elapsed > 2) this.sound.play('crowd');
        }
        if (phase !== race.phase) {
            if (race.phase === 'won') {
                this.sound.play('crowd');
                this.familyWins++;
                this.awardRace?.(race.rival.index);
                this.world.setTakeover(this.familyWins);
                this.world.overtime = this.familyWins === RIVALS.length;
                this.onRaceWin?.(this.familyWins);
                this.sound.play('victory');
                impact(true);
            } else if (race.phase === 'lost') {
                this.onDefeat?.(this.scoreManager.grossStamps, this.scoreManager.getDisplayScore());
                this.sound.play('end');
            } else {
                this.sound.play('starterPistol');
            }
        } else if (race.countdown !== count) this.sound.play('count');
    }

    leaveRace() {
        const race = this.race;
        if (this.mode !== 'playing' || !race || (race.phase !== 'won' && race.phase !== 'lost')) return;
        this.race = null;
        this.racePanel.hide();
        this.raceStage.stop();
        this.sound.setMood('street');
        if (race.phase === 'lost') {
            this.endRun('race:' + race.rival.id);
            return;
        }
        const message = this.world.overtime ? 'Takeover complete. Overtime is 10% faster.' : race.rival.name + ' beaten · ' + takeoverPercent(this.familyWins) + '% takeover.';
        if (!this.world.overtime) {
            this.raceSchedule.returnedToStreet(this.elapsed);
            if (this.familyWins === RIVALS.length - 1) this.prepareRace(this.raceSchedule.rivals[this.familyWins]);
        }
        this.bulletin(message, 'Race desk', true);
        this.clearRaceChute();
        this.updateHud();
        this.pause();
        this.renderCourse(1);
        this.resume();
    }

    endRun(cause) {
        this.mode = 'ended';
        this.finishFirstRun();
        this.raceApproach.warn(null);
        this.setTension(0);
        this.hud.danger.style.opacity = 0;
        this.sound.music(false, true);
        const { metres, stylePoints, bestMultiplier, grossStamps } = this.scoreManager;
        this.onEnd(this.scoreManager.getDisplayScore(), grossStamps, cause, { metres, stylePoints, bestMultiplier });
    }

    startCapture(cause) {
        this.capture = {
            cause,
            elapsed: 0,
            playerVisible: this.player.mesh.visible,
            shadowVisible: this.player.shadow.visible
        };
        this.player.mesh.visible = this.player.shadow.visible = false;
        this.captureBanner.hidden = false;
        this.setTension(0);
        this.hud.danger.style.opacity = 0;
        this.trump.arrive(this.player.mesh.position.x);
        this.input.reset();
        this.sound.music(false, true);
        this.onDefeat?.(this.scoreManager.grossStamps, this.scoreManager.getDisplayScore());
    }

    renderCourse(dt) {
        if (this.capture) {
            const capture = this.capture;
            const { x, z } = this.trump.mesh.position;
            const halfWidth = this.camera.aspect * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
            this.camera.position.set(x, 1.5, z + Math.max(3.35, 1.05 / halfWidth));
            this.camera.lookAt(x, 1.16, z);
            this.trump.celebrate(capture.elapsed, this.reduce);
            this.renderer.render(this.scene, this.camera);
            capture.elapsed += dt;
            if (capture.elapsed >= (this.reduce ? FINISH_HOLD : DANCE_HOLD)) this.endRun(capture.cause);
        } else if (this.race) {
            this.race.lead = this.acc;
            const finale = this.world.overtime && this.race.phase === 'won';
            const hold = finale ? CITY_REVEAL : this.race.phase === 'lost' && !this.reduce
                ? RACE_RUNOUT + DANCE_HOLD : FINISH_HOLD;
            const ready = this.raceStage.finishTime >= hold;
            if (this.race.phase === 'lost' && ready && this.mode === 'playing') {
                this.raceStage.render(this.renderer, this.race, 0, this.reduce);
                this.onFinishPhoto?.(this.renderer.domElement, this.raceStage);
                this.leaveRace();
                return;
            }
            if (finale && ready) {
                this.follow(dt);
                if (!streetClear(this.world.distance - 25, this.world.distance + 80)) {
                    frameOpenBlock(this.camera, this.world.blocks);
                }
                this.renderer.render(this.scene, this.camera);
            } else {
                this.raceStage.render(this.renderer, this.race, dt, this.reduce);
            }
            this.racePanel.paint(this.race, ready);
        } else {
            this.follow(dt);
            const schedule = this.raceSchedule;
            this.raceApproach.place(schedule.rivals[this.familyWins], this.world.distance, schedule.initialRecordPending, schedule.qualified);
            this.renderer.render(this.scene, this.camera);
        }
    }

    step(dt) {
        if (this.capture) return;
        if (this.race) {
            this.setTension(0);
            this.raceStep(dt);
            return;
        }
        const {
            world,
            player,
            obstacleManager: traffic,
            scoreManager: score,
            powerupManager: powers,
            trump,
            particles
        } = this;
        this.elapsed += dt;
        const wasCycling = this.parkRide.active;
        world.update(dt);
        this.parkRide.update(this);
        if (this.busRide.active) {
            this.input.isJustPressed('up');
            this.input.isJustPressed('down');
        }
        player.update(dt, this.input, world.speed, this.parkRide, this.reduce);
        traffic.update(dt, world.speed, world.distance);
        if (traffic.carriageBell) this.sound.play('carriageBell');
        powers.update(dt, world.speed);
        const riding = this.busRide.active || this.parkRide.active;
        const sheltered = player.invincible || player.covidMaskTimer > 0;
        const chase = trump.update(dt, player.mesh.position.x, player.stumble.shoulder,
            riding, sheltered, this.chaseReach, this.busRide.active);
        this.setTension(riding ? 0 : trump.pursuit.intensity);
        if (chase === 'escaped') {
            this.notify('Audit evaded!');
            this.sound.play('escape');
            this.bulletin('Trump requests an extension on the chase.');
        } else if (chase) this.taunt(chase);
        if (this.elapsed >= FIRST_RUN_SAFE_SECONDS) this.finishFirstRun();
        if (world.district !== this.lastDistrict) {
            this.lastDistrict = world.district;
            this.sound.play('edition');
            this.bulletin(editionLines[world.district]);
        }
        const stretch = traffic.stretchAt(world.distance);
        if (stretch !== this.stretch) {
            this.stretch = stretch;
            this.stretchReport = stretch ? stretchLine(stretch) : '';
            if (stretch) this.sound.play('stretch');
        }
        if (this.stretchReport && this.bulletin(this.stretchReport, 'Street report')) this.stretchReport = '';
        score.styleBoost = this.heatwave.styleBoost;
        if (score.update(dt, world.speed, !riding && !sheltered)) this.sound.play('multiplierLost');
        for (const e of player.events) {
            if (e !== 'confusion' && (!this.busRide.active || e === 'whoosh')) this.sound.play(e);
            if (e === 'land' || e === 'slide')
                particles.spawnParticles(player.mesh.position, 5, 0xd5be93, 0.45);
        }
        player.events.length = 0;
        const power = powers.checkCollisions(player);
        if (power && (power !== 'fastFreeBus' || (!this.busRide.active && !this.parkRide?.active))) {
            if (power === 'fastFreeBus') this.busRide.board(player, powerupSeconds(power, player.powerLevels[power]));
            else player.activatePowerup(power);
            this.pickupOrder = this.pickupOrder.filter(type => type !== power);
            this.pickupOrder.push(power);
            this.pickupDuration[power] = player[power + 'Timer'];
            this.updateHud();
            this.pickupRing.material.color.set({ kafiyeh: 0xffde86, covidMask: 0x87f2f5, rainbow: 0xffa2dc, fastFreeBus: 0x86d6ff }[power]);
            this.pulseTime = 0.72;
            this.pickupRing.visible = true;
            if (!this.reduce) {
                this.hud['pickup-card'].animate(
                    [{ transform: 'translateY(-5px)', outline: '3px solid #fff3c8' }, { transform: 'none', outline: '0px solid transparent' }],
                    { duration: 520, easing: 'ease-out' }
                );
            }
            this.sound.play('power');
            this.sound.play(power);
            impact();
            particles.spawnParticles(player.mesh.position, 14, 0xf0d997, 1.2);
        }
        if (player.covidMaskTimer > 0) traffic.clear();
        if (player.hasRainbow) {
            for (let i = traffic.obstacles.length - 1; i >= 0; i--) {
                const o = traffic.obstacles[i];
                if (o.type !== 'coin') continue;
                this.magnet.copy(player.mesh.position);
                this.magnet.y += 0.9;
                this.magnet.sub(o.mesh.position);
                const distance = this.magnet.length();
                if (distance < 13)
                    o.mesh.position.addScaledVector(
                        this.magnet,
                        Math.min(1, (28 * dt) / Math.max(0.01, distance))
                    );
                if (distance < 0.77) {
                    traffic.remove(i);
                    this.collect();
                }
            }
        }
        const ridingBus = this.busRide.active;
        if (ridingBus) {
            const fare = this.busRide.drive(dt, traffic, player, world.speed, this.reduce);
            const smashed = this.busRide.smashed;
            if (smashed) {
                score.addFoodStamps(fare);
                const points = score.addStyle(CLEAN_MOVE_POINTS * smashed);
                this.sound.play('smash');
                this.notify('Smash +' + points + (fare ? ' · ' + fare + (fare === 1 ? ' stamp' : ' stamps') : ''), 'clean');
            }
            player.fastFreeBusTimer = Math.max(0,player.fastFreeBusTimer-dt);
            if (player.fastFreeBusTimer < 1e-7) this.busRide.leave(traffic,player,world.speed);
        }
        const streetHit = traffic.checkCollisions(player,ridingBus);
        const parkHit = this.parkRide.contact(this);
        const hit = parkHit ?? streetHit;
        if (this.parkRide.gateCleared) {
            trump.pursuit.cleanMove();
            if (parkHit !== 'coin') this.notify('Clean gate +' + score.addStyle(CLEAN_MOVE_POINTS), 'clean');
            else score.addStyle(CLEAN_MOVE_POINTS);
        }
        if (traffic.slippedOnIce && !player.invincible && !player.covidMaskTimer &&
            !ridingBus && !wasCycling && !this.parkRide.active) {
            player.iceTimer = ICE_STEERING_SECONDS;
            if (!trump.hot) this.notify('Ice skid!', 'warning');
            if (!this.reduce) particles.spawnParticles(player.mesh.position, 7, 0xd8ecf2, .62);
        }
        if (hit === 'coin') this.collect(parkHit === 'coin' ? PARK_STAMPS : 1);
        else if (hit === 'alcohol') {
            if (player.rainbowTimer <= 0) {
                player.activateConfusion();
                this.notify('Haram!', 'warning');
                this.bulletin('Controls reversed · 5s', 'City wire', true);
                this.sound.play('haram');
                particles.spawnParticles(player.mesh.position, 12, 0xa95fbc, 1.2);
            }
        } else if (hit && !player.invincible) {
            const safe = this.firstRun && this.elapsed < FIRST_RUN_SAFE_SECONDS;
            if (!safe && (hit === 'wall' || trump.isChasing)) {
                this.sound.play('end');
                impact(true);
                if (trump.isChasing) this.startCapture(hit);
                else this.endRun(hit);
                return;
            }
            trump.hit(player.mesh.position.x, safe);
            player.stumble.start(trump.shoulder, this.reduce);
            if (score.hit()) this.sound.play('multiplierLost');
            player.flashRed();
            this.shake = 0.38;
            this.notify('Stumble!', 'stumble');
            this.bulletin('Trump wants the receipts.', 'City wire', true);
            this.sound.play('crash');
            this.sound.play('chase');
            impact(true);
            particles.spawnParticles(player.mesh.position, 16, 0xe5ad69, 1.45);
        } else if (hit && player.invincible) {
            particles.spawnParticles(
                player.mesh.position,
                10,
                player.rainbowTimer > 0 ? 0xe8bce5 : 0xf1e6bb,
                1.4
            );
        }
        const onFoot = !this.parkRide?.active && !ridingBus;
        this.updateHeatwave(dt, onFoot);
        if (onFoot && traffic.lastStunt) {
            this.cleanMoves++;
            trump.pursuit.cleanMove();
            const level = score.multiplier, style = score.stylePoints;
            const streak = score.cleanMove();
            const lines = stuntLines[traffic.lastStunt];
            const printed = this.bulletin(lines[(this.cleanMoves - 1) % lines.length]);
            if (!printed && this.noticeTime <= 0) {
                this.notify(moveNames[traffic.lastStunt] + ' +' + (score.stylePoints - style), 'clean');
            }
            this.sound.play('stunt', score.multiplier);
            if (score.multiplier > level) this.popMultiplier();
            if (streak) {
                const reward = this.heatwave.streakReward;
                score.addFoodStamps(reward);
                this.notify(this.heatwave.active ? 'Heatwave streak +' + reward + ' stamps' : 'Clean streak +1 stamp');
            }
        }
        particles.update(dt);
        if (this.pulseTime > 0) {
            this.pulseTime = Math.max(0, this.pulseTime - dt);
            const progress = 1 - this.pulseTime / 0.72;
            this.pickupRing.scale.setScalar(this.reduce ? 1.13 : 0.62 + progress * 1.65);
            this.pickupRing.material.opacity = (1 - progress) * 0.85;
            this.pickupRing.visible = this.pulseTime > 0;
        }
        if (this.wireTime > 0) {
            this.wireTime -= dt;
            if (this.wireTime <= 0) this.hud['wire-flash'].hidden = true;
        }
        this.shake = Math.max(0, this.shake - dt);
        if (this.noticeTime > 0) {
            this.noticeTime -= dt;
            if (this.noticeTime <= 0) this.hud.notice.textContent = '';
        }
        this.hudTimer -= dt;
        if (this.hudTimer <= 0) {
            this.readStreet();
            this.updateHud();
            this.hudTimer = 0.08;
        }
        const { metres } = score;
        const schedule = this.raceSchedule;
        schedule.update(score.getDisplayScore(), this.familyWins, this.elapsed, metres);
        const next = schedule.rivals[this.familyWins];
        if (next && world.distance >= next.at - 550) {
            this.prepareRace(next);
            if (!(next.record && schedule.initialRecordPending) && world.distance >= next.at - world.speed * 4.5) {
                if (this.upcomingRace?.rival !== next) {
                    this.upcomingRace = this.drawRace(next);
                    this.racePanel.prepare(this.upcomingRace, !this.raceTutorialSeen);
                }
            }
        }
        this.checkRaceEntry(next, metres);
    }
    updateHeatwave(dt, onFoot) {
        const wasActive = this.heatwave.active;
        const event = this.heatwave.update(dt, this.world.distance, onFoot);
        this.world.light.setHeatwave(this.heatwave.active, this.world.distance);
        if (this.heatwave.active !== wasActive) this.hudTimer = 0;
        if (!onFoot && this.hud.notice.dataset.tone === 'weather' && this.noticeTime > 0) {
            this.hud.notice.textContent = '';
            this.noticeTime = 0;
        }
        if (event && this.noticeTime <= 0) this.notify(event === 'start' ? '78° Heatwave' : 'Heatwave over', 'weather');
    }

    collect(count = 1) {
        this.scoreManager.addFoodStamps(count);
        this.scoreManager.addStyle(STAMP_POINTS * count);
        this.trump.pursuit.stamp();
        this.sound.play('stamp');
        this.magnet.copy(this.player.mesh.position);
        this.magnet.y += 0.9;
        this.particles.spawnParticles(this.magnet, 8, 0xffd477, 1.1);
    }

    frame(time) {
        if (this.mode !== 'playing') return;
        const elapsed = Math.max(0, (time - this.last) / 1000);
        this.last = time;
        this.acc += Math.min(elapsed, 0.1);
        while (this.acc >= STEP && this.mode === 'playing') {
            this.acc -= STEP;
            this.step(STEP);
        }
        this.renderCourse(Math.min(elapsed, 0.1));
        this.slow = elapsed > 0.024 ? this.slow + 1 : Math.max(0, this.slow - 1);
        this.fast = elapsed < 0.018 ? this.fast + 1 : 0;
        if (this.slow > 45 && this.quality > 0.76) {
            this.quality = Math.max(0.75, this.quality - 0.125);
            this.slow = 0;
            this.resize();
        } else if (this.fast > 360 && this.quality < 1) {
            this.quality = Math.min(1, this.quality + 0.125);
            this.fast = 0;
            this.resize();
        }
        if (this.mode === 'playing') this.frameId = requestAnimationFrame(this.frame);
    }
}
