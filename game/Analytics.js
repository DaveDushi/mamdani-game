import { Capacitor, registerPlugin } from '@capacitor/core';

const stream = 'G-M4V8F77Y5F';
const ios = Capacitor.getPlatform() === 'ios';
const services = registerPlugin('ArcadeServices');
const publishedWeb = !Capacitor.isNativePlatform() &&
    ['mamdanirun.com', 'www.mamdanirun.com'].includes(location.hostname);

export function startAnalytics() {
    if (!publishedWeb) return;
    window.dataLayer ??= [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', stream, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + stream;
    document.head.append(tag);
}

export function track(name, parameters = {}) {
    if (publishedWeb) window.gtag?.('event', name, parameters);
}

export async function setupSupportLinks() {
    const links = Array.from(document.querySelectorAll('[data-support-link]'));
    if (ios) {
        const storefront = await services.supportAvailability().catch(() => ({ available: false }));
        if (!storefront.available) return;
    }
    for (const link of links) {
        link.addEventListener('click', async event => {
            if (ios) {
                event.preventDefault();
                const result = await services.openSupport().catch(() => ({ opened: false }));
                if (!result.opened) return;
            }
            track('bmc_click', { entry_point: link.closest('#start-screen') ? 'home' : 'story' });
        });
        link.hidden = false;
    }
}
