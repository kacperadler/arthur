# AR0101 - Review 1

- Job: 2026-10-17-review-ar0101-diagram-90d45922
- Branch: h/2026-10-17-ar0101-diagram-fb43a273
- Commit reviewed: d88f7302bd1231ccd16dfb46e6715fc269c4e234
- Verdict: PASS

## Final message

Worktree clean. All findings confirmed, no uncommitted drift.

---

**Findings:** none blocking.

**Notes (non-blocking):**
- `arthur.mmd:91,129-130` — the `discord`/`slack`/`telegram` arrows into Outside Arthur, and the Owner→Telegram arrow, are marked `-.->` (dotted) correctly in the source, but render solid in local mermaid-cli 12.0.0 (confirmed myself: same crop as worker describes). A minimal two-subgraph repro with a dotted cross-subgraph edge rendered correctly, so this is specific to long/deeply-nested-cluster edges in this diagram, a known class of Mermaid dagre-wrapper rendering limitation, not a markup defect. Source semantics (built vs. planned) are correct; worker disclosed this transparently and asked the owner to check the actual GitHub rendering, which is the real target per the ticket's own decision ("GitHub renders a ```mermaid block natively"). Not a reason to fail: the file is correct, the caveat is honest, not hidden.
- F1 in `findings.md` (vision/`core-and-plugins.mmd` missing `findings`/`nvm` plugin rows) is pre-existing scope, correctly left open rather than fixed out-of-scope.

**Checks run:**
- `npm ci` — 7 packages, clean.
- `npm run check` — `tsc`, no errors.
- `npm test` — 357/357 pass, including the new "the README's mermaid block is arthur.mmd, unchanged" test.
- Mutation check: appended a stray line to `arthur.mmd` → the new drift test fails with `AssertionError: copy arthur.mmd into the README's ```mermaid block`; reverted with `git checkout -- arthur.mmd`, suite passes again. Confirms the test actually catches drift, not just wiring.
- Independently diffed the README's ```mermaid block against `arthur.mmd` byte-for-byte (`6530 === 6530`, `true`) — matches worker's claim.
- Rendered `arthur.mmd` myself with `mermaid-cli 12.0.0` (`--size 1600`, `--no-sandbox` puppeteer config) — compiles cleanly, no syntax/init-block errors, confirming it's GitHub-safe at the syntax level; no `click`/`securityLevel`/script directives present (grepped).
- Visually inspected the render (1600×1421): three zones (Arthur core, Plugins, Outside Arthur) with only Owner above, matches all four follow-ups; "Channels and media" (telegram, voice) inside First-version plugins; Later plugins in plan order signal→discord→slack→whatsapp→server→knowledge→company; `project agents` node beside `orchestration` in Coordinator group; Telegram service adjacent to Discord and Slack in Outside Arthur; Owner arrows to config (writes), terminal (shell), Telegram (phone); config file box and terminal both in the core zone, green.
- Cross-checked box status against `main`: `packages/` holds only `core`, `orchestration`, `projects` (confirmed via `git ls-tree`); core roadmap entries 1-22 all `merged` in `spec/build.json` (spot-checked 10+); orchestration's roadmap entries (23,24,25,26,27,28,29,65) — only 23 (AR0094) merged, the rest either `planned` or not yet ticketed, matching the "1 of 8 entries" label; projects' entries (41,42) — only 41 (AR0087) merged, matching "1 of 2 entries"; no other plugin (telegram, voice, signal, discord, slack, whatsapp, nvm, commit-rules, findings, machines, resources, models, docker, delivery, github, youtrack, manage, develop, server, knowledge, company) exists in `packages/`, correctly all grey/dashed.
- Cross-checked against the approved `AR0098` plan on `main`: "Later-plugins order: signal, discord, slack, whatsapp, server" and "a project agent beside orchestration" match exactly; Discord labeled "gateway" and Slack labeled "Socket Mode" match the plan's entries 89 and 91 verbatim.
- Grepped `arthur.mmd`/README/findings.md for client or other-project names — none found; `grep`'d for 4+-line labels (budget: "at most three short lines") — none found.
- Confirmed no PNG/SVG committed (`git ls-files` clean of image extensions), commits are Conventional Commits scoped `(AR0101)`, `git status --porcelain` clean after my own throwaway render/mutation experiments.

PASS
