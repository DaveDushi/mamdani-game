import { RunnerModel } from './RunnerModel.js';
import { groundShadow } from './Player.js';
import { Batch } from './Geometry.js';

const PURSUIT_SECONDS = 5;

export class Trump {
    constructor(scene, asset) {
        this.rig = new RunnerModel(asset, true);
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
        const briefcase = papers.mesh();
        briefcase.castShadow = true;
        this.rig.sockets.LeftHand.add(briefcase);
        scene.add(this.mesh);
        this.shadow = groundShadow(scene, 1.45, 2);
        this.reset();
    }

    reset() {
        this.isChasing = false;
        this.chaseTimer = 0;
        this.exitTime = 0;
        this.phase = 1;
        this.shoulder = 1;
        this.mesh.visible = this.shadow.visible = false;
        this.mesh.position.set(0, 0, 4);
    }

    startChase(x) {
        this.isChasing = true;
        this.chaseTimer = PURSUIT_SECONDS;
        this.exitTime = 0;
        this.shoulder = x > 0 ? -1 : 1;
        this.mesh.position.set(x + this.shoulder * 0.95, 0, 3.5);
        this.mesh.visible = this.shadow.visible = true;
        this.shadow.position.set(this.mesh.position.x, 0.019, this.mesh.position.z);
    }

    update(dt, x, glanceShoulder) {
        if (!this.mesh.visible) return;
        this.chaseTimer = Math.max(0, this.chaseTimer - dt);
        this.isChasing = this.chaseTimer > 0;
        // Track the inside shoulder so both silhouettes stay in frame in either outside lane.
        // Finish the over-the-shoulder exchange before crossing behind a lane-changing runner.
        if (this.isChasing && !glanceShoulder && Math.abs(x) > 1.3) this.shoulder = x > 0 ? -1 : 1;
        const targetX = this.isChasing ? x + this.shoulder * 0.9 : this.shoulder * 7;
        const targetZ = this.isChasing ? 1.85 : 7.5;
        const dx = targetX - this.mesh.position.x;
        this.mesh.position.x += dx * (1 - Math.exp(-6.2 * dt));
        this.mesh.position.z += (targetZ - this.mesh.position.z) * (1 - Math.exp(-2.8 * dt));
        this.mesh.rotation.y = -Math.max(-0.28, Math.min(0.28, dx * 0.09));
        this.phase += dt * 12;
        this.rig.pose(this.phase, 0, 0, dx * 0.22);
        this.shadow.position.set(this.mesh.position.x - 0.1, 0.019, this.mesh.position.z + 0.16);
        if (!this.isChasing) {
            this.exitTime += dt;
            if (this.exitTime >= 0.85) this.mesh.visible = this.shadow.visible = false;
        }
    }
}
