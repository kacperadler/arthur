# AR0002 - Review 1

- Job: 2026-10-16-review-ar0002-roadmap-jo-dd920680
- Branch: h/2026-10-16-ar0002-roadmap-job-state-a365c361
- Commit reviewed: de61731d3981a2ce71555454ebcbe5c5eb75a901
- Verdict: PASS

## Final message

## Findings

**`spec/features/AR0002-.../findings.md:13`** — F1 names "entry 53" for `arthur merge`, but after the branch's own renumbering `arthur merge` is entry 54 (entry 53 is `arthur review-needed`). Stale cross-reference inside the diff under review; the worker's own renumbering-consistency script (checked roadmap.md internal refs) didn't catch this because it lives in `findings.md`, not `spec/roadmap.md`. Minor: the finding also names the command (`arthur merge`) and the capability, so a reader can still locate the right entry, but anyone acting on "entry 53's Delivers and Done means" literally would edit the wrong roadmap entry. Not fail-level on its own — doesn't break roadmap structural integrity, dependencies, or coverage, which I verified independently (see below).

**AR0002 F1 vs. ticket Decisions** — `main`'s current ticket.md carries a Decision ("checks run on a machine that has the required labels … Goes into roadmap entry 53 when the tickets are cut") that pre-answers the question the worker's F1 finding reopens as "open." Checked the timeline: that Decision commit (`b956f25`, 11:38:20) landed 33s after the worker's last commit (`de61731`, 11:37:47) and is not in the base (`1e10f011`) the worker branched from — it's the intake response to this very finding, directing a *future* ticket cut from F1 to edit entry 54, not instructing AR0002 to do it now (AR0002's scope explicitly excludes "Implementing them," and entry 54/`arthur merge` predates AR0002). Correctly scoped as `open`; not a contradiction of the ticket.

**Entries 30–34 placed after Orchestration, not "before or with" it** — ticket's Done means says new entries go "before or with orchestration as their dependencies require." Machines/resources landed fully after the Orchestration section (deps on entries 25/26). Roadmap's own intro explains why (`maxAgents`/context from orchestration are real prerequisites), so this is a justified, disclosed interpretation of ambiguous ticket language, not silent scope drift.

## Verification performed

- Independently re-derived entry numbering: 72 sequential entries (1–72), confirmed via script — matches worker's claim.
- Independently verified every `Depends on:` reference points to a strictly earlier, existing entry — 0 problems.
- Independently re-did the worker's "63 of 63 old entries keep their dependencies" check by title-matching old↔new, deps compared by resolved title sets — 63/63 matched, 0 mismatches.
- Diffed content of all pre-existing entries beyond the `Depends on:` line — only 4 changed, all explainable (renumbered inline refs, and `projects`' `requires` addition, which is in-scope per the ticket and vision).
- Compared coverage-table id sets before/after (115 ids each) — identical, no drops/dupes.
- Spot-checked inline prose `entry N` references in `roadmap.md` body (6 occurrences) — all correct after renumbering.
- Read vision.md, core-and-plugins.mmd, versions.mmd, arthur.config.example.ts diffs in full — job state, machines/SSH/labels, resources (per-job/per-feature/concurrency) all present with interfaces, matching Done means.
- Confirmed AR0001 F1 fixed: `ORCH` subgraph in `core-and-plugins.mmd` now holds only `orchestration`, labeled "Coordinator - always on, required"; `session`/`schedule` moved to `CONV`; vision.md plugin table tags only `orchestration` as "always on." Rendered the `.mmd` to SVG (`npx @mermaid-js/mermaid-cli` with `--no-sandbox`) — parses and renders without error.
- Confirmed all five named edge cases present: machine offline mid-job (22), label no machine has (31), SSH key refused (21, 30), job over cap (32/33), resources too low to start anything (34).
- Ran `npm ci`, `npm run check`, `npm test` in this worktree: check passes (tsc clean), test 1/1 pass — matches worker's claim.
- `node --check arthur.config.example.ts`: passes.
- Grepped the full diff for non-ASCII: only ellipsis characters in unrelated pre-existing English prose, no foreign-language text.
- Nothing in the diff adds a listener/public port; machine reachability is SSH-only over private ranges, explicitly refusing non-private addresses (entry 30).

No FAIL-criterion is met: no missing/stubbed requirement, no failing check, no boundary violation, no unexplained scope creep, no exposure, no non-English text. The one real defect (stale "entry 53" cross-reference in findings.md) is a minor, easily-correctable documentation slip in an auxiliary file, not a structural or functional defect in the deliverable.

PASS
