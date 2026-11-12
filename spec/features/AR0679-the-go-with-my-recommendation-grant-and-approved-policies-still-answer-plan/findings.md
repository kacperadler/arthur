# AR0679 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A class of kind plan can still be proposed and approved, though it now answers nothing

- Kind: ux
- Found by: 2026-11-11-worker-72edd925 (worker), 2026-11-11
- Where: `packages/orchestration/src/decision-class.ts:17` (`propose`)
- What: since AR0679 no class answers a `plan` question (`byPolicy` in `decision-classes.ts`), yet `arthur decision class propose --kind plan ...` is accepted and asks the owner to "Pre-approve a class: plan questions naming ...", which he may approve believing it will answer plan questions. Reproduce: the test "an approved class never answers a plan question" in `packages/orchestration/test/decisions.test.ts` proposes and approves one with exit 0.
- Suggestion: `propose` refuses `--kind plan` as it refuses `--kind class` (`--kind plan: plan questions always go to the owner (AR-D603)`), with its line under "Refused" in `docs/commands/decision.md`; classes of kind plan already in a log stay as recorded.
- Status: deferred (client summary)
