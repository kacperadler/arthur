# AR0263 - Outcome

- Merged: 2026-10-21, `e0d14fb`
- Branch: h/2026-10-21-ar0263-roadmap-83-findin-30973403
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.46, reviews $1.37; review rounds 2

## What went in

- New `packages/findings` plugin: the `findings.md` reader out of the core, `findings.onMerge` called by the merge with the open findings, `findings({ mode: { <project>: "ticket" | "grouped" | "summary" } })` (default `ticket`; `summary` marks each `deferred (client summary)` and lists it in the outcome); `/findings` moves here. A ticket from a finding keeps its Kind and `budget`; every worker prompt carries the `findings.md` template.
- Without the plugin, findings stay open and the merge says so once. Budgets findings 254, orchestration 1523.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 922/922 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0267 (F1), AR0268 (F2).
