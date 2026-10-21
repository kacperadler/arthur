# AR0264 - `arthur init` writes the audit criteria as a bare title, not the criteria manage ships

```json
{
  "id": "AR0264",
  "title": "`arthur init` writes the audit criteria as a bare title, not the criteria manage ships",
  "date": "2026-10-21"
}
```

## Description

with manage loaded, `host.jobs.criteria()` names `audit`, so `arthur init` writes `<criteriaDir>/audit.md`; `criterion` takes the skeleton only from `packages/projects/skeleton/criteria/`, which has no `audit.md`, so the file is `# Audit` alone and the auditor runs on no criteria until someone copies manage's by hand. Delivery's `review` criteria have the same gap.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: improvement

Evidence:
- `packages/projects/src/init.ts:11-15` (`criterion`), `packages/manage/criteria/audit.md`
- Found by: 2026-10-21-ar0261-roadmap-62-audit-7f8971f2 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: let a role ship its criteria skeleton beside its role file (a `Role` key, or a file the role's package holds that `init` reads through the host), and have `init` write that one; or copy manage's `criteria/audit.md` into the projects skeleton. Out: drafting the files of projects onboarded earlier.
- `npm test` and `npm run check` pass.

## Scope

In:
- let a role ship its criteria skeleton beside its role file (a `Role` key, or a file the role's package holds that `init` reads through the host), and have `init` write that one; or copy manage's `criteria/audit.md` into the projects skeleton. Out: drafting the files of projects onboarded earlier.

## Decisions

- 2026-10-21: Source: F2 of AR0261
