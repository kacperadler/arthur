# AR0654 - Dokploy T3: create an app and set its build type, domain, volume and environment names, on the owner word

```json
{
  "id": "AR0654",
  "title": "Dokploy T3: create an app and set its build type, domain, volume and environment names, on the owner word",
  "date": "2026-11-06"
}
```

## Description

The owner asked on 2026-11-06 what the dokploy plugin can do and what it needs to do more. Today it only reads (`arthur dokploy apps`, `app`, `status`); AR0603 adds upload and deploy. A new app still needs the Dokploy panel or a hand-written API script with a copy of the key: creating the app, its build type, its domain, a volume and its environment. This ticket lets the coordinator do that through `arthur dokploy`, with the key staying in Arthur's environment.

## Goal

`arthur dokploy` sets up a new application end to end on the owner's word, so no key is ever copied out of the env file. Evidence: on 2026-11-06 the coordinator set up an app with `application.create`, `application.saveBuildType`, `domain.create`, `mounts.create` and `application.saveEnvironment` from a script, after the owner copied the key into a file by hand.

- Kind: feat

## Done means

- `arthur dokploy create <name> --project <dokploy project> [--environment <name>]` calls `application.create`; refused when the name exists in that environment.
- `arthur dokploy setup <app> [--dockerfile <path>] [--context <path>] [--domain <host> --port <n>] [--volume <name>:<path>]` calls `saveBuildType`, `domain.create` (https, letsencrypt) and `mounts.create`, each only when not already set; a domain whose host does not resolve to the server is named in a warning.
- `arthur dokploy env <app> set <NAME> <value>` and `arthur dokploy env <app> names`: names only are ever printed; a value is never echoed or logged, and setting keeps every other line.
- All run for the coordinator only, never in a job, and every write is on the owner's word (the coordinator role says so).
- Tests against the fake Dokploy in its documented shape; every refusal has a test that fails when removed. Docs and `CHANGELOG.md` updated; `npm run check` and `npm test` pass; a budget raise is named.

## Scope

In:
- `packages/dokploy/` (source, docs, tests), the coordinator role line, `README.md`, `spec/roadmap.md` if an entry names it.

Out:
- Upload and deploy: AR0603.
- Deleting apps, databases, compose services.

## Decisions
- 2026-11-06: AR0654 approved and joins the queue after AR0603; the owner: "AR0603 and AR0654 approved and join the queue" (AR-D524)

