import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Scene } from 'three';
import { BusRide, busSeconds } from '../game/BusRide.js';
import { cityBusModel } from '../game/CityBusArt.js';
import { ScoreManager } from '../game/ScoreManager.js';
import { ObstacleManager } from '../game/ObstacleManager.js';
import { PowerupManager } from '../game/PowerupManager.js';
import { civicModels } from '../game/CivicEncounters.js';

function fixture() {
    const model = cityBusModel(), scene = new Scene();
    const ride = new BusRide(scene,model);
    const player = {mesh:new Group(),shadow:new Group(),currentLane:1,bank:0,slideTimer:0,
        kafiyehTimer:3,rainbowTimer:4,covidMaskTimer:1,iceTimer:1};
    const traffic = {obstacles:[],remove(i) { this.obstacles.splice(i,1); }};
    function add(type,x,z,previousZ=z) {
        const obj = {type, previousZ, mesh:new Group()};
        obj.mesh.position.set(x,0,z);
        traffic.obstacles.push(obj);
        return obj;
    }
    ride.board(player);
    return {ride,traffic,player,add};
}

test('the full-size bus and collectible share their body, and boarding preserves timed wearables', () => {
    const powers = new PowerupManager(new Scene());
    assert.equal(powers.models.fastFreeBus.children[0].geometry,powers.busModel.geometry);
    const {ride,player} = fixture();
    assert.equal(player.fastFreeBusTimer,busSeconds);
    assert.equal(player.iceTimer,0);
    assert.equal(player.mesh.visible,false);
    assert.equal(player.shadow.visible,false);
    assert.equal(ride.model.visible,true);
    assert.deepEqual([player.kafiyehTimer,player.rainbowTimer,player.covidMaskTimer],[3,4,1]);
    player.fastFreeBusTimer = 6;
    ride.board(player);
    assert.equal(player.fastFreeBusTimer,6);
    ride.reset(player);
    assert.equal(player.mesh.visible && player.shadow.visible,true);
    assert.equal(ride.model.visible || ride.fragments.visible,false);
    assert.equal(player.fastFreeBusTimer,0);
});

test('the actual swept path pays at most three gross stamps, once per work gate, without scoring distance', () => {
    for (const hz of [20,60,120]) {
        const {ride,player,traffic,add} = fixture();
        const score = new ScoreManager();
        score.addFoodStamps(98);
        score.score=42200;
        const shared = {};
        for(const type of ['taxi','deliveryDolly','signalBoom','jumpGate','railGate','scaffold']) {
            add(type,0,-6-94/hz).gate = type==='jumpGate' || type==='railGate' ? shared : null;
        }
        const otherLane = add('gateBlock',3,-6-94/hz);
        for (let step=0;step<Math.ceil(hz*.24);step++) {
            for (const obj of traffic.obstacles) {
                obj.previousZ=obj.mesh.position.z;
                obj.mesh.position.z += 94/hz;
            }
            score.addFoodStamps(ride.drive(1/hz,traffic,player,94,false));
        }
        assert.deepEqual(traffic.obstacles,[otherLane]);
        assert.equal(score.grossStamps,101);
        assert.equal(score.foodStamps,11);
        assert.equal(score.score,42200);
        assert.equal(ride.drive(1/hz,traffic,player,94,false),0);
    }
    const {ride,player,traffic,add} = fixture();
    const gate = {};
    add('slideGate',0,-3).gate=gate;
    add('gateBlock',1.6,-3).gate=gate;
    assert.equal(ride.drive(1/60,traffic,player,62,true),1);
    assert.equal(ride.fragments.visible,false);
});

test('steering across a closed panel only counts while the bumper is alongside it', () => {
    for (const [endX,panelX,z,expected] of [[3,.38,5,1],[3,-1.78,5,0],[-3,-.38,5,1],[-3,1.78,5,0]]) {
        const {ride,player,traffic,add} = fixture();
        add('taxi',panelX,z,-6);
        player.mesh.position.x=endX;
        assert.equal(ride.drive(1/15,traffic,player,92,true),expected);
    }
});

test('people, road paint, bottles and ice are safe and unpaid; boarding and leaving keep stamps collectible', () => {
    const {ride,player,traffic,add} = fixture();
    const protest=add('protestor',0,-32),horse=add('horseCarriage',0,-32);
    for (const type of ['coin','cue','alcohol','rentIce']) add(type,0,-.1);
    assert.equal(ride.drive(1/30,traffic,player,65,true),0);
    assert.ok(protest.mesh.position.x<0 && horse.mesh.position.x<0);
    const fore = {obstacles:traffic.obstacles.slice(2),remove:traffic.remove};
    fore.obstacles[0].height=1.02;
    fore.obstacles[0].mesh.position.y=1.02;
    assert.equal(ObstacleManager.prototype.checkCollisions.call(fore,player,true),'coin');
    const close=add('gateBlock',0,-34),far=add('gateBlock',0,-75),adjacent=add('gateBlock',3,-20);
    ride.leave(traffic,player,65);
    assert.equal(traffic.obstacles.includes(close),false);
    assert.ok(traffic.obstacles.includes(far) && traffic.obstacles.includes(adjacent));
    assert.equal(player.mesh.visible,true);
    assert.equal(ride.earned,0);
});

test('the carriage moves aside while its road paint stays put; broken tape leaves the sidewalk march in place', () => {
    const {ride,player} = fixture();
    const traffic = Object.assign(Object.create(ObstacleManager.prototype),{scene:new Scene(),
        models:civicModels(),pool:{horseCarriage:[],policeTape:[]},obstacles:[]});
    const horse = traffic.add('horseCarriage',0,-12,'route',1,{approachSpeed:60});
    const tape = traffic.add('policeTape',0,-3,'route',1,{approachSpeed:60});
    for (let i=0;i<36;i++) {
        assert.equal(ride.drive(1/60,traffic,player,60,true), i ? 0 : 1);
    }
    assert.ok(horse.mesh.position.x < -4);
    assert.equal(horse.mesh.position.x + horse.stencil.position.x,0);
    assert.equal(tape.march.visible,true);
    assert.equal(tape.mesh.children.some(part => part !== tape.march && part.visible),false);
    assert.ok(traffic.obstacles.includes(horse) && traffic.obstacles.includes(tape));
    traffic.clear();
    assert.equal(traffic.add('policeTape',3,-70,'route',1,{approachSpeed:60}),tape);
    assert.equal(tape.mesh.children.every(part => part.visible),true);
    assert.equal(traffic.add('horseCarriage',3,-70,'route',1,{approachSpeed:60}),horse);
    assert.equal(horse.stencil.position.x,0);
});
