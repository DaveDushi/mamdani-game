import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
let castRequest;

export function loadCast() {
    if (!castRequest) {
        const names = ['mayor', 'chaser', 'commuter', 'new-yorker'];
        castRequest = Promise.all(
            names.map(async (name) => [
                name,
                await loader.loadAsync(import.meta.env.BASE_URL + 'models/' + name + '.glb')
            ])
        )
            .then(Object.fromEntries)
            .catch((error) => {
                castRequest = null;
                throw error;
            });
    }
    return castRequest;
}

export class RunnerModel {
    constructor(asset, chaser = false) {
        this.root = new THREE.Group();
        this.figure = asset.scene;
        this.root.add(this.figure);
        this.figure.updateMatrixWorld(true);
        this.sockets = {};
        for (const name of chaser ? ['LeftHand'] : ['Neck', 'Spine2', 'Head']) {
            const bone = this.figure.getObjectByName('mixamorig' + name);
            const mount = new THREE.Group();
            bone.getWorldPosition(mount.position);
            this.figure.add(mount);
            bone.attach(mount);
            this.sockets[name] = mount;
        }
        this.figure.rotation.y = Math.PI;
        if (chaser) this.figure.scale.set(1.14, 1.015, 1.09);

        const outfit = this.figure.getObjectByName(chaser ? 'Outfit_original' : 'Outfit_formal');
        this.material = outfit.material = outfit.material.clone();
        this.tint = { value: new THREE.Color(1, 1, 1) };
        this.material.onBeforeCompile = (shader) => {
            shader.uniforms.suitTint = this.tint;
            shader.fragmentShader =
                'uniform vec3 suitTint;\n' +
                shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    '#include <map_fragment>\nfloat wool = smoothstep(0.002, 0.035, diffuseColor.b - diffuseColor.r);\ndiffuseColor.rgb *= mix(vec3(1.), suitTint, wool);'
                );
        };
        this.figure.traverse((part) => {
            if (!part.isMesh) return;
            part.castShadow = true;
            part.receiveShadow = false;
            part.frustumCulled = false;
        });
        this.mixer = new THREE.AnimationMixer(this.figure);
        const clip = (name) => THREE.AnimationClip.findByName(asset.animations, name);
        this.run = this.mixer.clipAction(clip('Run')).play();
        this.stand = this.mixer.clipAction(clip('Idle')).play();
        this.crouch = this.mixer.clipAction(clip('Crouch')).play();
        this.jump = this.mixer.clipAction(clip('Run').clone()).play();
        this.pose(0, 0, 0, 0, true);
    }

    setColors(color) {
        const base = new THREE.Color(0x344b65),
            target = new THREE.Color(color);
        this.tint.value.setRGB(target.r / base.r, target.g / base.g, target.b / base.b);
    }

    pose(phase, slide, air, lean, idle = false) {
        this.figure.rotation.z = idle ? 0 : THREE.MathUtils.clamp(-lean * 0.12, -0.17, 0.17);
        this.stand.enabled = idle;
        this.run.enabled = !idle && slide < 0.999 && air < 0.999;
        this.crouch.enabled = !idle && slide > 0.001;
        this.jump.enabled = !idle && air > 0.001 && slide < 0.999;
        const cycle = this.run.getClip().duration;
        this.stand.setEffectiveWeight(idle ? 1 : 0);
        this.stand.time = phase % this.stand.getClip().duration;
        this.run.setEffectiveWeight((1 - slide) * (1 - air));
        this.run.time = ((phase / (2 * Math.PI)) % 1) * cycle;
        this.jump.setEffectiveWeight(air * (1 - slide));
        this.jump.time = cycle * 0.32;
        this.crouch.setEffectiveWeight(slide);
        this.crouch.time = 0.6 + ((phase * 0.1) % 1.8);
        this.mixer.update(0);
    }
}
