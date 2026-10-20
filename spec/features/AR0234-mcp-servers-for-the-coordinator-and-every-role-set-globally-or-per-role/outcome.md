# AR0234 - Outcome

- Merged: 2026-10-20, `5bede8d`
- Branch: h/2026-10-20-ar0234-mcp-per-role-223dbdae
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.85, reviews $2.19; review rounds 2

## What went in

- `packages/orchestration/src/mcp.ts` (new): the `mcp: { servers, all, roles }` option, checked at load (unknown names, `command`/`url`, `valueEnv` secrets), each role's servers resolved; the coordinator gets its own in `<home>/orchestration/mcp/` with `--plugin-dir`.
- Core: the `roles.model` answer carries `mcp`; a local job's record gets `mcp/.mcp.json` (0600), `plugin.json` and the `mcp.yml` overlay (`tools.xdev: false`, so a read-only role never gains `write`); the wrapper adds `--plugin-dir` and `--config`; a job on another machine gets none and its spawn warns.
- `docs/plugin-api.md` (one row), the command docs, `arthur.config.example.ts`, roadmap entry 85, `test/structure.test.ts` (core 5714, orchestration 1542).

## Checks on main

- `npm run check`: passed.
- `npm test`: 811/811 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
