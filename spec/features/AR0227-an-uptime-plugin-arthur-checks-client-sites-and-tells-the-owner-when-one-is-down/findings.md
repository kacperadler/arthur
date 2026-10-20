# AR0227 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A site on a port that fetch blocks is reported down forever, as `bad port`

- Kind: bug
- Found by: 2026-10-20-ar0227-uptime-plugin-f319c5fb (worker), 2026-10-20
- Where: `packages/uptime/src/site-check.ts:12`, `packages/uptime/src/uptime-options.ts:18`
- What: Node's `fetch` refuses the ports of the Fetch standard's bad-port list (9, 25, 6000, 6665 to 6669, 10080 and others) without a connection. A site listed with such a port passes the option check, then every check fails with `bad port`: `arthur run` with `uptime({ sites: { acme: [{ url: "http://127.0.0.1:9/" }] } })` sent `uptime: http://127.0.0.1:9/ (project acme) is down since ...: bad port`, and it stays down whatever the site does.
- Suggestion: refuse such a `url` at load, naming the port and that fetch never reaches it; or check that one site with `node:http`/`node:https` instead of `fetch`. Nothing else of the check changes.
- Status: ticket AR0232

## F2. `sites` is the uptime plugin's own option, where every other per-project setting is a key of the project's entry

- Kind: improvement
- Found by: 2026-10-20-ar0227-uptime-plugin-f319c5fb (worker), 2026-10-20
- Where: `packages/uptime/src/uptime-options.ts:38`, `packages/projects/src/project-options.ts:38`
- What: a project's `tracker`, `ci`, `commitRules`, `autoMerge`, `requires` and `docker` live on its entry in the projects list, checked there for their shape and read by their plugin through `collect("projects")`. AR0227's Scope names only `packages/uptime`, so its sites are `uptime({ sites: { <project>: [...] } })`, each key checked against the project list at setup. Two places now say what belongs to a project.
- Suggestion: decide whether a project's sites move to an `uptime` key of its entry (a line in projects' `FIELDS`, the uptime plugin reading it as commit-rules reads `commitRules`, `sites` removed), or stay a plugin option as AR0216's other stimulus plugins would then follow.
- Status: dropped (accepted by the coordinator; AR0233 dropped)
