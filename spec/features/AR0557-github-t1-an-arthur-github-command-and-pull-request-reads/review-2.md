# AR0557 - Review 2

- Job: 2026-10-29-review-b628de3a
- Branch: arthur/2026-10-29-worker-915f655c
- Commit reviewed: 8f8bf6df47b3f01e7ce6d441f5786b10e87d7b2a
- Verdict: PASS

## Final message

The one finding from review 1 is fixed, and I found nothing that blocks the merge. The new open finding F1 in `findings.md` is real but not a blocker.

## Findings

None that block.

- **Review 1's finding is fixed.** `packages/github/test/fake-github.ts:91` (`shapedComment`) now ends with `minimized: null`. That gives it the same keys review 1 listed from GitHub's `issue-comment-items` example.
- **Review 1's uncaught mutation is now caught.** The test in `packages/core/test/cli.test.ts:58-63` now writes `echo-PR.md`. When I let `groupPage` accept uppercase (`[a-zA-Z]`), the test fails (`ℹ fail 1`).
- **F1 is real but does not block.** I checked it from `packages/core/src/commands.ts:52` and the doc file names; I did not run either command.
  - `groupPage(retro.md, "due")` finds `packages/manage/docs/commands/retro-due.md`, so `arthur retro due --help` prints the `arthur retro-due` page. `arthur review needed --help` prints `review-needed.md` the same way.
  - These two are the only clashes among the doc file names. No other command's doc has a `<doc>-<word>.md` beside it, except `github-pr.md`, which is meant to be found.
  - `arthur retro` takes no words, and `arthur review` takes a worker job id such as `2026-10-29-worker-…`, which can never be `due` or `needed`. So only an invalid line shows the other page.
  - That page starts with its own heading (`# arthur retro-due`), so the reader sees which command it describes. Nothing is run, nothing is lost, and nothing is hidden.
  - It is what plan Option 2 approved and what `help.md` now documents. The entry is filed `Status: open`, which the merge settles. Not a reason to fail.

## Notes

- `ticket.md` is the same as main's: it is not in the range's diff. Main's AR-D332 line records the budgets github 870 and core 6470, and `test/structure.test.ts` uses them. The github source is 813 lines (`cat packages/github/src/*.ts | wc -l`).
- Review 1's other non-blocking notes still hold: the fake's `link` header has only `rel="next"`, `github-command.ts` and `github-pr.ts` import each other, and `text()` lets U+2028 and bidi characters through, as youtrack's does.
- Building the `pr merge` refusal in T1 comes from Done means; review 1 accepted the worker's reason for it.

## Checks

- **`npm ci`:** "added 24 packages".
- **`npm run check` and `npm test`, in one bash call with a 1800 s timeout:** `tsc` clean; 1300 tests, 1238 passed, 0 failed, 62 skipped. This matches the worker's numbers.
- **Mutations:** each was restored with `git checkout --`, and `git status --short` is empty at the end. Every one failed at least one test:

| Where | Mutation | Failed |
| --- | --- | --- |
| `groupPage` | word regex accepts uppercase | 1 |
| `groupPage` | `existsSync` check removed | 2 |
| `cli.ts` | `printDoc` given `args.at(-2)` instead of `args[0]` | 1 |
| `github-command.ts` | `merge` added to `READS` | 1 |
| `github-command.ts` | job refusal disabled | 1 |
| `github-command.ts` | control-character filter narrowed to `\u0000-\u0008` | 3 |
| `github-pr.ts` | `--all` ignored (`state=open` always) | 1 |
| `github-api.ts` | `PAGES` changed from 10 to 11 | 2 |
| `github.ts` | every project resolved at load | 15 |
| `github-ci.ts` | `> ` dropped before log lines | 1 |
| `github-pr.ts` | `pr merge` refusal disabled | 1 |
| `github-pr.ts` | PENDING filter removed | 1 |
| `github-comments.ts` | comment body printed unquoted | 1 |

PASS