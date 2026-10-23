# AR0362 - A plain `arthur merge` asks no CI, so a tip whose run ended `failure` goes in on the checks on main alone, unsaid

```json
{
  "id": "AR0362",
  "title": "A plain `arthur merge` asks no CI, so a tip whose run ended `failure` goes in on the checks on main alone, unsaid",
  "date": "2026-10-23"
}
```

## Description

after `[github] CI run … ended failure on arthur/<id>` the owner's `arthur merge <id>` merges and pushes without a word about that run; the merge's own `check` and `test` on main are what stands between, and they are the same scripts CI ran, on the VPS instead of a runner. `--no-ci` is refused without `--auto` (`merge-command.ts:36`), so there is no way to say the owner saw the failure.

## Goal

A plain `arthur merge` reads the CI of the tip too and says a failed run before merging; tested.

- Kind: feat

Evidence:
- `packages/delivery/src/merge-command.ts:83` (`autoRefusal`, the only caller of `github.ci`, runs with `--auto` only), `packages/delivery/docs/commands/merge.md:7-9` (the PASS alone), `packages/orchestration/roles/coordinator.md:25`
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: when a plugin provides `github.ci`, a plain merge asks it as `--auto` does; a run on the branch's own commits that ended other than `success` refuses with the same `--auto merges only with CI passed …` line reworded for the merge, lifted by `--no-ci`, which then goes with a plain merge too on the owner's word; no run, a pending one, or github not loaded merges as today (the owner's merge waits for nothing). Tests in `merge.test.ts`: a failed run on the tip refuses without `--no-ci` and merges with it; a pending run and none merge; `--no-ci` without `--auto` no longer wrong usage (`:312` updated); `docs/commands/merge.md` and `coordinator.md:25` say it.
- `npm test` and `npm run check` pass.

## Scope

In:
- when a plugin provides `github.ci`, a plain merge asks it as `--auto` does; a run on the branch's own commits that ended other than `success` refuses with the same `--auto merges only with CI passed …` line reworded for the merge, lifted by `--no-ci`, which then goes with a plain merge too on the owner's word; no run, a pending one, or github not loaded merges as today (the owner's merge waits for nothing). Tests in `merge.test.ts`: a failed run on the tip refuses without `--no-ci` and merges with it; a pending run and none merge; `--no-ci` without `--auto` no longer wrong usage (`:312` updated); `docs/commands/merge.md` and `coordinator.md:25` say it.

## Decisions

- 2026-10-23: Source: F6 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
