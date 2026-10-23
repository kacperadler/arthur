# AR0358 - `review-needed` lets a small change to what the merge and each spawn run go in without a review (AR0311 F11, confirmed)

```json
{
  "id": "AR0358",
  "title": "`review-needed` lets a small change to what the merge and each spawn run go in without a review (AR0311 F11, confirmed)",
  "date": "2026-10-23"
}
```

## Description

a branch that changes at most 30 lines of a `package.json` script, a lockfile (`package-lock.json`, `bun.lock`, `yarn.lock`, `pnpm-lock.yaml`: a dependency's `resolved` URL), `.npmrc` (`ignore-scripts`, a registry), `.nvmrc`, or a hooks folder (`.githooks/`, `.husky/`), with the job's recorded checks passing, is `no review: <n> lines changed; the job's checks: …`, its ticket done, and the owner's plain `arthur merge` then runs that script, install or Node as Arthur on the VPS; in the probe each of the first four answered `no review`. `--auto` holds `**/package.json` (`auto-merge.ts:35`) but not the others either.

## Goal

Changes to what the merge and each spawn run (package.json scripts, lockfiles, `.npmrc`, `.nvmrc`, hooks) are always reviewed, however small; tested.

- Kind: risk

Evidence:
- `packages/delivery/src/delivery-options.ts:16` (the default always-review list: Arthur's own files and `.github/workflows/**`), `packages/delivery/src/review-needed.ts:53-83` (a branch of 30 lines or fewer with passing checks is `no review`), `packages/delivery/src/merge-checks.ts:46-63` and `packages/projects/src/install.ts` (the merge runs the tip's install, `check` and `test` scripts as `sh -c` in Arthur's process; each spawn runs the install)
- Found by: 2026-10-23-ar0324-security-check-87836883 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: add to `ALWAYS_REVIEW` what the merge and a spawn execute in every project: `**/package.json`, `**/package-lock.json`, `**/npm-shrinkwrap.json`, `**/bun.lock`, `**/bun.lockb`, `**/yarn.lock`, `**/pnpm-lock.yaml`, `**/.npmrc`, `**/.nvmrc`, `.githooks/**`, `.husky/**`; since `held` is also `--auto`'s and `delivery.alwaysReview`'s, `--auto` then refuses them and autopilot refuses a ticket whose Scope names one, which is the intent (a tradeoff to name in `docs/commands/review-needed.md`, "The always-review list"). Tests: rows in `review-needed.test.ts`'s table for a one-line change of each; `auto-merge.test.ts:146` a lockfile among the held paths; `:174`'s list check extended. Out: where the merge's steps run (AR0311 F14, AR0328).
- `npm test` and `npm run check` pass.

## Scope

In:
- add to `ALWAYS_REVIEW` what the merge and a spawn execute in every project: `**/package.json`, `**/package-lock.json`, `**/npm-shrinkwrap.json`, `**/bun.lock`, `**/bun.lockb`, `**/yarn.lock`, `**/pnpm-lock.yaml`, `**/.npmrc`, `**/.nvmrc`, `.githooks/**`, `.husky/**`; since `held` is also `--auto`'s and `delivery.alwaysReview`'s, `--auto` then refuses them and autopilot refuses a ticket whose Scope names one, which is the intent (a tradeoff to name in `docs/commands/review-needed.md`, "The always-review list"). Tests: rows in `review-needed.test.ts`'s table for a one-line change of each; `auto-merge.test.ts:146` a lockfile among the held paths; `:174`'s list check extended. Out: where the merge's steps run (AR0311 F14, AR0328).

## Decisions

- 2026-10-23: Source: F2 of AR0324
- 2026-10-23: Coordinator (free hand, finding ticket) approved; starts after the ten security checks AR0319-AR0328.
