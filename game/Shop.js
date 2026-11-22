import { ApiClient } from './ApiClient.js';
import { RIVALS, raceSpeedBonus } from './FamilyRace.js';
import {
    NIGHT_SHIFT_STAMPS, POWERUP_PRICES, POWERUP_TYPES, SPEED_PRICES, powerupSeconds, walletBalance, walletLifetime
} from './Progression.js';
import { RECORD_FLOOR, familySchedule, raceDistance, racePoints } from './RaceSchedule.js';

const $ = id => document.getElementById(id);
const stamps = n => n.toLocaleString() + (n === 1 ? ' stamp' : ' stamps');
const seconds = n => Number(n.toFixed(1)).toLocaleString() + ' s';
const sections = ['outfits', 'powerups', 'training'];

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

const powerups = {
    kafiyeh: { name: 'Keffiyeh', effect: 'Collision shield' },
    rainbow: { name: 'Rainbow', effect: 'Invincible. Pulls in stamps' },
    covidMask: { name: 'COVID mask', effect: 'Clears the traffic' },
    fastFreeBus: { name: 'Fast & Free', effect: 'Smash for up to 8 stamps' }
};

const tricks = {
    junior: 'Pure speed',
    ivanka: 'Gold bursts',
    eric: 'Red lights',
    tiffany: 'Moving pad',
    barron: 'Left, right',
    donald: 'All of it, and a head start'
};

// What the next banked stamps buy: Night Shift first, then the cheapest upgrade left in the shop.
export function nextGoal(wallet) {
    if (!wallet.nightUnlocked) {
        return { name: 'Night Shift', have: walletLifetime(wallet), need: NIGHT_SHIFT_STAMPS, unlock: true };
    }
    const upgrades = POWERUP_TYPES.map(type => ({ name: powerups[type].name, need: POWERUP_PRICES[wallet.powerLevels[type]] }));
    upgrades.push({ name: 'Sprint training', need: SPEED_PRICES[wallet.speedLevel] });
    const cheapest = upgrades.filter(({ need }) => need !== undefined).sort((a, b) => a.need - b.need)[0];
    return cheapest ? { ...cheapest, have: walletBalance(wallet), unlock: false } : null;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

export class Shop {
    constructor({ select, buySpeed, buyPower, resize }) {
        this.selected = outfits.find((s) => s.id === localStorage.getItem('mamdani_outfit')) || outfits[0];
        this.api = new ApiClient();
        this.scheduleRequest = 0;
        this.resize = resize;
        const schedule = $('race-schedule');
        schedule.ontoggle = () => {
            if (schedule.open) {
                this.refreshSchedule();
                schedule.scrollIntoView({ block: 'nearest' });
            }
            resize();
        };
        for (const section of sections) $('show-' + section).onclick = () => this.showSection(section);
        $('buy-speed').onclick = () => {
            const level = this.wallet.speedLevel;
            this.purchase($('speed-feedback'), () => buySpeed(level), SPEED_PRICES[level],
                wallet => 'Trained to Sprint Lv. ' + wallet.speedLevel + '.');
        };
        this.powerCards = POWERUP_TYPES.map(type => {
            const { name, effect } = powerups[type];
            const card = element('article', 'power-card');
            const icon = element('i', 'power-icon');
            icon.dataset.kind = type;
            icon.setAttribute('aria-hidden', 'true');
            const body = element('div');
            const heading = element('h3', '', name);
            const pips = element('span', 'pips');
            pips.setAttribute('role', 'img');
            pips.append(...POWERUP_PRICES.map(() => element('i')));
            heading.append(pips);
            const time = element('p', 'power-time');
            body.append(heading, element('p', '', effect), time);
            const buy = element('button', 'solid');
            buy.type = 'button';
            buy.onclick = () => {
                const level = this.wallet.powerLevels[type];
                this.purchase($('power-feedback'), () => buyPower(type, level), POWERUP_PRICES[level],
                    wallet => name + ' now lasts ' + seconds(powerupSeconds(type, wallet.powerLevels[type])) + '.');
            };
            card.append(icon, body, buy);
            $('shop-powerups').append(card);
            return { type, name, pips, time, buy };
        });
        this.buttons = outfits.map((skin) => {
            const button = document.createElement('button');
            button.type = 'button';
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
    async purchase(feedback, buy, price, bought) {
        if (this.buying) return;
        this.buying = true;
        this.paintBuyButtons();
        try {
            const { wallet, status } = await buy();
            this.updateWallet(wallet, true);
            if (status === 'bought') feedback.textContent = bought(wallet);
            else if (status === 'short') feedback.textContent = 'Bank another ' + stamps(Math.round(10 * (price - walletBalance(wallet))) / 10) + '.';
            else if (status === 'changed') feedback.textContent = 'Already bought in another tab.';
        } catch {
            feedback.textContent = 'Purchase could not be saved. Try again.';
        } finally {
            this.buying = false;
            this.paintBuyButtons();
        }
    }
    async refreshSchedule() {
        const request = ++this.scheduleRequest;
        this.paintSchedule(null, 'Checking the record…');
        const record = await this.api.getSeasonRecord();
        if (request !== this.scheduleRequest || !$('race-schedule').open) return;
        const floor = 'Donald waits past ' + racePoints(RECORD_FLOOR) + ' points';
        let status = floor + '.';
        if (!record) status = 'Offline. ' + floor + ' or the live record.';
        else if (record.score > RECORD_FLOOR) status = 'Donald waits past the live record.';
        else if (record.score !== null) status = floor + '. The record is ' + racePoints(record.score) + '.';
        this.paintSchedule(record?.score ?? null, status);
    }
    paintSchedule(score, status) {
        const rows = familySchedule(score).map(rival => {
            const row = document.createElement('tr');
            const name = document.createElement('th');
            name.scope = 'row';
            name.append(rival.name, ' ', document.createElement('b'), element('small', '', tricks[rival.id]));
            row.append(name);
            const where = row.insertCell();
            if (rival.record) where.append('Record', element('small', '', racePoints(rival.target) + ' pts'));
            else where.textContent = raceDistance(rival.at);
            row.insertCell().textContent = raceDistance(rival.metres);
            return row;
        });
        $('shop-rivals').replaceChildren(...rows);
        this.paintRivalMarks();
        $('schedule-status').textContent = status;
    }
    paintRivalMarks() {
        $('shop-rivals').querySelectorAll('b').forEach((mark, index) => {
            mark.textContent = !this.available ? '' : index < this.wallet.familyBest ? 'Beaten' : index === this.wallet.familyBest ? 'Next' : '';
        });
    }
    showSection(section) {
        for (const name of sections) {
            const active = section === name;
            $('show-' + name).setAttribute('aria-pressed', String(active));
            $(name + '-panel').hidden = !active;
        }
        $('shop-screen').dataset.section = section;
        this.resize();
    }
    open(wallet, available, section = 'outfits') {
        this.showSection(section);
        $('race-schedule').open = false;
        this.updateWallet(wallet, available);
        this.clearFeedback();
    }
    clearFeedback() {
        $('speed-feedback').textContent = $('power-feedback').textContent = '';
    }
    updateWallet(wallet, available) {
        if (this.wallet && walletBalance(wallet) !== walletBalance(this.wallet)) this.clearFeedback();
        this.wallet = wallet;
        this.available = available;
        const level = wallet.speedLevel;
        const maxed = level === SPEED_PRICES.length;
        $('speed-level').textContent = 'Lv. ' + level + '/' + SPEED_PRICES.length;
        $('speed-effect').textContent = maxed
            ? `Every tap carries ${raceSpeedBonus(level)}% more speed.`
            : `Every tap carries ${raceSpeedBonus(level)}% more speed. Next level: ${raceSpeedBonus(level + 1)}%.`;
        $('shop-wallet').textContent = available ? stamps(walletBalance(wallet)) : 'Wallet unavailable';
        $('buy-speed').textContent = maxed ? 'Fully trained' : 'Train · ' + stamps(SPEED_PRICES[level]);
        $('shop-record').textContent = available ? 'Best run · ' + familyRecord(wallet.familyBest) : 'Family record unavailable.';
        for (const { type, name, pips, time, buy } of this.powerCards) {
            const owned = wallet.powerLevels[type];
            const price = POWERUP_PRICES[owned];
            pips.setAttribute('aria-label', `Level ${owned} of ${POWERUP_PRICES.length}`);
            pips.childNodes.forEach((pip, index) => pip.classList.toggle('on', index < owned));
            const now = seconds(powerupSeconds(type, owned));
            time.replaceChildren(element('b', '', now));
            if (price === undefined) buy.textContent = 'Maxed';
            else {
                time.append(' → ' + seconds(powerupSeconds(type, owned + 1)));
                buy.textContent = stamps(price);
            }
            buy.setAttribute('aria-label', price === undefined ? name + ' fully upgraded' : `Upgrade ${name} for ${stamps(price)}`);
        }
        this.paintRivalMarks();
        this.paintBuyButtons();
    }
    // A short wallet still opens the button, which then says how many stamps are missing.
    paintBuyButtons() {
        const closed = this.buying || !this.available;
        const paint = (button, price) => {
            button.disabled = closed || price === undefined;
            button.classList.toggle('short', price > this.wallet.stamps);
        };
        paint($('buy-speed'), SPEED_PRICES[this.wallet.speedLevel]);
        for (const { type, buy } of this.powerCards) paint(buy, POWERUP_PRICES[this.wallet.powerLevels[type]]);
    }
    paint() {
        this.buttons.forEach((btn, i) => {
            const selected = outfits[i] === this.selected;
            btn.setAttribute('aria-pressed', selected);
            btn.lastChild.textContent = selected ? '✓' : '';
        });
    }
}
