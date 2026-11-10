# AR0672 - `arthur plugin new` writes a package without the release version, so every new plugin fails `npm test` until it is edited by hand

```json
{
  "id": "AR0672",
  "title": "`arthur plugin new` writes a package without the release version, so every new plugin fails `npm test` until it is edited by hand",
  "date": "2026-11-10",
  "budget": 3
}
```

## Description

`arthur plugin new` writes a package with the release version, so a new plugin passes `npm test` as created, as its doc promises.

## Goal

every new-plugin ticket spends worker time, and sometimes a FAIL or a merge of main, on the same edit, and the command's doc promises it is not needed.

Evidence (audit 2026-11-10):
- `packages/develop/src/plugin-template.ts:6`: the package.json it writes has `name, private, type, license, exports` and no `version`. I ran `pluginFiles("acme","acme")` with node: the new package.json's version is `undefined`, while the root's is `0.1.0`.
- `packages/develop/src/plugin-new.ts:61` (`locked`): the lockfile entry for `packages/<name>` gets only `name` and `license`.
- `packages/core/test/plugin-range.test.ts:104`: asserts that every `packages/*/package.json` and its lockfile entry hold the root's version.
- `packages/develop/docs/commands/plugin.md:33`: "As created, the package passes `npm run check`, `npm test` and the structure test with no hand edit." This is false since AR0640.
- `packages/develop/test/plugin-new.test.ts:60`: runs check, the package's own test and the structure test, but not `plugin-range.test.ts`, so nothing catches this.
- It has been fixed by hand five times. Each time `"version": "0.1.0"` was added as the last key, after the command had run:
  - activity: in merge commit `098ce7b1`.
  - stats: `fe5a92fd`.
  - docker: AR0645, `f2c0bc90`.
  - herdr: AR0670, `f6d5238c`.
  - speak: AR0553, `9a419e09`.

- Kind: fix

## Done means

- `pluginFiles` writes the root package.json's `version` into the new package.json, and `locked` writes it into its lockfile entry.
- `packages/develop/test/plugin-new.test.ts`: its "passes as created" test also runs `packages/core/test/plugin-range.test.ts` on the copy; that test fails before the change and passes after it.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/develop/src/plugin-template.ts`: `pluginFiles` writes the root package.json's `version`.
- `packages/develop/src/plugin-new.ts`: `locked` writes it into the lockfile entry.
- `packages/develop/test/plugin-new.test.ts`: its "passes as created" test also runs `packages/core/test/plugin-range.test.ts` on the copy.

Out:
- adding the new plugin to `test/option-tables.test.ts`.

## Decisions
- 2026-11-10: Source: audit spec/quality/2026-11-10.md
- 2026-11-10: Source: F3 of AR0650
- 2026-11-10: Source: F4 of AR0650
- 2026-11-10: AR0672 approved; the owner: "approve all five" (AR-D608)
