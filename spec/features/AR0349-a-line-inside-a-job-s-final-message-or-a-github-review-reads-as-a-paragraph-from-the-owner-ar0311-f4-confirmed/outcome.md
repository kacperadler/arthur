# AR0349 - Outcome

- Merged: 2026-10-23, `587442ae`
- Branch: h/2026-10-23-ar0349-forged-owner-para-cf06f333
- Reviews: review-1.md PASS
- Cost: worker $4.75, reviews $0.94; review rounds 1

## What went in

- `packages/orchestration/src/hand-over.ts`, `packages/session/src/handoff-extension.ts`: every message reaching the coordinator (a job's end, a plugin's text, the handoff after a restart) is a mark line (`[via <channel>]`, `[Arthur]`, `[Arthur: <plugin>]`) followed by each line of its text after `> `, split at every line-break character; a forged `[via …]` inside stays quoted text.
- `packages/orchestration/src/inbox.ts`: a `coordinator-message` carries the plugin that sent it; one without is refused. github and delivery no longer prefix their own name.
- The coordinator role and the docs say a quoted `[via …]` is never the owner. Budgets orchestration 2317, session 880, develop 704.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1061/1061 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40010196698

## Left open

- Findings: none; no findings.md on this ticket.
