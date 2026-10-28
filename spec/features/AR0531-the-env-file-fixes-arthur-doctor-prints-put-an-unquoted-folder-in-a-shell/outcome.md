# AR0531 - Outcome

- Merged: 2026-10-28, `3520fee0`
- Branch: arthur/2026-10-28-worker-e7d4c366
- Reviews: review-1.md PASS
- Cost: worker $1.62, reviews $0.64; review rounds 1

## What went in

- The two env file fixes `arthur doctor` prints now run as printed: the folder and the file name are each quoted as one shell word, also in a folder with a space or a quote. The tracked fix is `git -C '<folder>' rm --cached -- '<name>'`.
- The `.gitignore` fix is now a command (`printf '\n%s\n' '<name>' >> '<folder>/.gitignore'`), with the name escaped where Git reads its own syntax.
- `doctor.md` describes the new printed fixes; a test runs each printed fix with awkward folder and file names.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1164/1231 passed.

## Left open

- Deferred (client summary): F1. `doctor.md` says the `.gitignore` line names the file and nothing else, though `*` and `?` are not escaped
- Dropped: F2, F3, F4.
