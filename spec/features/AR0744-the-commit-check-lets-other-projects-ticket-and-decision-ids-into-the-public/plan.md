# AR0744 - Plan

- Job: 2026-11-27-plan-9b49c2f2
- Planned at: 9509c86ce73c7499ae175d5e7f12f2919bcf10d2

## Approach
The check will also refuse other projects' ticket ids (`<prefix>` plus 4 or more digits) and decision ids (`<prefix>-D<n>`), in tracked file paths, in file contents (giving file and line) and in commit messages. Each prefix is read when the check runs, by importing `projects/<name>/project.config.ts` the way the projects plugin does (`packages/projects/src/project-file.ts`). No prefix is written in the code. Arthur's own folder `arthur` is never read, so `AR` ids pass, and so do the fixture prefixes (AC, SH, DM, BL).

Inside a job's sandbox the other configs cannot be read. Nothing else readable there holds a prefix (see Not available directly). This plan follows Option 2:
- In a job's sandbox, a config that fails with EACCES while `ARTHUR_JOB` is set gets one stderr line saying its ids are not checked there. That project's name is still checked. That one case alone passes.
- Anywhere else, a prefix that cannot be learned refuses the commit.
- Every route to GitHub runs where the configs can be read: `arthur commit-board`, the merge's checks on main, and the merge's `spec:` commit. They all use the step sandbox (`stepSandbox`, `packages/core/src/job-sandbox.ts:165-171`), which hides only the env file and credentials.

The 19 tracked files are reworded by the coordinator on main with `arthur commit-board`, not on the worker's branch, for two reasons:
- The merge refuses any worker branch that changes `spec/features/*/ticket.md` or `spec/decisions.jsonl` (`PAPERS`, `packages/orchestration/src/paper-check.ts:8`). 14 of the 19 files are those.
- No job can learn the real prefixes, so a worker could not find the lines. The coordinator has them in its context (`projectLine`, `packages/projects/src/projects.ts:103-105`).

The worker writes the check, its tests and the docs.

Left alone:
- The name matching and the `Signed-off-by` exemption (AR-D501).
- `.githooks/commit-msg`, `npm run commit-msg`, the core, every plugin.
- The published history (AR-D499).
- The cross-project schedule and the `project-daily` procedure path (see Open questions).

## Not available directly
- **What is missing:** inside a job's sandbox nothing readable holds another project's prefix. Where I checked:
  - `projects/<other>/` is hidden by `hidden()` (`packages/core/src/job-sandbox.ts:103-120`, from `<home>/projects/folders`). Here `cat` gave "Permission denied" and `import()` gave `EACCES` for all four configs; Arthur's own imported.
  - The only home files a job may read, `<home>/projects/checkouts` and `folders`, hold names and paths only (`packages/projects/src/projects.ts:54-55`).
  - The job's env has only `ARTHUR_JOB`, `ARTHUR_GUARDED` and `ARTHUR_INSTALL`.
  - The other projects' checkouts are hidden.
- **Why it matters:** the sandbox runs this check on every worker commit. The job's hooks (`.git/worktrees/<id>/arthur-hooks/commit-msg`) chain to the worktree's `.githooks/commit-msg`. `npm test` runs it too.
- **Option 1: publish the prefixes.** The projects plugin writes `<name> <prefix>` lines to `<home>/projects/prefixes`, `hidden()` shows that file to jobs, and the check reads it in a job and refuses when it learns nothing.
  - Cost: two more packages (projects, core), with tests and docs.
  - It must be its own ticket, merged and restarted before this one. This ticket's worker and reviewer run under today's wrapper and plugin, so a refusing check would block their commits and `npm test`.
  - Risk: every Arthur job can read every other project's prefix. Jobs already read their names and checkout paths.
- **Option 2: read the configs wherever possible.** In a job's sandbox (EACCES with `ARTHUR_JOB` set) the check says on stderr that those projects' ids are not checked, and passes for that reason only. Every other failure refuses.
  - Cost: the check only.
  - Risk: an id in a worker's commit is caught at its merge, not at commit time. That merge fails before any push, and the branch is reworded.
- **Option 3: refuse in a job's sandbox.**
  - Cost: the smallest.
  - Risk: every commit of every Arthur job, and every `npm test` there, fails while another project is configured. No worker can deliver.
- **Recommendation: Option 2.**

## Files
- **`test/other-projects.ts`**:
  - `otherProjects(root, env = process.env)` becomes async. For each folder of `projects/` but `arthur`, it returns `{ name, prefix }` or `{ name, unread: <why> }`.
  - It reads the prefix by `import(pathToFileURL(<folder>/project.config.ts))`. The prefix is the default export's entry with `projects.prefix`, checked against `^[A-Z]+$` because that file is human-edited, as `PREFIX` in `packages/projects/src/project-options.ts:15`.
  - Mark whether the failure was EACCES with `env.ARTHUR_JOB` set.
  - `namings` keeps its name findings and adds, per project with a prefix:
    - paths matching `\b<P>(-D\d+|\d{4,})\b`, reported as `<path>: names the project <name>`;
    - content from `git grep --cached -a -z -n -o -w -E -e '<P>(-D[0-9]+|[0-9]{4,})'`. Each record is `path\0line\0match\n`, checked here with git 2.43. Reported as `<path>:<line>: names the project <name>`;
    - each message's `unsigned()` text, by a RegExp built from the prefix.
  - A project with `unread` outside a job, or with any error other than EACCES, is a finding: `projects/<name>/project.config.ts: its prefix was not read (<why>), so its ids cannot be checked`.
  - The `import.meta.main` block awaits these. For each in-job EACCES project it prints `ids of the project <name> not checked here: its project.config.ts cannot be read in a job's sandbox; arthur commit-board and arthur merge check them` and keeps exit code 0 for that.
  - Update the header comment.
- **`test/other-projects.test.ts`**:
  - `checkout()` writes real fixture configs: `export default [{ projects: { prefix: "WS", path: "../.." } }];` for `Web.Shop`, and `prefix: "AR"` for `arthur`. Today's file is empty, which the new check would refuse.
  - Existing calls `await otherProjects(...)`.
  - Add the rows of Done means 1-4 to the hook test and the `namings` test.
  - Hook rows that expect a refusal outside a job spawn `git` with `ARTHUR_JOB` removed from the env.
- **`docs/setup.md:127`**: the paragraph also covers ids. Prefixes come from each `project.config.ts`. In a job's sandbox the check prints which projects' ids it could not check, and commit-board and the merge do check them.
- **The tracked files the Goal lists, done by the coordinator on main with `arthur commit-board` before this ticket's merge** (not a worker file):
  - the 13 `spec/features/*/ticket.md`;
  - `spec/decisions.jsonl` (21 lines);
  - `spec/schedule.json` (3 lines; line 130 is a past one-off entry);
  - `spec/quality/2026-11-24.md:30`;
  - `spec/retro/2026-11-11.md` and `spec/retro/2026-11-11.html`.

  Each id is replaced by words like "another project's ticket" or "another project's decision". Every `(AR-D<n>)` marker stays.

## Risks
- **An answer's line reappears.** A line answered by policy is matched by its whole text (`packages/orchestration/src/decision-log.ts:140-146`). If a ticket's Decisions line and its log record are reworded differently, the next `arthur decision` writes the old line back, id included. The coordinator rewords both identically. A plain answer line is matched by `(AR-D<n>)` and never rewritten (`ticketLines`, line 125).
- **A decision record no longer parses.** Records must stay valid (`problem()`, `decision-log.ts:55-67`). Only text fields change, never an `id`, which must already carry Arthur's prefix.
- **A test counts the real log.** `packages/manage/test/repeats.test.ts:273-274` counts the first 673 lines of the real `spec/decisions.jsonl`. Rewording inside those lines must keep each record's kind and its answer. That test is run after the rewording.
- **The merge fails if rewording is late or incomplete.** If this ticket merges before the coordinator's rewording, or with a line missed, its `npm test` on main fails and the merge is refused before any push. The order is enforced, not assumed.
- **A false positive.** `\b` and `-w` stop matches inside longer tokens. Matching is case-sensitive, as Arthur writes ids, so lowercase commit hashes never match. A title holding an id is caught at its uppercase spelling in `ticket.md` and `spec/build.json` before its lowercase slug matters.
- **A real prefix equal to a fixture prefix (AC, SH, DM, BL)** would fail on thousands of fixture lines at the merge. The audit counted 19 files, so none collides ([INFERENCE]: I could not read the real prefixes).
- **Tests that run inside a job** inherit `ARTHUR_JOB`. Rows asserting a refusal unset it.
- **The EACCES row** uses `chmod 000` on a fixture config and is skipped as root (`process.getuid?.() === 0`), where permissions do not apply. GitHub's runner is not root ([INFERENCE]).
- **Import cost.** The hook now imports up to four configs and their plugin modules from the main checkout's `node_modules`. Arthur's own config imported that way in this sandbox. Expect a short delay per commit.

## How to test
1. **Done 1** (file holding an id is refused): in the hook test, stage `deploy.md` with `WS0150` on line 2, then a file with `WS-D156`. Each commit gives `[1, "commit refused: deploy.md:2: names the project Web.Shop; Arthur's repository names no other project (AR0627)"]`. Main's check returns 0 for the same commit. A path holding `WS0150` is also refused.
2. **Done 2** (message holding an id is refused): rows for `fix: as WS-D156 asked` (the subject) and `docs: x\n\nFor WS0150.` (the body) each give `refused("the commit message")`. In the `namings` test, a merge's branch commit holding `WS0150` is named as `commit <hash>`.
3. **Done 3** (prefixes read at run time; own and fixture prefixes pass):
   - These pass in a file and in a message: `AR0001`, `AR-D1`, `AC0001`, `SH-D2`, `DM0003`, `BL-D4`, `WS015` (3 digits) and `XWS0150`.
   - The prefix comes from the fixture's config, not the code: a second fixture whose config says `prefix: "QQ"` refuses `QQ0150` and passes `WS0150`.
   - A config with no prefix, or a lowercase one, is refused outside a job.
4. **Done 4** (job's sandbox): with the fixture's config at `chmod 000`:
   - with `ARTHUR_JOB` set: `[0, "ids of the project Web.Shop not checked here: ..."]`, and a message naming `web-shop` is still refused;
   - without it: exit 1 with the `its prefix was not read (EACCES ...)` finding.

   In the worker's own job, `node test/other-projects.ts <message file>` on the real checkout prints one such line per other project and exits 0.
5. **Done 5** (no tracked id left):
   - After rewording, the coordinator runs the audit's `git grep -l -E` with the four real prefixes in `~/arthur`; the result must be empty.
   - The coordinator also runs `node --test packages/manage/test/repeats.test.ts`.
   - At the merge, the first test of `test/other-projects.test.ts` (`namings(ROOT, await otherProjects(ROOT), headMessages(ROOT))` deep-equal `[]`) runs in the step sandbox with the real prefixes and proves it on main.
   - No job can prove this point: no job can read the prefixes.
6. **Done 6:** `npm test` and `npm run check`, each one bash call with a 1800 s timeout.

## Open questions
- Done 4 says "still learns the prefixes or refuses to pass silently". Option 2 reads that as "never passes without saying so": in a job's sandbox the check prints which projects' ids it could not check, and refuses everywhere a commit can reach GitHub. If you want a job's own commits refused or fully checked too, that is Option 1 as its own ticket, merged before this one. Which do you want?
- The cross-project schedule (Scope, Out): should the coordinator's wakes for other projects leave `spec/schedule.json`, for example by putting them in the config's `schedule` entries or in a git-ignored file? The file is public and tracked, and line 130 already listed another project's work.
- The `project-daily` entry (`spec/schedule.json:134-139`) names its procedure file by a path spelled with another project's prefix. It is not an id, so neither the new check nor Done 5's grep covers it. Should the coordinator rename that file in `.arthur/` and the entry's path to a neutral name, or leave it?