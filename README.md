# Mamdani Run — Escape Trump!

A portrait-first 3D endless runner by Dave Dushi. In this fictional New York, Mayor Mamdani has endorsed every march on the calendar. Trump wants the receipts for his five-year plan.

## Play

Swipe left or right to change lanes, up to jump and down to slide. On a keyboard, use the arrow keys or WASD. Space also jumps. Tap the pause button or press P or Escape to pause and reread the last street sign. In Shop → Free outfits, drag the preview to inspect a costume. With the preview focused, use the left and right arrow keys to turn it. The Posters gallery contains all nine City Hall prints with large-text captions.

Follow the lane markings. The opening stunt gates teach the moves. Jump low hurdles, slide under beams, or clear the waist-high ticket rail either way. The route crosses the Brooklyn and Manhattan bridges and passes through the Queens–Midtown and Brooklyn–Battery tunnels. Watch the sidewalks for the fare strike, bagel bailout and mobile press unit. On a loss, City Wire runs a Stars and Stripes front page with the score and stamp receipt.

Distance determines your score. One collision starts a five-second chase. A second collision during the chase ends the run. The Stamp Office takes 90 out of every 100 food stamps. Bank 150 after tax across completed runs to unlock Night Shift, a faster course with wet streets, rarer pickups and a separate local best. Outfits stay free. See [game rules](game-rules.md) for obstacles and power-ups.

Race Donald Jr., Ivanka, Eric, Tiffany and Barron in order. On the opening course, Junior waits at 650 m, about 25 seconds into Day Run or 20 seconds into Night Shift. Each child waits farther down the street and takes a faster tapping rhythm to beat. All five race offline. Open Race schedule in the Shop for their checkpoints and sprint lengths. Spend after-tax stamps there on permanent sprint training. Spent stamps still count toward Night Shift.

After five wins in one run, go beyond both 9 km and the live season record. The game confirms your place online before Donald’s 100 m final. A clean opening campaign takes about four minutes. A season record above 9 km moves the checkpoints farther out. Each win changes one sixth of the city. Beat Donald to complete the takeover and continue in endless Overtime at 10% higher speed.

In version 2.3.3, Day Run and Night Shift continue to share the Season 2.3.1 distance rankings. Earlier scores stay on the historical board.

## Run locally

Use Node.js 22 or newer, then run `npm ci` and `npm run dev`. Use `npm run build` to generate the static site in `dist` and `npm run preview` to serve the production build.

## Build for iPhone

On a Mac with Xcode 26 and an iOS Simulator runtime, run `npm ci`, `npm run ios:sync`, then `npm run ios:open`. Select the App scheme and an iPhone simulator and press Run. Run `npm run ios:sync` again after changing the game. To install on a physical iPhone, select your development team in Signing & Capabilities.

The iPhone release is pending. The Capacitor app bundles the game, fonts, posters and models for offline play. Qualifying for Donald's final, viewing the season rankings and sending feedback require a connection. Runs pause when the app loses focus.

## Analytics and creator support

The published site uses GA4 web stream `G-M4V8F77Y5F`. It measures page visits, run starts and finishes, the Night Shift unlock and clicks on Dave’s coffee link. Run events carry the mode and gameplay totals. The leaderboard name, registration details and feedback text stay out of these events. Local web builds skip the production tag.

The iPhone app forwards the same gameplay events and screen changes to Firebase Analytics through Capacitor. Collection stays inactive until the Firebase client configuration is available. To activate it, register `cc.mamdanirun.game` in the Firebase project linked to the intended Analytics property, add its `GoogleService-Info.plist` to the Xcode **App** target as a bundled resource and rebuild. The SDK uses the Analytics Core product without advertising-ID support. To verify a configured build, launch it with `-FIRDebugEnabled` and watch the iOS stream in DebugView. [Firebase Apple setup](https://firebase.google.com/docs/ios/setup) · [DebugView](https://firebase.google.com/docs/analytics/debugview)

The creator support button opens Dave’s Buy Me a Coffee page. It is available on the web and in the native app when StoreKit identifies the United States storefront. Support does not affect the wallet, outfits or gameplay.

## Art and credits

Version 2.3.2 adds original artwork for the track crowds and the Overtime front page. Zahra wears a restyled suit and long hair in the fitting room and on the track.

The five family challengers have separate animated models with custom faces and race outfits. Their source meshes and license notices are listed in the [race model credits](public/models/race/LICENSE.txt).

The 2.1 edition adds an original 16-bar jazz score and AI-assisted district facades and newspaper illustration. The 2026 edition includes original AI-assisted cover and icon illustrations, printed posters, painted city surfaces and character textures. Character meshes and motion are adapted from the [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox), using glTF conversions from [Avatar Studio](https://github.com/memoriesrohit/avatar-studio). Both MIT notices ship with the [models](public/models). The locally bundled Barlow fonts ship with their [SIL Open Font License notices](public/fonts). Earlier billboard art is preserved in [artwork/originals](artwork/originals).

The Flatbush bus-lane dispatch riffs on the city's November 2026 transit announcement. The committees, endorsements, headlines and chase are fiction. [NYC Mayor’s Office](https://www.nyc.gov/mayors-office/news/2026/11/mayor-mamdani-delivers-faster-buses-on-flatbush-avenue--laying-g)
