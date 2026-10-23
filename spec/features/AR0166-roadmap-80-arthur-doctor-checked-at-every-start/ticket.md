# AR0166 - Roadmap 80: arthur doctor, checked at every start

```json
{
  "id": "AR0166",
  "title": "Roadmap 80: arthur doctor, checked at every start",
  "date": "2026-10-19"
}
```

## Description

Roadmap entry 80 (`spec/roadmap.md`), built as the entry says.

## Goal

At every start Arthur checks what it needs (tools, folders, plugins' own requirements) and says plainly what is missing and how to fix it, so a broken setup is found at start, not in the middle of work.

- Kind: feat

## Done means

- Entry 80's Delivers, Also delivers and Done means, each edge case with its test against the fake host and the fake agent; each plugin that exists today provides its own requirements in this ticket.
- Each option it adds is in `arthur.config.example.ts` and the option table; each command has its doc page; the README feature table and `arthur.mmd` show the entry built.
- `npm test` and `npm run check` pass.

## Scope

Out:
- `arthur setup` (entry 94) and option tables (entry 93).

## Decisions

- 2026-10-19: The owner asked for a night plan for Arthur with Claude 7 Day usage up to 75%; entry 80 is next (depends on 38 and 4, merged).
- 2026-10-19: Coordinator (owner delegated Arthur calls): option (a): each tools label is a command name, checked with command -v over SSH and documented; the example becomes tools: ["xcodebuild"]. No label-to-command map (an option nobody asked for).
- 2026-10-19: Coordinator (owner delegated Arthur calls): machines 375 -> 391 (+16, tools check) accepted, plus the raises recorded in test/structure.test.ts by the first commit; a machine missing a tool stays online: accepted; F1 (local tools unchecked) stays open for the merge.
