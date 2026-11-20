export const outfits = [
    { id: 'default', name: 'Civilian', swatch: '#344b65' },
    { id: 'rebel', name: 'Hamas parody fatigues', swatch: 'linear-gradient(35deg, #43503a 34%, #a69e76 35% 54%, #738056 55%)' },
    { id: 'worker', name: 'Antifa black bloc', swatch: 'linear-gradient(140deg, #4b5055 45%, #24272d 46%)' },
    { id: 'activist', name: 'LGBTQ+ Pride', swatch: 'linear-gradient(#df4355 17%, #e99146 17% 33%, #e9c14d 33% 50%, #43a476 50% 67%, #4d85bd 67% 83%, #8c5ca7 83%)' },
    { id: 'imam', name: 'Imam robes', swatch: 'linear-gradient(90deg, #2c534e 36%, #c1a46a 36% 48%, #e7dcc0 48%)' }
];

export class Shop {
    constructor(select) {
        this.selected = outfits.find((s) => s.id === localStorage.getItem('mamdani_outfit')) || outfits[0];
        this.buttons = outfits.map((skin) => {
            const button = document.createElement('button');
            button.className = 'outfit';
            const swatch = document.createElement('span');
            swatch.style.background = skin.swatch;
            swatch.style.flexShrink = '0';
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
