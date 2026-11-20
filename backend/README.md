# Season leaderboard

The existing `game-backend` Worker serves `api.mamdanirun.cc`. Its original module handles registration, feedback, legacy scores and the scheduled mail job. The 2.3.1 routes use two new tables in its existing D1 database. Player names come from the shared `players` table.

## Routes under `/seasons/2.3.1`

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/leaderboard?limit=50` | Returns `entries` ordered by distance, then when the player reached it, then player ID. Unnamed players appear as Anonymous. |
| GET | `/record` | Returns `{ok,record}`. An empty season returns `null`. |
| GET | `/score?playerId=...` | Returns `{ok,bestScore,rank,onLeaderboard}`. |
| POST | `/score` | Takes `{playerId,score,mode}` and returns the player's standing. Day and Night share the board. |
| POST | `/record/claim` | Takes `{playerId,attemptId,score,mode}`. Returns `{ok,qualified,previousRecord,record}`. A successful live claim immediately updates the player's public PB. |

A qualifying distance must exceed both the current record and the opening benchmark in [season-rules.js](src/season-rules.js). D1 compares and publishes in one transaction. Retries of a winning attempt return the original qualification and the current global record. A runner whose earlier claim fell short can try again farther along the course.

The iPhone uses `/ios/leaderboard`, `/ios/score`, `/ios/record/claim` and `/ios/delete` under the same season prefix. The reader returns scores only. Writes use a private device key in place of a public player ID. Deletion removes the device's season scores, race claims and player record in one transaction. The server retains a one-way hash to reject late score uploads. The Worker also serves the App Store's public `/privacy` and `/support` pages.

## Local verification and release

Run `node --test backend/test/season.test.js` with Node 22.13 or later. Before running the full Worker locally or uploading a Worker version, restore the original private mail module into its ignored build path. This reads the deployed source and verifies the pinned SHA-256 checksum.

```sh
node backend/restore-legacy.mjs /path/to/wrangler/bin/wrangler.js
wrangler versions upload --dry-run --config backend/wrangler.jsonc
```

Apply the additive migrations to `game-d1` before activating the Worker version. Upload with `wrangler versions upload --config backend/wrangler.jsonc --keep-vars`, verify the inherited bindings, then activate the uploaded version with `wrangler versions deploy`. Restoring the preceding Worker version rolls back the API while retaining season data. Version deployment preserves the custom domain and cron triggers.
