# arthur retro-due

Usage: `arthur retro-due [--project <name>]`. Comes with the `manage` plugin (roadmap entry 63). Answered without the model, for one project, the main one unless `--project` names another. It reads only: nothing is written.

Whether there is enough since the last retro for a new one, as one line:

```
retro due: 12 merges, 3 FAIL reviews and 4 findings since the last retro, 0a1b2c3d4e5f (spec/retro/2026-10-16.md)
no retro due: 7 merges, 2 FAIL reviews and 1 finding since the last retro, 0a1b2c3d4e5f (spec/retro/2026-10-16.md); 10 merges needed
no retro due: 10 merges, 1 FAIL review and 4 findings since the start (no retro yet); 2 FAIL reviews or 5 findings needed
```

A retro is due at 10 merges or more, when in them 2 reviews or more failed or 5 findings or more were written; exactly 10 merges with 2 FAIL reviews is due, and so are 10 merges with 5 findings. A line that is not due names the first rule not met.

- The merges: the merge commits on the first-parent line of the project's `HEAD` whose subject is `Merge <ticket id>: ...`, as `arthur merge` writes it, since the last retro's commit. The last retro is the newest report in `spec/retro/` by its name's date and number with a `- Merges up to: <commit>` line, which the filing writes (`arthur ticket file`, docs/manage.md, "The retro"). With no such report it is `since the start (no retro yet)`, every merge of the history (a report written by hand, `spec/retro/<date>.md` with that line, starts the first period at its commit instead); with one whose commit Git does not find, `since the start (<commit> of <report> is no commit of this repository)`.
- The FAIL reviews: in each merged ticket's folder on the board, the `review-N.md` files with a `- Verdict: FAIL` line. A merge whose ticket is not on the board counts as a merge with nothing in it.
- The findings: every `## F<n>.` entry of each merged ticket's `findings.md`, whatever its status.

The coordinator's context carries the same line for the main project on every turn, under `## manage` (`arthur coordinator --help`). With `retro.day` and `retro.at`, the schedule starts a retro only while it is due (docs/manage.md, "The retro").

More than nothing after the command prints `usage: arthur retro-due [--project <name>]` and exits 2; an unknown project exits 1 with the board's refusal.
