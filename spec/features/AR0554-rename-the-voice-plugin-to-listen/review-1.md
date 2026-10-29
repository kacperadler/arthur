# AR0554 - Review 1

- Job: 2026-10-29-review-1de1604d
- Branch: arthur/2026-10-29-worker-7b9c5d1f
- Commit reviewed: 996076471431efb3a929fd68d55e3feb7c6c0aaf
- Verdict: PASS

## Final message

No blocking findings. The rename covers every point in the ticket's "Done means". The owner approved the listen budget of 248 and the video wording as AR-D329, so I treated both as decided.

## Findings

None that block the merge.

## Notes (not blocking)

- **Unquoted paths in the doctor fix** (`packages/listen/src/listen-tools.ts:29-31`): the move it prints is `mkdir -p ${dirname(file)} && mv ${old} ${file}`, with no quotes around the paths. A home path that contains a space would break the command. The existing download fix on the same line has no quotes either, so this follows how the file already works.
- **Gap that was already there before this branch:** I changed `options.model.startsWith("/") ? \`put the model…` to `false ? …` (`listen-tools.ts:31`) and the tests still passed (13 pass, 0 fail). For a model given by path, nothing tests the fix text "put the model at <path>". The base's `voice.test.ts` has the same gap, so this branch did not add it.
- **F1 is filed correctly:** the core's `NOT_TRANSCRIBED` (`packages/core/src/message-parts.ts:16`) still says "the voice plugin is not enabled". The core is outside this ticket's scope, and F1 in `findings.md` is open for it. `packages/listen/docs/listen.md:33` quotes that line as it reads today.
- **Owner's model file:** the merge leaves the owner's `.arthur/voice/models/ggml-medium.bin` where it is. Notes are not transcribed until it is moved with the fix `arthur doctor` prints, as the worker's message says.

## Checks run

- **`npm ci --offline`:** exit 0.
- **`npm run check`:** exit 0.
- **`npm test`:** 1290 tests, 1228 pass, 0 fail, 62 skipped, exit 0. This matches the worker's numbers.
- **Budget:** `cat packages/listen/src/*.ts | wc -l` gives 248, the same as `listen: 248` in `test/structure.test.ts`.
- **Rename is complete:** `packages/voice/` is gone. `package-lock.json` swaps only the `@arthur/voice` entries for `@arthur/listen`.
  - A grep of README, vision, roadmap, the diagrams, the example config, `plugin-api.md` and `packages/video` finds no voice *plugin* name left. Only the part kind `voice` and the `[voice <s> s]` lines remain, and the ticket keeps those.
  - Roadmap entry 81 is now "Listen" with "Package: listen".
- **Mutations:** I made each change below, ran the test files named, then restored it with `git checkout --`. `git status` is clean at the end. The tests caught all nine:
  - video `words.ts` calling `"voice.transcribe"` again: 3 fail.
  - video's line back to "the voice plugin is not enabled": 1 fail.
  - plugin `name: "voice"` (listen test plus `test/option-tables.test.ts`): 1 fail.
  - doctor folder `join(core.home, "voice")`: 2 fail.
  - `host.provide("voice.transcribe")`: 3 fail.
  - `transcribe-command.ts` calling `"voice.transcribe"`: 2 fail.
  - old-model check `?.isFile()` loosened to `!== undefined`: 1 fail.
  - old folder pointed at `"listen"` instead of `"voice"`: 1 fail.
  - fix without `mkdir -p`: 1 fail.

PASS