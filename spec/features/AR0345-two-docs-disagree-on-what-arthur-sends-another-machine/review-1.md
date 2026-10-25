# AR0345 - Review 1

- Job: 2026-10-25-review-ab9e2646
- Branch: arthur/2026-10-25-worker-e48e0ded
- Commit reviewed: 103a72d8f80dba8d55f4050816c6724530736f65
- Verdict: PASS

## Final message

No blocking findings. The branch does what AR0345 asks: `coordinator.md:139`, `spawn.md:21` and the warning at `jobs.ts:176` now say Arthur sends another machine no **MCP** secret and point to `arthur spawn --help`, "On another machine". `spawn.md:22` now says a `prepare`'s variables reach the environment of every tool call of the job too.

**Findings**

None.

**Notes (not blocking)**
- `docs/deploy.md:9` is outside the three places the ticket names. The worker gives a reason: it repeated the same "no secret" claim, and leaving it would miss the Goal ("the docs agree"). The new text matches `spawn.md:62`: a `prepare`'s variables, such as a provider's key, go on the launch's stdin. The change is small and justified.
- The ticket says "point to `spawn.md`"; the branch points to `arthur spawn --help`, which prints `spawn.md`. That is how these docs refer to each other elsewhere (`coordinator.md` already uses `arthur spawn --help`).
- `spec/vision.md:134` still says "Arthur sends it no secret". The worker recorded this as F1 in `findings.md` with `Status: open`. Per your instruction it is left for its own ticket and does not block.
- The one skipped test in `machine.test.ts` ("a job there gets the machine's own joint limit…", line 572) skips itself when there is no systemd user manager. The range does not touch it, and it explains the "35 of 36" the worker could not account for.
- One commit, Conventional Commits with the ticket id as scope. No new source lines, so the line budget is unchanged.

**Checks run**
- `npm run check`: `tsc` finished with no errors, exit 0.
- `timeout 300 node --test test/structure.test.ts`: 15 tests, 15 pass, 0 fail.
- `timeout 300 node --import @arthur/core/testing --test packages/core/test/machine.test.ts`: 36 tests, 35 pass, 0 fail, 1 skipped (the systemd one above).
- Mutation: I put the old warning text back in `packages/core/src/jobs.ts:176` and ran the warning's test alone (`--test-name-pattern "MCP servers, and its spawn warns"`). It failed (1 fail), so the test catches the change. I restored the file with `git checkout -- packages/core/src/jobs.ts`, and `git status --short` came back empty.
- `node packages/core/src/cli.ts spawn --help`: the output contains "no MCP secret", "every tool call of the job too" and the "## On another machine" heading (3 matching lines).
- I did not run `npm ci` or the full `npm test`, per your instruction; the merge runs the full suite on main.

PASS