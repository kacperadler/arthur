# AR0753 - A worker tests a path check against the forms the reviewer will try

```json
{
  "id": "AR0753",
  "title": "A worker tests a path check against the forms the reviewer will try",
  "date": "2026-11-27"
}
```

## Description

The verify criteria every worker reads before its final message ask for one test row per form that could get past a path check: an absolute path, a `..` climbing out and back, a symlink, a hard link, and a folder with the expected file's name.

## Goal

Two of the week's three FAILs and two open security findings came from path checks tested only against the ticket's own examples; reviewers found each bypass with the forms above. `worker.md:21` asks for "every way it could still break" in general words, and that was missed twice. A shared helper can't hold this: there are about 10 hand-written path guards, and a Git pathspec is not a file path.

Evidence (retro spec/retro/2026-11-27.md, proposal 4):
- AR0716 review-1 F1: `relative(".", agent)` accepted `../<cwd name>/x`; F2: removing `isAbsolute(agent) ||` failed no test; findings F4: a shipped symlink took writes outside the repository.
- AR0738 review-1 F1: the folder `spec/schedule.json/` matched as a pathspec; findings F7: a hard link among the board files was committed with an outside file's contents.

- Kind: chore

## Done means

- `.agents/arthur/criteria/verify.md` step 4 ends with the sentence from the retro report's After, naming the five forms.
- Nothing else in the file changes; it stays English, with "-" and no "—".
- `npm run check` and `npm test` pass (the structure test reads the criteria files).

## Scope

In:
- `.agents/arthur/criteria/verify.md`: step 4 gains one sentence (Before/After in the retro report).

Out:
- A shared path-check helper (the retro says one can't fit a pathspec and a file path).
- Fixing AR0716 F4 and AR0738 F7 themselves.

## Decisions

- 2026-11-27: Source: retro spec/retro/2026-11-27.md
