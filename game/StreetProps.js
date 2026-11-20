import * as THREE from 'three';
import { labelMaterial } from './Geometry.js';
import { roadPickup } from './PickupArt.js';
import { halalCart, sidewalkShed, signHolder, yellowCab } from './StreetHazards.js';

export function pedestrian(cast, index) {
    const person = cast[index % 2 ? 'commuter' : 'new-yorker'].scene.clone(true);
    if (index === 2) person.rotation.y = -0.24;
    return person;
}

function stamp() {
    return new THREE.Mesh(
        new THREE.BoxGeometry(0.79, 0.49, 0.075),
        labelMaterial(['NYC', 'FOOD STAMP'], '#f6d77f', '#613d24', 256, 144)
    );
}

export function streetProps(cast) {
    return {
        taxi: yellowCab(),
        scaffold: sidewalkShed(),
        halal: halalCart(),
        alcohol: roadPickup('alcohol'),
        coin: stamp(),
        protest0: signHolder(pedestrian(cast, 0), 0),
        protest1: signHolder(pedestrian(cast, 1), 1),
        protest2: signHolder(pedestrian(cast, 2), 2)
    };
}
