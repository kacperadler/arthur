# AR0737 - Arthur's text uses '-' instead of '—', the owner's standard

```json
{
  "id": "AR0737",
  "title": "Arthur's text uses '-' instead of '—', the owner's standard",
  "date": "2026-11-24"
}
```

## Description

The owner set a standard on 2026-11-24: "new standard for arthur use "-" instead of "—"". Arthur's own text (what it says to the owner, its docs and its prompts) uses a plain hyphen "-" where it now has an em dash "—", and Arthur's styleguide says so for every later change.

## Goal

One dash in everything Arthur writes. Evidence: `grep -rc '—' packages --include=*.md --include=*.ts` finds `packages/orchestration/docs/commands/coordinator.md` (1), `decision.md` (2), `decisions.md` (1), `src/blocked-notice.ts` (2), `src/decision-views.ts` (1) and `test/decisions.test.ts` (16).

- Kind: chore

## Done means

- `.agents/arthur/criteria/styleguide.md`, beside "English only": text Arthur writes (messages, docs, prompts, code strings) uses "-", never "—".
- No "—" left in `packages/` (`grep -rn '—' packages` prints nothing), the strings of `blocked-notice.ts` and `decision-views.ts` included; `test/decisions.test.ts` expects the new text.
- The project's checks pass.

## Scope

In:
- `.agents/arthur/criteria/styleguide.md`: the rule.
- `packages/orchestration/docs/commands/{coordinator,decision,decisions}.md`, `packages/orchestration/src/{blocked-notice,decision-views}.ts`, `packages/orchestration/test/decisions.test.ts`.

Out:
- `spec/` and `CHANGELOG.md`: history stays as written.

## Decisions

- 2026-11-24: Source: the owner on Discord, "new standard for arthur use "-" instead of "—"".
- 2026-11-24: AR0737 approved: Arthur writes "-" instead of "—", styleguide rule and the 6 files fixed; budget $10; the owner: "ZF-D126 yes, ZF-D127 yes, AR-D721 yes, ZF-D125 yes" (AR-D721)
