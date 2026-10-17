# AR0106 - Findings

## F1. The favicon turns light in dark-mode browsers, which the ticket did not ask for

- Kind: improvement
- Found by: 2026-10-17-review-ar0106-logo-434c0b3a (review), 2026-10-17
- Where: `docs/logo/arthur-favicon.svg`
- What: one `<style>` line swaps navy for a light fill in dark mode.
- Suggestion: keep it; a navy icon is invisible on a dark tab bar.
- Status: dropped (kept on purpose)

## F2. A new test pins the README logo above the title, behaviour this branch did not change

- Kind: improvement
- Found by: 2026-10-17-review-ar0106-logo-434c0b3a (review), 2026-10-17
- Where: `site/test/markdown.test.ts`
- What: the test covers existing `splitTitle` behaviour that now matters because the README starts with the logo.
- Status: dropped (it guards the landing page the logo now relies on)
