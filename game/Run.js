import * as THREE from 'three';
import { artLoads, artTexture } from './Geometry.js';
import { Wardrobe } from './Wardrobe.js';
import { impact } from './Native.js';
import { World } from './World.js';
import { StreetLight } from './StreetLight.js';
import { Player } from './Player.js';
import { Trump } from './Trump.js';
import { Input } from './Input.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ObstacleManager } from './ObstacleManager.js';
import { PowerupManager } from './PowerupManager.js';
import { ScoreManager, stampReceipt } from './ScoreManager.js';
import { editionLines, raceDispatches, stuntLines } from './CityWire.js';
import { captions } from './Posters.js';
import { FamilyRace, RIVALS } from './FamilyRace.js';
import { RacePanel } from './RacePanel.js';
import { RaceStage } from './RaceStage.js';

const STEP = 1 / 60;
const pickups = {
    kafiyeh: { title: 'Allah Akbar', detail: 'Keffiyeh · Collision shield', short: 'Keffiyeh shield' },
    rainbow: { title: 'Full spectrum immunity', detail: 'Rainbow · Invincible + magnet', short: 'Invincible + magnet' },
    covidMask: { title: 'listen to Fauci', detail: 'COVID mask · Traffic cleared', short: 'Clear street' }
};
export class Run {
    constructor(canvas, sound, onEnd, cast) {
        this.sound = sound;
        this.cast = cast;
        this.preparedRivals = new Set();
        this.onEnd = onEnd;
        this.mode = 'menu';
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
        this.player = new Player(this.scene, cast.mayor);
        this.pickupRing = new THREE.Mesh(
            new THREE.RingGeometry(0.84, 1, 40),
            new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
        );
        this.pickupRing.rotation.x = -Math.PI / 2;
        this.pickupRing.position.y = 0.085;
        this.pickupRing.visible = false;
        this.player.mesh.add(this.pickupRing);
        this.trump = new Trump(this.scene, cast.chaser);
        this.wardrobe = new Wardrobe(this.renderer, this.player);
        this.powerupManager = new PowerupManager(this.scene, artTexture('pickup-markers'));
        this.obstacleManager = new ObstacleManager(this.scene, this.powerupManager, cast);
        this.scoreManager = new ScoreManager();
        this.particles = new ParticleSystem(this.scene);
        this.input = new Input(canvas, () => this.mode === 'playing' && !this.race);
        this.racePanel = new RacePanel(document.getElementById('hud'), () => {
            if (this.mode !== 'playing' || !this.race?.tap()) return;
            this.sound.play('stride');
        }, () => this.leaveRace());
        this.magnet = new THREE.Vector3();
        this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.hud = Object.fromEntries(
            [
                'score',
                'pace',
                'resume-count',
                'count-digit',
                'food-stamps',
                'district',
                'race-checkpoint',
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
                'pause-print',
                'chase-card',
                'chase-meter',
                'chase-seconds'
            ].map((id) => [id, document.getElementById(id)])
        );
        this.frame = this.frame.bind(this);
        this.countFrame = this.countFrame.bind(this);
        this.quality = 1;
        this.frameId = 0;
        this.ready = Promise.all(artLoads).then(() => this.prepareStreet());
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    async prepareStreet() {
        // Stage the first stamp burst, collision and pickup before the run clock starts.
        const encounters = new THREE.Group();
        encounters.add(...Object.values(this.obstacleManager.models), ...Object.values(this.powerupManager.models));
        await this.renderer.compileAsync(this.scene, this.camera);
        await this.renderer.compileAsync(encounters, this.camera, this.scene);
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
        this.renderer.setPixelRatio(
            Math.min(devicePixelRatio || 1, 1.4, Math.sqrt(1850000 / (w * h))) * this.quality
        );
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        if (this.mode === 'outfits') {
            this.wardrobe.resize();
            return;
        }
        this.baseFov = this.camera.aspect < 0.8 ? 59 : 53;
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
        if (this.mode === 'playing' || this.mode === 'paused' || this.mode === 'countdown') {
            this.renderCourse(this.race ? 0 : 1);
        }
    }

    start(mode = 'day', speedLevel = 0) {
        this.stop();
        this.runType = mode;
        this.speedLevel = speedLevel;
        this.familyWins = 0;
        this.preparingRival = null;
        this.raceRetryAt = 0;
        this.raceAnnounced = null;
        this.world.light.setShift(mode);
        this.world.reset(mode);
        this.player.reset();
        this.trump.reset();
        this.powerupManager.reset();
        this.obstacleManager.reset(mode);
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
        this.streak = 0;
        this.lastStuntAt = -10;
        this.pursuitFrame = 0;
        this.lastDistrict = this.world.district;
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
        this.pursuitFrame += ((this.trump.isChasing ? 1 : 0) - this.pursuitFrame) * (1 - Math.exp(-5 * dt));
        const z = Math.max(5.9, 3.46 / (this.camera.aspect * Math.tan(halfFov))) + this.pursuitFrame * 1.25;
        const targetX = this.reduce ? 0 : x * (portrait ? 0.43 : 0.23);
        this.camera.position.x += (targetX - this.camera.position.x) * (1 - Math.exp(-5 * dt));
        const impact = this.reduce ? 0 : Math.sin(this.shake * 95) * this.shake * 0.13;
        this.camera.position.set(
            this.camera.position.x,
            (portrait ? 5.65 : 4.55) +
                this.pursuitFrame * 0.33 +
                this.player.mesh.position.y * 0.115 +
                impact,
            z
        );
        this.camera.lookAt(this.camera.position.x * 0.52, portrait ? 1.65 : 1.05, -7.3);
    }

    showOutfit() {
        this.stop();
        this.mode = 'outfits';
        this.player.reset();
        this.wardrobe.open();
    }

    stop() {
        this.race = null;
        this.raceStage?.stop();
        this.racePanel.hide();
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
        this.sound.music(true);
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
        if (auditedGross > this.reportedAuditGross && !this.trump.isChasing && p.confusionTimer <= 0 && this.pulseTime <= 0) {
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
        const effect = secondary.join('\n');
        const next = RIVALS[this.familyWins];
        const checkpoint = next ? 'Next race · ' + next.name + ' · ' + next.at.toLocaleString() + ' m'
            : 'All six beaten · Overtime';
        this.hud['chase-card'].hidden = !this.trump.isChasing;
        if (this.trump.isChasing) {
            this.hud['chase-meter'].style.transform = 'scaleX(' + this.trump.chaseTimer / 5 + ')';
            this.hud['chase-seconds'].textContent = Math.ceil(this.trump.chaseTimer) + 's';
        }
        for (const [key, value] of [
            ['score', this.scoreManager.getDisplayScore()],
            ['pace', (this.world.speed / 17.5).toFixed(1) + '×'],
            ['food-stamps', this.scoreManager.foodStamps],
            ['district', this.world.crossings?.currentName || this.world.currentEventLabel || this.world.district],
            ['race-checkpoint', checkpoint],
            ['effect', effect]
        ]) {
            if (this.hud[key].textContent !== String(value)) this.hud[key].textContent = value;
        }
    }

    // Start in a clear stretch so the return countdown shows a route the player has time to read.
    canStartRace() {
        if (this.trump.isChasing || !this.player.isGrounded || this.player.slideTimer > 0) return false;
        const ahead = this.world.speed * 0.42;
        return !this.obstacleManager.obstacles.some(({ type, mesh }) =>
            type !== 'coin' && type !== 'cue' && mesh.position.z > -ahead && mesh.position.z < 2
        );
    }

    startRace() {
        this.input.reset();
        this.race = new FamilyRace(this.familyWins, this.speedLevel);
        this.raceStage.start(this.race.rival);
        this.racePanel.show(this.race.rival, this.speedLevel);
        this.racePanel.paint(this.race);
        this.sound.play('count');
        // Give the introductory artwork a full first frame on phones that compile a new shader here.
        this.acc = 0;
        this.last = performance.now();
    }

    prepareRace(rival) {
        if (this.preparingRival === rival.id || this.preparedRivals.has(rival.id) || this.elapsed < this.raceRetryAt) return;
        this.preparingRival = rival.id;
        this.raceStage ??= new RaceStage(this.cast, this.player, this.renderer);
        this.raceStage.prepare(rival).then(() => {
            this.preparedRivals.add(rival.id);
        }).catch(() => {
            if (this.preparingRival !== rival.id) return;
            this.preparingRival = null;
            this.raceRetryAt = this.elapsed + 5;
        });
    }

    raceStep(dt) {
        const race = this.race;
        const phase = race.phase;
        if (phase === 'won' || phase === 'lost') return;
        const count = race.countdown;
        this.elapsed += dt;
        race.update(dt);
        if (phase !== race.phase) {
            if (race.phase === 'won') {
                this.familyWins++;
                this.onRaceWin?.(this.familyWins);
                this.sound.play('victory');
                impact(true);
            } else if (race.phase === 'lost') {
                this.onRaceLoss?.(this.scoreManager.grossStamps, this.scoreManager.getDisplayScore());
                this.sound.play('end');
            } else {
                this.sound.play('go');
            }
        } else if (race.countdown !== count) this.sound.play('count');
    }

    leaveRace() {
        const race = this.race;
        if (this.mode !== 'playing' || !race || (race.phase !== 'won' && race.phase !== 'lost')) return;
        this.race = null;
        this.racePanel.hide();
        this.raceStage.stop();
        if (race.phase === 'lost') {
            this.endRun('race:' + race.rival.id);
            return;
        }
        this.world.overtime = this.familyWins === RIVALS.length;
        const message = this.world.overtime ? 'Donald beaten. Overtime runs 10% faster.' : race.rival.name + ' beaten. Back to the street.';
        this.bulletin(message, 'Race desk', true);
        this.updateHud();
        this.pause();
        this.renderCourse(1);
        this.resume();
    }

    endRun(cause) {
        this.mode = 'ended';
        this.sound.music(false, true);
        this.onEnd(this.scoreManager.getDisplayScore(), this.scoreManager.grossStamps, cause);
    }

    renderCourse(dt) {
        if (this.race) {
            this.raceStage.render(this.renderer, this.race, dt, this.reduce);
            this.racePanel.paint(this.race);
        } else {
            this.follow(dt);
            this.renderer.render(this.scene, this.camera);
        }
    }

    step(dt) {
        if (this.race) {
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
        const wasChasing = trump.isChasing;
        world.update(dt);
        player.update(dt, this.input, world.speed);
        traffic.update(dt, world.speed, world.distance);
        powers.update(dt, world.speed);
        trump.update(dt, player.mesh.position.x);
        if (wasChasing && !trump.isChasing) {
            this.notify('Audit evaded!');
            this.sound.play('escape');
            this.bulletin('Trump requests an extension on the chase.');
        }
        if (world.district !== this.lastDistrict) {
            this.lastDistrict = world.district;
            this.sound.play('edition');
            this.bulletin(editionLines[world.district]);
        }
        score.update(dt, world.speed);
        for (const e of player.events) {
            if (e === 'jump' || e === 'slide') this.sound.play(e);
            if (e === 'land' || e === 'slide')
                particles.spawnParticles(player.mesh.position, 5, 0xd5be93, 0.45);
        }
        player.events.length = 0;
        const power = powers.checkCollisions(player);
        if (power) {
            player.activatePowerup(power);
            this.pickupOrder = this.pickupOrder.filter(type => type !== power);
            this.pickupOrder.push(power);
            this.pickupDuration[power] = player[power + 'Timer'];
            this.updateHud();
            this.pickupRing.material.color.set({ kafiyeh: 0xffde86, covidMask: 0x87f2f5, rainbow: 0xffa2dc }[power]);
            this.pulseTime = 0.72;
            this.pickupRing.visible = true;
            if (!this.reduce) {
                this.hud['pickup-card'].animate(
                    [{ transform: 'translateY(-5px)', outline: '3px solid #fff3c8' }, { transform: 'none', outline: '0px solid transparent' }],
                    { duration: 520, easing: 'ease-out' }
                );
            }
            this.sound.play(power);
            impact();
            particles.spawnParticles(player.mesh.position, 14, 0xf0d997, 1.2);
        }
        if (player.covidMaskTimer > 0) {
            traffic.clear();
            powers.reset();
        }
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
        const hit = traffic.checkCollisions(player);
        if (hit === 'coin') this.collect();
        else if (hit === 'alcohol') {
            if (player.rainbowTimer <= 0) {
                player.activateConfusion();
                this.notify('Haram!', 'warning');
                this.bulletin('Both swipe axes reversed for five seconds.', 'City wire', true);
                this.sound.play('haram');
                particles.spawnParticles(player.mesh.position, 12, 0xa95fbc, 1.2);
            }
        } else if (hit && !player.invincible) {
            if (trump.isChasing) {
                this.sound.play('end');
                impact(true);
                this.endRun(hit);
                return;
            }
            trump.startChase(player.mesh.position.x);
            this.streak = 0;
            player.flashRed();
            this.shake = 0.38;
            this.notify('Stumble!', 'warning');
            this.bulletin('Trump would like a word about those receipts.', 'City wire', true);
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
        if (traffic.lastStunt) {
            this.cleanMoves++;
            this.streak = this.elapsed - this.lastStuntAt < 5 ? this.streak + 1 : 1;
            this.lastStuntAt = this.elapsed;
            const lines = stuntLines[traffic.lastStunt];
            const printed = this.bulletin(lines[(this.cleanMoves - 1) % lines.length]);
            if (!printed && this.noticeTime <= 0) {
                this.notify({ cab: 'Clean jump', jump: 'Clean jump', slide: 'Clean slide', sidestep: 'Clean dodge' }[traffic.lastStunt], 'clean');
            }
            this.sound.play('stunt');
            if (this.streak % 3 === 0) {
                score.addFoodStamps(1);
                this.notify('Clean streak +1 stamp');
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
        const next = RIVALS[this.familyWins];
        if (next && world.distance >= next.at - 550) {
            this.prepareRace(next);
            if (this.raceAnnounced !== next.id && world.distance >= next.at - world.speed * 4.5) {
                if (this.bulletin(raceDispatches[next.id], 'Race desk')) this.raceAnnounced = next.id;
            }
            if (world.distance >= next.at && this.preparedRivals.has(next.id) && this.canStartRace()) this.startRace();
        }
    }
    collect() {
        this.scoreManager.addFoodStamps(1);
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
