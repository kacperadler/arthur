# AR0130 - Roadmap 30 names `npm i -g arthur` as the fix for a machine without Arthur, which does not install it

```json
{
  "id": "AR0130",
  "title": "Roadmap 30 names `npm i -g arthur` as the fix for a machine without Arthur, which does not install it",
  "date": "2026-10-18"
}
```

## Description

entry 30 lists `npm i -g arthur` among the doctor fixes. Every `package.json` here is `"private": true` and nothing is published to npm; `docs/deploy.md` step 2 installs the core on another machine by cloning and `npm ci` at the same commit. The machines plugin's fix follows deploy.md (`install Arthur's core there at this commit, arthur on the PATH of a command over ssh (docs/deploy.md)`), so the roadmap and the code now say different things.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: refactor

Evidence:
- `spec/roadmap.md:292` (entry 30, Also delivers); `docs/deploy.md:12`
- Found by: 2026-10-18-ar0124-machines-list-56a82238 (worker), 2026-10-18

## Done means

- The fix, with a test that proves it: change the roadmap's fix to deploy.md's install; nothing in the code changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- change the roadmap's fix to deploy.md's install; nothing in the code changes.

## Decisions

- 2026-10-18: Source: F1 of AR0124
- 2026-10-18: Dropped by the coordinator: AR0128 (the release plan) decides how Arthur is installed, and its follow-up fixes this roadmap line.
