import * as BABYLON from '@babylonjs/core';
import { TextureGenerator } from './TextureGenerator.js';

export class Trump {
    constructor(scene, shadowGenerator) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.texGen = new TextureGenerator();

        // Mesh Group
        this.mesh = new BABYLON.TransformNode("trumpNode", scene);
        this.mesh.position.set(0, 0, 15);

        // Materials
        const skinMat = new BABYLON.StandardMaterial("trumpSkin", scene);
        skinMat.diffuseColor = new BABYLON.Color3(1, 0.8, 0.6); // Orange-ish Skin

        const suitMat = new BABYLON.StandardMaterial("trumpSuit", scene);
        suitMat.diffuseColor = new BABYLON.Color3(0, 0, 0.5); // Navy Suit

        const hairMat = new BABYLON.StandardMaterial("trumpHair", scene);
        hairMat.diffuseColor = new BABYLON.Color3(1, 1, 0); // Yellow Hair

        const tieMat = new BABYLON.StandardMaterial("trumpTie", scene);
        tieMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Red Tie

        // Head
        this.head = BABYLON.MeshBuilder.CreateBox("trumpHead", { width: 0.6, height: 0.6, depth: 0.6 }, scene);
        this.head.material = skinMat;
        this.head.position.y = 1.8;
        this.head.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.head);

        // Hair
        this.hair = BABYLON.MeshBuilder.CreateBox("trumpHair", { width: 0.65, height: 0.2, depth: 0.65 }, scene);
        this.hair.material = hairMat;
        this.hair.position.y = 2.15;
        this.hair.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.hair);

        // Body
        this.body = BABYLON.MeshBuilder.CreateBox("trumpBody", { width: 0.7, height: 0.7, depth: 0.4 }, scene);
        this.body.material = suitMat;
        this.body.position.y = 1.15;
        this.body.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.body);

        // Tie
        this.tie = BABYLON.MeshBuilder.CreateBox("trumpTie", { width: 0.2, height: 0.5, depth: 0.05 }, scene);
        this.tie.material = tieMat;
        this.tie.position.set(0, 1.15, 0.21);
        this.tie.parent = this.mesh;

        // Arms
        this.leftArm = BABYLON.MeshBuilder.CreateBox("trumpLeftArm", { width: 0.25, height: 0.7, depth: 0.25 }, scene);
        this.leftArm.material = suitMat;
        this.leftArm.position.set(-0.5, 1.15, 0);
        this.leftArm.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.leftArm);

        this.rightArm = BABYLON.MeshBuilder.CreateBox("trumpRightArm", { width: 0.25, height: 0.7, depth: 0.25 }, scene);
        this.rightArm.material = suitMat;
        this.rightArm.position.set(0.5, 1.15, 0);
        this.rightArm.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.rightArm);

        // Legs
        this.leftLeg = BABYLON.MeshBuilder.CreateBox("trumpLeftLeg", { width: 0.3, height: 0.8, depth: 0.3 }, scene);
        this.leftLeg.material = suitMat;
        this.leftLeg.position.set(-0.2, 0.4, 0);
        this.leftLeg.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.leftLeg);

        this.rightLeg = BABYLON.MeshBuilder.CreateBox("trumpRightLeg", { width: 0.3, height: 0.8, depth: 0.3 }, scene);
        this.rightLeg.material = suitMat;
        this.rightLeg.position.set(0.2, 0.4, 0);
        this.rightLeg.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.rightLeg);

        // State
        this.isChasing = false;
        this.chaseTimer = 0;
        this.chaseDuration = 5.0; // Chase for 5 seconds after hit
        this.runTime = 0;

        // Positions
        this.hiddenZ = 15; // Behind camera (out of view)
        this.chaseZ = 2; // Behind player, visible but not blocking
    }

    reset() {
        this.isChasing = false;
        this.chaseTimer = 0;
        this.mesh.position.z = this.hiddenZ;
    }

    startChase() {
        this.isChasing = true;
        this.chaseTimer = this.chaseDuration;
    }

    update(dt, playerLaneX) {
        // Timer logic
        if (this.isChasing) {
            this.chaseTimer -= dt;
            if (this.chaseTimer <= 0) {
                this.isChasing = false;
            }
        }

        // Target Position
        const targetZ = this.isChasing ? this.chaseZ : this.hiddenZ;

        // Move Z
        this.mesh.position.z += (targetZ - this.mesh.position.z) * 3 * dt;

        // Follow Player X (with some lag)
        this.mesh.position.x += (playerLaneX - this.mesh.position.x) * 2 * dt;

        // Animation
        if (this.isChasing) {
            this.runTime += dt * 12; // Run fast
            this.leftLeg.rotation.x = Math.sin(this.runTime) * 0.6;
            this.rightLeg.rotation.x = Math.sin(this.runTime + Math.PI) * 0.6;
            this.leftArm.rotation.x = Math.sin(this.runTime + Math.PI) * 0.6;
            this.rightArm.rotation.x = Math.sin(this.runTime) * 0.6;

            // Bobbing
            this.mesh.position.y = Math.abs(Math.sin(this.runTime * 2)) * 0.1;
        }
    }
}
