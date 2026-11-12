# AR0553 - Review 5

- Job: 2026-11-10-review-ed28acb1
- Branch: arthur/2026-11-10-worker-042e7671
- Commit reviewed: 1fc3af9e9d96d6b6dd4840501fb098168267636f
- Verdict: PASS

## Final message

No finding blocks the merge. The tip `1fc3af9e` is review 3's PASSed commit `e7048efa` with `main` (`b6b43c83`) merged in. Of the merge's three conflicts, `arthur.config.example.ts` and `test/option-tables.test.ts` are resolved by keeping both sides. `test/structure.test.ts` keeps both sides too, and takes the orchestration budget from 2863 on `main` to 2918, up 55 lines for this branch's work. The rest of the branch is unchanged since review 3.

- **Ticket, end to end:**
  - `packages/speak/` provides `speak.say` and `arthur say [--out]`. Piper and ffmpeg make an OGG/Opus file in `.arthur/speak/`, choosing a Polish or English voice from the text.
  - The three options have the defaults the ticket names (`voices` pl/en, `maxChars` 1500, `timeoutSeconds` 120), and texts are spoken one at a time.
  - `packages/orchestration/src/voice-reply.ts` speaks only a reply that answers a message holding a `voice` part. It sends the result after the text, through that channel's own `channel.send`.
  - When the voice note cannot go, one `voice note not sent: <why>` line goes to that channel. Without the speak plugin, the text goes alone.
  - Telegram sends `.ogg` files with `sendVoice`, each on its own. The fake answers with a `Voice` shape, and the shape test covers it.
  - `arthur doctor` lists piper, each voice and ffmpeg, none critical, each with its fix.
- **Line budget:** speak's budget of 248 equals its five `src` files exactly (50+52+47+71+28) under the 160-character rule. No file is yellow or red.
- **Docs:** the README list and diagram, `spec/vision.md`, both `.mmd` diagrams, `docs/plugin-api.md`, the telegram and coordinator pages and the example config all show the change. A search found no stale text.
- **Out-of-scope change:** the README line moving `CONTRIBUTING.md` up is there to keep the README at the 120 lines that `test/structure.test.ts:155` allows.
- **Boundaries:** no plugin imports another, `dependencies` stays empty, and there are no classes or enums.
- **Worker's claims:** the counts and the five survivors reproduce on this tip.

## Notes
None new. F1–F6 and review 3's minor note on `say-command.ts:37` already cover what I saw.

## Checks (all on 1fc3af9e)
- **`npm run check`:** tsc clean.
- **`npm test`:** 1733 tests, 1669 pass, 0 fail, 0 cancelled, 64 skipped.
- **`npm run mutate`:** 25 mutants, 20 caught, 5 survived. They are the same five the worker named: the example config's speak hunk and its `voices` and `maxChars` lines, `summary`, and `name: "speak"`. I checked two by hand:
  - Restoring the base `arthur.config.example.ts` fails `packages/speak/test/speak.test.ts`: 9 pass, 1 fail.
  - Deleting `summary` from `speak-options.ts` fails `test/option-tables.test.ts`: 4 pass, 1 fail.
- **Hand mutations on behaviour `npm run mutate` did not reach:**
  - In `inbox.ts`, removing the `voice(...)` wrapper around the `coordinator-replied` emit fails `voice-reply.test.ts`: 0 pass, 6 fail.
  - In `speak-tools.ts`, making `missing` check both languages instead of the text's own fails `speak.test.ts`: 9 pass, 1 fail.
  - Each was restored with `git checkout`, and `git status --short` prints nothing.
- **Merge resolution:** `git show --remerge-diff 1fc3af9e` shows the three conflicts resolved as described above.
- **Running it as a user:** in a temporary folder with orchestration and speak configured, `npx arthur say --help` prints the doc page. `arthur say Hello` refuses there with "refused inside a job" because of the job sandbox, so the command itself is covered only by `speak.test.ts`'s CLI test.

PASS