# Mamdani Run — Escape Trump!

A portrait-first 3D endless runner by Dave Dushi. In this fictional New York, Mayor Mamdani has endorsed every march on the calendar. Trump wants the receipts for his five-year plan. The mayor has five minutes to get across town.

## Play

Swipe left or right to change lanes, up to jump and down to slide. On a keyboard, use the arrow keys or WASD. Space also jumps. Tap the pause button or press P or Escape to pause and reread the last street sign. In Outfits, drag or use the turn buttons to inspect each costume. The Posters gallery contains all nine City Hall prints with large-text captions.

Run beneath the Canal Street lanterns, the Union Square marquee and the City Hall arch. The district changes every 240 metres. A jump over a cab, a slide under cover or a last-second sidestep earns a clean move. Three in a row earn a three-stamp bonus. The City Wire prints a front page about the obstacle that caught you.

Distance determines your score. Stamps have their own counter. One collision starts a five-second chase. A second collision during the chase ends the run and the Stamp Office takes half your stamps, rounded down. See [game rules](game-rules.md) for obstacles and power-ups.

## Run locally

Use Node.js 22 or newer, then run `npm ci` and `npm run dev`. Use `npm run build` to generate the static site in `dist` and `npm run preview` to serve the production build.

## Build for iPhone

On a Mac with Xcode 26 and an iOS Simulator runtime, run `npm ci`, `npm run ios:sync`, then `npm run ios:open`. Select the App scheme and an iPhone simulator and press Run. Run `npm run ios:sync` again after changing the game. To install on a physical iPhone, select your development team in Signing & Capabilities.

The Capacitor app bundles the game, fonts, posters and models for offline play. Leaderboards and feedback use the existing online service. Runs pause when the app loses focus.

## Art and credits

The 2.1 edition adds an original 16-bar jazz score and AI-assisted district facades and newspaper illustration. The 2026 edition includes original AI-assisted cover and icon illustrations, printed posters, painted city surfaces and character textures. Character meshes and motion are adapted from the [Microsoft Rocketbox Avatar Library](https://github.com/microsoft/Microsoft-Rocketbox), using glTF conversions from [Avatar Studio](https://github.com/memoriesrohit/avatar-studio). Both MIT notices ship with the [models](public/models). The locally bundled Barlow fonts ship with their [SIL Open Font License notices](public/fonts). Earlier billboard art is preserved in [artwork/originals](artwork/originals).

The Flatbush bus-lane dispatch riffs on the city's November 2026 transit announcement. The committees, endorsements, headlines and chase are fiction. [NYC Mayor’s Office](https://www.nyc.gov/mayors-office/news/2026/11/mayor-mamdani-delivers-faster-buses-on-flatbush-avenue--laying-g)
