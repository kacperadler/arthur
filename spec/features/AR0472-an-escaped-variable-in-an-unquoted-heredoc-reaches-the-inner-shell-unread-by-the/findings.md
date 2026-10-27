# AR0472 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. A backslash-newline right before a heredoc's delimiter line hides the lines after it

- Kind: security
- Found by: 2026-10-27-review-1027b2ed (review), 2026-10-27
- Where: `packages/core/src/shell-words.ts`
- What: bash joins the line ending in a backslash with the delimiter line, so the next lines stay body, while the guard ends the heredoc there and reads them as outer commands: `bash <<EOF\necho a\\\nEOF\nrm \$HOME/acme/README.md\nEOF` passes the guard; real bash puts those lines in the body. Before AR0472 too.
- Status: ticket AR0493 (the same root, a backslash-newline the parser does not remove; added to its Description)

## F2. A `HOME=` in front of the command is ignored

- Kind: security
- Found by: 2026-10-27-review-1027b2ed (review), 2026-10-27
- Where: `packages/core/src/shell-words.ts`
- What: `HOME=../../acme bash <<EOF\nrm \$HOME/README.md\nEOF` and the `bash -c` form pass the guard; real bash deleted the main README. Before AR0472 too.
- Status: ticket AR0496

## F3. `$$HOME` in an unquoted heredoc reads as `$` and the value of HOME

- Kind: fix
- Found by: 2026-10-27-review-1027b2ed (review), 2026-10-27
- Where: `packages/core/src/shell-words.ts` (`outer`)
- What: bash gives the shell's pid then `HOME`; the guard can only refuse more than it should, never less.
- Status: dropped (over-refusal only, of a form no job needs)
