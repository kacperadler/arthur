# AR0657 - A reviewer does not file again what the ticket's findings.md already holds

```json
{
  "id": "AR0657",
  "title": "A reviewer does not file again what the ticket's findings.md already holds",
  "date": "2026-11-06"
}
```

## Description

The reviewer role says that a note restating an entry of the ticket's findings.md is not written again, so the owner, the audit and the retro stop reading the same finding twice.

## Goal

since AR0574, every `risk`, `bug` or `security` note of a passed review becomes a finding. 18 entries in 14 tickets are copies, which the owner, the audit and the retro then read twice. A check cannot hold this: whether a note adds something an entry lacks is a judgment of its words. Matching `F<n>` or `file:line` in the findings plugin would also drop a new risk at the same line, and AR0616 F2 and AR0626 F2 name no line of their F1.

Evidence:
- AR0390 F3, F4: restate F1 and F2 ("The worker filed this as F1").
- AR0395 F4: "confirms the worker's F1".
- AR0396 F4, F5: restate F1 and F2 ("Filed as F2").
- AR0520 F3, F4: "recorded as F1 … recorded as F2".
- AR0579 F3: "The worker already filed this as F1".
- AR0590 F3: the worker's F2, restated.
- AR0593 F2: "This is the worker's F1".
- AR0616 F2: "F1 is still open".
- AR0620 F2: "The worker filed this as F1".
- AR0621 F2: "F1 … is still Status: open".
- AR0624 F3: "F1 is a real remaining hole … filed as open".
- AR0626 F2: "already filed in findings.md".
- AR0627 F7, F8: "The worker filed this as F1", "This is F6".
- AR0628 F3: "already filed as F1".

- Kind: chore

## Done means

- `packages/delivery/roles/reviewer.md`, under Final message, says a note that only restates a findings.md entry is left out, and a note that adds to one names it and says what it adds.
- `npm run check` and `npm test` pass.

## Scope

In:
`packages/delivery/roles/reviewer.md`, the first paragraph under "Final message". The reviewer reads it before its verdict.

Before:
> Findings first, most important first, each `file:line`, what is wrong and why it matters; a FAIL names at least one finding the review criteria count as a reason to fail. Then the notes that do not block the merge, under `## Notes`, one line each: `- (<kind>) <file:line>: <title>. <what>`, the kind `security`, `bug` or `risk` for a note the merge of a PASS files as a finding of the ticket, `minor` for one it leaves in the review. Then the checks you ran, each with its real result.

After:
> Findings first, most important first, each `file:line`, what is wrong and why it matters; a FAIL names at least one finding the review criteria count as a reason to fail. Then the notes that do not block the merge, under `## Notes`, one line each: `- (<kind>) <file:line>: <title>. <what>`, the kind `security`, `bug` or `risk` for a note the merge of a PASS files as a finding of the ticket, `minor` for one it leaves in the review. Read the ticket's `findings.md` on the branch first: what one of its entries already says (the worker's `F<n>`, or an earlier review's) is no note; a note that adds to an entry names its `F<n>` and says only what is new. Then the checks you ran, each with its real result.

Out:
- Anything past the file this proposal names; a larger change is a new ticket.

## Decisions

- 2026-11-06: Source: retro spec/retro/2026-11-06.md
