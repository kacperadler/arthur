# AR0196 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The option-tables test cannot hold a plugin without options, so nvm's options file is not checked there

- Kind: cleanup
- Found by: 2026-10-19-ar0196-nvm-52bdb90d (worker), 2026-10-19
- Where: `test/option-tables.test.ts` (`PLUGINS` and the assertion `${name} has options`)
- What: the nvm plugin's options file (`packages/nvm/src/nvm-options.ts`) has an empty `table`, since nvm has no options but `enabled`. The test that checks every package's options file (summary in one line, each tool's version command) asserts that each file has at least one option, so nvm is left out of `PLUGINS` and its summary is checked by no test. `arthur setup` prints it fine (`nvm on no options`, seen by hand on this branch).
- Suggestion: let that assertion accept an empty table for a plugin that declares none (or drop it: an option without a meaning is already caught per option), and add `nvm: [nvmFile, nvm()]` to `PLUGINS`. Out: options for nvm.
- Status: open
