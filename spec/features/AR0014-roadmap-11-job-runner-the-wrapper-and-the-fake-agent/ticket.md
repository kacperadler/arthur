# AR0014 - Roadmap 11: Job runner: the wrapper, and the fake agent

```json
{
  "id": "AR0014",
  "title": "Roadmap 11: Job runner: the wrapper, and the fake agent",
  "date": "2026-10-16",
  "after": [
    "AR0013"
  ]
}
```

## Description

Roadmap entry 11 of `spec/roadmap.md`: Job runner: the wrapper, and the fake agent. Its Package, Delivers, Done means (with edge cases), Depends on and Covers there are this ticket's contract.

## Goal

Build entry 11 as `spec/roadmap.md` describes it, behind the interface it names, following `spec/vision.md` and `.agents/harness/criteria/styleguide.md`.

- Kind: feat

## Done means

- Everything under entry 11's "Done means" in `spec/roadmap.md`, every edge case it lists with its own test.
- The package is tested on its own (a plugin against `@arthur/core/testing`'s fake host); nothing imports another plugin or a core internal.
- `npm run check` and `npm test` pass; the result names what was smoke-run beyond the tests.

## Scope

In:
- Entry 11 only.

Out:
- Later roadmap entries; changing `spec/roadmap.md` except to correct this entry, said in the result.

## Decisions

- 2026-10-16: Cut from `spec/roadmap.md` entry 11 by the coordinator; AR tickets need no approval (the owner, 2026-10-16).
- 2026-10-16: Coordinator: OK on the worker's six calls: tools by the read-only flag, not the kind name; exit 0 with no final message is failed; state running/done/failed with the reason in the log and job-ended; a record deleted mid-run stops the agent and writes <home>/wrapper.log; a base key in the record; jobRunner takes agent from core.agent.command. The real omp smoke runs after the merge (coordinator).
