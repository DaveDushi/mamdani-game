import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Group, Scene } from 'three';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { encounterModels, boomLow, boomHigh, boomThickness, mastX } from '../game/StreetEncounterArt.js';

const models = encounterModels();
function street(reducedMotion = false) {
    return Object.assign(Object.create(ObstacleManager.prototype), { models, reducedMotion, scene: new Scene(),
        pool: { deliveryDolly: [], signalBoom: [] }, obstacles: [], nextRow: { distance: Infinity } });
}
function runner(x, y = 0, duck = false) {
    const mesh = new Group();
    mesh.position.set(x,y,0);
    return { mesh, slideTimer: duck ? .4 : 0, invincible: false };
}
function load(street, key, speed, z, high = false) {
    const info = key === 'deliveryDolly' ? { id:'delivery-dolly', fromLane:0, toLane:1, approachSpeed:speed }
        : { id:'signal-boom', lane:1, position:high?'high':'low', approachSpeed:speed };
    return street.add(key,0,z,'route',1.02,info);
}

test('the load rolls into its painted bay and the working boom locks before contact', () => {
    for (const speed of [25, 80, 102]) {
        for (const reduced of [false, true]) {
            const s = street(reduced);
            const dolly = load(s,'deliveryDolly',speed,-1.55*speed);
            const bar = load(s,'signalBoom',speed,-1.55*speed,true);
            assert.equal(dolly.mesh.position.x,-3);
            assert.ok(bar.boom.rotation.z > .60);
            s.update(.50,speed,.50*speed);
            assert.ok(dolly.mesh.position.x > -3 && dolly.mesh.position.x < -2);
            assert.equal(dolly.bay.position.x + dolly.mesh.position.x,0);
            assert.equal(dolly.nearCaster.rotation.z === 0,reduced);
            assert.equal(bar.boom.rotation.z,0);
            s.update(.35,speed,.85*speed);
            const bounds = new Box3().setFromObject(bar.boom);
            assert.ok(Math.abs(bounds.min.y-boomHigh)<.011);
            assert.ok(Math.abs(bounds.max.y-(boomHigh+boomThickness))<.011);
            const locked = bar.boom.position.y;
            s.update(.70,speed,1.55*speed);
            assert.equal(bar.boom.position.y,locked);
            assert.ok(dolly.mesh.position.x > -.25 && dolly.mesh.position.x < 0);
        }
    }
});

test('swept dolly contact uses the runner position alongside the load', () => {
    for (const speed of [25, 80, 102]) {
        const s = street();
        load(s,'deliveryDolly',speed,-3);
        const p = runner(1.7);
        assert.equal(s.checkCollisions(p),null);
        s.update(6/speed,speed,6);
        p.mesh.position.x = -2.4; // Both endpoints miss. The runner crosses through the cart.
        assert.equal(s.checkCollisions(p),'deliveryDolly');

        const after = street();
        load(after,'deliveryDolly',speed,-3);
        const late = runner(3);
        assert.equal(after.checkCollisions(late),null);
        after.update(6/speed,speed,6);
        late.mesh.position.x = .50; // Enters the destination lane only after the cart passes.
        assert.equal(after.checkCollisions(late),null);
    }
});

test('low and high settings give the advertised clears; the mast and dolly stay solid', () => {
    for (const hz of [20,60,120]) {
        for (const speed of [23,80,102]) {
            for (const [key,high,x,y,duck,hit,stunt] of [
                ['deliveryDolly',false,0,0,false,'deliveryDolly'], ['deliveryDolly',false,0,1.64,false,'deliveryDolly'],
                ['deliveryDolly',false,-3,0,false,null], ['deliveryDolly',false,3,0,false,null],
                ['signalBoom',false,0,0,true,'signalBoom'], ['signalBoom',false,0,1.1,false,null,'jump'],
                ['signalBoom',true,0,0,false,'signalBoom'], ['signalBoom',true,0,0,true,null,'slide'],
                ['signalBoom',true,0,1.64,false,'signalBoom'], ['signalBoom',true,mastX,0,true,'signalBoom'],
                ['signalBoom',false,mastX,1.4,false,'signalBoom'], ['signalBoom',true,3,0,false,null]
            ]) {
                const s = street(), p = runner(x,y,duck);
                load(s,key,speed,-speed*.5,high);
                const awards = [];
                let contact = null;
                for (let tick=1;tick<Math.ceil(hz*.65);tick++) {
                    s.update(1/hz,speed,tick*speed/hz);
                    contact = s.checkCollisions(p);
                    if (s.lastStunt) awards.push(s.lastStunt);
                    if (contact) break;
                }
                assert.equal(contact,hit, [key,high,x,y,duck,speed,hz].join(' '));
                assert.deepEqual(awards,stunt?[stunt]:[]);
            }
        }
    }
});

test('a recycled cart or boom starts from the new lane, position, and warning phase', () => {
    const s=street();
    const a=load(s,'deliveryDolly',80,0);
    const b=load(s,'signalBoom',80,0,true);
    a.stunt='sidestep';b.passed=true;
    s.clear();
    assert.equal(s.add('deliveryDolly',3,-160,'route',1,{fromLane:1,toLane:2,approachSpeed:80}),a);
    assert.equal(a.mesh.position.x,0);
    assert.equal(a.bay.position.x,3);
    assert.ok(Math.abs(a.farCaster.rotation.z)===0);
    assert.equal(a.stunt,null);
    assert.equal(s.add('signalBoom',3,-160,'route',1,{lane:2,position:'low',approachSpeed:80}),b);
    assert.equal(b.bottom,boomLow);
    assert.ok(b.boom.rotation.z>.6);
    assert.equal(b.passed,false);
});
