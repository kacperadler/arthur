# commit-rules

The `commit-rules` plugin (roadmap entry 43): each project's rule for its commit messages, set by `commitRules` in its entry of the `projects` plugin's list (`arthur projects --help`), in one of three forms. It needs the `projects` plugin and takes no option of its own: `commitRules()` in `arthur.config.ts`, or `commitRules({ enabled: false })`.

| Form | Example | What the plugin does |
| --- | --- | --- |
| `regex` | `{ regex: "^(feat\|fix\|docs)(\\([\\w-]+\\))?!?: .{1,72}$" }` | A `commit-msg` hook in each job worktree of the project refuses a commit whose subject does not match, and says the rule. Nothing goes into the prompt. |
| `words` | `{ words: "Start with the ticket id, then a verb in the imperative." }` | The words go into the prompt of the project's workers and reviewers; the review judges the branch's messages by them. No hook. |
| `file` | `{ file: "docs/commit-rules.md" }` | The file, a path in the project's repository, is read at the commit the job starts from and goes into the prompt as words, so the rule is versioned with the project. No hook. |

A project without `commitRules` gets no hook and no text.

## Refused at load

- A `regex` that does not compile as a JavaScript regular expression refuses the start, naming the project: `plugin commit-rules: setup failed: project <name>: commitRules.regex does not compile: <why>`.
- Any option but `enabled`: `unknown option; commit-rules takes none: a project's rule is its commitRules in the projects list`.

The shape of `commitRules` (exactly one of the three keys, a non-empty string) is the `projects` plugin's check.

## The hook

Each new job worktree of a project with a `regex`, of every kind, gets the hook before its agent starts, on the job's machine (a `prepare` step, `arthur spawn --help`):

- The subject is the message's first line that is neither blank nor a comment (`#`). One that does not match fails the commit with `commit refused: the subject "<subject>" does not match this project's commit rule, the regex <regex>`. The regex runs in Node, as it was checked at load.
- A commit that concludes a merge is not checked (Git's `MERGE_HEAD` is there), whatever its subject: Git writes its own, `Merge branch 'main' into ...`, and a conflict resolved by hand ends the same way. The next commit is checked again.
- The project's own hooks still run in the job's worktree: its `core.hooksPath` (a relative one is the worktree's own folder, as Git takes it), else the repository's `hooks` folder. Its `commit-msg` runs after the rule passes.
- The hook lives in the worktree's own Git folder (`.git/worktrees/<id>/arthur-hooks`) and is named by `core.hooksPath` in that worktree's own `config.worktree`; both go with the worktree. Git reads a worktree's own configuration only once `extensions.worktreeConfig` is on, so the first hook sets that one key in the repository's `.git/config`. Nothing else outside Arthur's worktrees changes: not the main checkout's hooks, nor its `core.hooksPath`, nor any other value, and a commit in the main checkout is not checked.
- A hook that cannot be installed refuses the spawn, and the job's worktree and record are removed: `plugin commit-rules: prepare failed: project <name>: the commit-msg hook was not installed: exit <code>: <its last line>`.
- `git commit --no-verify` skips it, as it skips every `commit-msg` hook; the review still sees the subject.

## In the prompt

The rule of `words` or `file` is a section at the end of the prompt of the roles `worker` and `reviewer` (`arthur roles --help`), no other:

- worker: `## Commit messages`, then `This project's rule for every commit message you write (<source>):` and the rule.
- reviewer: the same heading, then `This project's rule for commit messages; judge each commit of the branch by it, and a message that breaks it is a finding (<source>):` and the rule.

`<source>` is `commitRules.words in arthur.config.ts`, or `<file> at <the job's commit, 7 digits>`. The file is read from Git at that commit, never from the working tree, so an uncommitted change does not count. A file missing at that commit, a folder, or an empty one warns on stderr and the job starts without the section: `warning: commit-rules: project <name>: rule file <file> at <commit> is missing or not a file; the <role> goes without it` (`is empty` for an empty one).
