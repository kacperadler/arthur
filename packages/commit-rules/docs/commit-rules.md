# commit-rules

The `commit-rules` plugin (roadmap entry 43): each project's rule for its commit messages, set by its piece, `commitRules.project(...)` in its project file (`arthur projects --help`, "A project's file"), in one of three forms: `commitRules.project({ regex: "..." })`, `{ words }` or `{ file }`. The piece's key is the plugin's name, `commit-rules`, so a refusal and `arthur doctor` name it `commit-rules.project(...)`. It needs the `projects` plugin and takes no option of its own: `commitRules()` in `arthur.config.ts`, or `commitRules({ enabled: false })`.

| Form | Example | What the plugin does |
| --- | --- | --- |
| `regex` | `{ regex: "^(?=.{1,72}$)(feat\|fix\|docs)(\\([\\w-]+\\))?!?: .+$" }` | A `commit-msg` hook in each job worktree of the project refuses a commit whose subject does not match, and says the rule. Nothing goes into the prompt. |
| `words` | `{ words: "Start with the ticket id, then a verb in the imperative." }` | The words go into the prompt of the project's workers and reviewers; the review judges the branch's messages by them. No hook. |
| `file` | `{ file: "commit-rules.md" }` | The file, a path inside the project's folder (`projects/<name>/`), is read at each spawn and goes into the prompt as words. No hook. |

A project without `commitRules.project(...)` gets no hook and no text.

## Refused at load

Each refuses the load before the plugin's setup, naming the project, so `arthur config check` and `arthur run` say it and no job starts:

- A `regex` that does not compile as a JavaScript regular expression: `plugin commit-rules: setup failed: project <name>: commit-rules.project(...): regex does not compile: <why>`.
- A piece of another shape, not exactly one of the three keys with a non-empty string: `... commit-rules.project(...): expected exactly one of { regex }, { words }, { file }, a non-empty string`.
- A `file` that is absolute or leads out of the project's folder: `... commit-rules.project(...): file "<file>" is not a path inside the project's folder`.

Any option but `enabled` is refused too: `unknown option; commit-rules takes none: a project's rule is its commitRules.project(...) in its project file`.

## The hook

Each new job worktree of a project with a `regex`, of every kind, gets the hook before its agent starts, on the job's machine (a `prepare` step, `arthur spawn --help`):

- The subject is the message's first line that is neither blank nor a comment (`#`). One that does not match fails the commit with `commit refused: the subject "<subject>" does not match this project's commit rule, the regex <regex>`. The regex runs in Node, as it was checked at load.
- A commit that concludes a merge is not checked (Git's `MERGE_HEAD` is there), whatever its subject: Git writes its own, `Merge branch 'main' into ...`, and a conflict resolved by hand ends the same way. The next commit is checked again.
- The project's own hooks still run in the job's worktree: its `core.hooksPath` (a relative one is the worktree's own folder, as Git takes it), else the repository's `hooks` folder. Its `commit-msg` runs after the rule passes.
- The hook lives in the worktree's own Git folder (`.git/worktrees/<id>/arthur-hooks`) and is named by `core.hooksPath` in that worktree's own `config.worktree`; both go with the worktree. Git reads a worktree's own configuration only once `extensions.worktreeConfig` is on, so the first hook sets that one key in the repository's shared `.git/config`. Nothing else outside Arthur's worktrees changes: not the main checkout's hooks, nor its `core.hooksPath`, nor any other value, and a commit in the main checkout is not checked.
- One exception, from Git itself (`git help worktree`, "CONFIGURATION FILE"): with that key on, a `core.bare = true` or a `core.worktree` in the shared config would hold for every worktree, so each is moved first into the main one's `config.worktree` (`<git folder>/config.worktree`), as `git sparse-checkout init` does. The repository reads the same value there, and its other worktrees, earlier and later ones, keep working. This is what happens to the bare repository of a project on another machine (`<home>/repos/<project>.git`, `arthur remote-job --help`), which `arthur remote-job repo` creates only once, so `core.bare` is never written back.
- `arthur continue` installs nothing: the worktree keeps the hook its spawn installed.
- A hook that cannot be installed refuses the spawn, and the job's worktree and record are removed: `plugin commit-rules: prepare failed: project <name>: the commit-msg hook was not installed: exit <code>: <its last line>`.
- `git commit --no-verify` skips it, as it skips every `commit-msg` hook; the review still sees the subject.

## In the prompt

The rule of `words` or `file` is a section at the end of the prompt of the roles `worker` and `reviewer` (`arthur roles --help`), no other:

- worker: `## Commit messages`, then `This project's rule for every commit message you write (<source>):` and the rule.
- reviewer: the same heading, then `This project's rule for commit messages; judge each commit of the branch by it, and a message that breaks it is a finding (<source>):` and the rule.

`<source>` is `commitRules.project({ words }) in its project file`, or the file's path in the project's folder. The file is read at each spawn. A file missing, a folder, a symlink, or an empty one is a warning of the spawn (`arthur spawn` prints it on stderr, `host.jobs.spawn` returns it in the job's `warnings`) and the job starts without the section: `warning: commit-rules: project <name>: rule file <path> is missing or not a file; the <role> goes without it` (`is empty` for an empty one).
