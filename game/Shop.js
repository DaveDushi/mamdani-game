export const outfits = [
    { id: 'default', name: 'Civilian', suitColor: 0x344b65, color: 0xb67852 },
    { id: 'rebel', name: 'Rebel', suitColor: 0x656b46, color: 0x976444 },
    { id: 'activist', name: 'Activist', suitColor: 0xa9546a, color: 0xc99060 },
    { id: 'worker', name: 'Worker', suitColor: 0x4b7187, color: 0xbc835c }
];

export class Shop {
    constructor(select) {
        this.selected = outfits.find((s) => s.id === localStorage.getItem('mamdani_outfit')) || outfits[0];
        this.buttons = outfits.map((skin) => {
            const button = document.createElement('button');
            button.className = 'outfit';
            const swatch = document.createElement('span');
            swatch.style.background = '#' + skin.suitColor.toString(16);
            button.append(swatch, skin.name, document.createElement('b'));
            button.addEventListener('click', () => {
                this.selected = skin;
                localStorage.setItem('mamdani_outfit', skin.id);
                this.paint();
                select(skin);
            });
            document.getElementById('shop-items').append(button);
            return button;
        });
        this.paint();
    }
    paint() {
        this.buttons.forEach((btn, i) => {
            const selected = outfits[i] === this.selected;
            btn.setAttribute('aria-pressed', selected);
            btn.lastChild.textContent = selected ? '✓' : '';
        });
    }
}
