import * as BABYLON from '@babylonjs/core';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];

        // reuse geometry/material for performance
        // In Babylon, we can clone meshes or use instances.
        // For simplicity, we'll create a base mesh and clone it.
        this.baseMesh = BABYLON.MeshBuilder.CreateBox("particleBase", { size: 0.2 }, scene);
        this.baseMesh.isVisible = false;

        this.mat = new BABYLON.StandardMaterial("particleMat", scene);
        this.mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        this.mat.disableLighting = true;
        this.baseMesh.material = this.mat;
    }

    reset() {
        this.particles.forEach(p => p.mesh.dispose());
        this.particles = [];
    }

    spawnParticles(position, count, color, speed = 1) {
        // Color handling: color might be hex number or Color3
        let babColor;
        if (typeof color === 'number') {
            babColor = BABYLON.Color3.FromHexString(color.toString(16).padStart(6, '0'));
        } else if (color instanceof BABYLON.Color3) {
            babColor = color;
        } else {
            babColor = new BABYLON.Color3(1, 1, 1);
        }

        for (let i = 0; i < count; i++) {
            const mesh = this.baseMesh.clone("particle");
            mesh.isVisible = true;
            mesh.position.copyFrom(position);

            // We need a unique material to change color per batch? 
            // Or use vertex colors?
            // For simplicity, let's clone material if color is different, or just set it.
            // Actually, cloning material for every particle is bad.
            // Better: Use instances and set color? Or just clone material for the batch.
            // Let's clone material for the batch (or per particle if needed).
            // Since particles fade out, maybe we need unique materials or handle alpha.
            // Let's just clone material for each particle for now (not efficient but safe for small counts).
            const pMat = this.mat.clone("pMat");
            pMat.emissiveColor = babColor;
            pMat.diffuseColor = babColor;
            mesh.material = pMat;

            // Random spread
            mesh.position.x += (Math.random() - 0.5) * 0.5;
            mesh.position.y += (Math.random() - 0.5) * 0.5;
            mesh.position.z += (Math.random() - 0.5) * 0.5;

            // Random velocity
            const velocity = new BABYLON.Vector3(
                (Math.random() - 0.5) * 2 * speed,
                (Math.random() * 2 + 1) * speed, // Upward bias
                (Math.random() - 0.5) * 2 * speed
            );

            this.particles.push({ mesh, velocity, life: 1.0 });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                p.mesh.dispose();
                // Also dispose material if we cloned it
                if (p.mesh.material) p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            // Physics
            p.velocity.y -= 9.8 * dt; // Gravity
            p.mesh.position.addInPlace(p.velocity.scale(dt));
            p.mesh.rotation.x += dt;
            p.mesh.rotation.y += dt;
            p.mesh.scaling.setAll(p.life); // Shrink over time
        }
    }
}
