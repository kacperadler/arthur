# AR0450 - Review 1

- Job: 2026-10-26-review-084bf1be
- Branch: arthur/2026-10-26-worker-79f8fb55
- Commit reviewed: 2265f10b5adda41eeba8318c3e2ef9378fd2d4c3
- Verdict: PASS

## Final message

No blocking findings. The branch meets AR0450's Done means and the owner's AR-D87 decision, and can be merged as it is.

**Done means and AR-D87**
- **README length:** `README.md` is 115 lines (`wc -l`); the limit is 120. It keeps what Arthur is and is not, the status, a feature list of one line per package (each linking its doc pages), how to try it, the links to the docs, and the licence. The long command list is gone; `arthur help` and links to each package's command pages replace it.
- **Diagram (AR-D87):** the README holds one 25-line `mermaid` flowchart of the core and the plugin groups. One line above it links the full diagram, `https://kacperadler.github.io/arthur/diagram/` (built from `arthur.mmd` by `site/scripts/generate.ts:61`, under the base set in `site/astro.config.ts`), and `arthur.mmd` itself. Its groups and colours match `arthur.mmd`'s subgraphs (CHAN, COORD, PROJ, RES, DELIV, SELF, LATER) and its built/planned classes.
- **Links:** every relative link in the README points to a file that exists (checked with a loop over each link).
- **Dropped facts still live in linked docs.** I spot-checked these:
  - The "polled / outbound" non-goal, "the owner installs plugins" and "Discord, the owner's pick" are in `spec/vision.md:14,21,203`.
  - The roadmap entry numbers are in `spec/roadmap.md` and `spec/build.json`.
  - Time zone and quiet hours are in the core's command pages.
- **Docs after today's merges:**
  - The env file at `~/.config/arthur/.env` is in `docs/setup.md`.
  - `take-main` and the merge refusal (AR0441) are in `docs/deploy.md:42`.
  - Outside text as data, as a rule of the prompt and not a guard (AR0350), is in `deploy.md:47`.
  - The provider-key warning (AR0439) is in `deploy.md:34` and the `arthur doctor` paragraph of `setup.md:295`.
  - The install and merge checks in their own scopes (AR0373) are in `deploy.md:43`.
  - Process reads from the sandbox (AR0440) are in `deploy.md:44`.
- **No source file changed:** the range touches only Markdown, `arthur.mmd`, `findings.md` and `test/structure.test.ts`.

**Notes (not blocking)**
- **Files outside the ticket's Scope:** `arthur.mmd` and `test/structure.test.ts` are not in the "In" list.
  - The old structure test required the README's diagram to be an exact copy of `arthur.mmd`, which a small diagram can't be, so replacing it was necessary. The worker's message calls it "one small test" without saying it replaced the old one.
  - The `arthur.mmd` change fixes stale facts (the env file's place and the dates), is recorded as F1 in `findings.md`, and is explained in the final message.
- **Test edge case:** `test/structure.test.ts:777` counts lines with `split("\n").length <= 121`, which assumes the file ends with a newline. A 121-line README without one would pass.

**Checks I ran (in this checkout)**
- `npm run check`: tsc, exit 0.
- `node --import @arthur/core/testing --test test/readme.test.ts test/structure.test.ts`: 17 tests, 17 pass, 0 fail. This matches the worker's 1 and 16.
- Breaking the README on purpose, then restoring it with `git checkout -- README.md` (`git status --short` was clean afterwards):
  - Padding the README to 121 lines makes the new test fail with "README.md holds at most 120 lines".
  - Adding a second `mermaid` block makes it fail with "one ```mermaid block".
- On your instruction I did not run the full `npm test` or `npm ci`. The full-suite result (1177 tests, 1171 pass, 0 fail, 6 skipped) is the coordinator's run on the host, not mine.

PASS