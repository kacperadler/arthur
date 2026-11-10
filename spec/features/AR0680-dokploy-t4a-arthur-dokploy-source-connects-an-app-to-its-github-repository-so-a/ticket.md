# AR0680 - Dokploy T4a: arthur dokploy source connects an app to its GitHub repository, so a push deploys it

```json
{
  "id": "AR0680",
  "title": "Dokploy T4a: arthur dokploy source connects an app to its GitHub repository, so a push deploys it",
  "date": "2026-11-10"
}
```

## Description

An app made by `arthur dokploy setup` today has no source; this connects it to its GitHub repository through Dokploy's GitHub app, with auto-deploy, so a push to its branch deploys it.

## Goal

Part T4a of the approved AR0655 plan (`spec/features/AR0655-plan-dokploy-t4-a-whole-project-from-arthur-an-app-built-from-its-git-repository/plan.md`, approved at e3069514, AR-D534): follow its Approach, Files, Risks and How to test for T4a.

- Kind: feat

## Done means

- `arthur dokploy source <app> --repo owner/name --branch <branch>` connects the app through the GitHub provider and turns auto-deploy on; each refusal the plan names (no GitHub app on the instance, a repo it cannot see, a source already set without `--replace`, a bad owner, repo or branch) prints its line and changes nothing; a test per refusal and one for the success, against a fake Dokploy answering in its documented shape.
- `packages/dokploy/docs/dokploy.md` and the command's doc page describe it.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/dokploy/src/dokploy-source.ts` (new), `packages/dokploy/src/dokploy-command.ts`, `packages/dokploy/src/dokploy-api.ts` (comment), the routes file the plan names, their tests, `packages/dokploy/docs/`.

Out:
- The database (AR0681) and backups (AR0682).

## Decisions
- 2026-11-10: AR0680 approved; the owner: "AR-D612 - approve" (AR-D612)
