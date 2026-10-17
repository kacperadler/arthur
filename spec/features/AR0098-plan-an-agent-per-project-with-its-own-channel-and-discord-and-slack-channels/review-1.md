# AR0098 - Review 1

- Job: 2026-10-17-review-ar0098-project-ag-cb647b22
- Branch: h/2026-10-17-ar0098-project-agents-160d388f
- Commit reviewed: 317e836c3935825c4b85018851e92a7b5d8c0859
- Verdict: PASS

## Final message

Findings and notes assessed; verdict below.

**Findings (non-blocking):**
- `spec/roadmap.md:12` — The sentence "The later entries go in this order (the owner, 2026-10-17, AR0098): project agents (85 to 88) first, once the other projects have moved to Arthur…" attributes this specific sequencing to "the owner." The plan's "Open questions" section left this undecided (two options, Option 1 recommended), and the ticket's Decisions list never resolves it. The worker's own final message confirms: "the plan's open question was never answered in a Decision. I used the plan's recommended order." Every other `(the owner, DATE: …)` annotation in this file cites a real, traceable Decision (verified against lines 158, 177, 292, 460, 492, 792, 901, 941); this one doesn't. Misattributing a worker-made call to "the owner" breaks that convention and could mislead a reader of the roadmap alone. Low severity: the substance matches the plan's own recommended default, and the worker flagged the underlying ambiguity explicitly in the final message for the owner's review — just the parenthetical wording needs to drop the false attribution (e.g. "following the plan's recommended order").
- `spec/vision.md:34` — The `orchestration` row gets "Later, an agent per project with a `chat`, and the routing of that chat to it (roadmap 85 to 88)" added. This specific table-row edit isn't listed in plan.md's "Vision edits proposed" (which only lists adding `discord`/`slack` rows), and isn't in the worker's own "Details I added myself" disclosure either. Minor, consistent with the rest of the change, doesn't contradict anything — but it is an undisclosed addition beyond what the plan specifies.

**Notes (non-blocking):**
- `spec/vision.md:72-73` — `findings` row placed before `commit-rules` but after `nvm`; AR0101's F1 names findings as entry 83 and nvm as entry 84 (findings first), so table order is reversed from roadmap-number order. Cosmetic only; the table isn't strictly roadmap-ordered elsewhere either.
- New `findings.md` F1 is accurate: confirmed `arthur.mmd` (untouched by this diff, last touched at `dfc0a18`) still places the `agents` node inside `FIRST`/`COORD`, and its legend/README still say "1 of 8 entries" despite AR0084/AR0110 merges — correctly filed as `open`, correctly left out of scope ("Leave the roadmap alone").

**Checks run:**
- `npm ci`: installs clean (7 packages, no changes expected since no new runtime deps).
- `npm run check` (`tsc`): exit 0, matches worker's claim.
- `npm test`: 385/385 pass, 0 fail — matches worker's claim exactly, including structure tests (line budgets, boundaries, dependency rules) and the `options.test.ts` update for `roles.project`.
- Rendered both edited diagrams (`npx @mermaid-js/mermaid-cli --no-sandbox`): both parse and render without error, matching worker's claim; node/edge structure matches plan's described ordering (project agents → signal → discord → slack → whatsapp → server).
- Diffed `spec/vision.md` and `spec/roadmap.md` line-by-line against `plan.md`'s "Vision edits proposed" / "Files" sections and the ticket's Decisions log (read from `main`): decisions 3, 10, new 20, "What stays true" bullet 2, coordinator section, plugins table, later-plugins order, channels bullet, and "Where the less obvious parts live" all match the plan's specified wording closely.
- Verified roadmap entry numbers 85–92 appear exactly once each, in file order matching the plan's "Order of the later entries" list (85–88, then 73, then 89–92, then 74, then 75–77); `Depends on` chains for 85–88 match the plan verbatim; the 89→90→91→92 and 74→92 chain is the worker's own addition (plan specifies 74→92 explicitly; 89-92's internal chain isn't in the plan but is disclosed by the worker).
- Confirmed `arthur.config.example.ts` is excluded from `tsc` (`tsconfig.json` `include`) and loaded by no test (per repo's own established convention, confirmed via prior review notes in `spec/features/*/review-1.md`), so the new `chat` key (not yet recognized by `packages/projects/src/project-options.ts` `FIELDS`) is correctly inert, consistent with every other "planned" plugin already listed there.
- `git status --short`: clean, no residue from the render commands.

PASS
