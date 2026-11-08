# AR0658 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The checks line and the review gate read a run the deadline cut as one capped by --max

- Kind: fix
- Found by: 2026-11-08-worker-54bdf673 (worker), 2026-11-08
- Where: `packages/delivery/src/checks-extension.ts:77`, `packages/delivery/src/review-command.ts:133-136`
- What: mutate's summary now has two `not run` parts, `; <n> not run (time)` before `; <m> not run (--max <max>)`. The extension's regex `survived(?:; (\d+) not run)?` takes the first one only: `node -e` on `mutate: 10 mutants, 10 caught, 0 survived; 15 not run (time); 100 not run (--max 25)` gives run 10, survived 0, not run 15, the --max part dropped. The gate then needs min(25, 10 + 15) = 25 and refuses with `mutate capped at --max 10 (...)`, which names a cap nobody set [INFERENCE from review-command.ts:133-136, not run]. Whether a run the deadline cut opens the gate is the owner's call; today it does not, under a misleading reason.
- Suggestion: read both parts in the extension (`<run> run, <survived> survived, <not run> not run` with the time count apart, or summed), and have the gate name a run cut by time as such, opening or refusing it as the owner decides. Out: mutate.ts itself.
- Status: open
