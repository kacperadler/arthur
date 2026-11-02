# AR0568 - After the listen rename, the core still names the voice plugin, and versions.mmd misses four plugins

```json
{
  "id": "AR0568",
  "title": "After the listen rename, the core still names the voice plugin, and versions.mmd misses four plugins",
  "date": "2026-10-30"
}
```

## Description

A voice note sent while the listen plugin is off is answered with a hint to enable "the voice plugin", which no longer exists since its rename. After this, the hint names the listen plugin, and the version diagram lists every plugin of the first version that is built.

## Goal

An owner who sends a voice note with listen off is told to enable a plugin that does not exist. And the version diagram, which the vision points readers to, shows a smaller first version than the one built.

Evidence:
- `packages/core/src/message-parts.ts:16`: `NOT_TRANSCRIBED = "[voice note not transcribed: the voice plugin is not enabled]"`, which reaches the coordinator and the owner (`:68`). The plugin is `packages/listen/` since AR0554.
- The same line is quoted at `packages/listen/docs/listen.md:33`, `packages/core/test/parts.test.ts:60` and roadmap entry 49 (AR0554 F1, deferred as outside that ticket).
- `docs/architecture/versions.mmd:7-9`: the first version lists `listen` but not `video`, `uptime`, `nvm` or `findings`, though all are in `packages/` and the README (`README.md:53-54`, `:69-70`).

- Kind: ux

## Done means

- The line reads `[voice note not transcribed: the listen plugin is not enabled]` in the core, its test, `listen.md` and roadmap entry 49; `parts.test.ts` fails if the old wording comes back.
- `versions.mmd` has `video`, `uptime`, `nvm` and `findings` among the first version's nodes.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/core/src/message-parts.ts:16`: the wording.
- `packages/core/test/parts.test.ts`, `packages/listen/docs/listen.md`, `spec/roadmap.md` entry 49: the quoted line.
- `docs/architecture/versions.mmd`: four plugin nodes.

Out:
- The part kind `voice` stays.
- Nothing else changes.

## Decisions

- 2026-10-30: Source: audit spec/quality/2026-10-30.md
- 2026-10-30: AR0568 approved; its worker starts now; the owner: "AR0566, AR0567, AR0568 - approve" (AR-D358)
- 2026-10-30: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
