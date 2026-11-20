export const editionLines = {
    'Canal Street': 'City Hall calls this a listening tour. The mayor is doing 30.',
    'Union Square': 'Two rival marches book the same megaphone.',
    'City Hall': 'Budget hearing underway. Treasurer passes around a hat.'
};

const receipts = {
    taxi: [
        [
            'Mayor freezes fare. Cab keeps moving.',
            'The meter was the only department still collecting revenue.'
        ],
        ['Cabinet reshuffle involves actual cab.', 'The driver has requested payment in actual dollars.'],
        ['Mayor seizes means of transportation.', 'The driver would like his door handle back.'],
        ['Taxi subsidy reaches one New Yorker.', 'He was last seen clinging to the hood.']
    ],
    scaffold: [
        ['Scaffold wins a second term.', 'A six-week repair enters its nineteenth year.'],
        ['Mayor meets the housing ceiling.', 'The scaffold has occupied this block longer than most tenants.'],
        ['Historic scaffolding granted landmark status.', 'The building underneath is expected to come down first.'],
        ['Rent freeze extends to construction crew.', 'They have been standing in the same spot since March.']
    ],
    halal: [
        ['Free lunch comes with a catch.', 'The cart takes cash. The mayor offered a working group.'],
        [
            'Lunch plan folds at the first cart.',
            'The vendor has declined an advisory seat in lieu of six dollars.'
        ],
        ['Free lunch pilot runs out of rice.', 'City Hall confirms the pilot still has nine deputy directors.'],
        ['City takes control of hot sauce.', 'White sauce remains in private hands pending an appeal.']
    ],
    protestor: [
        ['March to end meetings calls meeting.', 'The mayor endorsed both sides, then ran into one.'],
        ['Mayor joins march rather abruptly.', 'Organizers counted the collision as an endorsement.'],
        ['Mayor crosses his own picket line.', 'Both sides have promised him their endorsement.'],
        ['March divides over who gets the microphone.', 'The breakaway faction is currently three feet to the left.']
    ]
};

export function frontPage(cause, edition) {
    const stories = receipts[cause] || receipts.protestor;
    return stories[edition % stories.length];
}

export const stuntLines = {
    cab: ['Cab fare successfully evaded.', 'Mayor takes public transit. Briefly, on the roof.', 'Yellow cab crosses picket line. Mayor crosses cab.'],
    slide: ['Budget passes under the table.', 'For once, City Hall comes in under something.', 'Mayor lowers his position on street vendors.'],
    sidestep: ['Mayor dodges a follow-up question.', 'Campaign pivots sharply on transportation.', 'Aide confirms the dodge was fully funded.']
};
