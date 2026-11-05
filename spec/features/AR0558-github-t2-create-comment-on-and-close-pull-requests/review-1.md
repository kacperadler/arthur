# AR0558 - Review 1

- Job: 2026-11-06-review-dfcc549c
- Branch: arthur/2026-11-05-worker-1eec1d98
- Commit reviewed: f7763def026dcf4ba93ca858cf797bab8f667c83
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0558 and the AR0556 plan ask:

- **`pr create`** sends `POST /repos/<o>/<r>/pulls` with `{title, head, base, body}`. The title is the file's first line, the body is the rest, and the base defaults to the checkout's branch (`packages/github/src/github-pr.ts:19-27`).
- **Refusals before any request:** a file it cannot read, an empty file, an empty heading, a branch equal to its base, and a checkout on no branch.
- **`pr comment`** reads the pull request first, then sends `POST /issues/<n>/comments`. A 404 adds the issue hint.
- **`pr close`** reads first, then sends `PATCH {state: closed}`. One already closed or merged is refused with `nothing was written`.
- **`ask`** sends a JSON body with `Content-Type` and shows a 422's `errors`. The token is masked (`packages/github/src/github-api.ts:40-74`).
- **Inside a job** every write is refused before any request (`github-command.ts:47-49`).
- **Tests:** each write has a test for 401, 403 (naming `Pull requests: read and write`), 404, 422 and a rate limit.
- **Budget:** the line budget raise 1124 → 1200 matches AR-D510.

The worker's claims match what I saw. The docs, README, mermaid diagrams and example config were updated. A search for the old usage text and the old token wording found no stale line.

## Notes
- (minor) packages/github/src/github-options.ts:12,27: mutate survivors. The `summary` and `tokenEnv.about` text hunks can be reverted without a test failing; they are help text only, not behavior.
- (minor) arthur.config.example.ts:323: mutate survivor on a comment line, no behavior.
- (minor) packages/github/src/github-command.ts:38: only the first `--base` takes the word after it. A second `--base` stays a duplicate flag and exits 2 as intended; `--base=x` is refused as an unknown flag.
- (minor) packages/github/src/github-pr.ts:41: the `pr comment` refusal names `arthur github issue comment`, which arrives with T3, as the plan says.

## Checks (on f7763def)
- `npm run check`: tsc clean.
- `npm test`: 1574 tests, 1510 pass, 0 fail, 64 skipped.
- `npm run mutate`: 25 mutants, 22 caught, 3 survived (`arthur.config.example.ts:323`, `github-options.ts:12`, `github-options.ts:27`; all text only); 204 not run (`--max 25`).
- Hand mutation: I added `create`, `comment` and `close` to `READS` so jobs could run the writes. `github-pr.test.ts` then had 1 of 14 tests fail. I restored the file with `git checkout`, and `git status` was clean afterwards.

PASS