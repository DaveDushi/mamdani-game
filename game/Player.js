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


        this.slideTimer = 0;
        this.slideDuration = 0.8; // Seconds

        // Powerups
        this.hasKafiyeh = false; // Invincibility
        this.hasRainbow = false; // Magnet
        this.hasCovidMask = false; // Safe Slide

        this.kafiyehTimer = 0;
        this.rainbowTimer = 0;
        this.covidMaskTimer = 0;

        this.runTime = 0;

        this.confusionTimer = 0;

        this.events = [];
    }

    reset() {
        this.currentLane = 1;
        this.targetX = 0;
        this.mesh.position.set(0, 0, 0); // Group pivot is at 0
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.mesh.scale.set(1, 1, 1);

        this.slideTimer = 0;
        this.confusionTimer = 0;

        this.hasKafiyeh = false;
        this.hasRainbow = false;
        this.hasCovidMask = false;
    }

    activatePowerup(type) {
        if (type === 'kafiyeh') {
            this.hasKafiyeh = true;
            this.kafiyehTimer = 5.0;
            this.events.push({ type: 'powerupStart', name: 'kafiyeh', duration: 5.0 });
        } else if (type === 'rainbow') {
            this.hasRainbow = true;
            this.rainbowTimer = 7.0;
            this.events.push({ type: 'powerupStart', name: 'rainbow', duration: 7.0 });
        } else if (type === 'covidMask') {
            this.hasCovidMask = true;
            this.covidMaskTimer = 3.0;
            this.events.push({ type: 'powerupStart', name: 'covidMask', duration: 3.0 });
        }
    }

    activateConfusion() {
        this.confusionTimer = 5.0;
        this.events.push({ type: 'debuffStart', name: 'confusion', duration: 5.0 });
    }

    update(dt, input) {
        // Update Powerup Timers
        if (this.hasKafiyeh) {
            this.kafiyehTimer -= dt;
            if (this.kafiyehTimer <= 0) {
                this.hasKafiyeh = false;
                this.events.push({ type: 'powerupEnd', name: 'kafiyeh' });
            }
        }
        if (this.hasRainbow) {
            this.rainbowTimer -= dt;
            if (this.rainbowTimer <= 0) {
                this.hasRainbow = false;
                this.events.push({ type: 'powerupEnd', name: 'rainbow' });
            }
        }
        if (this.hasCovidMask) {
            this.covidMaskTimer -= dt;
            if (this.covidMaskTimer <= 0) {
                this.hasCovidMask = false;
                this.events.push({ type: 'powerupEnd', name: 'covidMask' });
            }
        }

        if (this.confusionTimer > 0) {
            this.confusionTimer -= dt;
            if (this.confusionTimer <= 0) {
                this.confusionTimer = 0;
                this.events.push({ type: 'debuffEnd', name: 'confusion' });
            }
        }

        // Input Handling with Confusion
        let moveLeft = input.isJustPressed('left');
        let moveRight = input.isJustPressed('right');
        let jump = input.isJustPressed('up');
        let slide = input.isJustPressed('down');

        if (this.confusionTimer > 0) {
            // Swap Inputs
            const tempLeft = moveLeft; moveLeft = moveRight; moveRight = tempLeft;
            const tempJump = jump; jump = slide; slide = tempJump;
        }

        // Lane Switching
        if (moveLeft && this.currentLane > 0) {
            this.currentLane--;
        }
        if (moveRight && this.currentLane < 2) {
            this.currentLane++;
        }

        this.targetX = this.lanes[this.currentLane];

        // Smooth movement to lane
        this.mesh.position.x += (this.targetX - this.mesh.position.x) * 10 * dt;

        // Jumping
        if (this.isGrounded && jump) {
            this.velocity.y = this.jumpForce;
            this.isGrounded = false;
        }

        // Sliding
        if (this.slideTimer > 0) {
            this.slideTimer -= dt;
            // Hitbox adjustment handled by groundY in gravity logic
        }

        if (slide) {
            if (this.isGrounded) {
                this.slideTimer = this.slideDuration;
            } else {
                // Jump Cancel / Air Slide
                this.slideTimer = this.slideDuration;
                this.velocity.y = -5; // Gentle drop
            }
        }

        // Gravity
        if (!this.isGrounded) {
            this.velocity.y += this.gravity * dt;
            this.mesh.position.y += this.velocity.y * dt;

            // Ground collision
            const groundY = 0;

            if (this.mesh.position.y <= groundY) {
                this.mesh.position.y = groundY;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }

        // Animation
        if (this.slideTimer > 0) {
            // Slide Pose
            const slideLean = -Math.PI / 4;

            // Legs forward
            this.leftLeg.rotation.x = -Math.PI / 2;
            this.rightLeg.rotation.x = -Math.PI / 2;
            this.leftLeg.position.set(-0.18, 0.2, 0.3); // Lift and move forward
            this.rightLeg.position.set(0.18, 0.2, 0.3);

            // Body lean back
            this.body.rotation.x = slideLean;
            this.body.position.y = 0.7; // Lower body
            this.body.position.z = -0.2;

            // Head follow body roughly (or look forward)
            this.head.position.y = 1.1;
            this.head.position.z = -0.4;
            this.head.rotation.x = Math.PI / 6; // Look forward slightly

            // Arms
            this.leftArm.position.y = 0.7;
            this.leftArm.position.z = -0.2;
            this.leftArm.rotation.x = slideLean;

            this.rightArm.position.y = 0.7;
            this.rightArm.position.z = -0.2;
            this.rightArm.rotation.x = slideLean;

            // Tie
            this.tie.position.y = 0.7;
            this.tie.position.z = -0.04; // Adjust for body lean
            this.tie.rotation.x = slideLean;

            // Ensure mesh is upright
            this.mesh.rotation.x = 0;

        } else if (this.isGrounded) {
            this.runTime += dt * 10;

            // Reset Positions (Defaults)
            this.resetPoseDefaults();

            // Run Cycle
            this.leftLeg.rotation.x = Math.sin(this.runTime) * 0.5;
            this.rightLeg.rotation.x = Math.sin(this.runTime + Math.PI) * 0.5;
            this.leftArm.rotation.x = Math.sin(this.runTime + Math.PI) * 0.5;
            this.rightArm.rotation.x = Math.sin(this.runTime) * 0.5;
        } else {
            // Reset pose for Jump/Idle
            this.resetPoseDefaults();

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

    setSkin(skinData) {
        this.currentSkin = skinData;
        this.resetColor();
    }

    resetColor() {
        if (this.hasKafiyeh || this.hasRainbow) return; // Don't reset if powerup active

        const skinColor = this.currentSkin ? this.currentSkin.color : 0xd2a679;
        const suitColor = this.currentSkin ? this.currentSkin.suitColor : 0x1a1a2e;

        this.head.material.color.setHex(skinColor); // Skin
        this.hair.material.color.setHex(0x000000); // Hair
        this.body.material.color.setHex(suitColor); // Suit
        this.tie.material.color.setHex(0xff0000); // Tie
        this.leftArm.material.color.setHex(suitColor); // Suit
        this.rightArm.material.color.setHex(suitColor); // Suit
        this.leftLeg.material.color.setHex(0x111111); // Pants
        this.rightLeg.material.color.setHex(0x111111); // Pants
    }
    resetPoseDefaults() {
        this.mesh.rotation.x = 0;
        this.mesh.position.z = 0;

        this.head.position.set(0, 1.75, 0);
        this.head.rotation.x = 0;

        this.body.position.set(0, 1.15, 0);
        this.body.rotation.x = 0;

        this.tie.position.set(0, 1.15, 0.16);
        this.tie.rotation.x = 0;

        this.leftArm.position.set(-0.45, 1.15, 0);
        this.rightArm.position.set(0.45, 1.15, 0);

        this.leftLeg.position.set(-0.18, 0.4, 0);
        this.rightLeg.position.set(0.18, 0.4, 0);
    }
}
