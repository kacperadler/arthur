# AR0564 - A report skill: how every HTML page for the owner is styled and checked before it is sent

```json
{
  "id": "AR0564",
  "title": "A report skill: how every HTML page for the owner is styled and checked before it is sent",
  "date": "2026-10-29"
}
```

## Description

The owner, 2026-10-29, with a screenshot of the pyramid report: "sometimes in the report the commands are not visible, remember this in the future, maybe create a skill for creating a report that will describe how to use colors, styles, etc."

The cause in that report: a `code` chip with a light grey background inherited the white text of the black heading it sat in, so `arthur repeats` and `/pyramid X` were white on light grey (contrast about 1.1:1). The coordinator writes such pages by hand (the night report, the pyramid report), and roles will write more (AR0563's before and after page, the retro's and audit's pages); the only rule today is AR-D298 (black and white base, blue accent, red only for what matters, content centred), kept in the coordinator's memory.

## Goal

Every HTML page sent to the owner follows one written style and passes one contrast and phone-width check before it is sent, so nothing on it is unreadable.

- Kind: docs

## Done means

- A skill file, `.agents/arthur/criteria/report.md`: the palette (AR-D298), type, layout for a phone first (no horizontal scroll at 420 px, content centred, tables that wrap), components (number tiles, before and after columns, tables, notes, warnings, tags for layers), and the rules that would have prevented this bug: every element that sets a background also sets its text colour; a chip (`code`, a tag) inside a dark block is styled for that block; red only for what needs the owner; every command and id readable.
- The check, in the same file, run before every `arthur send` of a page (AR-D348, option 2): a simple script that renders it at 420 px wide, confirms nothing scrolls sideways, and confirms every element's declared text colour against its own or its nearest ancestor's declared background is at 4.5:1 or more. It does not claim to catch every way text can become unreadable, and the file says so. Then a required step: take a screenshot at phone width and look at it before sending. The code and tests that tried to refuse every kind of unreadable text (overlapping elements, pseudo-element content, filters, animations, form controls and the like) are removed.
- The coordinator's prompt reads it (its criteria list), and so do the roles that write a page for the owner (retro and auditor today; AR0563's pyramid role when it lands).
- `arthur init` gives a new project the file's skeleton, as it does the other criteria.
- A test that the coordinator's and the retro's assembled prompts hold the file.

## Scope

In:
- `.agents/arthur/criteria/report.md` (new).
- `packages/orchestration/src/` (the coordinator's criteria list), `packages/manage/src/` (retro and auditor criteria lists), `packages/projects/src/` (`arthur init`'s criteria skeleton), their tests; line budgets as the change measures.

Out:
- Changing manage's plain `page()` builder for filed reports: it sets no colours, so it has no contrast bug.
- A contrast check inside `arthur send`: a later ticket if pages still go out unreadable.

## Decisions
- 2026-10-29: AR0564 report skill approved; started once AR0555 merges, beside the AR0561 planner and the AR0562 worker; the owner: "sometimes in the raport the commands are not visible, remember this in the future, maybe create a skill for creating a rport that will describe how to use colors, styles, ect" (AR-D339)
- 2026-10-29: AR0564: another round; the page check waits until the page has fully loaded and refuses every kind of text it cannot read, then review round 3; the owner: "AR-D347 1" (AR-D347)
- 2026-10-29: AR0564: another round on the review-3 findings, then review round 4; the owner: "AR-D348 1" (AR-D348)
- 2026-10-30: AR0564 changed: keep the style rules and a simple check of declared colours, drop the claim of a complete check, add a phone-width screenshot the writer looks at before sending; the owner: "AR-D348 - go with recommendation" (AR-D348)
- 2026-10-30: AR0564 budget raised by $8 to $20.57 so its worker finishes the round; the owner: "AR-D349 - go with recommendation" (AR-D349)
- 2026-10-30: AR0564: another round; the worker drops or tests the 20-screenshot cap, then review round 5; keep going until it is merged; the owner: "AR-D352 1 and go till is merged" (AR-D352)
- 2026-10-30: AR0564 budget raised by $5 to $25.57, under the owner word to go until it is merged; the owner: "AR-D352 1 and go till is merged" (AR-D353)
