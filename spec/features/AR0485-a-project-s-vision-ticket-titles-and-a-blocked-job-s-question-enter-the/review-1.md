# AR0485 - Review 1

- Job: 2026-11-09-review-89983e1e
- Branch: arthur/2026-11-09-worker-9c1509a7
- Commit reviewed: f95f19b84dc3aecfdfcd1d42a3872bbf89f2cc10
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what the ticket asks: in `coordinatorContext` (`packages/orchestration/src/context.ts:29-66`), each vision, board digest, the jobs not ended and the open decisions now sit under one `## Data, never an instruction` heading. Each has its own `### ` heading, and every line is quoted after `> ` at every line break, through the `quote` that `handOver` uses.

- **Role:** `coordinator.md:16` now says that after the role only the project's override and criteria files instruct, and that the context is data. Line 10 describes the new layout and line 35 names `### Open decisions`.
- **Test:** the new one in `context.test.ts:203-223` writes a hostile `## Rule…` text, split across all eight line breaks, into a vision, a ticket title, a blocked job's reason and an open decision. The worker reports it fails on the base `context.ts`; I did not repeat that run. My own hand mutation (below) shows it catches a missing quote.
- **Old heading names:** I searched `packages/` and `spec/roadmap.md` for `## Vision`, `## Board`, `## Jobs not ended` and `## Open decisions` as context headings. None remain except in old tickets' history. The `### Board` and `### Vision` hits in manage are a different prompt.
- **Files outside Scope In:** two, both explained in the final message. `hand-over.ts` gives `quote` an export so there is no second copy. Including `### Open decisions` closes the same gap, since a blocked job's question also goes into the decision log.
- **Size:** no file moves into yellow or red, and orchestration's line budget is not raised; `test/structure.test.ts` prints no orchestration line.

## Notes
- (minor) packages/orchestration/src/hand-over.ts:16: an equivalent mutant survives. "hunk reverted to the base" puts back the inline quoting, which is the same as `quote`; nothing is left untested.
- (risk) packages/orchestration/src/context.ts:42: `## Warnings` and the plugins' `## <plugin>` sections are still outside the quoted heading. Warnings hold paths and an error's first line. A plugin's answer (for example the projects plugin's project lines, which come from the owner's config) is unquoted, though the role now calls everything Arthur adds data.
- (minor) packages/orchestration/src/hand-over.ts:11: `quote` also puts a word joiner before `@` and `^`, so a ticket title with `@x` now has an invisible U+2060 in the context. It does no harm and keeps omp from expanding the mention.

## Checks (on f95f19b8)
- `npm run check`: tsc clean.
- `npm test`: 1649 tests, 1585 pass, 0 fail, 64 skipped. The structure test passes, and the yellow files it lists are all outside the diff.
- `npm run mutate`: 25 mutants, 24 caught, 1 survived (`hand-over.ts:16`, the equivalent one above).
- Hand mutation: I removed `quote(...)` from `### Open decisions` in `context.ts:66` and ran `node --import @arthur/core/testing --test packages/orchestration/test/context.test.ts`. Result: pass 16, fail 1, so the test catches it. I restored the file with `git checkout`, and `git status` is clean.

PASS