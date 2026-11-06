# AR0603 - Dokploy T2: upload a file or folder and start a deploy, on the owner's word

```json
{
  "id": "AR0603",
  "title": "Dokploy T2: upload a file or folder and start a deploy, on the owner's word",
  "date": "2026-11-01",
  "machine": "local"
}
```

## Description

This is the second build of the approved Dokploy plan (AR0588, AR-D390). Today `arthur dokploy` only reads projects, applications and deployments. After this ticket, the coordinator can upload a file or folder to an application and start a deploy through Dokploy's API, on the owner's word. No token goes through a chat.

## Goal

Build "Ticket 2 (writes)" of `spec/features/AR0588-plan-a-dokploy-plugin-deploy-and-upload-to-the-owner-s-dokploy-servers/plan.md`; that plan is the source of truth. It moves the vision's dokploy row from reads to reads and writes. Evidence of the gap: `README.md` line 50 says "upload and deploy planned".

- Kind: feat

## Done means

- `arthur dokploy upload <path>` zips a file or folder and sends it as multipart to the app's `application.dropDeployment`.
  - The zip holds regular files only. Symlinks, special files and the zip format's limits are refused.
  - It reads the app first. It refuses to switch the app's source unless `--replace-source` is given, and it keeps `dropBuildPath`.
- `arthur dokploy deploy` calls `application.deploy`.
- Both commands run for the coordinator only, never inside a job. Both refuse an ambiguous instance or app before any request.
- Tests run against the fake Dokploy, in the documented shape, with a zip read-back. Every refusal has a test that fails when it is removed.
- Docs:
  - `packages/dokploy/docs/commands/dokploy.md` gains the write sections.
  - The coordinator role says that writes go only on the owner's word.
  - `README.md`, `arthur.mmd`, `spec/vision.md` and `spec/roadmap.md` say upload and deploy are built.
  - `CHANGELOG.md` is updated.
- `npm run check` and `npm test` pass, and the dokploy budget of 450 holds.

## Scope

In:
- `packages/dokploy/src/dokploy-zip.ts` (new) and `dokploy-command.ts`.
- `packages/dokploy/test/dokploy.test.ts` and `fake-dokploy.ts`.
- `packages/dokploy/docs/commands/dokploy.md`.
- `packages/orchestration/roles/coordinator.md`, which is always reviewed.
- `README.md`, `arthur.mmd`, `spec/vision.md`, `spec/roadmap.md`, `CHANGELOG.md`.

Out:
- AR0588 F1, naming the unnamed instance when several servers exist, is a separate question to the owner.
- Deploys started by a job: never; writes are the coordinator's on the owner's word.

## Decisions
- 2026-11-06: Raise the AR0603 budget to $16 so it finishes its tests (owner approved the ticket and its queue, AR-D518 and AR-D524); the owner: "AR0603 and AR0654 approved and join the queue" (AR-D525)
- 2026-11-06: Merge pull request #2 (AR0603) to Arthur main; the owner: "Approved" (AR-D530)

