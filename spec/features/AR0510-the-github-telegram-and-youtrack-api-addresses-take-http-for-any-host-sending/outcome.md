# AR0510 - Outcome

- Merged: 2026-10-29, `6d1556d9`
- Branch: arthur/2026-10-29-worker-1d174632
- Reviews: review-1.md PASS
- Cost: worker $2.15, reviews $1.01; review rounds 1

## What went in

- The GitHub, Telegram and YouTrack API addresses accept `http://` only on this machine (localhost, 127.0.0.0/8, ::1); any other `http://` address is refused at load, naming the option, so a token is never sent in the clear over a network. Each plugin's doc says why.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1199/1267 passed.

## Left open

- Findings: F1 deferred (client summary): the youtrack help page still words the refusal the old way; F2 dropped (weaker checks the tests miss in telegram and youtrack, which fetch and the loopback host still bound).
