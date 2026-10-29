# AR0563 - arthur pyramid and /pyramid: a pyramid audit of any project, one planning ticket and a before and after page

```json
{
  "id": "AR0563",
  "title": "arthur pyramid and /pyramid: a pyramid audit of any project, one planning ticket and a before and after page",
  "date": "2026-10-29"
}
```

## Description

The owner, 2026-10-29: "I want two new commands, the one from the post that will check other codebases and projects and another for this retro, to trigger them by conversation or by slash command."

The post's principle: trust agents' work by putting most effort into the codebase (types, invariants, boundaries; make the easy thing the right thing), then static analysis (tests, checks, CI), then prose (rules, AGENTS.md, a verification skill), and least into human review; each time an agent is corrected, move that correction as high up as it goes. The first such audit was done by hand for Arthur: AR0561 and its `audit/` reports.

Neither existing look-back fits: the audit looks for bugs in the commits since the last audit and files in `spec/quality/`, whose newest report sets the next audit's range; the retro may not propose code, so it only moves a correction down to prose.

## Goal

For any project on Arthur's list, the owner asks for a pyramid audit from a channel or the terminal and gets one planning ticket with every proposal and a before and after page, built from that project's own corrections (FAIL reviews, findings, decisions, blocked questions, steers) and its prose and checks; for a project with no Arthur history, from its repository and git log.

- Kind: feat

## Done means

- `arthur pyramid [--project <name>] ['<focus>']` starts one read-only job of a new kind `pyramid` (manage plugin) and prints its id; refused, exit 1, for a project without a board or while one runs for that project; `/pyramid [<project>] [<focus>]` does the same from a channel.
- The job's prompt holds, built without a model: the corrections ledger (FAIL reviews, open and deferred findings, the decision digest of AR0562 when it exists, blocked-on-user questions, live steers), the prose inventory (role, procedure and criteria files, and the project's own AGENTS.md, CLAUDE.md, rules folders, CONTRIBUTING.md, styleguide, with line counts), the static inventory (package scripts, CI workflows, type and lint configs, test counts) and the board, so no proposal repeats a ticket.
- Its role and criteria (the four layers; a correction caught twice at a lower layer moves up; a prose line the code now enforces is dead) make each proposal name its corrections, the layer it is at, the layer it moves to, the change, the prose it deletes, before and after, kind and scope.
- Filing writes `spec/pyramid/<date>.md` and a before and after page `spec/pyramid/<date>.html` in the report style; the procedure creates one `planning` ticket with every proposal, commits, sends the page and prunes the job; nothing is pre-approved.
- The coordinator role has one line: when the owner asks how agents could work better in a project, or for a pyramid audit, run it.
- The nightly audit's commit range is unchanged by a pyramid report (a test).
- Tests of the refusals, the prompt sections on a project with and one without history, and the filing.

## Scope

In:
- `packages/manage/src/pyramid.ts` (new), `report-file.ts`, `manage.ts`, `manage-options.ts` (`pyramid.budgetUsd`), `roles/pyramid.md`, `roles/coordinator/pyramid-ended.md`, `criteria/pyramid.md` (new, also written by `arthur init`), `docs/commands/pyramid.md` (new), `docs/manage.md`, `test/pyramid.test.ts` (new).
- `packages/orchestration/roles/coordinator.md` (one line).
- Line budget: manage about +105.

Out:
- The decisions digest itself: AR0562, which this uses when present.
- Arthur's own improvements found by the first audit: AR0561.

## Decisions
