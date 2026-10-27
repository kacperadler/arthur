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

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F5 of AR0404
