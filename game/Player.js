import * as BABYLON from '@babylonjs/core';
import { TextureGenerator } from './TextureGenerator.js';

export class Player {
    constructor(scene, shadowGenerator) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        // this.texGen = new TextureGenerator(); // No longer needed for player mesh

        // Lane Config
        this.lanes = [-3, 0, 3]; // Left, Center, Right
        this.currentLane = 1; // Start in Center
        this.targetX = 0;

        // Physics
        this.velocity = new BABYLON.Vector3(0, 0, 0);
        this.gravity = -20;
        this.jumpForce = 8;
        this.isGrounded = true;

        // Mesh Group
        this.mesh = new BABYLON.TransformNode("playerNode", scene);

        // Materials
        const skinMat = new BABYLON.StandardMaterial("skinMat", scene);
        skinMat.diffuseColor = new BABYLON.Color3(0.82, 0.65, 0.47); // Skin

        const suitMat = new BABYLON.StandardMaterial("suitMat", scene);
        suitMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.18); // Dark Blue Suit

        const pantsMat = new BABYLON.StandardMaterial("pantsMat", scene);
        pantsMat.diffuseColor = new BABYLON.Color3(0.07, 0.07, 0.07); // Black Pants

        const redMat = new BABYLON.StandardMaterial("redMat", scene);
        redMat.diffuseColor = new BABYLON.Color3(1, 0, 0); // Tie

        const hairMat = new BABYLON.StandardMaterial("hairMat", scene);
        hairMat.diffuseColor = new BABYLON.Color3(0, 0, 0); // Black Hair

        // Head
        this.head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.5, height: 0.5, depth: 0.5 }, scene);
        this.head.material = skinMat;
        this.head.position.y = 1.75;
        this.head.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.head);

        // Hair
        this.hair = BABYLON.MeshBuilder.CreateBox("hair", { width: 0.55, height: 0.15, depth: 0.55 }, scene);
        this.hair.material = hairMat;
        this.hair.position.y = 0.3; // On top of head (relative to head center)
        this.hair.parent = this.head;

        // Body
        this.body = BABYLON.MeshBuilder.CreateBox("body", { width: 0.6, height: 0.7, depth: 0.3 }, scene);
        this.body.material = suitMat;
        this.body.position.y = 1.15;
        this.body.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.body);

        // Tie
        this.tie = BABYLON.MeshBuilder.CreateBox("tie", { width: 0.15, height: 0.4, depth: 0.05 }, scene);
        this.tie.material = redMat;
        this.tie.position.set(0, 1.15, 0.16); // Z is forward? If camera looks at -Z, then +Z is towards camera.
        // In Three.js, tie was at Z=0.16 (front).
        // In Babylon, if we look at -Z, front is +Z. So 0.16 is correct.
        this.tie.parent = this.mesh;

        // Arms
        this.leftArm = BABYLON.MeshBuilder.CreateBox("leftArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        this.leftArm.material = suitMat;
        this.leftArm.position.set(-0.45, 1.15, 0);
        this.leftArm.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.leftArm);

        this.rightArm = BABYLON.MeshBuilder.CreateBox("rightArm", { width: 0.2, height: 0.7, depth: 0.2 }, scene);
        this.rightArm.material = suitMat;
        this.rightArm.position.set(0.45, 1.15, 0);
        this.rightArm.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.rightArm);

        // Legs
        this.leftLeg = BABYLON.MeshBuilder.CreateBox("leftLeg", { width: 0.25, height: 0.8, depth: 0.25 }, scene);
        this.leftLeg.material = pantsMat;
        this.leftLeg.position.set(-0.18, 0.4, 0);
        this.leftLeg.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.leftLeg);

        this.rightLeg = BABYLON.MeshBuilder.CreateBox("rightLeg", { width: 0.25, height: 0.8, depth: 0.25 }, scene);
        this.rightLeg.material = pantsMat;
        this.rightLeg.position.set(0.18, 0.4, 0);
        this.rightLeg.parent = this.mesh;
        if (this.shadowGenerator) this.shadowGenerator.getShadowMap().renderList.push(this.rightLeg);


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
        this.mesh.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.isGrounded = true;
        this.mesh.scaling.set(1, 1, 1);

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
            this.events.push({ type: 'powerupStart', name: 'kafiyeh', duration: 10.0 });
        } else if (type === 'rainbow') {
            this.hasRainbow = true;
            this.rainbowTimer = 7.0;
            this.events.push({ type: 'powerupStart', name: 'rainbow', duration: 10.0 });
        } else if (type === 'covidMask') {
            this.hasCovidMask = true;
            this.covidMaskTimer = 10.0;
            this.events.push({ type: 'powerupStart', name: 'covidMask', duration: 10.0 });
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

        if (this.isGrounded && slide) {
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
        this.mesh.getChildMeshes().forEach(child => {
            if (child.material) child.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        });
    }

    setSkin(skinData) {
        this.currentSkin = skinData;
        this.resetColor();
    }

    resetColor() {
        if (this.hasKafiyeh || this.hasRainbow || this.hasCovidMask) return; // Don't reset if powerup active

        const skinColor = this.currentSkin ? BABYLON.Color3.FromHexString(this.currentSkin.color.toString(16).padStart(6, '0')) : new BABYLON.Color3(0.82, 0.65, 0.47);
        const suitColor = this.currentSkin ? BABYLON.Color3.FromHexString(this.currentSkin.suitColor.toString(16).padStart(6, '0')) : new BABYLON.Color3(0.1, 0.1, 0.18);

        // Note: Hex string conversion might be tricky if skinData uses 0x... numbers.
        // Assuming skinData uses hex numbers like 0xd2a679.
        // BABYLON.Color3.FromInt might be better if available, or manual conversion.
        // Let's implement a helper or just use FromHexString with #

        const hexToColor3 = (hex) => {
            const r = ((hex >> 16) & 255) / 255;
            const g = ((hex >> 8) & 255) / 255;
            const b = (hex & 255) / 255;
            return new BABYLON.Color3(r, g, b);
        };

        const finalSkinColor = this.currentSkin ? hexToColor3(this.currentSkin.color) : new BABYLON.Color3(0.82, 0.65, 0.47);
        const finalSuitColor = this.currentSkin ? hexToColor3(this.currentSkin.suitColor) : new BABYLON.Color3(0.1, 0.1, 0.18);

        this.head.material.diffuseColor = finalSkinColor;
        this.hair.material.diffuseColor = new BABYLON.Color3(0, 0, 0);
        this.body.material.diffuseColor = finalSuitColor;
        this.tie.material.diffuseColor = new BABYLON.Color3(1, 0, 0);
        this.leftArm.material.diffuseColor = finalSuitColor;
        this.rightArm.material.diffuseColor = finalSuitColor;
        this.leftLeg.material.diffuseColor = new BABYLON.Color3(0.07, 0.07, 0.07);
        this.rightLeg.material.diffuseColor = new BABYLON.Color3(0.07, 0.07, 0.07);
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
