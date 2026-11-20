import { ApiClient } from './ApiClient.js';
import { RIVALS, raceSpeedBonus } from './FamilyRace.js';
import { SPEED_PRICES, walletBalance } from './Progression.js';
import { familySchedule, raceDistance } from './RaceSchedule.js';
import { OPENING_RECORD_METRES } from '../backend/src/season-rules.js';

const $ = id => document.getElementById(id);
const stamps = n => n.toLocaleString() + (n === 1 ? ' stamp' : ' stamps');

export function familyRecord(count) {
    return count ? `Beat ${RIVALS[count - 1].name} (${count}/${RIVALS.length})` : `0/${RIVALS.length} beaten`;
}

export const outfits = [
    { id: 'default', name: 'Mayor', swatch: '#344b65' },
    { id: 'rebel', name: 'Zahra Mamdani', swatch: 'linear-gradient(135deg, #9acee5 40%, #e898b5 40% 60%, #f5eee9 60%)' },
    { id: 'worker', name: 'Antifa', swatch: 'linear-gradient(140deg, #4b5055 45%, #24272d 46%)' },
    { id: 'imam', name: 'Imam', swatch: 'linear-gradient(90deg, #2c534e 36%, #c1a46a 36% 48%, #e7dcc0 48%)' },
    { id: 'activist', name: 'Communist', swatch: 'linear-gradient(140deg, #913138 48%, #e3b259 48% 61%, #47282a 61%)' }
];

export class Shop {
    constructor(select, buy, resize) {
        this.selected = outfits.find((s) => s.id === localStorage.getItem('mamdani_outfit')) || outfits[0];
        this.api = new ApiClient();
        this.scheduleRequest = 0;
        const schedule = $('race-schedule');
        schedule.ontoggle = () => {
            if (schedule.open) {
                this.refreshSchedule();
                schedule.scrollIntoView({ block: 'nearest' });
            }
            resize();
        };
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
                    $('speed-feedback').textContent = 'Trained to Sprint Lv. ' + wallet.speedLevel + '.';
                } else if (status === 'short') {
                    const missing = SPEED_PRICES[wallet.speedLevel] - walletBalance(wallet);
                    $('speed-feedback').textContent = 'Bank another ' + stamps(missing) + ' to train.';
                } else if (status === 'changed') {
                    $('speed-feedback').textContent = 'Already trained in another tab.';
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
    async refreshSchedule() {
        const request = ++this.scheduleRequest;
        const opening = raceDistance(OPENING_RECORD_METRES);
        this.paintSchedule(null, 'Checking record. Preview target ' + opening + '.');
        const record = await this.api.getSeasonRecord();
        if (request !== this.scheduleRequest || !$('race-schedule').open) return;
        let status;
        if (!record) {
            status = 'Record unavailable. Offline preview at ' + opening + '.';
        } else if (record.score === null) {
            status = 'No season score yet. Opening target ' + opening + '.';
        } else {
            status = 'Season record ' + raceDistance(record.score) + '.';
            if (record.score < OPENING_RECORD_METRES) status += ' Minimum target ' + opening + '.';
        }
        this.paintSchedule(record?.score ?? null, status);
    }
    paintSchedule(score, status) {
        const rows = familySchedule(score).map(rival => {
            const row = document.createElement('tr');
            const name = document.createElement('th');
            name.scope = 'row';
            name.append(rival.name, ' ', document.createElement('b'));
            row.append(name);
            row.insertCell().textContent = raceDistance(rival.at);
            row.insertCell().textContent = raceDistance(rival.metres);
            return row;
        });
        $('shop-rivals').replaceChildren(...rows);
        this.paintRivalMarks();
        $('schedule-status').textContent = status;
    }
    paintRivalMarks() {
        $('shop-rivals').querySelectorAll('b').forEach((mark, index) => {
            mark.textContent = !this.available ? '' : index < this.wallet.familyBest ? 'Beaten' : index === this.wallet.familyBest ? 'Next unbeaten' : '';
        });
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
        $('speed-level').textContent = 'Sprint Lv. ' + level + '/' + SPEED_PRICES.length;
        $('speed-effect').textContent = maxed
            ? `Sprint tap boost +${raceSpeedBonus(level)}%.`
            : `Next level boosts sprint taps from +${raceSpeedBonus(level)}% to +${raceSpeedBonus(level + 1)}%.`;
        $('shop-wallet').textContent = available ? 'Wallet · ' + stamps(walletBalance(wallet)) : 'Stamp wallet unavailable.';
        $('buy-speed').textContent = maxed ? 'Fully trained' : 'Buy level ' + (level + 1) + ' · ' + stamps(SPEED_PRICES[level]);
        $('shop-record').textContent = available ? 'Device best · ' + familyRecord(wallet.familyBest) : 'Family record unavailable.';
        this.paintRivalMarks();
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
