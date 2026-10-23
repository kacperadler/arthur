# AR0229 - `host.jobs.block` without `stop` is used by no plugin

```json
{
  "id": "AR0229",
  "title": "`host.jobs.block` without `stop` is used by no plugin",
  "date": "2026-10-20"
}
```

## Description

the only plugin call of `host.jobs.block` is resources' `block(job.id, text, true)`. The hold without `stop` (`blocked` on `dependency: <reason>` while the run goes on) is reached by no plugin; this ticket removed `unblock`, which no plugin called either, so such a hold now ends only with its run. Entry 51 removes members no plugin uses; it kept this parameter, since `block` itself is used and the hold's path runs through the wrapper's end and `machine-sync.ts` as well.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: refactor

Evidence:
- `packages/core/src/job-state.ts:81`, `packages/core/src/machine-sync.ts:73`, `packages/resources/src/feature-guard.ts:41`
- Found by: 2026-10-20-ar0228-roadmap-51-freeze-619539f1 (worker), 2026-10-20

## Done means

- The fix, with a test that proves it: decide whether `block(id, reason)` always stops the run (`user: <reason>`), dropping the `stop` flag and the `dependency:` hold with its branch in `machine-sync.ts`, or keeps it for a plugin to come (machines' offline jobs are held by the core itself, not through `block`). The change is in the frozen API, so the decision goes into that ticket.
- `npm test` and `npm run check` pass.

## Scope

In:
- decide whether `block(id, reason)` always stops the run (`user: <reason>`), dropping the `stop` flag and the `dependency:` hold with its branch in `machine-sync.ts`, or keeps it for a plugin to come (machines' offline jobs are held by the core itself, not through `block`). The change is in the frozen API, so the decision goes into that ticket.

## Decisions

- 2026-10-20: Source: F1 of AR0228
- 2026-10-20: Dropped by the coordinator under the owner's free hand: keep the stop flag; removing it after the freeze changes the frozen API, keeping it costs nothing.
