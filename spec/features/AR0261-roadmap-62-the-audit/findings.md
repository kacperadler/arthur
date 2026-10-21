# AR0261 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A commit of the audit's tickets and board alone still starts the next night's audit

- Kind: improvement
- Found by: 2026-10-21-ar0261-roadmap-62-audit-7f8971f2 (worker), 2026-10-21
- Where: `packages/manage/src/audit.ts` (`AUDITED_PATHS`), `packages/manage/roles/coordinator/audit-ended.md` step 5
- What: "no commits since the last audit means no job" leaves out only commits that change files under `spec/quality/`, so a `NO PROPOSALS` night followed by an idle day starts no audit. An audit with proposals is committed with its tickets and the board (`spec/features/`, `spec/build.json`), and that commit counts: the next night audits the same code again at up to `audit.budgetUsd`, though nothing but the board changed.
- Suggestion: the owner decides whether a commit that changes only the board (`spec/build.json`, `spec/features/**`) is a commit to audit; if not, add those paths to `AUDITED_PATHS`' exclusions and say so in docs/manage.md, "When it runs". Out: any other path.
- Status: fixed in c2b7dde (decided 2026-10-21, ticket Decisions: commits touching only `spec/build.json`, `spec/features/**` or `spec/quality/**` do not count)

## F2. `arthur init` writes the audit criteria as a bare title, not the criteria manage ships

- Kind: improvement
- Found by: 2026-10-21-ar0261-roadmap-62-audit-7f8971f2 (worker), 2026-10-21
- Where: `packages/projects/src/init.ts:11-15` (`criterion`), `packages/manage/criteria/audit.md`
- What: with manage loaded, `host.jobs.criteria()` names `audit`, so `arthur init` writes `<criteriaDir>/audit.md`; `criterion` takes the skeleton only from `packages/projects/skeleton/criteria/`, which has no `audit.md`, so the file is `# Audit` alone and the auditor runs on no criteria until someone copies manage's by hand. Delivery's `review` criteria have the same gap.
- Suggestion: let a role ship its criteria skeleton beside its role file (a `Role` key, or a file the role's package holds that `init` reads through the host), and have `init` write that one; or copy manage's `criteria/audit.md` into the projects skeleton. Out: drafting the files of projects onboarded earlier.
- Status: open

## F3. No health line for a finished audit that was never filed

- Kind: improvement
- Found by: 2026-10-21-ar0261-roadmap-62-audit-7f8971f2 (worker), 2026-10-21
- Where: `packages/manage/src/health-checks.ts`, `packages/manage/src/audit-file.ts`
- What: the harness's health named a finished audit whose report is not in `spec/quality/` after a grace (`/home/kacper/harness/src/health-jobs.ts:97-103`). Here an audit the coordinator never files leaves the next audit's commit list starting from the older report, and nothing says so; `arthur prune` of the unfiled job loses its proposals.
- Suggestion: a manage health check: an `audit` job ended `finished` for an hour whose id no `- Job:` line of a report in `spec/quality/` names. Out: filing it automatically.
- Status: open
