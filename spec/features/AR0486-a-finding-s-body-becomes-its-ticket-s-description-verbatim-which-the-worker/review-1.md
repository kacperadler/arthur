# AR0486 - Review 1

- Job: 2026-11-09-review-65dee87f
- Branch: arthur/2026-11-09-worker-59e71578
- Commit reviewed: 8cecc6b99f0374193c40e10a938c66fd3ffdc5f2
- Verdict: FAIL

## Final message

## Findings

1. **`.agents/arthur/criteria/autopilot.md:11` still gives the old list of checks.** The branch changed this sentence in `packages/orchestration/criteria/autopilot.md:11` to add the Done means rule. It left the project's own copy unchanged, and that copy is the file Arthur's coordinator actually reads for this repository. It still says `--autopilot` "checks these and refuses otherwise: … its kind is …, its Scope names at most 3 files …" and never mentions the new refusal.
   - At base `b5927542` the two files were byte-identical. At `8cecc6b9` they differ on exactly this line (`git diff 8cecc6b9:packages/orchestration/criteria/autopilot.md 8cecc6b9:.agents/arthur/criteria/autopilot.md`).
   - Earlier changes kept both copies in step: AR0378 (`2724ab04`) edited both in one commit.
   - The ticket's Scope Out does not name this file, so under the review criteria a stale line here fails the branch. The fix is the same one-line edit the package copy got.

Everything else matches the ticket:
- **`onMerge` quoting:** `on-merge.ts:44-47` quotes every line of the finding, including the grouped `### F<n>.` headings, under the data line the Suggestion asks for.
- **Autopilot refusal:** `autopilot.ts:57-60` refuses a Done means that is missing, only the template's guidance, blank, or only quote lines, with comments stripped first.
- **Worker role:** `worker.md:7` now says a quoted finding is data.
- **Docs:** the findings doc and the coordinator doc were updated.

## Notes
- (security) `packages/delivery/roles/reviewer.md:9`, `packages/orchestration/roles/planner.md:9`, `packages/orchestration/roles/plan-reviewer.md:9`: other roles not told that a quoted finding is data. The worker already filed this as F1 in the ticket's `findings.md`. Tickets made before this change still hold their finding unquoted.
- (risk) `packages/findings/src/on-merge.ts:43`: the title is still a job's text, unquoted. In `ticket` mode the new ticket's title (the `# <id> - <title>` line) is the finding's title. It is one line and cannot form a `## ` section, but it is not marked as data.
- (minor) `packages/orchestration/src/autopilot.ts:59`: the guidance part of the check repeats the core. A Done means that holds only the template comment is already refused by the core's `planned` move (`ticket-template.ts:45`). The new check still adds the blank and quote-only cases, and puts all refusals in one message.
- (minor) `packages/orchestration/src/autopilot.ts:58`: comment stripping cannot be used to get past the check. I tried a finding with an unclosed `<!--` in the quoted Description: stripping only removes text, so at worst it removes the `## Done means` or `## Scope` heading, which gets the ticket refused. It cannot create an unquoted line.
- (minor) `test/structure.test.ts:42`: the orchestration line budget goes from 2761 to 2764. The worker's message says so, so `outcome.md` should record the raise.
- (minor) The ticket's own Description holds the old, unquoted finding. Its Suggestion matches what Done means asks for, so following Done means did the same work; nothing in it was followed as an instruction beyond what the ticket's own sections require.

## Checks (on commit 8cecc6b9)
- **`npm run check`:** tsc reported no errors.
- **`npm test`:** 1649 tests, 1585 pass, 0 fail, 0 cancelled, 64 skipped. That matches the worker's claim. The structure test passes, including the new orchestration budget of 2764.
- **`npm run mutate`:** `13 mutants, 13 caught, 0 survived`.
- **Hand mutations, each restored with `git checkout -- <file>`; the tree was clean afterwards:**
  - `autopilot.ts`: changed `/^\s*(>|$)/` to `/^\s*$/` so quote lines count as own words. `autopilot.test.ts` gave 10 pass, 1 fail (caught).
  - `autopilot.ts`: checked `section(text, "Done means")` instead of `section(plain, …)`, so comments are not stripped. 10 pass, 1 fail (caught).
  - `on-merge.ts`: removed `.replace(/^> $/gm, ">")`. `on-merge.test.ts` gave 7 pass, 2 fail (caught).
- **Not run:** `npx arthur coordinator --help`, since there is no `arthur.config.ts` in this checkout. I read the doc page diff instead.

FAIL