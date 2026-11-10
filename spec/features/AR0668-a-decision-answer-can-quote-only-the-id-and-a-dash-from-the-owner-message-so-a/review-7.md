# AR0668 - Review 7

- Job: 2026-11-10-review-b3ea0bff
- Branch: arthur/2026-11-09-worker-bb08f8e6
- Commit reviewed: ca6bd7350e5a4d69ea79f8039f775484c8a93709
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0668 asks, and every point in the ticket's "Done means" holds.

- **Word rule** (`packages/orchestration/src/decision-proof.ts:25-28,46`): with the owner's message "AR-D12 no, do not merge", the quotes `AR-D12`, `—`, `no`, `n o` and `AR-D1 2` are refused. The rule is checked twice: on the quote itself, and on the text it matches in his message. So spacing can't turn a fragment into a pass. Hand mutations (results below) show the tests catch a change to the word count, to the second check, or to the id lookup.
- **File lines** (`decision-proof.ts:14-18`): a line starting with `[photo|video|voice|audio|file` counts as his words only when it is a voice or audio transcript ending in ` (/<path>)`, and then without the path. I checked other ways in:
  - The core writes a saved file as `[<kind>, …] (…)`, with a comma after the kind, so it never matches.
  - listen's "no speech" and "not transcribed" lines and the video plugin's lines are dropped.
  - Discord's "not saved" line can't be made to look like a transcript. Its file name loses `/`, `\` and control characters (`discord/src/media-in.ts:34`), so the name can't contain ` (/`.
  - The capture stops at the first ` (/`, so a sender's file name inside the path never gets into the transcript.

  I found no way past these that F1–F5 don't already cover.
- **Notice** (`decision-writes.ts:63-66`): it shows the whole message, redacted before it is cut. A message of exactly 400 code points stays whole; at 401 it is cut and ends ` … (cut)`. Both cases are tested, and so is redaction.
- **Docs**: `decision.md`, `coordinator.md` and `take-main.md` match the code. I searched for the old notice format (`your words: "` with nothing after it) and for the quoting rule: nothing stale is left.
- **Budget**: I measured orchestration's `src` lines the way the structure test counts them: 2846 at the base, 2863 at the tip, so this range adds +17, under AR-D538 (`spec/decisions.jsonl:1109`). No changed source file is yellow or red.
- **Scope**: the files outside Scope "In" are `decision-use.test.ts`, `silent.test.ts`, `coordinator.md`, `take-main.md` and the budget line. The new rule needs them, and the worker's final message lists them.

## Notes
- (minor) packages/orchestration/src/decision-proof.ts:16: the `$` after the transcript's path isn't held by any test. With it removed, `decisions.test.ts` still passes (43/43). Discord file names can't hold `/`, so I see no way to exploit it today.
- (minor) The worker's final message says the budget went "2829 → 2863". Against this range's base it is 2846 → 2863: +17 from this branch, which the merge's outcome.md should show.

## Checks (all at ca6bd735)
- `npm run check`: tsc passed.
- `npm test`: exit 0. 1695 tests: 1631 passed, 0 failed, 64 skipped. The structure test printed no yellow line for any orchestration file.
- `npm run mutate`: 25 mutants, 25 caught, 0 survived, 67 not run.
- Hand mutations on `decision-proof.ts`, each run against `decisions.test.ts` and restored with `git checkout -- <file>`:

  | Mutation | Failed tests |
  |---|---|
  | sort reversed (latest message becomes earliest) | 2 |
  | word threshold `2→1` | 1 |
  | second check on his matched text removed | 1 |
  | id looked up in the raw text instead of `said(text)` | 1 |
  | `$` anchor of the transcript path removed | 0 (survived, note above) |

- Fails before the fix: with the base's `decision-proof.ts` and `decision-writes.ts` put back, `decisions.test.ts` fails 4 tests, including both new ones. I restored them after; `git status --short` was empty.
- After `npm test`, one fake agent was still running: `fake-agent.ts … --continue -e …/handoff-extension.ts`. That reproduces F2; I stopped it.

PASS