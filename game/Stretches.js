// Each stretch owns a street vocabulary. Alternatives inside a beat are drawn every
// time, so a returning theme keeps its character without repeating its road.
export const stretchThemes = [
    {
        id: 'protest', name: 'Protest March',
        lines: ['Every block has a new chant.', 'The march brought a march.', 'Four megaphones. One permit.'],
        pairs: [['protest', 'protest'], ['protest', 'protest'], ['protest', 'taxi'], ['protest', 'halal']],
        blockers: ['protest'], bonus: ['halal', 'taxi'], movers: ['dolly', 'boom'],
        jump: [null], slide: [null, 'halal'], wall: 'marchBarrier',
        motifs: [
            { level: 1, beats: ['tape'] },
            { level: 1, beats: ['tape', 'placard'] },
            { level: 1, beats: ['placard', 'open'] },
            { level: 1, beats: ['open', 'tape|placard'] },
            { level: 2, beats: ['tape', 'tape', 'placard'] },
            { level: 2, beats: ['placard', 'tape', 'fork'] },
            { level: 2, beats: ['choice', 'tape', 'weave'] },
            { level: 3, beats: ['tape', 'placard', 'tape', 'placard'] },
            { level: 3, beats: ['weave', 'weave', 'tape', 'dolly'] },
            { level: 4, beats: ['placard', 'tape', 'boom', 'tape', 'placard'] }
        ]
    },
    {
        id: 'construction', name: 'Construction Season',
        lines: ['It began in 1987. It ends in 1987.', 'Two lanes closed. One undecided.', 'The scaffold is now a landmark.'],
        pairs: [['scaffold', 'scaffold'], ['scaffold', 'taxi'], ['scaffold', 'trashPile']],
        blockers: ['scaffold'], bonus: ['scaffold'], movers: ['boom', 'boom', 'dolly'],
        jump: [null], slide: ['scaffold', 'scaffold', null],
        motifs: [
            { level: 1, beats: ['boom'] },
            { level: 1, beats: ['slide', 'jump'] },
            { level: 1, beats: ['rail', 'slide'] },
            { level: 1, beats: ['slideAll', 'jump|rail'] },
            { level: 2, beats: ['boom', 'slide', 'rail'] },
            { level: 2, beats: ['dolly', 'slideAll', 'jump'] },
            { level: 3, beats: ['boom', 'jump|rail', 'split'] },
            { level: 3, beats: ['slide', 'rail', 'slide', 'boom'] },
            { level: 4, beats: ['split', 'slide', 'dolly', 'rail', 'slideAll'] }
        ]
    },
    {
        id: 'rush', name: 'Rush Hour',
        lines: ['The fastest cab is parked.', 'Congestion pricing: noticed.', 'Every lane is the slow lane.'],
        pairs: [['taxi', 'taxi'], ['taxi', 'taxi'], ['taxi', 'trashPile'], ['taxi', 'protest']],
        blockers: ['taxi'], bonus: ['taxi'], movers: ['dolly', 'horse'],
        jump: ['taxi'], slide: ['scaffold', null],
        motifs: [
            { level: 1, beats: ['fork'] },
            { level: 1, beats: ['weave', 'weave'] },
            { level: 1, beats: ['jump', 'open'] },
            { level: 1, beats: ['jumpAll'] },
            { level: 2, beats: ['weave', 'jumpAll', 'fork'] },
            { level: 2, beats: ['choice', 'weave', 'jump'] },
            { level: 3, beats: ['weave', 'weave', 'weave', 'jumpAll'] },
            { level: 3, beats: ['jumpAll', 'slide', 'jump', 'fork'] },
            { level: 4, beats: ['weave', 'jump', 'slide', 'weave', 'jumpAll'] }
        ]
    },
    {
        id: 'fair', name: 'Street Fair',
        lines: ['Twelve carts. One recipe.', 'Tube socks, a food group.', 'Free samples. Paid barricades.'],
        pairs: [['halal', 'halal'], ['halal', 'fairBanner'], ['halal', 'protest'], ['fairBanner', 'trashPile']],
        blockers: ['halal', 'fairBanner'], bonus: ['halal', 'fairBanner', 'trashPile'], movers: ['dolly', 'dolly', 'boom'],
        jump: ['trashPile', null], slide: ['fairBanner', 'fairBanner', 'halal'],
        motifs: [
            { level: 1, beats: ['slide', 'slide'] },
            { level: 1, beats: ['dolly'] },
            { level: 1, beats: ['slideAll', 'fork'] },
            { level: 1, beats: ['slide', 'jump'] },
            { level: 2, beats: ['dolly', 'slide', 'jump'] },
            { level: 2, beats: ['slideAll', 'choice', 'slide'] },
            { level: 3, beats: ['dolly', 'slideAll', 'dolly'] },
            { level: 3, beats: ['slide', 'jump', 'slide', 'fork'] },
            { level: 4, beats: ['dolly', 'slide', 'jump', 'slideAll', 'dolly'] }
        ]
    },
    {
        id: 'carriage', name: 'Carriage Row',
        lines: ['Nobody told the horses.', 'Horsepower, original edition.', 'One horse learned to merge.'],
        pairs: [['taxi', 'protest'], ['trashPile', 'taxi'], ['protest', 'trashPile']],
        blockers: ['trashPile', 'protest'], bonus: ['trashPile', 'taxi'], movers: ['horse', 'swerve'],
        jump: ['trashPile', null], slide: [null],
        motifs: [
            { level: 1, beats: ['horse'] },
            { level: 1, beats: ['horse', 'jump|slide'] },
            { level: 1, beats: ['open', 'horse'] },
            { level: 2, beats: ['swerve', 'slide|rail'] },
            { level: 2, beats: ['horse', 'slide', 'horse'] },
            { level: 3, beats: ['team', 'jump'] },
            { level: 3, beats: ['swerve', 'jump|slide', 'horse'] },
            { level: 4, beats: ['team', 'slide', 'swerve', 'jump'] },
            { level: 4, beats: ['swerve', 'team', 'rail'] }
        ]
    },
    {
        id: 'freeze', name: 'Rent Freeze',
        lines: ['The rent is frozen. So is the road.', 'Landlords see a slippery slope.', 'Rent-stabilized. Runner not.'],
        pairs: [['protest', 'scaffold'], ['scaffold', 'taxi'], ['trashPile', 'protest']],
        blockers: ['scaffold', 'protest'], bonus: ['taxi', 'scaffold'], movers: ['boom', 'dolly'],
        jump: [null, 'trashPile'], slide: [null, 'scaffold'],
        motifs: [
            { level: 1, beats: ['ice'] },
            { level: 1, beats: ['ice', 'jump|slide'] },
            { level: 1, beats: ['slide', 'ice'] },
            { level: 2, beats: ['blackIce', 'rail|jump', 'slide'] },
            { level: 2, beats: ['ice', 'slide', 'jump'] },
            { level: 3, beats: ['blackIce', 'choice', 'slide', 'jump'] },
            { level: 3, beats: ['jump', 'slide', 'blackIce'] },
            { level: 4, beats: ['blackIce', 'slide', 'rail', 'slide', 'blackIce'] }
        ]
    },
    {
        id: 'trash', name: 'Collection Day',
        lines: ['Bins announced. Bags delivered.', 'The rats filed for overtime.', 'The pile has its own zip code.'],
        pairs: [['trashPile', 'trashPile'], ['trashPile', 'taxi'], ['trashPile', 'halal']],
        blockers: ['trashPile'], bonus: ['trashPile'], movers: ['dolly', 'boom'],
        jump: ['trashPile'], slide: [null, 'scaffold'],
        motifs: [
            { level: 1, beats: ['jump'] },
            { level: 1, beats: ['jumpAll', 'slide'] },
            { level: 1, beats: ['fork', 'jump'] },
            { level: 1, beats: ['weave', 'jump|rail'] },
            { level: 2, beats: ['jump', 'slide', 'jumpAll'] },
            { level: 2, beats: ['dolly', 'jump', 'slide'] },
            { level: 3, beats: ['weave', 'weave', 'jumpAll', 'slide'] },
            { level: 3, beats: ['jumpAll', 'choice', 'slide', 'boom'] },
            { level: 4, beats: ['dolly', 'jumpAll', 'slide', 'weave', 'jump'] }
        ]
    }
];

// The road between stretches mixes the whole city's furniture.
export const plainStreet = {
    pairs: [
        ['taxi', 'scaffold'], ['protest', 'halal'], ['taxi', 'protest'],
        ['halal', 'taxi'], ['scaffold', 'protest'], ['scaffold', 'halal']
    ],
    blockers: ['taxi', 'halal', 'scaffold', 'protest'], bonus: ['taxi', 'halal', 'scaffold'], movers: ['dolly', 'boom'],
    jump: [null], slide: [null], motifs: []
};

export function stretchLine({ id, level }) {
    const { lines } = stretchThemes.find(theme => theme.id === id);
    return lines[(level - 1) % lines.length];
}
