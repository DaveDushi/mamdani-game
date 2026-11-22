import assert from 'node:assert/strict';
import test from 'node:test';
import { frontPage } from '../game/CityWire.js';
import { RIVALS } from '../game/FamilyRace.js';

test('the headline follows the collision, and Overtime changes only the slug', () => {
    for (const [cause, edition, headline, copy] of [
        ['taxi', 2, 'Mayor seizes means of transportation.', 'The driver would like his door handle back.'],
        ['gateBlock', 3, 'Mayor clips the edge of a STREET CLOSED wall.', 'Trump catches him at the barricade.'],
        ['parkBarrier', 0, 'Mayor clips a barrier on the Central Park bike path.', 'The bike share clock keeps running.'],
        ['railGate', 1, 'Ticket rail beats the mayor.', 'City Hall has scheduled a ribbon-cutting for the replay.'],
        ['protestor', 3, 'March divides over who gets the microphone.', 'The breakaway faction is currently three feet to the left.']
    ]) {
        assert.deepEqual(frontPage(cause, edition), { slug: 'Stop press', headline, copy });
        assert.deepEqual(frontPage(cause, edition, { caught: true }), { slug: 'Trump returns', headline, copy });
        assert.deepEqual(frontPage(cause, edition, { overtime: true, caught: true }), { slug: 'Mamdani keeps NYC', headline, copy });
    }
});

test('every way to lose has its own headlines, and back-to-back editions differ', () => {
    const causes = [
        'taxi', 'halal', 'scaffold', 'protestor', 'jumpGate', 'slideGate', 'railGate', 'gateBlock', 'wall', 'trashPile', 'fairBanner',
        'deliveryDolly', 'signalBoom', 'horseCarriage', 'policeTape', 'fallenPlacard', 'parkBarrier',
        ...RIVALS.map(rival => 'race:' + rival.id)
    ];
    const printed = new Map();
    for (const cause of causes) {
        const { headline } = frontPage(cause, 0);
        assert.notEqual(headline, frontPage(cause, 1).headline);
        assert.equal(printed.get(headline), undefined, cause + ' shares a headline with ' + printed.get(headline));
        printed.set(headline, cause);
    }
    assert.equal(frontPage('race:junior', 0).slug, 'Race desk');
});
