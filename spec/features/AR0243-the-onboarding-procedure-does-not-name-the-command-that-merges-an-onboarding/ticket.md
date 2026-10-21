# AR0243 - The onboarding procedure does not name the command that merges an onboarding

```json
{
  "id": "AR0243",
  "title": "The onboarding procedure does not name the command that merges an onboarding",
  "date": "2026-10-21"
}
```

## Description

it says "merge only on the owner's word" but not how: an onboarding is never reviewed, so its merge is `arthur merge <job id> --unreviewed`, which `arthur merge --help` and the coordinator's role now say, but the procedure the coordinator gets at the onboarding's end does not.

## Goal

The onboarding-ended procedure names the merge command: end its merge sentence with "`arthur merge <job id> --unreviewed`, then the committed files", in `packages/projects/roles/coordinator/onboarding-ended.md`; nothing else.

- Kind: improvement
- Model: haiku

Evidence:
- `packages/projects/roles/coordinator/onboarding-ended.md:7`
- Found by: 2026-10-20-roadmap-54-arthur-merge-76ffc10e (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: end that sentence with "`arthur merge <job id> --unreviewed`, then the committed files", in the projects package; nothing else.
- `npm test` and `npm run check` pass.

## Scope

In:
- end that sentence with "`arthur merge <job id> --unreviewed`, then the committed files", in the projects package; nothing else.

## Decisions

- 2026-10-21: Source: F3 of AR0239
- 2026-10-21: Approved by the owner (Telegram, morning report).
