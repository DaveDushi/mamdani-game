# Mamdani Run — Escape Trump!

A portrait-first 3D endless runner by Dave Dushi. In this fictional New York, Mayor Mamdani has endorsed every march on the calendar. Trump wants the receipts for his five-year plan.

## Play

Play at [mamdanirun.com](https://mamdanirun.com/). The saved-game copy from mamdanirun.cc closed on November 21, 2026.

Swipe left or right to change lanes, up to jump and down to slide. On a keyboard, use the arrow keys or WASD. Space also jumps. Tap the pause button or press P or Escape to pause and reread the last street sign. The shop opens on Outfits, all sponsored by Soros. Drag the preview to inspect a costume, or focus it and use the left and right arrow keys. Street posters, in City Wire, holds all nine City Hall prints with large-text captions.

Follow the lane markings. The opening stunt gates teach the moves. Jump low hurdles, slide under beams, or clear the waist-high ticket rail either way. Farther along, a crossing delivery dolly or moving signal boom can lead straight into another gate. The Central Park bike path awards three stamps for each gap you steer through. Smash obstacles aboard a Fast & Free bus for up to eight stamps. A 78° Heatwave doubles style, and three clean moves pay five stamps. Between landmarks the street changes character: Protest March, Construction Season, Rush Hour, Street Fair, Carriage Row, Rent Freeze and Collection Day. The route crosses the Brooklyn and Manhattan bridges and passes through the Queens–Midtown and Brooklyn–Battery tunnels. Watch the sidewalks for the fare strike, bagel bailout and mobile press unit. On a loss, City Wire reports what stopped you, with the score and stamp receipt. Lose a family race and it prints a photo of the winner.

Your score is points: metres run plus style. Clean moves pay 10 points and stamps 5, times a multiplier that climbs from x1 to x5 as you chain moves. Trump starts 24 m back. A hit pulls him in 18 m, clean moves push him back, and a hit with 18 m of lead or less ends the run. Without protection, hitting a STREET CLOSED wall head-on ends it too. The Stamp Office takes 90 out of every 100 food stamps. Bank 100 after tax across completed runs to unlock Night Shift, a faster course with wet streets, rarer pickups and a separate local best. Outfits stay free. See [game rules](game-rules.md) for obstacles and power-ups.

Race Donald Jr., Ivanka, Eric, Tiffany and Barron in order. Junior waits at 1 km, about 35 seconds into Day Run or 30 seconds into Night Shift. Each child waits farther down the street and has its own trick. Tap as fast as you can. All five race offline, and their marks never move. Open Race schedule under Sprint training in the Shop for their checkpoints, sprint lengths and tricks. Spend after-tax stamps in the Shop on sprint training and longer power-ups. Spent stamps still count toward Night Shift.

After five wins in one run, pass both 12,000 points and the live record. The game confirms your place online before Donald’s 100 m final, so the run needs a connection from the start. Each win changes one sixth of the city. Beat Donald to complete the takeover and continue in endless Overtime at 10% higher speed.

From version 2.5 the Season 2.3.1 leaderboard ranks points, and Day Run and Night Shift share it. Earlier distance scores are not carried over.

## Run locally

Use Node.js 22 or newer, then run `npm ci` and `npm run dev`. Use `npm run build` to generate the static site in `dist` and `npm run preview` to serve the production build.

## Build for iPhone

On a Mac with Xcode 26 and an iOS Simulator runtime, run `npm ci`, `npm run ios:sync`, then `npm run ios:open`. Select the App scheme and an iPhone simulator and press Run. Run `npm run ios:sync` again after changing the game. To install on a physical iPhone, select your development team in Signing & Capabilities.

The Capacitor app bundles the game, fonts, posters and models for offline play. The five family races are available offline. Enable online play from **Settings → Online play and data** to post scores and qualify for Donald's final. Choose **Add a name** on the leaderboard or after a run to publish an optional nickname and enable online play for the next run. Viewing the season rankings requires a connection. Runs pause when the app loses focus.

### App Store submission

1. On a Mac with Xcode 26 or later and the iOS 26 SDK or later, run `npm ci`, `npm run ios:sync`, and `npm run ios:open`. Select the distribution team for `com.mamdanirun.game`. Test the release build on a physical iPhone, then archive and validate it from Xcode Organizer. The project is set to version 2.4.1, build 13.
2. In App Store Connect, enter [the privacy policy](https://api.mamdanirun.com/privacy) and [support URL](https://api.mamdanirun.com/support), complete the age-rating questionnaire and upload gameplay screenshots. For App Privacy, review **User ID** for the pseudonymous game identifier and **Product Interaction** for online scores and race attempts. Both support app functionality, and the scores and race attempts are associated with the identifier. The iOS build uses no Firebase SDK, ads or tracking.
3. In App Review notes, describe the game as unofficial fictional political satire. Explain that no sign-in is required, five family races can be played offline, and the results board or **Settings → Online play and data** lets players opt into score posting and remove their server data. City Wire links to the same screen on iPhone. Donald's final requires five wins in one run and a score above both 12,000 points and the live record. The optional Buy Me a Coffee link appears only on the U.S. storefront and provides no in-game reward.

On device, open both policy and support links, play offline, opt in and post a score, check the rankings, and delete the online data. Verify in Xcode's archive that the required SDK privacy manifests are present. Test the support link with U.S. and non-U.S. storefronts. Earlier TestFlight scores used the web leaderboard profile and are outside the new device-key deletion flow. Testers can contact support about those entries.

## Analytics and creator support

The published site uses GA4 web stream `G-M4V8F77Y5F`. It measures page visits, run starts and finishes, the Night Shift unlock and clicks on Dave’s coffee link. Run events carry the mode and gameplay totals. The leaderboard name, registration details and feedback text stay out of these events. Local web builds skip the production tag.

The iPhone app sends no analytics events. App Store Connect shows first-time downloads, redownloads and total downloads in Analytics. [Apple’s download metrics](https://developer.apple.com/help/app-store-connect-analytics/reference/metrics-definitions)

The creator support button opens Dave’s Buy Me a Coffee page. It is available on the web and in the native app when StoreKit identifies the United States storefront. Support does not affect the wallet, outfits or gameplay.

## Art and credits

Version 2.3.2 adds original artwork for the track crowds and the Overtime front page. Zahra wears a restyled suit and long hair in the fitting room and on the track.

The five family challengers have separate animated models with custom faces and race outfits. Their source meshes and license notices are listed in the [race model credits](public/models/race/LICENSE.txt).

The 2.1 edition adds an original 16-bar jazz score and AI-assisted district facades and newspaper illustration. The 2026 edition includes original AI-assisted cover and icon illustrations, printed posters, painted city surfaces and character textures. Character meshes and motion are adapted from the [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox), using glTF conversions from [Avatar Studio](https://github.com/memoriesrohit/avatar-studio). Both MIT notices ship with the [models](public/models). The locally bundled Barlow fonts ship with their [SIL Open Font License notices](public/fonts).

The Flatbush bus-lane dispatch riffs on the city's November 2026 transit announcement. The committees, endorsements, headlines and chase are fiction. [NYC Mayor’s Office](https://www.nyc.gov/mayors-office/news/2026/11/mayor-mamdani-delivers-faster-buses-on-flatbush-avenue--laying-g)
