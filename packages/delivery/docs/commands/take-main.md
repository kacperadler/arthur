# arthur take-main

Usage: `arthur take-main [--decision <id>] [--project <name>]`. Comes with the `delivery` plugin (AR0441). For one project, the main one unless `--project` names another. A job may not run it.

Takes main as it is, on the owner's word: `arthur merge` refuses a branch while main has a commit that changes code since the last merge `arthur merge` made (`arthur merge --help`, "Refused, touching nothing"). Once the owner has read those commits and keeps them, this command records main's HEAD in `<delivery folder>/<project>/last-merge` (`.arthur/delivery/<project>/last-merge`), the file each merge that went in writes with its merge commit, written under a temporary name and renamed; the next `arthur merge` lists main's commits from there. It prints `took main of <project> as it is at <commit>: the next arthur merge lists code commits from there`. It changes nothing in the repository: no commit, no merge.

Only with `--decision <id>`, the owner's recorded decision of kind `merge`, for no ticket and no job, which the orchestration plugin checks (`call("decision.owner", { id, what: "arthur take-main", kind: "merge", use })`, `arthur decision --help`, "What only the owner's decision lets through"); a decision is used once. Record it first:

```sh
arthur decision ask --kind merge --question 'Take main as it is at <commit>, with <commits>?'
arthur decision answer <id> --decided 'take main as it is' '<his words>'
arthur take-main --decision <id>
```

Refused, exit 1, nothing written:

- No decision, or one orchestration refuses: `<orchestration's refusal>; nothing taken`. Without `--decision` the refusal names the ask to make, `arthur take-main needs the owner's decision: arthur decision ask --kind merge --question '<what he decides>', his answer recorded with arthur decision answer, then arthur take-main --decision <its id>`.
- The project's checkout whose own Git config sets a key that may name a program, as `arthur merge` refuses it: `<file> sets <key>, …; nothing taken`.
- A project not in the list: `no project <name> in the project list`.

Wrong usage (any word but `--decision <id>`, `--decision` without a value) prints the usage line and exits 2.
