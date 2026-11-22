# Season leaderboard

The `game-backend` Worker serves `api.mamdanirun.com`. Existing clients can use the temporary `api.mamdanirun.cc` binding until November 21, 2026 at 14:00 UTC. At that cutoff, the Worker retires the old hostname and rejects requests from the old site's browser origins. Deployments require only the `.com` custom domain. The original module handles `/health`, the read-only historical `/leaderboard` and the scheduled mail job. Its `/register`, `/score` and `/feedback` routes trusted public player IDs, so [index.js](src/index.js) answers them with 410 and removes IDs from the historical board. The 2.3.1 routes use their own tables in the same D1 database. Player names come from the shared `players` table.

## Routes under `/seasons/2.3.1`

Every POST carries `key`, 64 lowercase hex characters that the client generates and keeps private. The server stores `web_` or `ios_` plus the key's SHA-256 and never returns it. The same POST routes exist under `/ios/` for the iPhone app, apart from feedback.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/leaderboard?limit=50` | Returns `entries` ordered by score, then when the player reached it, then stored ID. Unnamed players appear as Anonymous or iPhone runner. |
| POST | `/leaderboard` | Takes `{key,limit}`. Same entries, with `you: true` on the caller's row. |
| GET | `/record` | Returns `{ok,record}`. An empty season returns `null`. |
| POST | `/run` | Takes `{key,mode}` and returns `{ok,ticket}`. |
| POST | `/score` | Takes `{key,ticket,score,mode}` and returns `{ok,bestScore,rank,onLeaderboard}`. Day and Night share the board. |
| POST | `/record/claim` | Takes `{key,ticket,score,mode}`. Returns `{ok,qualified,previousRecord,record}`. A successful live claim immediately updates the player's public PB. |
| POST | `/profile` | Takes `{key,name}`, plus `social` and `isPwa` on the web. An empty name clears it. |
| POST | `/feedback` | Takes `{key,message}`. Web only. |
| POST | `/delete` | Takes `{key}` and removes the player's scores, claims, tickets, feedback and profile in one transaction. The server keeps the one-way hash to reject late writes. |

A ticket belongs to one player, mode and server start time. It lasts six hours, and each player keeps the latest 20. A score or claim may not exceed 6,000 points plus 250 for each second since the ticket was issued, or 250,000 in all. The limits are in [season-rules.js](src/season-rules.js). A ticket takes one final score. Sending the same score again returns the standing, and any other score gets 409. The next run to start after 12 hours deletes the old tickets. Refusals are 4xx: 403 for an unknown ticket, 410 for an expired ticket or deleted player, 422 for a score beyond the limits. Older clients send no key or ticket and get 400 or 403, which they show as an unsent score.

These checks stop instant forgeries and stolen identities. A patient script can still wait and post any score under the limits.

A qualifying score must exceed both the current record and the opening floor of 12,000. D1 compares and publishes in one transaction. Retries of a winning claim return the original qualification and the current global record. A runner whose earlier claim fell short can try again later in the run.

Older iPhone builds use the score-only GET `/ios/leaderboard`. The Worker also serves the App Store's public `/privacy` and `/support` pages.

## Local verification and release

Run `node --test backend/test/season.test.js` with Node 22.13 or later. Before running the full Worker locally or uploading a Worker version, restore the original private mail module into its ignored build path. This reads the deployed source and verifies the pinned SHA-256 checksum.

```sh
node backend/restore-legacy.mjs /path/to/wrangler/bin/wrangler.js
wrangler versions upload --dry-run --config backend/wrangler.jsonc
```

Apply the additive migrations to `game-d1` before activating the Worker version. Upload with `wrangler versions upload --config backend/wrangler.jsonc --keep-vars`, verify the inherited bindings, then activate the uploaded version with `wrangler versions deploy`. Restoring the preceding Worker version rolls back the API while retaining season data. Version deployment preserves the custom domain and cron triggers.

## Wiping the season board

`ops/wipe-season.sql` empties the 2.3.1 scores, claims and run tickets. When removing one forged score by hand, delete that player's tickets too, or the same ticket can post it again for up to six hours. It sits outside `migrations/`, so `wrangler d1 migrations apply` never runs it. Run it once, with the owner's approval, after the release that requires tickets is live. Running it earlier lets old clients refill the board with unchecked scores.

1. Apply the migrations and activate the Worker version as above. Check that a POST to `/score` without a ticket is refused.
2. Back up the database outside the repository. The export contains names and feedback. Note the Time Travel bookmark as well.

```sh
wrangler d1 export game-d1 --remote --config backend/wrangler.jsonc --output ../game-d1-before-wipe.sql
wrangler d1 time-travel info game-d1 --config backend/wrangler.jsonc
```

3. Wipe, then confirm that GET `/seasons/2.3.1/record` returns `null`.

```sh
wrangler d1 execute game-d1 --remote --config backend/wrangler.jsonc --file backend/ops/wipe-season.sql
```

Names and iPhone profiles survive. Web players get a new private key on their next run, and the game posts their saved nickname under it.
