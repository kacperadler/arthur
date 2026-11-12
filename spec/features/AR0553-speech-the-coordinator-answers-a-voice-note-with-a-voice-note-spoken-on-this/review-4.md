# AR0553 - Review 4

- Job: 2026-11-12-review-91f33212
- Branch: arthur/2026-11-10-worker-042e7671
- Commit reviewed: 689fb8275785d4ebdbcc303bbfd31e03b1d901ed
- Verdict: PASS

## Final message

The branch can merge as it is. I found nothing that fails it.

The diff delivers every point the ticket asks for:
- **The speak plugin:** `speak.say`, `arthur say <text> [--out <file>]`, and the `voices`, `maxChars` and `timeoutSeconds` options with their defaults (one Polish and one English voice, 1500, 120).
- **The reply to a voice note:** the coordinator's text reply still goes, and a voice note follows it through the channel the note came from (`packages/orchestration/src/voice-reply.ts`). A reply to text alone stays text. When the voice note cannot go, one line says why: `voice note not sent: <why>`.
- **Telegram:** an `.ogg` file goes as a voice note through `sendVoice`.
- **`arthur doctor`:** it names piper, each voice and ffmpeg, none critical, each with its fix.
- **Docs:** the plugin's page, the `say` page, the example config, the vision's plugin table, the README and the architecture diagrams all say speak.

The tests use a fake piper, a fake ffmpeg and the fake host. The speak budget is its code exactly: lowered by one, the structure test fails with `packages/speak: has 248 source lines, over its line budget of 247`. The orchestration (2918) and telegram (682) raises are exact too: each one lower fails. No boundary breaks, no runtime dependency, and no file reaches yellow. The worker's claims match what I saw, and F1–F6 already cover the gaps I would have raised.

## Notes
- (risk) packages/telegram/src/media-out.ts:12: every `.ogg` that `arthur send` sends now goes through `sendVoice`, including a Vorbis `.ogg`, which used to go as a document. Telegram documents `sendVoice` for OGG/Opus, MP3 and M4A only, so such a file may be refused or shown differently [INFERENCE, not tried against Telegram].
- (minor) packages/speak/docs/commands/say.md:8: the example `arthur say 'Gotowe, AR0081 już scalone.'` puts a Polish sentence in a doc. It shows the Polish voice, but the styleguide asks for English docs.
- (minor) packages/speak/src/say-command.ts:37: `copyFileSync` silently overwrites an existing `--out` file.

## Checks, all on 689fb827
- `npm run check`: tsc clean.
- `npm test`: 1778 tests, 1714 pass, 0 fail, 0 cancelled, 64 skipped. The first run's summary was lost to my output filter, so I ran it twice; both runs finished with no `not ok` line.
- `npm run mutate`: 25 mutants, 20 caught, 5 survived, 341 not run (`--max 25`). They are the same five the worker named. I re-mutated three by hand and tests outside the mutated file's package caught each:
  - Deleting `name: "speak"` (`speak.ts:14`): `test/option-tables.test.ts` fails 1.
  - Deleting `summary` (`speak-options.ts:11`): `test/option-tables.test.ts` fails 1.
  - Deleting the example config's `maxChars` line (`:374`): `packages/speak/test/speak.test.ts` fails 1.
  - I did not re-run the other two, the whole speak hunk reverted (`:367`) and the `voices` line deleted (`:373`); the worker reports them caught by the same speak test.
- Hand mutations; one or more tests failed for each, and each file was restored with `git checkout`:
  - `packages/orchestration/src/voice-reply.ts`: `part.kind === "voice"` made `true`; the answered-seq filter removed; the `each.plugin === channel` filter removed; the `channels.size === 0` guard removed; the one-at-a-time queue removed; the `why !== undefined` test inverted.
  - `packages/speak/src/say.ts`: `>` changed to `>=` on `maxChars`; the half-OGG `rmSync` removed; the WAV `rmSync` removed; the one-text-at-a-time queue removed; language forced to `"en"`; the empty-text refusal disabled; the missing-tool refusal removed; `timeoutSeconds` hard-coded to 120.
  - Elsewhere in speak: the `--out` cleanup `rmSync` removed (`say-command.ts`); `critical: true` and the voice config `.json` check dropped (`speak-tools.ts`); `>= 1` changed to `>= 0` (`speak-options.ts`); the non-text refusal disabled (`speak.ts`).
  - `packages/telegram/src/media-out.ts`: the `.ogg` mapping removed; voice notes put in the album; voice notes grouped into one message.
- `npx arthur doctor` in a temporary folder whose config enables orchestration and speak: piper and both voices show as missing, each with its `pipx install piper-tts` or `curl` fix; ffmpeg shows ok.
- `npx arthur say --help` prints the page. `arthur say` itself never ran:
  - With the job variable `ARTHUR_JOB` set, the job guard refuses it.
  - With it cleared, the config does not load, because this sandbox cannot read `~/.config/arthur/.env` (EACCES).
  - So the command is covered only by its tests here.

PASS