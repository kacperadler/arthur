# AR0099 - Findings

## F1. `h merge` never reads Arthur's GitHub CI

- Kind: risk
- Found by: coordinator, 2026-10-17
- Where: `.agents/harness/project.json` (no `"ci"`), no `H_GITHUB_ACTIONS_TOKEN` for this repository
- What: CI was red on main from 2026-10-16 19:49 to this merge while every merge reported only the local checks.
- Suggestion: set `"ci": "ci"` in `project.json` once the owner adds the token; until then the coordinator reads the public runs list before each merge.
- Status: dropped (configuration the owner was asked for on 2026-10-17; tracked in the coordinator's notes, not code)
