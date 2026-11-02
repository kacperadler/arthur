# AR0574 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The delivery/merge eval's baseline predates its new scenario

- Kind: test
- Found by: 2026-10-30-worker-44de7e7b (worker), 2026-10-30
- Where: `evals/baseline.json:10`
- What: `delivery/merge` now scores a coordinator that runs `arthur merge` and names the ticket the merge made from the review's risk note, and never runs `arthur ticket new`. Before, it scored the coordinator copying the notes by hand. The baseline's 3/3 was measured on the old scenario with a real model. No run here measured the new one, so the next `arthur eval` compares against a rate from a different test.
- Suggestion: run `arthur eval delivery/merge --runs 3` with the real model and record its rate in `evals/baseline.json`. Nothing else changes.
- Budget: 0.5
- Status: deferred (client summary)

## F2. Without the findings plugin, a passed review's notes reach no findings.md

- Kind: ux
- Found by: 2026-10-30-worker-44de7e7b (worker), 2026-10-30
- Where: `packages/delivery/src/merge-outcome.ts:101`
- What: AR0574 deleted the after-merge step where the coordinator copied the notes, as the plan says. In a project with no `findings.onMerge` provider, a PASS review's security, bug or risk notes now stay only in its `review-N.md`. The merge says `- Findings: ... left as it is` or `- Findings: none; no findings.md on this ticket.` and never says that notes were left too.
- Suggestion: when no provider answers and `notes` holds a line of kind security, bug or risk, add `- Findings: <n> review notes left in <review-N.md>: no plugin provides findings.onMerge` to the no-provider line. No coordinator step comes back.
- Status: deferred (client summary)

## F3. Without the findings plugin, a worker's own open entries are settled by no one either

- Kind: risk
- Found by: review 1 (not blocking)
- What: `packages/delivery/roles/coordinator/after-merge.md:1`: the deleted step also held the fallback for `no plugin provides findings.onMerge`; F2 names only the review notes.
- Status: deferred (client summary)

## F4. A note's title ends at its first period and space

- Kind: fix
- Found by: review 1 (not blocking)
- What: `packages/findings/src/on-merge.ts:17`: `- (bug) a.ts:1: Use e.g. X. why` gets the title "Use e.g".
- Status: deferred (client summary)

## F5. The merge eval's stubbed findings.md head differs from the template's

- Kind: test
- Found by: review 1 (not blocking)
- What: `packages/delivery/evals/merge/scenario.json`: a one-line head where the plugin writes the template's two paragraphs; the scoring is unchanged.
- Status: deferred (client summary)
