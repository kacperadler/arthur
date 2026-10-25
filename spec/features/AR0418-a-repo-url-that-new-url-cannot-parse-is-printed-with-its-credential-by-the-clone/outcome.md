# AR0418 - Outcome

- Merged: 2026-10-25, `458b3aaa`
- Branch: arthur/2026-10-25-worker-12f4ff21
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $0.75, reviews n/a; review rounds 2

## What went in

- `packages/projects/src/clone.ts`: `shown` drops the userinfo after `//` from a repo URL that `new URL` cannot parse (a bad port, a space in the host or the password); `git@host:path` is printed whole.
- `packages/projects/test/projects.test.ts`: refusals for `https://u:s3cret@host:99999/x.git` and `https://u:my pass@host:99999/x.git` show host and path, never the password; a `git@host:path` refusal names it.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1108/1108 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).
