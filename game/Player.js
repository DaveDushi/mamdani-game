import * as THREE from 'three';
import { TextureGenerator } from './TextureGenerator.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        // this.texGen = new TextureGenerator(); // No longer needed for player mesh

        // Lane Config
        this.lanes = [-3, 0, 3]; // Left, Center, Right
        this.currentLane = 1; // Start in Center
        this.targetX = 0;

        // Physics
        this.velocity = new THREE.Vector3();
        this.gravity = -20;
        this.jumpForce = 8;
        this.isGrounded = true;

        // Mesh Group
        this.mesh = new THREE.Group();
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        // Materials
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679 }); // Skin
        const suitMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e }); // Dark Blue Suit
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); // Black Pants
        const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Tie

        // Head
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        this.head = new THREE.Mesh(headGeo, skinMat);
        this.head.position.y = 1.75;
        this.head.castShadow = true;
        this.mesh.add(this.head);

        // Hair
        const hairGeo = new THREE.BoxGeometry(0.55, 0.15, 0.55);
        this.hair = new THREE.Mesh(hairGeo, new THREE.MeshStandardMaterial({ color: 0x000000 }));
        this.hair.position.y = 0.3; // On top of head (relative to head center)
        this.head.add(this.hair);

        // Body
        const bodyGeo = new THREE.BoxGeometry(0.6, 0.7, 0.3);
        this.body = new THREE.Mesh(bodyGeo, suitMat);
        this.body.position.y = 1.15;
        this.body.castShadow = true;
        this.mesh.add(this.body);

        // Tie
        const tieGeo = new THREE.BoxGeometry(0.15, 0.4, 0.05);
        this.tie = new THREE.Mesh(tieGeo, redMat);
        this.tie.position.set(0, 1.15, 0.16);
        this.mesh.add(this.tie);

        // Arms
        const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        this.leftArm = new THREE.Mesh(armGeo, suitMat);
        this.leftArm.position.set(-0.45, 1.15, 0);
        this.leftArm.castShadow = true;
        this.mesh.add(this.leftArm);

        this.rightArm = new THREE.Mesh(armGeo, suitMat);
        this.rightArm.position.set(0.45, 1.15, 0);
        this.rightArm.castShadow = true;
        this.mesh.add(this.rightArm);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        this.leftLeg = new THREE.Mesh(legGeo, pantsMat);
        this.leftLeg.position.set(-0.18, 0.4, 0);
        this.leftLeg.castShadow = true;
        this.mesh.add(this.leftLeg);

        this.rightLeg = new THREE.Mesh(legGeo, pantsMat);
        this.rightLeg.position.set(0.18, 0.4, 0);
        this.rightLeg.castShadow = true;
        this.mesh.add(this.rightLeg);

        // Purity (Health)
        this.maxPurity = 100;
        this.purity = this.maxPurity;
        this.slideTimer = 0;
        this.slideDuration = 0.8; // Seconds

        // Powerups
        this.hasScarf = false; // Invincibility
        this.hasRainbow = false; // Magnet
        this.hasMask = false; // Safe Slide

        this.scarfTimer = 0;
        this.rainbowTimer = 0;
        this.maskTimer = 0;

        this.runTime = 0;
    }

    reset() {
        this.currentLane = 1;
        this.targetX = 0;
        this.mesh.position.set(0, 0, 0); // Group pivot is at 0
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.mesh.scale.set(1, 1, 1);
        this.purity = this.maxPurity;
        this.slideTimer = 0;

        this.hasScarf = false;
        this.hasRainbow = false;
        this.hasMask = false;
    }

    takeDamage(amount) {
        if (this.hasScarf) return; // Invincible
        this.purity -= amount;
        if (this.purity < 0) this.purity = 0;
    }

    heal(amount) {
        this.purity += amount;
        if (this.purity > this.maxPurity) this.purity = this.maxPurity;
    }

    activatePowerup(type) {
        if (type === 'scarf') {
            this.hasScarf = true;
            this.scarfTimer = 10.0;
            // this.mesh.material.color.setHex(0xFF0000); // Visual cue - needs to be applied to specific parts
        } else if (type === 'rainbow') {
            this.hasRainbow = true;
            this.rainbowTimer = 10.0;
            // this.mesh.material.color.setHex(0x00FFFF);
        } else if (type === 'mask') {
            this.hasMask = true;
            this.maskTimer = 10.0;
            // this.mesh.material.color.setHex(0xFFFFFF);
        }
    }

    update(dt, input) {
        // Update Powerup Timers
        if (this.hasScarf) {
            this.scarfTimer -= dt;
            if (this.scarfTimer <= 0) {
                this.hasScarf = false;
                // Reset visual if needed
            }
        }
        if (this.hasRainbow) {
            this.rainbowTimer -= dt;
            if (this.rainbowTimer <= 0) {
                this.hasRainbow = false;
                // this.mesh.material.color.setHex(0xff0000);
            }
        }
        if (this.hasMask) {
            this.maskTimer -= dt;
            if (this.maskTimer <= 0) {
                this.hasMask = false;
                // this.mesh.material.color.setHex(0xff0000);
            }
        }

        // Lane Switching
        if (input.isJustPressed('left') && this.currentLane > 0) {
            this.currentLane--;
        }
        if (input.isJustPressed('right') && this.currentLane < 2) {
            this.currentLane++;
        }

        this.targetX = this.lanes[this.currentLane];

        // Smooth movement to lane
        this.mesh.position.x += (this.targetX - this.mesh.position.x) * 10 * dt;

        // Jumping
        if (this.isGrounded && input.isJustPressed('up')) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }

        // Sliding
        if (this.slideTimer > 0) {
            this.slideTimer -= dt;
            this.mesh.scale.y = 0.5;
            this.mesh.position.y = -0.5; // Adjust for scale
        } else {
            this.mesh.scale.y = 1;
            if (this.isGrounded) this.mesh.position.y = 0;
        }

        if (this.isGrounded && input.isJustPressed('down')) {
            this.slideTimer = this.slideDuration;
        }

        // Gravity
        if (!this.isGrounded) {
            this.velocity.y += this.gravity * dt;
            this.mesh.position.y += this.velocity.y * dt;

            // Ground collision
            const groundY = (this.slideTimer > 0) ? -0.5 : 0;

            if (this.mesh.position.y <= groundY) {
                this.mesh.position.y = groundY;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        // Animation
        if (this.isGrounded && this.slideTimer <= 0) {
            this.runTime += dt * 10;
            this.leftLeg.rotation.x = Math.sin(this.runTime) * 0.5;
            this.rightLeg.rotation.x = Math.sin(this.runTime + Math.PI) * 0.5;
            this.leftArm.rotation.x = Math.sin(this.runTime + Math.PI) * 0.5;
            this.rightArm.rotation.x = Math.sin(this.runTime) * 0.5;
        } else {
            // Reset pose
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
            this.leftArm.rotation.x = 0;
            this.rightArm.rotation.x = 0;
        }
    }

    flashRed() {
        this.mesh.traverse(child => {
            if (child.isMesh) child.material.color.setHex(0xff0000);
        });
    }

    resetColor() {
        if (this.hasScarf || this.hasRainbow || this.hasMask) return; // Don't reset if powerup active

        this.head.material.color.setHex(0xd2a679); // Skin
        this.hair.material.color.setHex(0x000000); // Hair
        this.body.material.color.setHex(0x1a1a2e); // Suit
        this.tie.material.color.setHex(0xff0000); // Tie
        this.leftArm.material.color.setHex(0x1a1a2e); // Suit
        this.rightArm.material.color.setHex(0x1a1a2e); // Suit
        this.leftLeg.material.color.setHex(0x111111); // Pants
        this.rightLeg.material.color.setHex(0x111111); // Pants
    }
}
