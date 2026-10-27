# AR0511 - Outcome

- Merged: 2026-10-27, `231e9f1d`
- Branch: arthur/2026-10-27-worker-72dc6789
- Reviews: none
- Cost: worker $1.02, reviews $0.00; review rounds 0

## What went in

- `packages/github/docs/github.md`: the `tokenEnv` recipe is now one fine-grained personal access token limited to the projects' repositories (Actions read, or read and write for `arthur ci --rerun` and cancel; Pull requests read), warns that a classic `repo` token writes every repository the account reaches, and says Arthur does not check a token's scope.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1155/1222 passed.

## Left open

- Findings: none; no findings.md on this ticket.
