import { RIVALS, raceSpeedBonus } from './FamilyRace.js';
import { SPEED_PRICES, walletBalance } from './Progression.js';

const $ = id => document.getElementById(id);
const stamps = n => n.toLocaleString() + (n === 1 ? ' stamp' : ' stamps');

export function familyRecord(count) {
    return count ? `Beat ${RIVALS[count - 1].name} (${count}/${RIVALS.length})` : `0/${RIVALS.length} beaten`;
}

export const outfits = [
    { id: 'default', name: 'Civilian', swatch: '#344b65' },
    { id: 'rebel', name: 'Hamas parody fatigues', swatch: 'linear-gradient(35deg, #43503a 34%, #a69e76 35% 54%, #738056 55%)' },
    { id: 'worker', name: 'Antifa black bloc', swatch: 'linear-gradient(140deg, #4b5055 45%, #24272d 46%)' },
    { id: 'activist', name: 'LGBTQ+ Pride', swatch: 'linear-gradient(#df4355 17%, #e99146 17% 33%, #e9c14d 33% 50%, #43a476 50% 67%, #4d85bd 67% 83%, #8c5ca7 83%)' },
    { id: 'imam', name: 'Imam robes', swatch: 'linear-gradient(90deg, #2c534e 36%, #c1a46a 36% 48%, #e7dcc0 48%)' }
];

export class Shop {
    constructor(select, buy, resize) {
        this.selected = outfits.find((s) => s.id === localStorage.getItem('mamdani_outfit')) || outfits[0];
        this.rivalMarks = RIVALS.map(rival => {
            const row = document.createElement('li');
            const name = document.createElement('span');
            const checkpoint = document.createElement('span');
            const mark = document.createElement('b');
            name.textContent = rival.name;
            checkpoint.textContent = rival.at.toLocaleString() + ' m';
            row.append(name, checkpoint, mark);
            $('shop-rivals').append(row);
            return mark;
        });
        $('race-schedule').ontoggle = resize;
        for (const section of ['training', 'outfits']) {
            $('show-' + section).onclick = () => {
                this.showSection(section);
                resize();
            };
        }
        $('buy-speed').onclick = async () => {
            if (this.buying) return;
            this.buying = true;
            $('buy-speed').disabled = true;
            try {
                const { wallet, status } = await buy(this.wallet.speedLevel);
                this.updateWallet(wallet, true);
                if (status === 'bought') {
                    $('speed-feedback').textContent = 'Bought speed level ' + wallet.speedLevel + '.';
                } else if (status === 'short') {
                    const missing = SPEED_PRICES[wallet.speedLevel] - walletBalance(wallet);
                    $('speed-feedback').textContent = 'Bank ' + stamps(missing) + ' more to buy this level.';
                } else if (status === 'changed') {
                    $('speed-feedback').textContent = 'Another tab bought that level. Check the new price.';
                }
            } catch {
                $('speed-feedback').textContent = 'Purchase could not be saved. Try again.';
            } finally {
                this.buying = false;
                this.paintBuyButton();
            }
        };
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
            $('shop-items').append(button);
            return button;
        });
        this.paint();
    }
    showSection(section) {
        for (const name of ['training', 'outfits']) {
            const active = section === name;
            $('show-' + name).setAttribute('aria-pressed', String(active));
            $(name + '-panel').hidden = !active;
        }
    }
    open(wallet, available) {
        this.showSection('training');
        $('race-schedule').open = false;
        this.updateWallet(wallet, available);
        $('speed-feedback').textContent = '';
    }
    updateWallet(wallet, available) {
        if (this.wallet && (wallet.speedLevel !== this.wallet.speedLevel || walletBalance(wallet) !== walletBalance(this.wallet))) {
            $('speed-feedback').textContent = '';
        }
        this.wallet = wallet;
        this.available = available;
        const level = wallet.speedLevel;
        const maxed = level === SPEED_PRICES.length;
        $('speed-level').textContent = 'Level ' + level + '/' + SPEED_PRICES.length;
        $('speed-effect').textContent = maxed
            ? `Your taps add ${raceSpeedBonus(level)}% more speed in every family sprint.`
            : `Train to raise your permanent speed bonus per tap from +${raceSpeedBonus(level)}% to +${raceSpeedBonus(level + 1)}% in family sprints.`;
        $('shop-wallet').textContent = available ? 'After-tax wallet · ' + stamps(walletBalance(wallet)) : 'Stamp wallet unavailable.';
        $('buy-speed').textContent = maxed ? 'Fully trained' : 'Buy level ' + (level + 1) + ' · ' + stamps(SPEED_PRICES[level]);
        $('shop-record').textContent = available ? 'Family best on this device · ' + familyRecord(wallet.familyBest) : 'Family record unavailable.';
        this.rivalMarks.forEach((mark, index) => {
            mark.textContent = !available ? '' : index < wallet.familyBest ? 'Beaten' : index === wallet.familyBest ? 'Next to beat' : '';
        });
        this.paintBuyButton();
    }
    paintBuyButton() {
        $('buy-speed').disabled = this.buying || !this.available || this.wallet.speedLevel === SPEED_PRICES.length;
    }
    paint() {
        this.buttons.forEach((btn, i) => {
            const selected = outfits[i] === this.selected;
            btn.setAttribute('aria-pressed', selected);
            btn.lastChild.textContent = selected ? '✓' : '';
        });
    }
}
