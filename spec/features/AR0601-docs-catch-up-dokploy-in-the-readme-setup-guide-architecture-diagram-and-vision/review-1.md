# AR0601 - Review 1

- Job: 2026-11-01-review-a2e56a8c
- Branch: arthur/2026-11-01-worker-8b02a88b
- Commit reviewed: d0b1f92b2a43aaa195d043050ddb39821aa82b7b
- Verdict: PASS

## Final message

No finding blocks the merge. This is a docs-only branch, and every line it adds matches the dokploy package, the board in `spec/build.json` and the roadmap.

What I checked against the ticket's Done means:
- **Dokploy in the shared docs.** `README.md`, `docs/setup.md`, `docs/architecture/core-and-plugins.mmd`, `docs/architecture/versions.mmd` and `spec/vision.md` now name dokploy, say what it does and link `packages/dokploy/docs/dokploy.md`. Each fact matches `packages/dokploy/docs/dokploy.md`:
  - the commands are `apps|app|status`, run by the coordinator only, never in a job (doc line 3);
  - the variables are `ARTHUR_DOKPLOY_TOKEN` and `ARTHUR_DOKPLOY_<INSTANCE>_TOKEN`, and `arthur config check` lists them (lines 25 and 39);
  - a project picks its server with `dokploy.project({ instance?, app })`, and the plugin needs `projects` (lines 17 and 21);
  - a URL must be https, or http only on a private or Tailscale address (line 28).
  
  Upload and deploy are called planned: AR0588 is the plan ticket, and only its reads are built.
- **Roadmap entry 1.** It now gives the zones as the styleguide's Shape does: green up to 200, yellow 201 to 220, red 221 to 250 only in `RED_FILES`, and above 250 fails. Its Done means checks the edges at 200, 201/220, 221/250 and 251.
- **`arthur.mmd` status lines.** AR0592 F1 asked to rebuild lines 1 and 3. Both are rebuilt:
  - the date in line 1 and the legend is 2026-11-01;
  - line 3 adds listen 81 (AR0550, merged) and video 102 (AR0551, merged);
  - it counts 103 under projects (AR0589 merged; `Plugin.piece` is at `packages/core/src/plugin.ts:51-53`, and `pieces` is in `packages/projects/src/`);
  - 71 stays unbuilt, which matches the board.
- **Worker's claims.** They match what I saw: the files changed, `README.md` at 120 lines, and the test counts.
- **Other rules.** No source file changed and no new package budget is needed. Everything else in the diff stays inside the files the ticket names, except the new `findings.md`, which is the usual way to record a finding. No client or other project is named.

## Notes
- (minor) `spec/vision.md:77`: the dokploy row is in the present tense: it "uploads a file or folder or starts a deploy". That matches how the vision describes what each plugin will do, but unlike the README, setup guide and diagrams it does not say upload and deploy are still planned.
- (minor) `arthur.mmd`: the drawing still has no dokploy box. The ticket asked only for the status lines, and line 3 now says what dokploy has built.

## Checks
- `npm run check`: passed (tsc).
- `npm test`: 1454 tests, 1392 passed, 0 failed, 62 skipped, exit 0. Six files print as yellow (board, cli, testing, wrapper, merge-command, restart). This branch touches none of them.
- `npm run mutate`: not run. The branch changes no code, and the owner asked me to keep this review short.
- The diagrams were not rendered.

PASS