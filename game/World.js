import * as THREE from 'three';
import { pedestrian } from './StreetProps.js';
import { Batch, artTexture } from './Geometry.js';
import { Landmarks, districts, districtAt } from './Landmarks.js';

const LENGTH = 48,
    BLOCKS = 5;
const cube = new THREE.BoxGeometry(),
    face = new THREE.PlaneGeometry();
const pole = new THREE.CylinderGeometry(1, 1, 1, 8),
    tank = new THREE.CylinderGeometry(1, 1, 1, 16);
const roof = new THREE.ConeGeometry(1, 1, 16);
const streetNames = ['CANAL ST', 'BROADWAY', 'BOWERY', 'SPRING ST', 'CENTRE ST'];
const cream = 0xe5d3ac,
    iron = 0x475655;

function signAtlas() {
    const signs = [
        ...streetNames,
        'BUS LANE',
        'RENT FREEZE',
        'DETOUR DEPT.',
        'THE CITY WIRE',
        'SUBWAY   N  Q  R'
    ];
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = signs.length * 80;
    const ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    signs.forEach((name, i) => {
        const y = i * 80;
        ctx.fillStyle = i < 5 ? '#215147' : '#293947';
        ctx.fillRect(0, y, 512, 80);
        ctx.strokeStyle = '#e4dbbd';
        ctx.lineWidth = 3;
        ctx.strokeRect(6, y + 5, 500, 70);
        ctx.font = '700 61px Condensed, Arial';
        ctx.fillStyle = '#fff9e9';
        ctx.fillText(name, 256, y + 43, 470);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
}

function streetLamp(batch, side, z, withSignal) {
    const x = side * 5.36;
    batch.shape(pole, iron, x, 2.28, z, 0.067, 4.56, 0.067);
    batch.shape(pole, 0x36494a, x, 0.23, z, 0.165, 0.46, 0.165);
    batch.box(iron, x - side * 0.51, 4.53, z, 1.07, 0.093, 0.1, 0, 0, side * 0.09);
    batch.oval(0x63706c, x - side * 1.02, 4.49, z, 0.32, 0.115, 0.17);
    batch.box(0xf5d199, x - side * 1.02, 4.42, z, 0.44, 0.035, 0.24);
    if (withSignal) {
        batch.box(0x5e645a, x - side * 1.3, 4.19, z, 2.65, 0.081, 0.09);
        batch.box(0xc38c38, x - side * 2.52, 3.88, z, 0.37, 0.82, 0.32);
        batch.box(0x323e39, x - side * 2.52, 3.88, z + 0.18, 0.28, 0.74, 0.035);
        for (let i = 0; i < 3; i++)
            batch.oval(
                [0xff7854, 0x8e753f, 0x416558][i],
                x - side * 2.52,
                4.11 - i * 0.226,
                z + 0.21,
                0.092,
                0.093,
                0.028
            );
    }
}

function waterTower(b, x, y, z) {
    for (const sx of [-1, 1])
        for (const sz of [-1, 1]) b.box(iron, x + sx * 0.74, y + 0.62, z + sz * 0.74, 0.1, 1.36, 0.1);
    b.shape(tank, 0x9a7355, x, y + 2.28, z, 1.24, 2.2, 1.24);
    for (const v of [1.27, 2.03, 2.83, 3.32]) b.shape(tank, 0x5e5950, x, y + v, z, 1.265, 0.045, 1.265);
    b.shape(roof, 0x5d6660, x, y + 3.73, z, 1.39, 0.73, 1.39);
}

function subwayTrain(material) {
    const cars = new Batch();
    for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 7.05;
        cars.box(0x92a19e, x, 7.77, -1.31, 6.88, 1.83, 1.89);
        cars.box(0x738883, x, 8.7, -1.31, 6.78, 0.15, 1.72);
        cars.box(0x50615e, x, 6.91, -1.31, 6.6, 0.27, 1.7);
        for (const side of [-1, 1]) {
            const z = -1.31 + side * 0.957;
            for (let window = 0; window < 8; window++) {
                const wx = x + (window - 3.5) * 0.78;
                cars.box(0x495d5f, wx, 8.05, z, 0.58, 0.65, 0.033);
                cars.box(window % 3 === 0 ? 0x9baca2 : 0x718983, wx, 8.1, z + side * 0.021, 0.5, 0.51, 0.014);
            }
            for (const door of [-1, 1]) {
                cars.box(0x657874, x + door * 1.83, 7.75, z + 0.025 * side, 0.025, 1.49, 0.015);
            }
            cars.box(0x4b6b79, x, 7.52, z + 0.032 * side, 6.74, 0.1, 0.022);
        }
        for (const axle of [-2.15, 2.15]) cars.box(0x394745, x + axle, 6.73, -1.31, 0.87, 0.28, 1.49);
    }
    return cars.mesh(material);
}

function block(index, mats, cast) {
    let train = null;
    const newsstands = [];
    const paving = new Batch();
    const group = new THREE.Group(),
        details = new Batch(),
        walls = new Batch(),
        districtWalls = new Batch(),
        signs = new Batch(),
        ads = new Batch(),
        trees = new Batch();
    details.box(0x676360, 0, -0.045, -2.48, 61, 0.08, 5.04);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, LENGTH), mats.road);
    road.receiveShadow = true;
    road.rotation.x = -Math.PI / 2;
    road.position.z = -LENGTH / 2;
    group.add(road);
    for (const side of [-1, 1]) {
        const sideIndex = side === 1 ? 1 : 0;
        details.box(0x97928a, side * 9, 0.05, -26.5, 8, 0.14, 43);
        details.box(0xd7c7ac, side * 5.09, 0.1, -26.5, 0.2, 0.2, 43);
        paving.shape(face, 0xffffff, side * 9, 0.128, -26.5, 7.8, 43, 1, -Math.PI / 2);
        for (let j = 0; j < 3; j++) {
            const k = index * 3 + j + sideIndex * 4;
            const tile = (k * 5 + Math.floor(k / 4)) % 6;
            const z = -12.2 - j * 14.05;
            const height = [10.8, 14, 12, 16, 11.9, 13][tile] + (k % 4 === 0 ? 2 : 0);
            const width = 9 + (k % 3),
                depth = 13.7;
            const wallX = 7.65 + (k % 3) * 0.55,
                x = side * (wallX + width * 0.5);
            const localFacade = (k + index) % 3 !== 0;
            const wallTile = localFacade
                ? [0.001, (k % 2) * 0.5 + 0.001, 1 / 3 - 0.002, 0.498]
                : [(tile % 3) / 3 + 0.001, 1 - (Math.floor(tile / 3) + 1) / 2 + 0.001, 1 / 3 - 0.002, 0.498];
            (localFacade ? districtWalls : walls).shape(
                cube,
                0xffffff,
                x,
                height * 0.5 + 0.12,
                z,
                width,
                height,
                depth,
                0,
                0,
                0,
                wallTile
            );
            if (k % 3 === 0) {
                // Balconies and ladders project past the brick, visible in silhouette down the street.
                for (let level = 0; level < 2; level++) {
                    const by = height * (0.42 + level * 0.23),
                        bx = side * (wallX - 0.43);
                    details.box(0x464c49, bx, by, z, 0.93, 0.12, 3.35);
                    details.box(0x55584e, bx - side * 0.46, by + 0.65, z, 0.05, 0.06, 3.4);
                    for (let bar = 0; bar < 7; bar++)
                        details.box(
                            0x4d514d,
                            bx - side * 0.45,
                            by + 0.33,
                            z - 1.56 + bar * 0.51,
                            0.033,
                            0.62,
                            0.042
                        );
                    for (const edge of [-1, 1])
                        details.box(0x52564f, bx, by + 0.64, z + edge * 1.65, 0.91, 0.06, 0.05);
                    details.box(0x50524b, bx - side * 0.43, by - 0.75, z + 0.62, 0.07, 1.91, 0.07, -0.55);
                }
            }
            details.box(0x847869, x, height + 0.19, z, width + 0.28, 0.24, depth + 0.24);
            details.box(cream, x, height + 0.37, z, width + 0.42, 0.14, depth + 0.34);
            details.box(0x6a6a61, x, height + 0.46, z, width, 0.12, depth);
            if (k % 3 === 0) waterTower(details, x - side * 1.2, height + 0.48, z - 0.6);
            else details.box(0x928a79, x, height + 0.95, z + 2, 2.5, 1.0, 1.6);
            // Projecting canvas awnings cast the storefront into shade.
            const awning = [0x395e4d, 0x854746, 0x4f6264, 0xa04b3d, 0x526477, 0x756f61][tile];
            details.box(
                awning,
                side * (wallX - 0.46),
                height * 0.22,
                z,
                0.98,
                0.135,
                depth * 0.74,
                0,
                0,
                side * 0.2
            );
            details.box(awning, side * (wallX - 0.93), height * 0.22 - 0.15, z, 0.08, 0.22, depth * 0.74);
            if (j === (sideIndex ? 0 : 1)) {
                const az = z + 3.4,
                    ax = side * 6.65,
                    angle = -side * 0.27;
                const col = (index + sideIndex) % 3;
                newsstands.push({ z: az, col });
                details.box(0x354441, ax, 2.68, az, 2.78, 3.95, 0.13, 0, angle);
                for (const foot of [-0.64, 0.64]) details.box(iron, ax + foot, 0.48, az, 0.09, 0.9, 0.1);
                details.box(0xb4ac90, ax, 4.69, az + 0.09, 2.87, 0.1, 0.36, 0, angle);
                ads.shape(face, 0xffffff, ax, 2.68, az + 0.09, 2.66, 3.84, 1, 0, angle, 0, [
                    col / 3 + 0.001,
                    0.668,
                    1 / 3 - 0.002,
                    1 / 3 - 0.002
                ]);
            }
        }
        streetLamp(details, side, -5.3, index % 2 === sideIndex);
        streetLamp(details, side, -32, false);
        signs.shape(face, 0xffffff, side * 5.63, 4.13, -5.18, 2.86, 0.52, 1, 0, -side * 0.24, 0, [
            0,
            1 - (index + 1) / 10,
            1,
            1 / 10
        ]);
        if (index % 2 === sideIndex) {
            signs.shape(face, 0xffffff, side * 6.24, 2.79, -28, 2.95, 0.59, 1, 0, -side * 0.18, 0, [
                0,
                1 - (6 + (index % 3)) / 10,
                1,
                1 / 10
            ]);
            details.box(iron, side * 6.24, 1.36, -28.04, 0.055, 2.72, 0.07);
        }
        // Newspaper boxes, fire hydrants and bins sit outside the playable lanes.
        const hx = side * 5.67,
            hz = -18.8 - index * 0.3;
        details.shape(pole, 0x9e4a3c, hx, 0.47, hz, 0.16, 0.76, 0.16);
        details.oval(0xad5141, hx, 0.84, hz, 0.183, 0.16, 0.183);
        details.box(0x983f32, hx, 0.56, hz, 0.49, 0.15, 0.18);
        const tz = -14 - ((index * 7 + sideIndex * 9) % 18),
            tx = side * 5.94;
        details.box(0x4c5045, tx, 0.141, tz + 0.1, 1.1, 0.026, 1.15);
        const th = 5.3 + ((index + sideIndex) % 3) * 0.55;
        trees.shape(face, 0xffffff, tx, 0.17 + th * 0.5, tz, th * 0.89, th, 1, 0, side * 0.27);
        details.box(0x42616b, side * 6.14, 0.59, -35.8, 0.72, 1.12, 0.58);
        details.box(0xc4bba4, side * 6.14, 0.77, -35.49, 0.5, 0.46, 0.04);
        signs.shape(face, 0xffffff, side * 6.14, 0.94, -35.457, 0.58, 0.15, 1, 0, 0, 0, [0, 0.1, 1, 0.1]);
        details.box(0x555b58, side * 6.14, 0.715, -35.457, 0.41, 0.022, 0.01);
        details.box(0x555b58, side * 6.14, 0.67, -35.457, 0.41, 0.022, 0.01);
        if (index === 1 && side === 1) {
            details.box(0x3f4644, 6.9, 0.135, -25.1, 1.8, 0.03, 3.96);
            for (const x of [5.96, 7.84])
                for (const z of [-23.14, -27.06]) {
                    details.shape(pole, 0x345849, x, 0.79, z, 0.082, 1.42, 0.082);
                    details.oval(0xe6dfb9, x, 1.55, z, 0.164, 0.19, 0.164);
                    details.oval(0x568770, x, 1.64, z, 0.167, 0.118, 0.168);
                }
            for (const x of [5.96, 7.84]) {
                details.box(0x345849, x, 1.1, -25.1, 0.1, 0.09, 4);
                for (let j = 0; j < 9; j++)
                    details.box(0x345849, x, 0.65, -23.3 - j * 0.44, 0.04, 0.91, 0.04);
            }
            signs.shape(face, 0xffffff, 6.9, 1.1, -23.08, 1.91, 0.42, 1, 0, 0, 0, [0, 0, 1, 0.1]);
        }
        if ((index + sideIndex) % 3 === 1) {
            const resident = pedestrian(cast, index + sideIndex);
            resident.position.set(side * 6.76, 0.15, -10 - index * 2.7);
            resident.rotation.y = side * (0.8 + index * 0.16);
            resident.scale.setScalar(1.01 + sideIndex * 0.08);
            // The sign holders on the course use the same geometry as the people waiting at the curb.
            resident.userData.streetResident = true;
            group.add(resident);
        }
        details.shape(pole, 0x445951, side * 6.15, 0.47, -8.2, 0.31, 0.86, 0.31);
        details.shape(pole, 0x343d39, side * 6.15, 0.907, -8.2, 0.27, 0.03, 0.27);
    }
    // Riveted elevated railway at the cross street, with daylight between its girders.
    if (index === 2 || index === 4) {
        train = subwayTrain(mats.details);
        group.add(train);
        for (const z of [-2.2, -0.32]) {
            details.box(0x365350, 0, 6.23, z, 35, 0.59, 0.18);
            details.box(0x59716a, 0, 6.55, z, 35, 0.095, 0.26);
            for (let x = -12; x <= 12; x += 1) details.box(0x73877b, x, 6.24, z + 0.12, 0.06, 0.46, 0.045);
        }
        for (let x = -14; x < 15; x += 0.87) details.box(0x575c50, x, 6.61, -1.26, 0.21, 0.17, 2.6);
        for (const s of [-1, 1]) {
            details.box(0x365350, s * 5.85, 3.04, -1.3, 0.25, 6.08, 0.55);
            details.box(0x51695e, s * 5.4, 5.58, -1.3, 0.19, 1.5, 0.34, 0, 0, -s * 0.73);
        }
    }
    const greenery = trees.mesh(mats.trees);
    greenery.castShadow = true;
    const furniture = details.mesh(mats.details);
    furniture.receiveShadow = true;
    group.add(paving.mesh(mats.paving), furniture, walls.mesh(mats.walls), signs.mesh(mats.signs), greenery);
    const posters = ads.mesh(mats.ads);
    const fronts = districtWalls.mesh(mats.district);
    group.add(posters, fronts);
    return {
        group,
        train,
        posters,
        newsstands,
        fronts,
        posterEra: 0,
        residents: group.children.filter((c) => c.userData.streetResident)
    };
}

export class World {
    constructor(scene, cast, light) {
        this.light = light;
        const paving = artTexture('pavement');
        paving.wrapS = paving.wrapT = THREE.RepeatWrapping;
        paving.repeat.set(4, 20);
        const road = artTexture('asphalt');
        road.anisotropy = 8;
        const mats = {
            walls: new THREE.MeshLambertMaterial({ map: artTexture('facades'), vertexColors: true }),
            district: new THREE.MeshLambertMaterial({ map: artTexture('districts'), vertexColors: true }),
            paving: new THREE.MeshLambertMaterial({ map: paving }),
            road: light.roadMaterial(road),
            ads: new THREE.MeshBasicMaterial({ map: artTexture('posters') }),
            trees: new THREE.MeshBasicMaterial({
                map: artTexture('locust'),
                alphaTest: 0.4,
                side: THREE.DoubleSide
            }),
            signs: signAtlas(),
            details: new THREE.MeshLambertMaterial({ vertexColors: true })
        };
        this.blocks = Array.from({ length: BLOCKS }, (_, i) => block(i, mats, cast));
        this.blocks.forEach((b) => scene.add(b.group));
        this.landmarks = new Landmarks(scene, mats.details);
        const skyline = new THREE.Mesh(new THREE.PlaneGeometry(350, 154), light.skyMaterial());
        skyline.position.set(-8, 56, -225);
        scene.add(skyline);
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(520, 330),
            new THREE.MeshLambertMaterial({ color: 0xa89b8e })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, -0.09, -124);
        scene.add(ground);
        this.reset();
    }

    get district() {
        return districts[districtAt(this.distance)];
    }

    reset() {
        this.speed = 17.5;
        this.distance = 0;
        this.trainTime = 0;
        this.landmarks.update(0);
        this.light.update(0);
        this.blocks.forEach((b, i) => {
            b.group.position.z = 15 - i * LENGTH;
            if (b.train) b.train.position.x = i === 2 ? -11 : 20;
            b.group.visible = b.group.position.z > -165;
            this.setPosters(b, 0);
        });
    }

    setPosters(b, era) {
        if (era === b.posterEra) return;
        const shift = (b.posterEra - era) / 3,
            uv = b.posters.geometry.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + shift);
        uv.needsUpdate = true;
        const facadeUV = b.fronts.geometry.attributes.uv;
        for (let i = 0; i < facadeUV.count; i++) facadeUV.setX(i, facadeUV.getX(i) - shift);
        facadeUV.needsUpdate = true;
        b.posterEra = era;
    }

    approachingPoster() {
        let nearest = -Infinity;
        let index = -1;
        for (const block of this.blocks) {
            for (const stand of block.newsstands) {
                const z = block.group.position.z + stand.z;
                if (z > -38 && z < -9 && z > nearest) {
                    nearest = z;
                    index = block.posterEra * 3 + stand.col;
                }
            }
        }
        return index;
    }

    update(dt) {
        this.speed = Math.min(37, this.speed + 0.72 * dt);
        const step = this.speed * dt;
        this.distance += step;
        this.landmarks.update(this.distance);
        this.light.update(this.distance);
        this.trainTime += dt * 7;
        for (const b of this.blocks) {
            b.group.position.z += step;
            if (b.group.position.z >= LENGTH + 15) {
                b.group.position.z -= LENGTH * BLOCKS;
                this.setPosters(b, districtAt(this.distance - b.group.position.z + LENGTH / 2));
            }
            b.group.visible = b.group.position.z > -165;
            if (b.train) b.train.position.x = ((this.trainTime + (b === this.blocks[2] ? 20 : 52)) % 70) - 35;
            for (const person of b.residents) person.visible = b.group.position.z + person.position.z > -45;
        }
    }
}
