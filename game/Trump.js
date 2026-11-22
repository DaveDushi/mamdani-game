import { RunnerModel } from './RunnerModel.js';
import { groundShadow } from './Player.js';
import { Batch } from './Geometry.js';
import { VictoryDance } from './RaceFinish.js';
import { CATCH_GAP, Pursuit } from './Pursuit.js';

export const taunts = {
    closing: ['Trump is close enough to read the receipts.', 'Trump calls your pace very low energy.', 'Trump can hear the stamps jingle.'],
    lead: ['Trump says he is winning the chase.', 'Trump demands a recount of the street.', 'Trump blames the headwind.']
};

export class Trump {
    constructor(scene, asset) {
        this.rig = new RunnerModel(asset, true);
        this.pursuit = new Pursuit();
        this.mesh = this.rig.root;
        this.mesh.scale.setScalar(1.1);
        // A red document case gives the pursuer a different silhouette from the suited runner.
        const papers = new Batch();
        papers.box(0x8b302c, 0, -0.22, 0, 0.38, 0.28, 0.105);
        papers.box(0xe6c78c, 0, -0.086, 0, 0.35, 0.028, 0.077);
        papers.box(0xa43d32, 0, -0.165, 0.059, 0.38, 0.14, 0.015);
        for (const x of [-0.093, 0.093]) {
            papers.box(0xbf9d56, x, -0.061, 0, 0.018, 0.07, 0.024);
            papers.box(0xdbbd73, x, -0.197, 0.071, 0.033, 0.047, 0.014);
        }
        papers.box(0x72432d, 0, -0.024, 0, 0.2, 0.023, 0.028);
        this.briefcase = papers.mesh();
        this.briefcase.castShadow = true;
        this.rig.sockets.LeftHand.add(this.briefcase);
        scene.add(this.mesh);
        this.shadow = groundShadow(scene, 1.45, 2);
        this.reset();
    }

    reset() {
        this.dance?.reset();
        this.briefcase.visible = true;
        this.pursuit.reset();
        this.exitTime = 0;
        this.phase = 1;
        this.shoulder = 1;
        this.mesh.visible = this.shadow.visible = false;
        this.mesh.position.set(0, 0, 4);
    }

    get gap() {
        return this.pursuit.gap;
    }

    get isChasing() {
        return this.pursuit.isChasing;
    }

    get hot() {
        return this.pursuit.hot;
    }

    celebrate(seconds, reducedMotion) {
        if (!this.dance?.active) {
            this.mesh.rotation.y = Math.PI;
            this.briefcase.visible = false;
            this.rig.pose(0, 0, 0, 0, true);
            this.dance ??= new VictoryDance(this.rig.figure);
        }
        this.dance.play(seconds, reducedMotion);
    }

    hit(x, safe) {
        this.pursuit.hit(safe);
        this.startChase(x);
    }

    startChase(x, z = 3.5) {
        this.exitTime = 0;
        this.shoulder = x > 0 ? -1 : 1;
        this.mesh.position.set(x + this.shoulder * 0.95, 0, z);
        this.mesh.visible = this.shadow.visible = true;
        this.shadow.position.set(this.mesh.position.x, 0.019, this.mesh.position.z);
    }

    // The capture can land while he is still running in from off screen.
    arrive(x) {
        if (this.mesh.visible && Math.abs(this.mesh.position.x - x) < 1.6 && this.mesh.position.z < 4) return;
        this.startChase(x, 1.85);
    }

    // He drops toward the camera as the gap opens. `reach` is how far back he stays in frame on this screen.
    update(dt, x, glanceShoulder, frozen = false, sheltered = false, reach = 2.2, hidden = false) {
        const event = frozen ? this.pursuit.ride(dt) : this.pursuit.update(dt, sheltered);
        const near = !hidden && (this.isChasing || this.hot);
        if (!this.mesh.visible) {
            if (!near) return event;
            this.startChase(x, reach + 5);
        }
        // Track the inside shoulder so both silhouettes stay in frame in either outside lane.
        // Finish the over-the-shoulder exchange before crossing behind a lane-changing runner.
        if (near && !glanceShoulder && Math.abs(x) > 1.3) this.shoulder = x > 0 ? -1 : 1;
        const away = Math.min(1, this.gap / CATCH_GAP);
        const targetX = x + this.shoulder * (near ? 0.9 + 0.35 * away : 7);
        const targetZ = !near ? reach + 5.3 : glanceShoulder ? 1.85 : 1.45 + (reach - 1.45) * away;
        const dx = targetX - this.mesh.position.x;
        this.mesh.position.x += dx * (1 - Math.exp(-6.2 * dt));
        this.mesh.position.z += (targetZ - this.mesh.position.z) * (1 - Math.exp(-2.8 * dt));
        this.mesh.rotation.y = -Math.max(-0.28, Math.min(0.28, dx * 0.09));
        this.phase += dt * 12;
        this.rig.pose(this.phase, 0, 0, dx * 0.22);
        this.shadow.position.set(this.mesh.position.x - 0.1, 0.019, this.mesh.position.z + 0.16);
        this.exitTime = near ? 0 : this.exitTime + dt;
        if (this.exitTime >= 0.85) this.mesh.visible = this.shadow.visible = false;
        return event;
    }
}
