# AR0179 - Outcome

- Merged: 2026-10-19, `f3f1b88`
- Branch: h/2026-10-19-ar0179-arthur-setup-9194f26c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.18, reviews $1.83; review rounds 2

## What went in

- `arthur setup` (roadmap 94): a report run again after each fix, in five sections: Tools (each tool's version or `not found`, cut after 5 s, and which plugins use it), Config (the core and each plugin on or off, options set and not set, env `set` or `missing`, never a value), Requirements (`arthur doctor`'s lines), what can still go in `arthur.config.ts` (installed plugins off or not listed, with every option's meaning and default), and Next (numbered fixes: config, env, critical, the rest).
- Exit code 1 when a step in Next would refuse `arthur run`; installed plugins are read from `node_modules/@arthur/*` by path, so the core still imports no plugin; `tailscale` is one of the core's tools.
- While Config refuses, the plugins' requirements are not checked yet (F1, now AR0180).

## Checks on main

- `npm run check`: passed.
- `npm test`: 587/587 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0180 (F1).
