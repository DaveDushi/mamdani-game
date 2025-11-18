import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class Trump {
    constructor(scene) {
        this.scene = scene;
        this.texGen = new TextureGenerator();

        // Mesh Group
        this.mesh = new THREE.Group();
        this.mesh.position.set(0, 0, 15);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Materials
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 }); // Orange Skin
        const suitMat = new THREE.MeshStandardMaterial({ color: 0x000080 }); // Navy Suit
        const hairMat = new THREE.MeshStandardMaterial({ color: 0xffff00 }); // Yellow Hair
        const tieMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red Tie

        // Head
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        this.head = new THREE.Mesh(headGeo, skinMat);
        this.head.position.y = 1.8;
        this.mesh.add(this.head);

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.65, 0.2, 0.65);
        this.hair = new THREE.Mesh(hairGeo, hairMat);
        this.hair.position.y = 2.15;
        this.mesh.add(this.hair);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.7, 0.7, 0.4);
        this.body = new THREE.Mesh(bodyGeo, suitMat);
        this.body.position.y = 1.15;
        this.mesh.add(this.body);

        // Tie
        const tieGeo = new THREE.BoxGeometry(0.2, 0.5, 0.05);
        this.tie = new THREE.Mesh(tieGeo, tieMat);
        this.tie.position.set(0, 1.15, 0.21);
        this.mesh.add(this.tie);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        this.leftArm = new THREE.Mesh(armGeo, suitMat);
        this.leftArm.position.set(-0.5, 1.15, 0);
        this.mesh.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, suitMat);
        this.rightArm.position.set(0.5, 1.15, 0);
        this.mesh.add(this.rightArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
        this.leftLeg = new THREE.Mesh(legGeo, suitMat);
        this.leftLeg.position.set(-0.2, 0.4, 0);
        this.mesh.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, suitMat);
        this.rightLeg.position.set(0.2, 0.4, 0);
        this.mesh.add(this.rightLeg);

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
