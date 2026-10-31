# AR0588 - Outcome

- Merged: 2026-10-31, `e4a950b0`
- Branch: arthur/2026-10-31-worker-c2342d8c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.01, reviews $0.66; review rounds 2

## What went in

- `arthur.config.example.ts`: lists discord and dokploy as built, imports dokploy, shows a `dokploy({ instances })` section and a `dokploy.project(...)` line in a project file.
- `package-lock.json`: holds `@arthur/dokploy` as a workspace, beside main's `@arthur/discord`.
- `packages/dokploy/package.json`: the `@arthur/dokploy` package, exporting the plugin and its options file.
- `packages/dokploy/src/dokploy.ts`: the plugin. It needs `projects`, checks each project's `dokploy.project(...)`, builds the instances from `url` and the token, and registers `dokploy` (not allowed in jobs).
- `packages/dokploy/src/dokploy-options.ts`: summary, table and `checkOptions` for `instances` and `timeoutSeconds`, plus the https / private-http URL rule.
- `packages/dokploy/src/dokploy-api.ts`: the GET of `<url>/api/<procedure>` with `x-api-key`, no redirects and a timeout. Errors come back as one line with the token redacted; `field`, `text` and the id pattern live here too.
- `packages/dokploy/src/dokploy-command.ts`: `apps`, `app` and `status`, picking the instance and the app, with the refusals made before any request.
- `packages/dokploy/docs/dokploy.md`: options, the config and project-file example, and the refusals at load.
- `packages/dokploy/docs/commands/dokploy.md`: each verb with its Dokploy doc page, its output, how the app and instance are picked, the refusals and the errors.
- `packages/dokploy/test/fake-dokploy.ts`: the fake Dokploy (an http server on a port the OS picks) answering `project.all` (current and documented forms), `application.one` and `deployment.all`. It answers errors in tRPC's shape, can be scripted to fail, and records every request.
- `packages/dokploy/test/dokploy-shapes.json`: the answer shapes, recorded from the documentation's example and from Dokploy v0.30.10's source.
- `packages/dokploy/test/fake-shapes.test.ts`: checks every route of the fake against the recorded shapes at every depth, and checks the comparison itself.
- `packages/dokploy/test/dokploy.test.ts`: tests the output, instance picking, refusals, Dokploy errors, the redirect, piece and token refusals, and that no secret is printed.
- `packages/dokploy/test/dokploy-options.test.ts`: tests the URL rule both ways, the instances rules, `timeoutSeconds` and unknown options.
- `test/structure.test.ts`: gives dokploy a line budget of 450, beside discord's 750.
- `test/option-tables.test.ts`: checks dokploy's options file with every other plugin's, discord's included.
- `test/job-gate.test.ts`: loads dokploy and checks that `dokploy apps` and `dokploy status` are refused inside a job.
- `spec/features/AR0588-plan-a-dokploy-plugin-deploy-and-upload-to-the-owner-s-dokploy-servers/findings.md`: holds F1.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1381/1450 passed.

## Left open

- Deferred (client summary): F1. `--instance` cannot name the unnamed instance
