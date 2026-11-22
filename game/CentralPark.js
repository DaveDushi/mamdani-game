import * as THREE from 'three';
import { ParkArt, parkBike } from './ParkArt.js';
import { bikeLaneX, parkRoute, parkStart, PARK_LENGTH, pathBend, pathWidth } from './ParkRoute.js';
import { movementClip } from './Locomotion.js';
import { APPROACH_SECONDS } from './RaceApproach.js';
import { RIVALS } from './FamilyRace.js';

export class CentralPark {
    constructor(run) {
        this.art = new ParkArt(run.scene, run.world.streetMaterials.road, run.obstacleManager.models.coin);
        this.bike = parkBike();
        run.player.mesh.add(this.bike);
        const rig = run.player.rig;
        this.pedals = new THREE.Group();
        this.pedals.position.set(0, .32, -.09);
        const crank = new THREE.Mesh(new THREE.BoxGeometry(.045, .32, .032), new THREE.MeshLambertMaterial({ color: 0x3b4846 }));
        this.pedals.add(crank);
        for (const s of [-1, 1]) {
            const pedal = new THREE.Mesh(new THREE.BoxGeometry(.19, .035, .087), crank.material);
            pedal.position.set(s * .12, s * .16, 0);
            this.pedals.add(pedal);
        }
        this.bike.add(this.pedals);
        this.cycle = rig.mixer.clipAction(movementClip(rig.figure, rig.run.getClip(), 'cycle'));
        this.reset();
    }
    reset() {
        this.cycle.stop();
        this.active = this.bike.visible = false;
        this.width = this.bend = this.heading = this.cameraOffset = 0;
        this.label = '';
        this.start = this.plan = null;
        this.lastAt = 0;
        this.art.ground.visible = this.art.route.visible = false;
        this.armed = this.offered = this.gateCleared = false;
    }
    laneX(lane) {
        return bikeLaneX(lane, this.width) + this.bend;
    }
    update(run) {
        const { world, player, raceSchedule: schedule } = run;
        const at = world.distance, speed = world.speed, start = parkStart(at);
        const from = this.lastAt;
        this.lastAt = at;
        const rival = schedule.rivals[run.familyWins];
        // Donald waits on the score, so his final only blocks a ride once the runner has qualified.
        const final = rival?.index === RIVALS.length - 1;
        const next = !rival || final && !schedule.qualified ? Infinity : final ? at : rival.at;
        this.label = '';
        this.art.update(at, start);
        if (start !== this.start) this.art.route.visible = false;
        if (start !== this.start && at >= start - Math.max(195, speed * 2.7) && at < start + PARK_LENGTH) {
            this.start = start;
            const rows = run.obstacleManager.peekRowsThrough(start + PARK_LENGTH + speed);
            this.plan = parkRoute(start, rows, world.courseMode, world.overtime, next);
            this.art.setRoute(this.plan, start);
            this.armed = this.offered = false;
        }
        const plan = this.plan;
        if (!plan || start !== this.start) return;
        const bus = run.busRide.active || player.fastFreeBusTimer > 0;
        if (!this.active && (bus || run.raceWarning || plan.exit + speed * APPROACH_SECONDS >= next)) {
            this.armed = false;
            this.art.route.visible = false;
            return;
        }
        this.art.route.visible = true;
        if (!this.active) {
            const ahead = plan.entry - at;
            if (from >= plan.entry || ahead > speed * 2.15) return;
            if (!this.offered) {
                run.notify('E-bikes · Left again from the left lane');
                this.offered = true;
            }
            if (player.currentLane !== 0 || run.input.pressed.has('right') || player.confusionTimer > 0 || player.iceTimer > 0) {
                this.armed = false;
            } else if (run.input.pressed.has('left')) this.armed = true;
            this.label = this.armed ? 'E-bike dock selected' : 'E-bikes · Left again from left lane';
            if (ahead > 0 || !this.armed || player.mesh.position.x > -2.6 || !player.isGrounded) return;
            this.active = this.bike.visible = true;
            this.art.parked.visible = false;
            this.nextGate = this.lastLane = 0;
            this.steered = false;
            this.cycle.reset().play();
            run.notify('Central Park · Ride the gaps');
        }
        const oldX = this.laneX(player.currentLane);
        this.width = pathWidth(plan, at);
        this.bend = pathBend(plan, at, this.width);
        const aheadWidth = pathWidth(plan, at + .25);
        const aheadX = bikeLaneX(player.currentLane, aheadWidth) + pathBend(plan, at + .25, aheadWidth);
        this.heading = -Math.atan2(aheadX - this.laneX(player.currentLane), .25);
        this.cameraOffset = -15 * this.width + this.bend;
        this.label = 'Central Park E-bike Loop';
        player.mesh.position.x += this.laneX(player.currentLane) - oldX;
        if (at < plan.exit) return;
        player.currentLane = 0;
        player.mesh.position.x = -3;
        this.active = this.bike.visible = false;
        this.cycle.stop();
        this.label = '';
        run.notify('Fifth Avenue');
    }
    pose(player, reduced) {
        const rig = player.rig;
        rig.balance.restore();
        rig.stand.enabled = rig.run.enabled = false;
        for (const clip of rig.leaps) clip.enabled = false;
        for (const clip of rig.slides) clip.enabled = false;
        const phase = player.phase * .74;
        this.cycle.time = (phase / (Math.PI * 2) % 1) * this.cycle.getClip().duration;
        rig.mixer.update(0);
        this.pedals.rotation.x = phase;
        this.bike.rotation.z = rig.figure.rotation.z = reduced ? 0 : .18 * player.bank;
        rig.figure.position.y = 0;
    }
    contact(run) {
        this.gateCleared = false;
        if (!this.active) return null;
        const { world, player } = run, gate = this.plan.gates[this.nextGate];
        if (!gate) return null;
        this.steered ||= player.currentLane !== this.lastLane;
        this.lastLane = player.currentLane;
        const group = this.art.gates[this.nextGate], x = player.mesh.position.x - group.position.x;
        if (player.covidMaskTimer > 0 && gate.at - world.distance < world.speed * 1.65) {
            group.children[0].visible = group.children[1].visible = false;
        }
        const z = world.distance - gate.at;
        // Cars never share the separated part of the loop. Check the entire
        // wheelbase on every fixed step, even if it crosses a row in one tick.
        if (z < -1.05) return null;
        for (let i = 0; i < 2; i++) {
            const barrier = group.children[i];
            if (barrier.visible && z < 1.05 && Math.abs(x - barrier.position.x) < 1.14 && player.mesh.position.y < 1.08) {
                barrier.visible = false;
                group.children[2].visible = false;
                return 'parkBarrier';
            }
        }
        if (z < 0) return null;
        const stamp = group.children[2];
        const collected = this.steered && stamp.visible && Math.abs(x - stamp.position.x) < .84 && player.mesh.position.y < 1.45;
        if (collected) stamp.visible = false;
        // Do not retire contact on the leading edge of the row.
        if (z >= 1.05) {
            this.gateCleared = group.children[0].visible && group.children[1].visible;
            this.nextGate++;
            this.steered = false;
        }
        return collected ? 'coin' : null;
    }
}
