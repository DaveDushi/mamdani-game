export const editionLines = {
    'Canal Street': 'City Hall calls this a listening tour. The mayor is doing 30.',
    'Union Square': 'Two rival marches book the same megaphone.',
    'City Hall': 'Budget hearing underway. Treasurer passes around a hat.'
};

export const raceDispatches = {
    junior: 'Don Jr. inherits lane two. City Hall files an objection.',
    ivanka: 'Ivanka has trademarked the finish line. Crossing it is still free.',
    eric: 'Eric brings a golf cart. Officials make him run.',
    tiffany: 'Tiffany reads the fine print. The mayor has been running for office hours.',
    barron: 'Barron asks for a longer track. The budget office offers a shorter ruler.',
    donald: 'Donald promises the biggest finish in history. It is still 100 metres.'
};

const receipts = {
    jumpGate: [
        ['Red tape stops mayor in his tracks.', 'City Hall spent the ribbon-cutting budget on the ribbon.'],
        ['Mayor fails to clear a low bar.', 'The appointments committee has already voted to lower it.']
    ],
    slideGate: [
        ['Mayor hits the spending cap.', 'The comptroller says this is the first time anyone at City Hall has noticed it.'],
        ['City raises rent. Forgets to raise beam.', 'Aides described the clearance as affordable.']
    ],
    gateBlock: [
        ['City opens lane for future use.', 'The concrete is temporary. The committee that approved it is permanent.'],
        ['Mayor runs into his own road closure.', 'His office has asked the barricade to join the transition team.']
    ],
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
    jump: ['Mayor clears the spending cap.', 'Red tape cleared. More red tape on order.', 'Mayor gets over budget hurdle. Budget still short.'],
    cab: ['Cab fare successfully evaded.', 'Mayor takes public transit. Briefly, on the roof.', 'Yellow cab crosses picket line. Mayor crosses cab.'],
    slide: ['Budget passes under the table.', 'For once, City Hall comes in under something.', 'Mayor lowers his position on street vendors.'],
    sidestep: ['Mayor dodges a follow-up question.', 'Campaign pivots sharply on transportation.', 'Aide confirms the dodge was fully funded.']
};
