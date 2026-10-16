# AR0069 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. `arthur config check` prints one bad plugin entry twice

- Kind: bug
- Found by: 2026-10-16-ar0069-core-line-review-ad27c8c4 (worker), 2026-10-16
- Where: `packages/core/src/env.ts:85-94`, `packages/core/src/host.ts:116-129`, `packages/core/src/config-check.ts:22-31`
- What: `checkPlugins` and `checkEnv` each validate the plugin list, and `configCheck` prints both refusals, in different wording. Reproduced with `export default { plugins: [1, { name: "orchestration", setup() {} }] };` and `node packages/core/src/cli.ts config check`, which printed `...: plugins[0]: expected a plugin such as youtrack({ ... }), got 1`, then `...: plugins[0]: expected a plugin such as youtrack({ ... }), got a number`, and exit 1.
- Suggestion: proposal A1 of `spec/quality/core-lines-2026-10-16.md`: `checkEnv` skips the entries `checkPlugins` refuses and drops its own `asPlugin`, about 12 lines fewer. That is cut ticket 1 there, so this finding can be folded into it.
- Status: ticket AR0073 (folded in; AR0072 dropped)
