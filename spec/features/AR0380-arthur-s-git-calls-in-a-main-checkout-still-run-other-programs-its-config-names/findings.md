# AR0380 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. A job's program can still plant a key between the config check and the git call

- Kind: security
- Found by: 2026-10-24-ar0380-git-config-progra-2bc459e3 (worker), 2026-10-25
- Where: `packages/core/src/git-config.ts` (`configRefusal`), its callers in `git.ts`, `job-machine.ts`, `merge-command.ts`, `github-git.ts`
- What: the check reads the repository's own config with one `git config --list`, then the git call reads it again. A running job's program that rewrites `.git/config` in a loop (a filter plus `.git/info/attributes`) can land its key in that gap, and the merge, checkout or push runs it. Named as a limit in `docs/deploy.md`, "Threat model". [INFERENCE] from the two reads; no race was run.
- Suggestion: pass the values of the keys Git reads by a fixed name with `-c` as well (`credential.helper=` resets the list, `core.sshCommand`, `gpg.program`, `commit.gpgSign=false`, `protocol.allow=never` for `ext`), which closes the gap for them; drivers named by an attribute (`filter.<name>`, `merge.<name>`) stay behind the check.
- Status: ticket AR0392

## F2. A remote's `url` can name a transport whose helper runs from PATH

- Kind: security
- Found by: 2026-10-24-ar0380-git-config-progra-2bc459e3 (worker), 2026-10-25
- Where: `packages/core/src/git-config.ts` (`remote.<name>.url` is on the allowed set)
- What: `remote.origin.url = <transport>::<address>` makes `github.push` run `git-remote-<transport>`, a program found on PATH, not one the config names; `ext::` stays off as long as `protocol.ext.allow` cannot be set in the repository's config (it is outside the set). Named as a limit in `docs/deploy.md`. [INFERENCE] from Git's gitremote-helpers documentation; not run here.
- Suggestion: refuse a `remote.*.url` or `pushurl` of the form `<word>::` in `configRefusal`, or run the push with `GIT_PROTOCOL_FROM_USER=0`.
- Status: ticket AR0393
