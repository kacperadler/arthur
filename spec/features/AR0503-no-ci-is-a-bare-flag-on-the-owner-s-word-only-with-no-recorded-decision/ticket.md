# AR0503 - `--no-ci` is a bare flag, "on the owner's word only", with no recorded decision

```json
{
  "id": "AR0503",
  "title": "`--no-ci` is a bare flag, \"on the owner's word only\", with no recorded decision",
  "date": "2026-10-27"
}
```

## Description

F5 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/delivery/src/merge-command.ts:40`, `:108`; `packages/delivery/docs/commands/merge.md:36`, `:67`; `packages/delivery/src/auto-merge.ts:53`
- Input: the coordinator's `arthur merge <job> --no-ci`, or `--auto --no-ci`, on a branch whose CI ended `failure`.
- Why the check misses it: AR0355 gave `--unreviewed` a decision check and left `--no-ci` a sentence in the docs and the role. `--auto --no-ci` merges without the owner and without CI, given a PASS.
- What: a branch whose CI failed goes in on the checks on main alone, without the owner having said so.
- Suggestion: `--no-ci` takes `--decision <id>`, checked by `decision.owner` with `what: "--no-ci"`, kind `merge`, as `--unreviewed` is. Tests as for `--unreviewed` in `merge.test.ts`.

## Goal

`arthur merge --no-ci` needs the owner's recorded decision, as `--unreviewed` does, so a branch whose CI failed never goes in on the coordinator's word alone. Evidence: `packages/delivery/src/merge-command.ts:40`, `:108` take `--no-ci` as a bare flag; `--auto --no-ci` merges with no owner at all (`auto-merge.ts:53`).

- Kind: security

## Done means

- `--no-ci` without `--decision <id>` is refused; with one, it is checked by `decision.owner` with `what: "--no-ci"`, kind `merge`, as `--unreviewed` is; a wrong kind, an open or another ticket's decision is refused. Tests in `merge.test.ts` as for `--unreviewed`.
- `--auto --no-ci` is refused.
- `merge.md` and the coordinator's role say so.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/merge-command.ts`, `auto-merge.ts`, `packages/delivery/test/merge.test.ts`, `packages/delivery/docs/commands/merge.md`, `packages/orchestration/roles/coordinator.md`.

Out:
- `--unreviewed`: unchanged.

## Decisions

- 2026-10-27: Source: F5 of AR0404
- 2026-10-27: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D74)
