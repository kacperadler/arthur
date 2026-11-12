# AR0693 - Outcome

- Merged: 2026-11-12, `5afc8e5a`
- Branch: arthur/2026-11-11-worker-07795aec
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md FAIL, review-4.md PASS, review-5.md PASS
- Cost: worker $9.56, reviews $4.48; review rounds 5

## What went in

- packages/delivery/src/auto-merge.ts: `autoRefusal` lets through a role, criteria or vision `*.md` that main's ticket.md names in backticks in its `## Scope`, the project's own `prompts` folders and vision included. It reads the Scope as autopilot does: comments dropped (an unclosed one to the end), backticks paired within a line, ending at the next heading or a line that, trimmed, starts `Out:`. Every other held path still refuses. It reads the changed files NUL-separated, so a non-ASCII path still meets its glob.
- packages/delivery/test/auto-merge.test.ts: two new tests. The first: named role, criteria and vision files merge, the Scope heading with trailing blanks and a stray backtick before them included; refused are an unnamed role, one named only in a comment (an unclosed one too), a path under `Out:` (indented too) or after the Scope, one named only in the branch's own ticket, and a named workflow (a non-ASCII one too), `package.json`, lockfile, code file under `roles/` or other held `*.md`. The second: with a project's own `rolesDir`, `criteriaDir` and `vision`, a named file merges and an unnamed one is refused.
- packages/delivery/docs/commands/merge.md: the `--auto` held-path paragraph explains the Scope exception: the trimmed `Out:` line, comments naming nothing, and what stays held.
- packages/delivery/docs/commands/review-needed.md: the tradeoff paragraph names `--auto`'s exception for a role, criteria or vision file the approved ticket's Scope names (AR0693).
- spec/roadmap.md: entry 59's Delivers line notes the Scope exception (AR0693).
- test/structure.test.ts: delivery's line budget set to its measured 2327 after the merge of main (main's 2318 plus the Scope check).
- spec/features/AR0693-a-role-criteria-or-vision-file-the-approved-ticket-s-scope-names-merges-on-its/findings.md: new; F1 (herdr test under load) fixed in eca9687c by AR0692; F2 (Scope read at merge time), F3 (review-needed matches quoted paths) and F4 (a project's own criteria folder not held) open.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1717/1788 passed.

## Left open

- Deferred (client summary): F2. `--auto` reads the Scope as main holds it at merge time, not as the owner approved it
- Deferred (client summary): F3. `arthur review-needed` matches the always-review list against paths git quotes
- Deferred (client summary): F4. A project's `prompts.criteriaDir` outside `.agents/` and not named `criteria/` is not held by `--auto` or `review-needed`
