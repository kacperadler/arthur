# AR0200 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The commit-rules doc and the vision show the regex that counts 72 after the prefix

- Kind: cleanup
- Found by: 2026-10-19-ar0151-docs-doctor-batch-1ae178d5 (worker), 2026-10-19
- Where: `packages/commit-rules/docs/commit-rules.md:7`, `spec/vision.md:100`
- What: AR0200 changed only `arthur.config.example.ts`; the `regex` example of the commit-rules doc (`^(feat|fix|docs)(\([\w-]+\))?!?: .{1,72}$`) and of the vision's table (`^(feat|fix|docs)(\(.+\))?!?: .{1,72}$`) still let a subject of about 90 characters pass, so a reader copying either gets the rule AR0200 fixed in the example.
- Suggestion: the same lookahead in both, `^(?=.{1,72}$)(feat|fix|docs)(\([\w-]+\))?!?: .+$`; the vision is the owner's, so its line waits for the owner's word. Out: the regex in `packages/commit-rules/test/commit-rules.test.ts`, which tests the hook, not the 72.
- Status: open
