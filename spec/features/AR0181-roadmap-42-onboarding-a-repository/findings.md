# AR0181 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. `arthur merge` (54) must ask `merge.check` before it merges an onboarding's branch

- Kind: improvement
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19
- Where: `packages/projects/src/onboarding.ts` (`host.provide("merge.check", ...)`)
- What: entry 42 says an onboarding's merge accepts only the vision and criteria files. Arthur has no merge yet (the README: "nothing reviews or merges"), and entry 54 is out of AR0181's Scope, so the projects plugin provides the rule as `merge.check` (asked with the job as `host.jobs.list()` has it; a text is a reason to refuse), tested against real branches in `packages/projects/test/onboarding.test.ts`. Nothing asks it until 54 exists; until then the onboarding procedure has the coordinator show the owner `git diff --stat HEAD...arthur/<job id>` before a merge.
- Suggestion: in entry 54, before `git merge`, `collect("merge.check", job)` and refuse with every text answer, main unchanged; a test with a fake plugin that provides `merge.check`. Out: changing the rule itself.
- Status: open

## F2. The `.nvmrc` that `arthur init` writes is read by nothing until the nvm plugin (84)

- Kind: improvement
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19
- Where: `packages/projects/src/init.ts` (`.nvmrc`, the major of `process.versions.node`)
- What: `arthur init` writes `.nvmrc` (`24` today) for entry 84, which is out of AR0181's Scope; until 84 is built, every job of the project runs on the Node of Arthur's service `PATH`, whatever the file says.
- Suggestion: build entry 84 as the roadmap describes it; its tests can use a repository `arthur init` gave its `.nvmrc`. Out: anything in `init`.
- Status: open

## F3. The coordinator's role does not say when to run `arthur init` and start an onboarding

- Kind: improvement
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19
- Where: `packages/orchestration/roles/coordinator.md`, "Commands"
- What: the coordinator learns of `arthur init` only from `arthur doctor`'s fix line (`fix: arthur init <project>`) and of the onboarding only from `arthur init`'s own output; the procedure `onboarding-ended.md` reaches it only once an onboarding ends. AR0181's Scope is `packages/projects`, so the role is unchanged.
- Suggestion: one line under Commands: a project without a board gets `arthur init <project>`, its files committed, then `arthur spawn --kind onboarding --project <project> 'Onboard <project>.'`; its end brings the procedure (`arthur init --help`). Raise the role's character ceiling in `test/structure.test.ts` if it needs it.
- Status: open

## F4. `arthur init` writes the criteria skeletons of today's roles only

- Kind: improvement
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19
- Where: `packages/projects/src/init.ts` (`CRITERIA = ["styleguide", "autopilot"]`), `packages/projects/skeleton/criteria/`
- What: the roles registered today read `styleguide` (worker, planner, plan reviewer, coordinator) and `autopilot` (coordinator), so `init` writes those two. The reviewer (52), the auditor and the retro will read more criteria files (`review`, `audit`, `retro` in Arthur's own repository); a plugin cannot list the registered roles (`host.jobs` has `prompt` and `vision` only), so the projects plugin keeps its own list, which those entries must extend, and a project onboarded before them lacks those files.
- Suggestion: either each entry that adds a role with criteria adds its skeleton to `packages/projects/skeleton/criteria/` and to `CRITERIA`, or the core publishes the criteria names the registered roles read (`host.jobs.criteria()`), and `init` writes one skeleton per name. Out: drafting those files for projects onboarded earlier.
- Status: open
