import * as THREE from 'three';
import { artTexture } from './Geometry.js';
import { DISTRICT_LENGTH, districtAt } from './Landmarks.js';

const looks = [
    {
        sky: 0xc3c3bd,
        fog: 0xf0cfaa,
        skyLight: 0xffe7ca,
        ground: 0xc2b8ae,
        sun: 0xffddb0,
        fill: 0xd4e7ff,
        hemi: 1.4,
        key: 2.05,
        haze: 0.0105,
        night: 0,
        wet: 0.3
    },
    {
        sky: 0x53577b,
        fog: 0x908798,
        skyLight: 0xd9dcff,
        ground: 0x957f80,
        sun: 0xffc49a,
        fill: 0xbacfff,
        hemi: 0.94,
        key: 1.12,
        haze: 0.0108,
        night: 1,
        wet: 0.72
    },
    {
        sky: 0xc4ced0,
        fog: 0xcdd6d6,
        skyLight: 0xf2f7ff,
        ground: 0xbcbbb3,
        sun: 0xffe7c6,
        fill: 0xd0e6f4,
        hemi: 1.49,
        key: 1.65,
        haze: 0.0102,
        night: 0.04,
        wet: 0.94
    }
];
for (const look of looks)
    for (const field of ['sky', 'fog', 'skyLight', 'ground', 'sun', 'fill'])
        look[field] = new THREE.Color(look[field]);

const takeoverSky = new THREE.Color(0x50616d);
const takeoverFog = new THREE.Color(0x657782);
const takeoverSun = new THREE.Color(0xd8dfe1);
const takeoverHemi = new THREE.Color(0xd3e0e9);
const takeoverGround = new THREE.Color(0x919caa);
const skyGrade = `
uniform float takeover;
vec3 gradeSky(vec3 sky) {
    float luminance = dot(sky, vec3(.2126, .7152, .0722));
    vec3 overcast = vec3(.012, .021, .030) + luminance * vec3(.13, .17, .20);
    return mix(sky, overcast, takeover);
}`;

export class StreetLight {
    constructor(scene, hemi, sun, fill) {
        this.scene = scene;
        this.hemi = hemi;
        this.sun = sun;
        this.fill = fill;
        this.night = { value: 0 };
        this.wet = { value: 0 };
        this.takeover = { value: 0 };
        this.daySky = artTexture('skyline');
        this.lateSky = artTexture('blue-hour');
        this.lastFrom = -1;
        this.lastMix = -1;
    }

    skyMaterial() {
        const m = new THREE.MeshBasicMaterial({ map: this.daySky, fog: false });
        m.onBeforeCompile = (shader) => {
            shader.uniforms.lateSky = { value: this.lateSky };
            shader.uniforms.nightMix = this.night;
            shader.uniforms.takeover = this.takeover;
            shader.fragmentShader =
                'uniform sampler2D lateSky;\nuniform float nightMix;\n' + skyGrade + '\n' +
                shader.fragmentShader.replace(
                    '#include <map_fragment>',
                    'diffuseColor.rgb *= gradeSky(mix(texture2D(map, vMapUv).rgb, texture2D(lateSky, vMapUv).rgb, nightMix));'
                );
        };
        return m;
    }

    roadMaterial(pavement) {
        const m = new THREE.MeshLambertMaterial({ map: pavement });
        // Shallow curbside puddles pick up the same sky as the horizon in the road's existing draw.
        m.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, {
                clearSky: { value: this.daySky },
                lateSky: { value: this.lateSky },
                nightMix: this.night,
                takeover: this.takeover,
                wet: this.wet
            });
            shader.vertexShader =
                'varying vec3 roadWorld;\n' +
                shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    '#include <begin_vertex>\nroadWorld = (modelMatrix * vec4(position, 1.0)).xyz;'
                );
            shader.fragmentShader =
                'varying vec3 roadWorld;\nuniform sampler2D clearSky, lateSky;\nuniform float wet, nightMix;\n' + skyGrade + '\n' +
                shader.fragmentShader.replace(
                    '#include <opaque_fragment>',
                    `
                vec2 uv = vMapUv;
                float irregular = sin(uv.y * 30.0 + 2.7 * sin(uv.y*17.0) + uv.x*4.9);
                float bank = abs(uv.x - .5) * 2.0;
                float pool = smoothstep(.61, .72, bank + .18*irregular + .028*sin(uv.y*94.0));
                pool *= smoothstep(.02,.08,uv.y) * (1.0-smoothstep(.96,1.0,bank));
                vec3 ray = normalize(roadWorld-cameraPosition);
                vec2 reflected = vec2(.51 + ray.x*.46 + .003*sin(uv.y*340.0), clamp(.11 - ray.y*.86, .035,.93));
                vec3 sky = mix(texture2D(clearSky,reflected).rgb, texture2D(lateSky,reflected).rgb, nightMix);
                float fresnel = pow(1.0-clamp(-ray.y,0.0,1.0),2.0);
                outgoingLight = mix(outgoingLight,gradeSky(sky),pool*wet*(.18+.46*fresnel));
                #include <opaque_fragment>`
                );
        };
        return m;
    }

    setShift(mode) {
        this.afterHours = mode === 'night';
        this.lastFrom = -1;
    }

    setTakeover(amount) {
        this.takeover.value = amount;
        this.lastFrom = -1;
    }

    lampMaterial() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const falloff = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        falloff.addColorStop(0, '#fff');
        falloff.addColorStop(0.18, 'rgba(255,255,255,.54)');
        falloff.addColorStop(0.55, 'rgba(255,255,255,.14)');
        falloff.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = falloff;
        ctx.fillRect(0, 0, 64, 64);
        this.lamps = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(canvas),
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            toneMapped: false
        });
        return this.lamps;
    }

    update(distance) {
        const from = this.afterHours ? 1 : districtAt(distance),
            to = (from + 1) % looks.length;
        const edge = distance % DISTRICT_LENGTH;
        const amount = this.afterHours ? 0 : THREE.MathUtils.smoothstep(edge, DISTRICT_LENGTH - 55, DISTRICT_LENGTH);
        if (this.lastFrom === from && Math.abs(this.lastMix - amount) < 0.003) return;
        this.lastFrom = from;
        this.lastMix = amount;
        const a = looks[from],
            b = looks[to],
            blend = (k) => THREE.MathUtils.lerp(a[k], b[k], amount);
        this.scene.background.lerpColors(a.sky, b.sky, amount);
        this.scene.fog.color.lerpColors(a.fog, b.fog, amount);
        this.hemi.color.lerpColors(a.skyLight, b.skyLight, amount);
        this.hemi.groundColor.lerpColors(a.ground, b.ground, amount);
        this.sun.color.lerpColors(a.sun, b.sun, amount);
        this.fill.color.lerpColors(a.fill, b.fill, amount);
        this.sun.intensity = blend('key');
        this.hemi.intensity = blend('hemi');
        this.scene.fog.density = blend('haze');
        this.night.value = blend('night');
        this.wet.value = blend('wet');
        if (this.afterHours) {
            this.scene.fog.color.setHex(0x7e8298);
            this.sun.color.setHex(0xffc396);
            this.fill.color.setHex(0xc4d8ff);
            this.fill.intensity = 1.0;
            this.wet.value = 1;
        } else {
            this.fill.intensity = 0.74;
        }
        const t = this.takeover.value;
        if (t) {
            this.scene.background.lerp(takeoverSky, t * 0.95);
            this.scene.fog.color.lerp(takeoverFog, t * 0.94);
            this.scene.fog.density += t * 0.0015;
            this.hemi.color.lerp(takeoverHemi, t * 0.87);
            this.hemi.groundColor.lerp(takeoverGround, t * 0.88);
            this.sun.color.lerp(takeoverSun, t * 0.92);
            this.sun.intensity *= 1 - t * 0.29;
            this.hemi.intensity *= 1 - t * 0.10;
            this.night.value = Math.max(this.night.value, t * 0.27);
        }
        this.lamps.visible = this.night.value > 0.14;
        this.lamps.opacity = this.night.value * 0.66;
    }
}
