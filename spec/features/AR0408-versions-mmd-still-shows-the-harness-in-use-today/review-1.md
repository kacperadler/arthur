# AR0408 - Review 1

- Job: 2026-10-25-review-5f774bcc
- Branch: arthur/2026-10-25-worker-84970abd
- Commit reviewed: 27091e3f2345f9950e1716dedd5ee79f9e15cfa0
- Verdict: PASS

## Final message

**Findings**

None blocking.

**Notes**
- The worker removed three nodes besides the comment and the starting node: `move`, `start` and `switch1`, with their links. That goes past the ticket's Scope "In" (the comment and the starting node), but it fits the ticket. Each removed step is finished by the switch the new start describes:
  - `switch1` reads "Switch one project first, Arthur itself".
  - `start` reads "Arthur starts with an empty board". The board is already in use: `spec/build.json` holds AR0408.
  - `move` reads "Move modules with their tests". The core and plugins already live in `packages/` and Arthur runs on them.
  
  Leaving them after "Arthur runs on its own repository" would make the diagram contradict itself. The ticket's "Out" list (the first-version and later groups, other diagrams) does not cover them, and the worker's final message explains the departure.
- Done means is met:
  - The start shows the switch done: `today[Arthur runs on its own repository<br/>other projects to follow]`, and the comment on line 1 matches it.
  - The `V1` and `V2` subgraphs, the `classDef` lines and the `class` lines are byte-identical to base. I compared the full files at `04e3c65d` and `27091e3f`.
  - "Switch the other projects" (`switch2`) still sits between V1 and V2.
- Mermaid integrity: the only top-level link is `today --> V1 --> switch2 --> V2`, and every id in it is still defined. A grep for `\b(move|start|switch1)\b` in `docs/architecture/versions.mmd` finds nothing, so no link or `class` line points at a removed node. I did not render the diagram; the task allowed only `npm run check`.
- Other references to `versions.mmd` (`README.md:175`, `spec/vision.md:3`, `arthur.config.example.ts:20`) point at the file, not at a removed node, so none needs a change.
- There is one commit, `docs(AR0408): start versions.mmd at the switch to Arthur's own repo`, a Conventional Commit with the ticket as scope. It names no client or other project.
- I did no mutation testing: the change is docs only, and no test reads `versions.mmd`.

**Checks**
- `npm run check`: `tsc` exited with no errors, which matches the worker's claim.
- `npm test`: not run, as the task instructed (AR0401).

PASS