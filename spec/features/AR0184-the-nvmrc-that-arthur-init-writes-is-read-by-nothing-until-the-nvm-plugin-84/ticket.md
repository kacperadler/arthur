# AR0184 - The `.nvmrc` that `arthur init` writes is read by nothing until the nvm plugin (84)

```json
{
  "id": "AR0184",
  "title": "The `.nvmrc` that `arthur init` writes is read by nothing until the nvm plugin (84)",
  "date": "2026-10-19"
}
```

## Description

`arthur init` writes `.nvmrc` (`24` today) for entry 84, which is out of AR0181's Scope; until 84 is built, every job of the project runs on the Node of Arthur's service `PATH`, whatever the file says.

## Goal

The Node version `arthur init` writes into a project is actually used when that project's jobs run, once the nvm plugin (84) is built.

- Kind: improvement

Evidence:
- `packages/projects/src/init.ts` (`.nvmrc`, the major of `process.versions.node`)
- Found by: 2026-10-19-ar0181-onboarding-f9194d6e (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: build entry 84 as the roadmap describes it; its tests can use a repository `arthur init` gave its `.nvmrc`. Out: anything in `init`.
- `npm test` and `npm run check` pass.

## Scope

In:
- build entry 84 as the roadmap describes it; its tests can use a repository `arthur init` gave its `.nvmrc`. Out: anything in `init`.

## Decisions

- 2026-10-19: Source: F2 of AR0181
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
