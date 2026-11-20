const captions = [
    'Our Fair Share. One for you. Nine for the committee.',
    'Public Parking. Cars abolished. Meters retained.',
    'Seize the Suite. Reserved for senior Party officials.',
    'Five-Year Express. Due at your stop in Year Four.',
    'Rent on Ice. Heat requires a separate resolution.',
    'Bagel Rations. Everyone gets an equal hole.',
    'Collective Tap. Two signatures for hot. Three for cold.',
    'Free Transit. Fare waived. Party dues apply.',
    'Workers, Adjourn! Motion to end the meeting tabled.'
];
export function setupPosters(open) {
    let index = 0;
    const print = document.getElementById('poster-print');
    function display(step) {
        index = (index + step + captions.length) % captions.length;
        print.style.backgroundPosition = (index % 3) * 50 + '% ' + Math.floor(index / 3) * 50 + '%';
        print.setAttribute('aria-label', captions[index]);
        document.getElementById('poster-count').textContent = index + 1 + ' / ' + captions.length;
    }
    document.getElementById('posters-btn').onclick = () => {
        display(0);
        open();
    };
    document.getElementById('poster-prev').onclick = () => display(-1);
    document.getElementById('poster-next').onclick = () => display(1);
}
