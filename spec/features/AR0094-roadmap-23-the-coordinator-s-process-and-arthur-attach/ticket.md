# AR0094 - Roadmap 23: The coordinator's process and arthur attach

```json
{
  "id": "AR0094",
  "title": "Roadmap 23: The coordinator's process and arthur attach",
  "date": "2026-10-17"
}
```

## Description

Roadmap entry 23 of `spec/roadmap.md`: The coordinator's process and `arthur attach`. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 23 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feature

## Done means

- Everything under entry 23's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 23 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-17: Cut from `spec/roadmap.md` entry 23 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: The human: steps 1 (cuts AR0074 to AR0079) and 2 (entries 16, 21, 22) approved; in parallel only where tickets touch different files, otherwise one after another. Entry 23 starts only after both are merged.
- 2026-10-16 evening: The human: start AR0019, AR0024, AR0025 (one after another).
- 2026-10-16: Coordinator: also in this ticket, from AR0024's review and findings (the human asked for findings grouped per entry, not one ticket each): `arthur continue` on a job on another machine names the machine and runs there (today it says "its worktree was pruned"); the `host.jobs.run` quoting test adds a backtick and a newline; F1 of AR0024 (a job there gets this host's joint CPU and memory limit) and F2 (each sweep copies the whole log when it grew: copy only the new bytes).
- 2026-10-16: Coordinator: accepted ssh -o ConnectTimeout=10 (a silent machine must not freeze the sweep); roadmap 21 updated on main.
- 2026-10-17: The owner resumed Arthur's build; this entry is next.
- 2026-10-17: Worker: line budgets in `test/structure.test.ts`: orchestration 300 (276 at the commit); 8 lines move from core (4804) to core/testing (276) for the fake agent's `tool_call` handlers, which the env-guard test of the coordinator needs.
