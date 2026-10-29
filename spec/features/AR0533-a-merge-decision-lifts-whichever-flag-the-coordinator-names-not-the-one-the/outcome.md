# AR0533 - Outcome

- Merged: 2026-10-28, `76f2ab84`
- Branch: arthur/2026-10-28-worker-a79493ce
- Reviews: review-1.md PASS
- Cost: worker $4.16, reviews $0.88; review rounds 1

## What went in

- A merge decision records the flags it lets through when it is asked (`arthur decision ask --kind merge --what --unreviewed`, `--what --no-ci`, or both), and `arthur merge` refuses a flag the decision does not name, also when the same merge already used it. A decision asked before this change names no flag, so it lets none through; `arthur take-main` decisions work as before.
- `arthur merge <job> --no-ci --decision <id>` on a branch with no PASS is refused without asking the decision log.
- The coordinator's role, the merge and decision docs and the onboarding procedure say to ask with `--what`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1165/1232 passed.

## Left open

- Deferred (client summary): F1. A bad `--what` exits with the usage line only, not a reason; F2. the no-id hint in `decision.md` reads ambiguously
- Dropped: F3, F4.
