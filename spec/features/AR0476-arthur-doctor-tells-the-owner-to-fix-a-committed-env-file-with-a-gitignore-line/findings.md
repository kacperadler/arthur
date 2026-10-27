# AR0476 - Findings

## F1. Lines packed to stay inside the core line budget

- Kind: chore
- Found by: 2026-10-27-review-f76e9e47 (review), 2026-10-27
- Where: `packages/core/src/requirements.ts:31`, `:111`
- What: a destructuring and a one-line getter keep the core at 6414 without a recorded raise; legal, harder to read.
- Status: dropped (same behaviour; AR0495's size zones address squeezing)

## F2. A file only staged with `git add -f` also gets the advice to rotate

- Kind: ux
- Found by: 2026-10-27-review-f76e9e47 (review), 2026-10-27
- Where: `packages/core/src/requirements.ts:105-108`
- What: `ls-files --error-unmatch` counts a staged file as tracked, though no commit holds its values yet.
- Status: dropped (the ticket's scope named that test; rotating is the safe side)

## F3. The printed fix puts an unquoted folder in a shell command

- Kind: fix
- Found by: 2026-10-27-review-f76e9e47 (review), 2026-10-27
- Where: `packages/core/src/requirements.ts:111`
- What: a folder with a space breaks the fix when pasted as printed; the older `.gitignore` fix does the same.
- Status: ticket AR0531
