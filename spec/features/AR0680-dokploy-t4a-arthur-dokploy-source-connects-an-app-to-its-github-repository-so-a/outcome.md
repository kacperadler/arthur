# AR0680 - Outcome

- Merged: 2026-11-10, `3c9144dc`
- Branch: arthur/2026-11-10-worker-622e3180
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $8.36, reviews $2.35; review rounds 2

## What went in

- packages/dokploy/src/dokploy-source.ts: `sourceApp`, which checks `--repo`, `--branch` and `--build-path`, reads the app, its GitHub apps, repositories and branches, refuses before any write, then saves the GitHub source with push and turns auto-deploy on.
- packages/dokploy/src/dokploy-command.ts: the `source` verb, its flags (`--repo`, `--branch`, `--build-path`, `--github`, `--replace-source`), the rule that it needs `--repo` and `--branch`, and its usage line.
- packages/dokploy/src/dokploy-api.ts: the `ID` comment now names `source`'s checked GitHub app id, owner and repository as text put into a query.
- packages/dokploy/src/dokploy.ts: the header comment names `create`, `setup` and `source`.
- packages/dokploy/test/dokploy-source.test.ts: tests for the success path, the already-set case, auto-deploy, each refusal, each key of the same-source check (including a Docker app that kept its GitHub columns, and another GitHub app), GitHub's spelling in the saved body, branch characters, `--replace-source` and wrong usage, all against the fake Dokploy.
- packages/dokploy/test/fake-dokploy.ts: GitHub apps (`githubs`), the routes `github.githubProviders`, `getGithubRepositories` and `getGithubBranches`, the writes `application.saveGithubProvider` and `application.update`, and the app's GitHub fields and `github` record in `application.one`.
- packages/dokploy/test/github-examples.json: GitHub's documented repository and branch examples, verbatim, which the fake answers with.
- packages/dokploy/test/dokploy-shapes.json: the recorded shapes of the five new routes and of `application-one.github`, with their sources.
- packages/dokploy/test/fake-shapes.test.ts: checks the new routes against their shapes, and that an app with a GitHub app answers its record.
- packages/dokploy/test/dokploy.test.ts: the pinned usage line includes `source`.
- packages/dokploy/docs/commands/dokploy.md: the usage line, a "From Git" section, the `source` refusals and its wrong usage.
- packages/dokploy/docs/dokploy.md: the intro names `source`, the token's rights include changing a source, and a new section covers the owner's one-time GitHub app setup.
- docs/setup.md: the dokploy paragraph names `arthur dokploy source` and its GitHub app.
- README.md: the dokploy line names connecting an app to its GitHub repository.
- arthur.config.example.ts: the dokploy comment names `source`.
- packages/orchestration/roles/coordinator.md: the coordinator runs `source` only when the owner asks.
- spec/roadmap.md: entry 113 lists AR0680 and what it delivers.
- test/structure.test.ts: the dokploy line budget is 690 (was 615).
- spec/features/AR0680-dokploy-t4a-arthur-dokploy-source-connects-an-app-to-its-github-repository-so-a/findings.md: F1, the vision's dokploy row does not name the Git source.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1654/1725 passed.

## Left open

- Deferred (client summary): F1. The vision's dokploy row does not name the Git source
