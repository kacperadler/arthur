# arthur init

Usage: `arthur init <project>`. Comes with the `projects` plugin.

Gives the repository of `<project>`, a name in the plugin's list, what Arthur reads, in its folder (the main checkout), each file only where nothing is there yet:

- its vision, `spec/vision.md` (the project's `prompts.vision` moves it), and its criteria files in `.agents/arthur/criteria/` (`prompts.criteriaDir`): one per criteria file a registered role reads (`host.jobs.criteria()`), today `styleguide.md`, which every job and the coordinator read, `autopilot.md`, the coordinator's, and `report.md`, how a page for the owner looks and is checked, which the coordinator, the retro and the auditor read. Each is a skeleton, its headings and nothing under them, for the onboarding below to draft. A name this plugin ships no skeleton for gets the `criteria/<name>.md` a package of this load ships (`host.code`, the first in load order), as that package wrote it (manage's `audit.md` and `retro.md`, delivery's `review.md`); else its title alone (`code-review` is `# Code review`);
- `.nvmrc`, the major version of the Node Arthur runs on (`24` today), for the nvm plugin (roadmap entry 84), unless the repository has one, kept then as it is; a repository without `package.json` gets one too;
- its board, `spec/build.json`, empty (`[]`), written last.

A file is written whole under a temporary name and linked in, never over anything there (a symlink included). It prints what it created, what it left as it was, and the next step:

```
created: spec/vision.md, .agents/arthur/criteria/styleguide.md, .agents/arthur/criteria/autopilot.md, .agents/arthur/criteria/report.md, .nvmrc, spec/build.json
left as it was: nothing
nothing committed: commit these files, then start the onboarding: arthur spawn --kind onboarding --project shop 'Onboard shop.'
```

It commits nothing: a job's worktree starts from HEAD, so the files must be committed before the onboarding starts.

Refused, exit code 1, writing nothing: a project not in the list (`arthur init: unknown project <name>; projects: <names>`); a repository that has a board already, `spec/build.json` (`arthur init: <project> has a board already, <path>; arthur init is for a repository without one`), so a project with tickets is never given a skeleton over its own files. Of two inits of one project at the same moment, the one that finds the board written by the other is refused the same way. Wrong usage (no project, more than one, or `--project`): `usage: arthur init <project>`, exit code 2.

`arthur doctor` (and so `arthur setup`) lists, for each project without a board, a requirement that is not critical: `projects <project> board: missing: no spec/build.json; without it: no tickets for <project>; fix: arthur init <project>`.

## Onboarding

The kind `onboarding`, with its role `onboarding` (`packages/projects/roles/onboarding.md`, reading the project's `styleguide`), works on its own branch and drafts the project's vision and criteria. Its prompt ends with the paths of those files in this project. It goes in rounds, each a run of the same job:

1. It reads the repository and ends with `## Repository` and `## Questions`, numbered, each with a proposed answer.
2. `arthur continue <job id> '<answers>'` brings the owner's answers; it commits the drafts and ends with one line per file and `Review focus:`.
3. Each later `arthur continue` revises the drafts.

When an onboarding's run ends, the coordinator's wake carries the procedure `packages/projects/roles/coordinator/onboarding-ended.md` and, for a run that finished with questions, the questions to send the owner: the numbered items under `## Questions` of its final message, each with the lines under it. One onboarding sends at most 10 questions in all of its runs: past 10 the rest are cut, and a run that asks when 10 were sent gets `Its <n> new questions are cut: ... Send none.` How many each run sent is kept in `<home>/projects/onboarding/<job id>/`, one file per final message, so a wake built twice counts once. The questions are read from the final message the wake is asked with (`arthur coordinator --help`), so an eval's onboarding, a job in no home, gets them too; its count is not kept.

Its merge accepts only the vision and the `.md` files directly in the criteria folder: the plugin provides `merge.check`, asked with the job as `host.jobs.list()` has it (`kind`, `project`, `branch`), which answers undefined for any other kind and for an onboarding branch that changes only those files against HEAD of the project's checkout, and otherwise a reason naming the files: `<branch> changes <files>; an onboarding's merge accepts only <vision> and <criteriaDir>/*.md`, and `<branch> adds or changes the symlink <files>; an onboarding's merge accepts no symlink`. `.nvmrc` is `arthur init`'s, never the onboarding's. The merge command that asks it is roadmap entry 54.

Its merge is the project's first `arthur merge`, and main has no merge that command made: `arthur merge` lists main's commits that change code since main's last merge commit, from the root without one, and refuses while there are any (`arthur merge --help`), so a history that ends in plain commits (squash or rebase merges, a solo project) refuses it. Before that merge the coordinator asks the owner to take main as it is (`arthur take-main --help`): his decision (`arthur decision ask --kind merge --question 'Take main of <project> as it is at <commit>, its history kept?'`, his `answer`), then `arthur take-main --decision <its id> --project <project>`, then the onboarding's merge. The procedure an onboarding's end brings says so.
