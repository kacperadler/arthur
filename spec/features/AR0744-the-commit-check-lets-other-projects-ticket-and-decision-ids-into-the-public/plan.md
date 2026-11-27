# AR0744 - Plan

- Job: 2026-11-27-plan-4bfb0802
- Planned at: 7e4edf35ed835977535978604c22ee2ad470fe93

## Approach
The check also refuses other projects' ticket ids (`<prefix>` plus 4 or more digits) and decision ids (`<prefix>-D<n>`). It looks in tracked file paths, in file contents (naming file and line) and in commit messages. No prefix is written in the code. This plan follows the owner's Option 1 (AR-D737): AR0749 publishes `<home>/projects/prefixes` and shows it to jobs, so a job's commits are checked fully. The pass-with-a-warning path of the earlier plan is gone.

How the check learns each prefix, for every folder of the main checkout's `projects/` except `arthur` (the same project list as today):
1. It imports `projects/<name>/project.config.ts`, as `readProjects` does (`packages/projects/src/project-file.ts:28-31`), and takes the `projects.prefix` piece. This works on main, in `arthur commit-board` and in the merge's step sandbox.
2. If that fails (in a job's sandbox the import gives `EACCES`; I confirmed this for every other config here), it reads the line `<name> <prefix>` from `<home>/projects/prefixes`. `<home>` is `dirname(dirname($ARTHUR_JOB))`, because the wrapper sets `ARTHUR_JOB` to `<home>/jobs/<id>` (`packages/core/src/wrapper.ts:134`).
3. If neither gives a prefix matching `^[A-Z]+$`, the commit is refused, naming the project's config and both reasons. The check never passes silently.

Arthur's own `AR` ids pass because the `arthur` folder is never read. The fixture prefixes (AC, SH, DM, BL) pass because no project has them. On GitHub CI there is no `projects/`, so nothing is checked, as today.

Rewording the tracked ids stays with the coordinator, on main, with `arthur commit-board`, for two reasons:
- The merge refuses a worker branch that touches `spec/features/*/ticket.md` or `spec/decisions.jsonl` (`PAPERS`, `packages/orchestration/src/paper-check.ts:8`).
- One timing change from the filed plan: the rewording must land on main **before the worker is spawned**. The hook runs the worktree's own `test/other-projects.ts`, which greps the whole index (`git grep --cached`). Once the worker's new check is in its worktree, every commit it makes, and its `npm test`, would fail on the old ids. The coordinator can find the lines itself, and once AR0749 is merged a job can run the same grep against the prefixes file.

The worker writes the check, its tests and the docs.

Left alone:
- Name matching and the `Signed-off-by` exemption (AR-D501).
- `npm run commit-msg`, the core and every plugin (AR0749 owns the projects and core changes).
- The published history (AR-D499).
- The cross-project schedule and the `project-daily` procedure path (Open questions).
- A project listed in the prefixes file but with no folder under `projects/` is not checked, as today.

## Not available directly
- none. The owner chose Option 1 (AR-D737). This plan depends on AR0749 being merged and Arthur restarted first. AR0749 is not on this checkout's HEAD: `<home>/projects/prefixes` does not exist here yet, and `spec/build.json` lists AR0744 `after` AR0749.

## Files
- **`test/other-projects.ts`**:
  - `otherProjects(root, env = process.env)` becomes async. For each folder of `projects/` except `arthur` it returns `{ name, prefix }` or `{ name, unlearned: <why> }`.
  - The prefix comes from the config import first, then from the line `/^(\S+) ([A-Z]+)$/` for that name in `<home>/projects/prefixes`. The file is read only when `env.ARTHUR_JOB` is non-empty.
  - The config's prefix is checked against `^[A-Z]+$`, as `PREFIX` in `packages/projects/src/project-options.ts:15`, because the file is human-edited. A malformed line counts as missing.
  - `namings(root, projects, messages)` keeps its name findings. For each project with a prefix it adds:
    - paths matching `\b<P>(-D\d+|\d{4,})\b`: `<path>: names the project <name>`;
    - contents from `git grep --cached -a -z -n -o -w -E -e '<P>(-D[0-9]+|[0-9]{4,})'`. Each record is `path\0line\0match\n`; I checked this format with git 2.43, and `-w` drops `XWS0150`. Reported as `<path>:<line>: names the project <name>`;
    - each message's `unsigned()` text, against a RegExp built from the prefix: `<where>: names the project <name>`.
  - Each unlearned project is a finding: `projects/<name>/project.config.ts: its prefix was not learned (<import error>; <prefixes file>: <missing, or no line for it>), so its ids cannot be checked`.
  - The `import.meta.main` block awaits these and prints each finding under the existing `commit refused: …` line, exit 1.
  - The header comment is updated.
- **`test/other-projects.test.ts`**:
  - `checkout()` writes real fixture configs, because the current empty files would now be refused: `export default [{ projects: { prefix: "WS", path: "../.." } }];` for `Web.Shop` and `prefix: "AR"` for `arthur`.
  - Existing calls become `await otherProjects(root, env)`, with an env that has `ARTHUR_JOB` emptied, because a worker's job inherits it.
  - The hook's `commit()` spawns `git` with an explicit env: `ARTHUR_JOB` empty, or a fixture `<tmp>/home/jobs/x`.
  - Add the rows of Done means 1 to 4. The first test (the real checkout) keeps `process.env`.
- **`.githooks/commit-msg`**: the comment line also says "or its ticket or decision ids".
- **`docs/setup.md:127`**: the paragraph also covers ids. Prefixes come from each `project.config.ts`, or in a job from `<home>/projects/prefixes`. A prefix learned from neither refuses the commit.
- **Tracked files, reworded by the coordinator on main with `arthur commit-board` before the worker is spawned** (not a worker file). The audit found:
  - the 13 `spec/features/*/ticket.md` files;
  - `spec/decisions.jsonl` (21 lines);
  - `spec/schedule.json` (3 lines);
  - `spec/quality/2026-11-24.md:30`;
  - `spec/retro/2026-11-11.md` and `.html`.

  The coordinator re-runs the grep at main's tip, so anything added since the audit is included. Each id becomes words like "another project's ticket" or "another project's decision". Every `(AR-D<n>)` marker stays.

## Risks
- **The worker cannot commit if main still holds ids.** The hook checks the whole index with the worktree's new check. The coordinator rewords first. The worker's first step greps with the prefixes file and stops with a report if anything is listed; it does not reword spec papers itself.
- **AR0749 not live.** Without the file, every job commit in Arthur's repository would be refused once this is merged. The ticket order (`after: AR0749`) and the restart come first. The worker confirms `<home>/projects/prefixes` exists before it starts.
- **An answer's line reappears.** A line answered by policy is matched by its whole text (`packages/orchestration/src/decision-log.ts:140-146`). The coordinator rewords a ticket's Decisions line and its log record identically. A plain answer line is matched by `(AR-D<n>)` (`ticketLines`, line 125).
- **A decision record stops parsing** (`problem()`, `decision-log.ts:55-67`). Only text fields change, never an `id`.
- **The real-log test.** `packages/manage/test/repeats.test.ts:273-274` counts the first 673 lines of `spec/decisions.jsonl`. Rewording must keep each record's kind and answer. That test is re-run after the rewording.
- **Rewording commit subjects.** commit-board still runs the old check, which ignores ids, so the coordinator's subjects for these commits must name no id.
- **Merging main into the worker's branch.** That makes `headMessages` list main's commits since the branch point (`HEAD^1..HEAD`). A published commit there whose subject holds an id would fail the worker's `npm test`, and history is not rewritten (AR-D499). The worker merges main only if it has to, and reports such a commit rather than working around it. At the merge on main, `HEAD^1` is main, so this does not apply.
- **False positives.** `\b` and `-w` stop matches inside longer tokens. Matching is case-sensitive, so lowercase hashes never match. A real prefix equal to a fixture prefix would fail on fixture lines. The audit counted only 19 files, so none collides ([INFERENCE]: I could not read the real prefixes).
- **A stale prefixes file in a job** (the owner changed a prefix but Arthur has not restarted). The job checks the old prefix. The merge on main imports the configs and catches the new one before any push.
- **This plan, and the worker's tests and docs, are public.** None names a real project or prefix; the fixtures use `WS`, `QQ` and `Web.Shop`.
- **Import cost.** The hook imports up to four configs outside a job. In a job each import fails fast with EACCES (observed here).

## How to test
1. **Done 1 (file holding an id refused):** in the hook test, with `ARTHUR_JOB` empty:
   - Stage `deploy.md` with `WS0150` on line 2, then a version with `WS-D156`. Each gives `[1, "commit refused: deploy.md:2: names the project Web.Shop; Arthur's repository names no other project (AR0627)"]`.
   - A file whose path holds `WS0150` is refused.
   - These rows fail on main, whose check returns 0.
2. **Done 2 (message holding an id refused):**
   - `fix: as WS-D156 asked` (subject) and `docs: x\n\nFor WS0150.` (body) each give `refused("the commit message")`.
   - In the `namings` test, a merge's branch commit holding `WS0150` is named `commit <hash>`.
3. **Done 3 (prefixes read at run time; Arthur's own and fixture prefixes pass):**
   - These pass in a file and in a message: `AR0001`, `AR-D1`, `AC0001`, `SH-D2`, `DM0003`, `BL-D4`, `WS015` and `XWS0150`.
   - A fixture whose config says `prefix: "QQ"` refuses `QQ0150` and passes `WS0150`.
   - A config with no prefix, or a lowercase one, and no `ARTHUR_JOB`, is refused with the `its prefix was not learned` finding.
4. **Done 4 (job's sandbox):** `projects/Web.Shop/project.config.ts` is removed from the fixture so its import fails, a deterministic stand-in for EACCES that needs no root skip. `ARTHUR_JOB` is `<tmp>/home/jobs/x`:
   - with `<tmp>/home/projects/prefixes` holding `arthur AR\nWeb.Shop WS\n`: `WS0150` in a file and in a message is refused, and a clean commit passes (0, "");
   - with the file missing, holding no `Web.Shop` line, or holding `Web.Shop ws`: exit 1 with the `not learned` finding;
   - with `ARTHUR_JOB` empty: exit 1 as well.

   In the worker's own job: `node test/other-projects.ts <message file>` on the real checkout exits 0 and prints nothing after the rewording.
5. **Done 5 (no tracked id left):**
   - In the worker's job, the real-checkout test (`namings(ROOT, await otherProjects(ROOT), headMessages(ROOT))` deep-equals `[]`) runs with the real prefixes from the file.
   - The same test runs at the merge with the configs.
   - The coordinator also runs the audit's `git grep -l -E` with the real prefixes in `~/arthur` after rewording (empty), and `node --test packages/manage/test/repeats.test.ts`.
6. **Done 6:** `npm test` and `npm run check`, each in one bash call with a 1800 s timeout.

## Open questions
- The cross-project schedule (Scope, Out): should the coordinator's wakes for other projects leave `spec/schedule.json`, for example into each project config's `schedule` piece or a git-ignored file? The file is public and tracked, and line 130 already listed another project's pending work by id.
- The `project-daily` entry (`spec/schedule.json:134-139`) names its procedure file by a path spelled with another project's prefix. It is not an id, so neither the new check nor Done 5's grep catches it. Should the coordinator rename that file in `.arthur/`, and the entry's path, to a neutral name, or leave it?