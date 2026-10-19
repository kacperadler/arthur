# AR0219 - schedule.register still finds a plugin's package folder by its name

```json
{
  "id": "AR0219",
  "title": "schedule.register still finds a plugin's package folder by its name",
  "date": "2026-10-19"
}
```

## Description

Since AR0161, `host.code` takes each plugin's package from its own module, but `schedule.register` (`packages/schedule/src/register.ts:21`) still finds the registering plugin's folder by its name, so a plugin whose module name differs from its package gets the wrong folder for its procedures.

## Goal

`schedule.register` takes the registering plugin's package folder from the plugin itself (the folder the host took from its `module`), never from the list by name.

- Kind: risk

## Done means

- A test registers an entry from a plugin whose package folder name differs from the plugin's name, and its procedure is found; it fails on today's name lookup.

## Scope

- `packages/schedule/src/register.ts`, the host's hand-over of the folder, their tests.

## Decisions

- 2026-10-19: Source: F1 of AR0161. Approved under the owner's word of the same day: findings are built in batches; built with AR0218.
- 2026-10-19: The owner: finish what is in progress today, on the usage there is now (85%).
