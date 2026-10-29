# AR0545 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Arithmetic outside `let`, `((…))`, `$((…))` and `$[…]` still sets HOME or XDG_CONFIG_HOME unseen

- Kind: security
- Found by: 2026-10-29-worker-062fd159 (worker), 2026-10-29
- Where: `packages/core/src/worktree-guard.ts:55`, `:84`
- What: bash evaluates arithmetic in more places than `let` and `((…))`, and an assignment there sets the variable: an array index (`a[XDG_CONFIG_HOME=5]=1`), the value given to an integer variable (`declare -i x=XDG_CONFIG_HOME=5`), an operand of `[[ … -eq … ]]` (`[[ 1 -eq XDG_CONFIG_HOME=1 ]]`), and a variable whose value is an expression that arithmetic reads (`n=XDG_CONFIG_HOME=5; (( n ))`). With `env -u XDG_CONFIG_HOME bash -c '<form>; echo "[$XDG_CONFIG_HOME]"'`, real bash printed `[5]`, `[5]`, `[1]` and `[5]`. With `; git status` added, each passed `worktreeRefusal` (a throwaway script on this branch). Arithmetic sets only an integer, but `HOME=5` or `XDG_CONFIG_HOME=5` is a relative folder, so git reads `5/.gitconfig` or `5/git/config` under the folder the call runs in, which the job can write.
- Suggestion: count a guarded name followed by an assignment operator inside a word's `[…]`, in the value of a `declare`/`typeset`/`local` with `-i`, in an operand of `-eq`, `-ne`, `-lt`, `-le`, `-gt` or `-ge` inside `[[`, and in a substring offset or length (`x=abc; : ${x:HOME=1}; git status` passes; with `env FOO=x bash -c 'export FOO; x=abc; : ${x:FOO=1}; env | grep ^FOO='` real bash printed `FOO=1`, review 2). Also count any assignment whose value contains a guarded name followed by `=`. A `$` or a backtick inside `((…))`, `$((…))` or `$[…]` is already counted, since bash evaluates its value as arithmetic too. Review 2's `wait -p FOO` and `coproc FOO { cat; }`, run the same way with `FOO` exported, left no `FOO` in the environment, so git would not see them.
- Status: open

## F2. A `${name:=…}` of config, or arithmetic, refuses a git call before it in the same text too

- Kind: ux
- Found by: 2026-10-29-worker-062fd159 (worker), 2026-10-29
- Where: `packages/core/src/worktree-guard.ts:55`
- What: the parser replaces `${XDG_CONFIG_HOME:=/tmp/h}` with its value and does not say which name it sets, and it splits `((…))` at `|`, `&` and `>>`. So the guard looks for these expansions, for a nameref declared with a `$`, and for `((…))`, `$((…))` or `$[…]` naming config or holding a `$` or a backtick, in the whole text a shell reads. As a result, `git status; : ${XDG_CONFIG_HOME:=/tmp/h}` is refused even though its git call runs first, and so is `git status; echo $(( $n + 1 ))` (a throwaway `worktreeRefusal` script on this branch). Every other form AR0545 counts takes effect only for the git calls after it.
- Suggestion: have `shellCommands` record, on the command each belongs to, the name a `${name=…}` or `${name:=…}` sets and the text of each arithmetic expansion, the way it records `dynamic`. The guard can then count it where it stands. `shell-words.ts` is at its 200-line limit.
- Status: dropped (AR0546, merged in, judges every git call of a call with the config set anywhere in it, so a git call before these forms is refused as the merged design intends)
