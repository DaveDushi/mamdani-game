import * as THREE from 'three';
import { Batch } from './Geometry.js';

// Both atlases face the broadcast camera (+Z). The track runs away from the start stand.
const camps = [
    { side: -1, art: 'mamdani', fascia: 0x175950, seat: 0x629b87 },
    { side: 1, art: 'trump', fascia: 0x7a3040, seat: 0xbe776a }
];

function flagMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 208;
    const pen = canvas.getContext('2d');
    const w = canvas.width / 2, h = canvas.height;
    pen.fillStyle = '#fff';
    pen.fillRect(0, 0, w * 2, h);
    pen.fillStyle = '#16191b';
    pen.fillRect(0, 0, w, h / 3);
    pen.fillStyle = '#168348';
    pen.fillRect(0, h * 2 / 3, w, h / 3);
    pen.fillStyle = '#ce303c';
    pen.beginPath();
    pen.moveTo(0, 0);
    pen.lineTo(w / 2, h / 2);
    pen.lineTo(0, h);
    pen.fill();
    pen.translate(w, 0);
    const stripe = h / 13, canton = w * .4;
    pen.fillStyle = '#b31942';
    for (let i = 0; i < 13; i += 2) pen.fillRect(0, i * stripe, w, stripe);
    pen.fillStyle = '#213969';
    pen.fillRect(0, 0, canton, 7 * stripe);
    pen.fillStyle = '#fff';
    for (let row = 0; row < 9; row++) {
        const count = row % 2 ? 5 : 6;
        for (let col = 0; col < count; col++) {
            const x = (col * 2 + (row % 2) + 1) * canton / 12;
            const y = (row + 1) * 7 * stripe / 10;
            pen.beginPath();
            for (let k = 0; k < 10; k++) {
                const a = k * Math.PI / 5 - Math.PI / 2;
                const radius = h * (k % 2 ? .012 : .031);
                const px = x + radius * Math.cos(a), py = y + radius * Math.sin(a);
                if (k === 0) pen.moveTo(px, py);
                else pen.lineTo(px, py);
            }
            pen.fill();
        }
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
}

function movingMaterial(clock, map = null) {
    const material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, alphaTest: .42 });
    material.onBeforeCompile = shader => {
        shader.uniforms.cheerTime = clock;
        shader.vertexShader = 'uniform float cheerTime; attribute vec2 cheer;\n' +
            shader.vertexShader.replace('#include <begin_vertex>', `
                #include <begin_vertex>
                float t = cheerTime * 3.8 + cheer.x;
                if (cheer.y >= 0.) {
                    transformed.x += sin(t) * .040 * cheer.y;
                    transformed.y += (.5 + .5 * sin(t * 1.45)) * .068 * cheer.y;
                } else {
                    float fly = -1. - cheer.y;
                    transformed.y += fly * (.062 * sin(t - fly * 5.) - .035);
                    transformed.z += fly * .125 * sin(t - fly * 7.);
                }
            `);
    };
    return material;
}

function spritePlane(columns) {
    const geometry = new THREE.PlaneGeometry(1, 1, columns, 1);
    const uv = geometry.attributes.uv;
    geometry.setAttribute('cheer', new THREE.Float32BufferAttribute(new Float32Array(uv.count * 2), 2));
    return geometry;
}

function pose(plane, phase, flag) {
    const { uv, cheer } = plane.attributes;
    for (let i = 0; i < uv.count; i++) cheer.setXY(i, phase, flag ? -1 - uv.getX(i) : uv.getY(i));
}

export function grandstands(scene, structure, addSign) {
    const clock = { value: 0 };
    const flags = new Batch();
    const face = spritePlane(1), cloth = spritePlane(8);
    const loader = new THREE.TextureLoader();
    const loads = [];
    for (const [index, camp] of camps.entries()) {
        const { side, fascia, seat } = camp;
        const fans = new Batch();
        const fan = (slot, x, floor, z, height, yaw = 0) => {
            pose(face, x * 7.51 + z * 1.89, false);
            fans.shape(face, 0xffffff, x, floor + height / 2, z, height * 2 / 3, height, 1, 0, yaw, 0,
                [(slot * 256 + .5) / 1280, .5 / 384, 255 / 1280, 383 / 384]);
        };
        const flag = (x, foot, z, top, width, yaw = 0) => {
            const height = width / (index ? 1.9 : 2);
            structure.box(0xd3c8ae, x, (foot + top) / 2, z, .029, top - foot + .05, .029);
            pose(cloth, x * 4 + z * .83, true);
            flags.shape(cloth, 0xffffff, x + Math.cos(yaw) * width / 2, top - height / 2,
                z - Math.sin(yaw) * width / 2, width, height, 1, 0, yaw, 0,
                [(400 * index + .5) / 800, .5 / 208, 399 / 800, 207 / 208]);
        };

        // Two tiered boxes behind the starting line keep all six headliners in the portrait shot.
        const boxX = side * 1.80;
        structure.box(fascia, boxX, .61, -2.65, 3.48, 1.22, 1.2);
        structure.box(0xe4c68c, boxX, 1.22, -2.05, 3.50, .06, .09);
        structure.box(seat, boxX, .98, -3.67, 3.48, 1.96, 1.0);
        structure.box(0xe4c68c, boxX, 1.96, -3.17, 3.50, .06, .08);
        addSign(index + 5, side * .56, .90, -2.036, .94, .30);
        fan(0, side * .52, 1.16, -2.36, 1.34);
        fan(1, side * 1.44, 1.16, -2.40, 1.34);
        fan(2, side * .99, 1.91, -3.41, 1.35);
        fan(3, side * 2.37, 1.16, -2.45, 1.25);
        fan(4, side * 2.05, 1.91, -3.46, 1.28);
        flag(side * 1.16 - .50, 1.94, -3.64, 3.91, 1.00);
        for (const [slot, x, y, z] of [[0, .46, 1.90, -2.13], [1, 1.51, 1.90, -2.13], [2, .99, 2.59, -3.14]]) {
            structure.box(0xc9b997, side * x, y - .33, z, .025, .66, .025);
            addSign(7, side * x, y, z + .02, .67, .20, 0, index * 3 + slot, 6);
        }

        // Short banks leave gaps between sections. The raised back row can see over the front rail.
        for (let bay = 0; bay < 8; bay++) {
            const z = 2.8 + bay * 7.2, yaw = -side * .81;
            structure.box(fascia, side * 3.69, .36, z, 1.06, .72, 5.75);
            structure.box(0xd0ae7d, side * 3.16, .71, z, .08, .07, 5.78);
            structure.box(seat, side * 4.63, .68, z, .90, 1.36, 5.75);
            structure.box(0xd0ae7d, side * 4.18, 1.36, z, .08, .07, 5.78);
            for (let j = 0; j < 5; j++) {
                fan((j + bay * 2) % 5, side * 3.44, .67, z - 2.24 + j * 1.12,
                    1.22 + ((j + bay) % 3) * .045, yaw);
            }
            for (let j = 0; j < 4; j++) {
                fan((j * 3 + bay + 3) % 5, side * 4.47, 1.30, z - 1.72 + j * 1.15, 1.27, yaw);
            }
            flag(side * 4.12, 1.30, z + (bay % 2 ? 1.8 : -.7), 3.18, 1.15, yaw * .6);
        }
        const mesh = fans.mesh(movingMaterial(clock));
        mesh.name = 'Race crowd / ' + camp.art;
        mesh.visible = false;
        scene.add(mesh);
        loads.push(loader.loadAsync(import.meta.env.BASE_URL + 'art/race-crowd-' + camp.art + '.webp').then(map => {
            map.colorSpace = THREE.SRGBColorSpace;
            mesh.material.map = map;
            mesh.material.needsUpdate = true;
            mesh.visible = true;
        }).catch(() => {}));
    }
    const standards = flags.mesh(movingMaterial(clock, flagMap()));
    standards.name = 'Race flags';
    scene.add(standards);
    face.dispose();
    cloth.dispose();
    return { clock, ready: Promise.all(loads) };
}
