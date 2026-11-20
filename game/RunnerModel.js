import * as THREE from 'three';
export { loadCast, loadMayor } from './Cast.js';

export class RunnerModel {
    constructor(asset, chaser = false) {
        this.root = new THREE.Group();
        this.figure = asset.scene;
        this.root.add(this.figure);
        this.figure.updateMatrixWorld(true);
        this.sockets = {};
        if (chaser) {
            const name = 'LeftHand';
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
        if (!chaser) {
            this.suits = new Map([['default', outfit]]);
            this.headwear = new Map();
            for (const piece of [...asset.apparel.children]) {
                if (piece.name.startsWith('Suit_')) this.addOutfit(piece.name.slice(5), { scene: asset.apparel });
                else if (!piece.isBone && !piece.name.startsWith('Head_')) this.attachClothing(piece);
            }
            this.scarf = this.figure.getObjectByName('Keffiyeh');
            this.flag = this.figure.getObjectByName('Rainbow_flag');
            const fasteners = this.figure.getObjectByName('Flag_fasteners');
            this.flag.add(fasteners);
            fasteners.visible = true;
            this.mask = this.figure.getObjectByName('Fitted_mask');
            this.hairStraps = this.figure.getObjectByName('Elastic_over_hair');
            this.clothStraps = this.figure.getObjectByName('Elastic_over_cloth');
            this.mask.add(this.hairStraps, this.clothStraps);
            this.setOutfit('default');
        }
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

    attachClothing(piece) {
        // Every wardrobe pack uses the mayor's bind pose and joint order.
        const formal = this.suits.get('default');
        piece.traverse(part => {
            if (!part.isSkinnedMesh) return;
            part.bind(formal.skeleton, formal.bindMatrix);
            part.material.emissive = this.material.emissive;
            part.castShadow = true;
            part.receiveShadow = false;
            part.frustumCulled = false;
        });
        this.figure.add(piece);
        piece.visible = false;
    }

    addOutfit(id, asset) {
        if (!asset || this.suits.has(id)) return [];
        const suit = asset.scene.getObjectByName('Suit_' + id);
        const cap = asset.scene.getObjectByName('Head_' + id);
        const pieces = cap ? [suit, cap] : [suit];
        for (const piece of pieces) this.attachClothing(piece);
        this.suits.set(id, suit);
        if (cap) this.headwear.set(id, cap);
        return pieces;
    }

    setOutfit(id) {
        if (this.cap) this.cap.visible = false;
        if (this.suit) this.suit.visible = false;
        this.suit = this.suits.get(id) || this.suits.get('default');
        this.suit.visible = true;
        this.cap = this.headwear.get(id);
        this.wear(this.scarf.visible, this.flag.visible, this.mask.visible);
    }

    wear(scarf, flag, mask) {
        this.scarf.visible = scarf;
        this.flag.visible = flag;
        this.mask.visible = mask;
        if (this.cap) this.cap.visible = !scarf;
        const overCloth = scarf || this.cap?.name === 'Head_worker';
        this.hairStraps.visible = !overCloth;
        this.clothStraps.visible = overCloth;
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
        if (this.flag?.visible) {
            const folds = this.flag.morphTargetInfluences;
            folds[0] = Math.sin(phase * 0.85) * 0.8;
            folds[1] = Math.cos(phase * 0.85) * 0.8;
            folds[2] = slide;
        }
    }
}
