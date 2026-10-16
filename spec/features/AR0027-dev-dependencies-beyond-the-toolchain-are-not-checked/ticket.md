# AR0027 - Dev dependencies beyond the toolchain are not checked

```json
{
  "id": "AR0027",
  "title": "Dev dependencies beyond the toolchain are not checked",
  "date": "2026-10-16"
}
```

## Description

the styleguide says dev dependencies are the toolchain only (`typescript`, `@types/node`); roadmap entry 1 lists only runtime dependencies, so the structure test checks `dependencies`, `optionalDependencies` and `peerDependencies` and lets any `devDependencies` through.

## Goal

The no-runtime-dependency rule also keeps dev dependencies to the toolchain (typescript, @types/node), so a test-only package cannot creep in unnoticed.

- Kind: improvement

Evidence:
- `test/structure.ts` (`checkManifest`)
- Found by: 2026-10-16-ar0004-repository-rules-e926d472 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: add an allow-list of dev dependencies to the structure test, with a fixture that adds another one and fails.
- `npm test` and `npm run check` pass.

## Scope

In:
- add an allow-list of dev dependencies to the structure test, with a fixture that adds another one and fails.

## Decisions

- 2026-10-16: Source: F2 of AR0004
