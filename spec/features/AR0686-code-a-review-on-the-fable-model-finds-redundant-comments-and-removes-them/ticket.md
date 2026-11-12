# AR0686 - Code: a review on the fable model finds redundant comments and removes them

```json
{
  "id": "AR0686",
  "title": "Code: a review on the fable model finds redundant comments and removes them",
  "date": "2026-11-10"
}
```

## Description

One job on the fable model reads the source of the core and every plugin, finds comments that say nothing the code beside them does not already say, and removes them, so the code is shorter and easier to read and fewer comments go stale. The owner sees the list in the plan before any comment is removed.

## Goal

The owner asked on 2026-11-10: "and another thing about AR will be review of redundant comments", after asking for the redundant-tests review on fable 5.2 (AR0685). Evidence: `packages/*/src` holds about 3320 comment lines in 24085 lines of TypeScript (lines starting `//`, `/*` or `*`, counted 2026-11-10), and every line counts toward a package's line budget (styleguide, "Shape").

- Plan: yes
- Model: the same as AR0685 (AR-D623): claude-fable-5-1, or fable 5.2 if it exists when the job starts.

- Kind: refactor

## Done means

- The plan lists the comments to remove, by file and line, in groups with a reason each: a comment that restates the code below it, one that names what the function's name already says, one that is stale (says what the code no longer does), a commented-out block. It keeps a comment that says why (a decision id, a limit of an outside service, a trap), and names the kinds it keeps.
- The worker removes exactly what the approved plan lists; a stale comment is removed, or corrected where it holds a why. No code changes: `git diff -w` of the branch shows only comment lines removed or changed.
- The outcome gives the comment lines and each package's lines before and after.
- `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Scope

In:
- `packages/*/src/**`, `test/structure.ts`: comment lines only.

Out:
- Test files: AR0685 handles the tests.
- Docs, role and procedure Markdown.
- Lowering a package's line budget: a later decision of the owner.

## Decisions
- 2026-11-10: AR0686 approved: plan and worker on the same fable model as AR0685, after AR0685; the owner: "AR-D625: yes" (AR-D625)
- 2026-11-11: Plan approved by the owner: plan.md at 3b71031b; the owner: "AR-D634 - approve" (AR-D634)
- 2026-11-11: The AR0686 worker runs on Opus (claude-opus-5-5); the comment review on Fable is done; the owner: "AR0686 -> did you do the review already? if yes then use opus" (AR-D641)
- 2026-11-12: Merge AR0686; the owner: "AR-D663 1, AR-D656 1, AR-D657 1, AR-D658 1" (AR-D656)

