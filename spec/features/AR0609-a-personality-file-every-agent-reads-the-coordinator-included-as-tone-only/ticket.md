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

One `personality.md` per project, read by the coordinator and every job's role, that shapes how they write and speak and can never override a rule.

- Kind: feat

## Done means

- `<criteriaDir>/personality.md` (default `.agents/arthur/criteria/personality.md`), when present, is added to the prompt of every role, the coordinator included, after the role, its override and its criteria, under a heading that says it sets tone only and that every rule above wins over it; a project may also give one role its own with `<rolesDir>/<role>.personality.md`, which replaces the shared one for that role.
- A missing file adds nothing and warns nothing; an empty one adds nothing; a symlink is refused as for criteria files.
- `arthur roles` lists the file for each role; `arthur init` writes no personality (the owner writes it).
- Tests: each role's assembled prompt holds the file once, after the rules; a per-role file replaces the shared one; missing, empty and symlinked files.
- Docs: `arthur roles --help`, the vision's "Where the less obvious parts live".

## Scope

In:
- `packages/core/src/roles.ts` (prompt order), its test, `packages/core/docs/commands/roles.md`; orchestration's coordinator prompt if it is built apart; `spec/vision.md`.

Out:
- Writing the personality itself: the owner's.
- Voice (AR0553) and per-project chat agents (roadmap 85 to 88), which will read the same file once they exist.

## Decisions
