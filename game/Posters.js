export const placards = [
    ['FREE PALESTINE', 'FREE MICS'],
    ['PROTEST', 'THIS PROTEST'],
    ['NATIONALIZE', 'BRUNCH']
];
export const captions = [
    'Our Fair Share. One for you. Nine for the committee.',
    'Public Parking. Cars abolished. Meters retained.',
    'Seize the Suite. Party brass only.',
    'Five-Year Express. Arrives in Year Four.',
    'Rent on Ice. Heat needs a vote.',
    'Bagel Rations. An equal hole for all.',
    'Collective Tap. Two signatures for hot. Three for cold.',
    'Free Transit. Party dues apply.',
    'Workers, Adjourn! Adjournment tabled.'
];
export function setupPosters(open) {
    let index = 0;
    const print = document.getElementById('poster-print');
    function display(step) {
        index = (index + step + captions.length) % captions.length;
        print.style.backgroundPosition = (index % 3) * 50 + '% ' + Math.floor(index / 3) * 50 + '%';
        print.setAttribute('aria-label', captions[index]);
        document.getElementById('poster-caption').textContent = captions[index];
        document.getElementById('poster-count').textContent = index + 1 + ' / ' + captions.length;
    }
    document.getElementById('posters-btn').onclick = () => {
        display(0);
        open();
    };
    document.getElementById('poster-prev').onclick = () => display(-1);
    document.getElementById('poster-next').onclick = () => display(1);
}
