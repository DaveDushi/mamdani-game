const issues = 'https://github.com/DaveDushi/mamdani-game/issues';

const pages = {
    '/privacy': {
        title: 'Mamdani Run privacy policy',
        content: `
<p>Mamdani Run is an independent game by Dave Dushi.</p>
<h2>iPhone data</h2>
<p>Local scores, outfits, settings and game progress are stored on your device. Online play is off by default. With online play enabled, the game sends a random device key, run mode, distance and, when you qualify for the final, a random attempt ID. The server stores a hash of the key to keep your best score and verify race claims. Your distance appears in the public season rankings. You can also submit an optional public nickname from Join leaderboard. Saving it enables online play. If you save from the run results, the game also posts that run. The iPhone app sends no social handle, advertising identifier or analytics events.</p>
<p>To stop sending scores, open City Wire, choose Online play and data, and turn off online play. You can clear your public nickname using Edit name. Choose Delete online data to remove your online profile, nickname, scores and race claims. A one-way hash is retained to reject late uploads. Your local progress stays on your device. Backup copies age out under the hosting provider's backup schedule.</p>
<h2>Website data</h2>
<p>The web game uses a random player ID for scores and race claims. It allows you to submit a display name and optional Truth Social handle for public rankings, or to send feedback privately to the developer. The published web game uses Google Analytics to measure visits, gameplay and support-link clicks. Registration fields and feedback text are excluded from those analytics events.</p>
<h2>Service providers and contact</h2>
<p>Cloudflare hosts the game API and database and processes connection information such as IP addresses to serve and protect the service. The web game is hosted by GitHub Pages and uses Google Analytics. The web feedback form uses the developer's email service. Buy Me a Coffee handles optional tips on its own site under its own privacy policy. A tip gives no in-game reward.</p>
<p>For privacy questions or help with web or pre-release scores, see <a href="/support">Mamdani Run support</a>.</p>`
    },
    '/support': {
        title: 'Mamdani Run support',
        content: `
<p>Mamdani Run is an unofficial fictional arcade satire by Dave Dushi.</p>
<p>To contact the developer or report a problem, <a href="${issues}">open an issue on GitHub</a>. Include your app version and device model. GitHub issues are public, so leave out personal information.</p>
<p>On iPhone, open City Wire and choose Online play and data to enable or disable online play or delete your online scores.</p>
<p><a href="/privacy">Privacy policy</a> · <a href="https://mamdanirun.com">Play on the web</a></p>`
    }
};

export function appStorePage(path) {
    if (!Object.hasOwn(pages, path)) return null;
    const { title, content } = pages[path];
    return new Response(`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { max-width: 42rem; margin: 3rem auto; padding: 0 1.25rem; font: 1rem/1.6 system-ui, sans-serif; color: #14212c; background: #f9f4e8; }
a { color: #185477; } h1, h2 { line-height: 1.25; } h2 { margin-top: 1.75rem; }
</style>
<main><h1>${title}</h1>${content}</main>
</html>`, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
            'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
        }
    });
}
