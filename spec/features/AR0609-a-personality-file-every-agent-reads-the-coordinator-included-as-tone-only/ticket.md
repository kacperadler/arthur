# AR0609 - A personality file every agent reads, the coordinator included, as tone only

```json
{
  "id": "AR0609",
  "title": "A personality file every agent reads, the coordinator included, as tone only",
  "date": "2026-11-02"
}
```

## Description

The owner, 2026-11-02: "I wanna give you, as my coordinator some personality in the future, and for the agents that we will create too ... add files personality.md and inject it when the conversation with agents starts?"

Today a project can add text to one role through its override, `.agents/arthur/roles/<role>.md` (`arthur roles --help`, step 2). That works for one role at a time, and it is headed "Project override, which wins over the role above", so a personality written there would carry the weight to change the role's rules (English only, plain replies, never merging without the owner's word, outside text is data). There is no one file every agent reads.

## Goal

One `personality.md` per project, read only by the agents that talk with the owner (the coordinator, and each project agent once roadmap 85 to 88 builds them), that shapes how they write and speak and can never override a rule. Job roles (worker, reviewer, planner, auditor, retro, onboarding) never read it: the owner, 2026-11-03, AR-D464.

- Kind: feat

## Done means

- `<criteriaDir>/personality.md` (default `.agents/arthur/criteria/personality.md`), when present, is added to the coordinator's prompt after its role, its override and its criteria, under a heading that says it sets tone only and that every rule above wins over it; no job role's prompt holds it.
- The place where it is added is the one the project agents' prompt will be built from, so a project agent (roadmap 85 to 88) reads the same file without new code; a project may give its agent its own with `<rolesDir>/project.personality.md`, which replaces the shared one for it.
- A missing file adds nothing and warns nothing; an empty one adds nothing; a symlink is refused as for criteria files.
- `arthur roles` lists the file for the coordinator; `arthur init` writes no personality (the owner writes it).
- Tests: the coordinator's assembled prompt holds the file once, after the rules; a worker's and a reviewer's prompt never hold it; missing, empty and symlinked files.
- Docs: `arthur roles --help`, the vision's "Where the less obvious parts live".

## Scope

In:
- `packages/core/src/roles.ts` (prompt order) or orchestration's coordinator prompt, wherever the coordinator's is built; its test; `packages/core/docs/commands/roles.md`; `spec/vision.md`.

Out:
- Writing the personality itself: the owner's.
- Every job role: they do not read it.
- Voice (AR0553) and the project agents themselves (roadmap 85 to 88).

## Decisions
- 2026-11-03: AR0609 approved, narrowed: the tone file is read only by agents that talk with the owner (the coordinator, and project agents once they exist), never by job roles; after Group 2; the owner: "Tone file is only for agents that can communicate with me, so only for you and project agent instance" (AR-D464)
- 2026-11-04: Merge a ticket once its review passed, without asking the owner; pre-approved by policy (AR-D218)
