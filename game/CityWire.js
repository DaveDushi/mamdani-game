export const editionLines = {
    'Canal Street': 'Listening tour hits 30 mph.',
    'Union Square': 'Two marches, one mic.',
    'City Hall': 'Budget vote. Pass the hat.'
};

export const raceDispatches = {
    junior: 'Don Jr. inherits lane two.',
    ivanka: 'Ivanka trademarks the finish line. Crossing is free.',
    eric: 'Eric’s golf cart fails inspection.',
    tiffany: 'Tiffany checks the rules. Running for office counts.',
    barron: 'Barron wants more track. City Hall shrinks the ruler.',
    donald: 'Trump promises the biggest 100 m.'
};

const receipts = {
    jumpGate: [
        ['Red tape stops mayor in his tracks.', 'City Hall budgeted for the finish line in year five.'],
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
    railGate: [
        ['Mayor trips at the ticket rail.', 'City Hall claims the landing as a completed infrastructure project.'],
        ['Ticket rail beats the mayor.', 'City Hall has scheduled a ribbon-cutting for the replay.']
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
        ['Free lunch comes with a catch.', 'The Free Stuff Committee is meeting to decide who pays.'],
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

export function frontPage(cause, edition, overtime = false) {
    const stories = receipts[cause] || receipts.protestor;
    const [news, detail] = stories[edition % stories.length];
    return [overtime ? 'Mamdani keeps NYC.' : 'Trump returns.', news + ' ' + detail];
}

export const stuntLines = {
    jump: ['Mayor clears the spending cap.', 'Red tape cleared. More on order.', 'Mayor clears budget hurdle. Budget doesn’t.'],
    cab: ['Cab fare evaded.', 'Mayor rides public transit. On the roof.', 'Cab crosses picket line. Mayor crosses cab.'],
    slide: ['Budget passes under the table.', 'For once, City Hall comes in under something.', 'Mayor lowers his stance on vendors.'],
    sidestep: ['Mayor dodges a follow-up question.', 'Campaign pivots on transit.', 'Aides say the dodge was funded.']
};
