# AR0072 - `arthur config check` prints one bad plugin entry twice

```json
{
  "id": "AR0072",
  "title": "`arthur config check` prints one bad plugin entry twice",
  "date": "2026-10-16"
}
```

## Description

`checkPlugins` and `checkEnv` each validate the plugin list, and `configCheck` prints both refusals, in different wording. Reproduced with `export default { plugins: [1, { name: "orchestration", setup() {} }] };` and `node packages/core/src/cli.ts config check`, which printed `...: plugins[0]: expected a plugin such as youtrack({ ... }), got 1`, then `...: plugins[0]: expected a plugin such as youtrack({ ... }), got a number`, and exit 1.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: bug

Evidence:
- `packages/core/src/env.ts:85-94`, `packages/core/src/host.ts:116-129`, `packages/core/src/config-check.ts:22-31`
- Found by: 2026-10-16-ar0069-core-line-review-ad27c8c4 (worker), 2026-10-16

## Done means

- The fix, with a test that proves it: proposal A1 of `spec/quality/core-lines-2026-10-16.md`: `checkEnv` skips the entries `checkPlugins` refuses and drops its own `asPlugin`, about 12 lines fewer. That is cut ticket 1 there, so this finding can be folded into it.
- `npm test` and `npm run check` pass.

## Scope

In:
- proposal A1 of `spec/quality/core-lines-2026-10-16.md`: `checkEnv` skips the entries `checkPlugins` refuses and drops its own `asPlugin`, about 12 lines fewer. That is cut ticket 1 there, so this finding can be folded into it.

## Decisions

- 2026-10-16: Source: F1 of AR0069
