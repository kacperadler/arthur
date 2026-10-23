# AR0207 - The option-tables test cannot hold a plugin without options, so nvm's options file is not checked there

```json
{
  "id": "AR0207",
  "title": "The option-tables test cannot hold a plugin without options, so nvm's options file is not checked there",
  "date": "2026-10-19"
}
```

## Description

the nvm plugin's options file (`packages/nvm/src/nvm-options.ts`) has an empty `table`, since nvm has no options but `enabled`. The test that checks every package's options file (summary in one line, each tool's version command) asserts that each file has at least one option, so nvm is left out of `PLUGINS` and its summary is checked by no test. `arthur setup` prints it fine (`nvm on no options`, seen by hand on this branch).

## Goal

The option-tables test covers plugins without options (nvm, commit-rules), so their options files are checked like every other.

- Kind: refactor

Evidence:
- `test/option-tables.test.ts` (`PLUGINS` and the assertion `${name} has options`)
- Found by: 2026-10-19-ar0196-nvm-52bdb90d (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: let that assertion accept an empty table for a plugin that declares none (or drop it: an option without a meaning is already caught per option), and add `nvm: [nvmFile, nvm()]` to `PLUGINS`. Out: options for nvm.
- `npm test` and `npm run check` pass.

## Scope

In:
- let that assertion accept an empty table for a plugin that declares none (or drop it: an option without a meaning is already caught per option), and add `nvm: [nvmFile, nvm()]` to `PLUGINS`. Out: options for nvm.

## Decisions

- 2026-10-19: Source: F1 of AR0196
- 2026-10-19: Approved under the owner's word of the same day; built together with AR0199, the same test.
