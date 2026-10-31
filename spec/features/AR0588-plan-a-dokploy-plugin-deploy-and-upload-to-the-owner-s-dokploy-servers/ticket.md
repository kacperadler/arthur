# AR0588 - Plan: a dokploy plugin, deploy and upload to the owner's Dokploy servers

```json
{
  "id": "AR0588",
  "title": "Plan: a dokploy plugin, deploy and upload to the owner's Dokploy servers",
  "date": "2026-10-30"
}
```

## Description

The owner, 2026-10-30: "i think we will need a dokploy plugin for athur".

In a MEGA.dev Challenge that day, the coordinator put a page on the owner's Dokploy server through curl and a token the owner pasted into the chat. Dokploy's drop deploy is `POST /api/application.dropDeployment` with an `x-api-key` header and the form fields `applicationId` and `zip`, and `GET /api/project.all` lists the projects and their applications. There was no plugin, so nothing kept the token out of the chat, checked the address, or told the coordinator how to do it again.

## Goal

The coordinator deploys to the owner's Dokploy servers through `arthur dokploy ...`, with each server's token held in the environment the way YouTrack's is (`ARTHUR_DOKPLOY_<INSTANCE>_TOKEN`), so no token passes through a chat again.

- Kind: feat
- Plan: yes

## Done means

- A plan, approved by the owner, that names:
  - the commands, for example `arthur dokploy apps` (projects and applications), `arthur dokploy app <id>`, `arthur dokploy upload <app> <file or folder>` (drop deploy), `arthur dokploy deploy <app>` and `arthur dokploy status <app>`, each with its doc page and its refusals;
  - which commands only read and which write, and that a write runs only on the owner's word, as GitHub's and YouTrack's do;
  - several Dokploy instances (the owner, 2026-10-30, AR-D386), as the vision's named instances: each in `arthur.config.ts` with a name, a URL and `tokenEnv` (`ARTHUR_DOKPLOY_<INSTANCE>_TOKEN`; one instance may omit its name); a project names its instance; every command takes `--instance <name>` and refuses an ambiguous call when several are set and none is named; `arthur dokploy apps` lists each instance's projects and applications under its name;
  - that only the owner's own servers are called, by the URL the config gives;
  - what a job may do with the plugin, if anything (a preview upload from a worker, or the coordinator only);
  - the fake Dokploy in tests, answering in the shape Dokploy's API documentation shows, with every field;
  - the plugin's line budget and the tickets the plan splits into.

## Scope

In:
- The plan only: `spec/features/AR0588-*/plan.md`.

Out:
- Managing the Dokploy server itself (installing it, its users and its domains): the owner does that in Dokploy.

## Decisions
- 2026-10-30: AR0588 approved; its plan is written after the current plan tickets (AR0572, AR0574, AR0576, AR0579, AR0580, AR0583, AR0585); the owner: "AR-D382 1" (AR-D382)
- 2026-10-30: AR0588 plan starts now, ahead of the remaining plan tickets; the plugin serves several named Dokploy instances; the owner: "I wanna add the dokploy plugin as fast as possible, BUT, there is a catch, what if i have multiple dokploy instances?" (AR-D386)
- 2026-10-30: Plan approved by the owner: plan.md at 293af006, as written: https only, an upload over a Git or Docker app only with --replace-source, dokploy line budget 450; the owner: "AR-D390 1 - I already send this to you" (AR-D390)
- 2026-10-31: Merge AR0588 ticket 1 (dokploy plugin, read only) now; the owner: "Go all with recommendations" (AR-D409)
