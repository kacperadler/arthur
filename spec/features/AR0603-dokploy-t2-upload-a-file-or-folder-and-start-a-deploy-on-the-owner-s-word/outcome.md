# AR0603 - Outcome

- Merged: 2026-11-06, `39c9f9a0`
- Branch: arthur/2026-11-06-worker-8af99dd8
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $17.21, reviews $2.62; review rounds 3

## What went in

- `packages/dokploy/src/dokploy-zip.ts`: new. Zips a file or folder in memory, with regular files only and no zip64, or sends a ready `.zip` as it is. Refuses a symlink, a special file, a missing or unreadable path, an empty folder, more than 65535 files, or a zip over 4 GiB.
- `packages/dokploy/src/dokploy-command.ts`: adds `upload` and `deploy`. `upload` reads the app first, refuses to switch its source unless given `--replace-source`, and keeps its `dropBuildPath`. Each prints the `arthur dokploy status` call that follows the deployment.
- `packages/dokploy/src/dokploy-api.ts`: sends POST requests as JSON or a multipart form. Takes an empty answer only from a write that succeeded. A 403 on a write says "may not change". Exports `NOTHING`.
- `packages/dokploy/src/dokploy-options.ts`: the `tokenEnv` description says the Dokploy user Arthur "acts as".
- `packages/dokploy/src/dokploy.ts`: the header comment names the writes.
- `packages/dokploy/test/dokploy.test.ts`: tests for upload and deploy and every refusal, the zip read back, `--replace-source`, `dropBuildPath`, Content-Types, empty answers and usage errors.
- `packages/dokploy/test/fake-dokploy.ts`: the fake answers `application.deploy` and `application.dropDeployment` and parses request bodies as Dokploy does. It records each request's Content-Type and body, and has `readZip`.
- `packages/dokploy/test/fake-shapes.test.ts`, `packages/dokploy/test/dokploy-shapes.json`: record the shape of the dropDeployment answer and of Dokploy's input error.
- `packages/dokploy/docs/commands/dokploy.md`, `packages/dokploy/docs/dokploy.md`: the writing sections, refusals and errors.
- `packages/orchestration/roles/coordinator.md`: how to look at a project's Dokploy apps, and to upload or deploy only when the owner asks.
- `README.md`: dokploy is built, upload and deploy included, and is no longer listed as planned or next.
- `arthur.mmd`: a built dokploy node, with the Dokploy servers outside Arthur; roadmap entry 113.
- `docs/architecture/core-and-plugins.mmd`, `docs/architecture/versions.mmd`, `docs/setup.md`, `arthur.config.example.ts`: dokploy's upload and deploy shown as built.
- `spec/roadmap.md`: entry 113, Dokploy, built by AR0588 and AR0603, beside main's Stats entries 108 to 112.
- `spec/features/AR0603-dokploy-t2-upload-a-file-or-folder-and-start-a-deploy-on-the-owner-s-word/findings.md`: new, with F1 (a ready zip is sent unchecked) and F2 (a file of 2 to 4 GiB is refused as unreadable), both open.
- arthur.config.example.ts: not described
- docs/architecture/core-and-plugins.mmd: not described
- docs/architecture/versions.mmd: not described
- docs/setup.md: not described
- packages/dokploy/docs/commands/dokploy.md: not described
- packages/dokploy/docs/dokploy.md: not described
- packages/dokploy/test/dokploy-shapes.json: not described
- packages/dokploy/test/fake-shapes.test.ts: not described

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1517/1588 passed.

## Left open

- Deferred (client summary): F1. A ready .zip is sent unchecked, symlink entries included
- Deferred (client summary): F2. A file between 2 and 4 GiB is refused as unreadable, not by its size
