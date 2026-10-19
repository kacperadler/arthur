# The nvm plugin

Roadmap entry 84: each project's jobs run on the Node its `.nvmrc` names, as nvm finds it on the job's machine. `arthur init` writes that file (the major version of the Node Arthur runs on, `24` today) into a repository without one. The plugin is optional: without it every job runs on the Node of Arthur's `PATH` (`docs/setup.md`, step 8), whatever `.nvmrc` says.

```ts
plugins: [orchestration({}), nvm(), projects({ list: [...] })],
```

It has no options but `enabled`; any other is refused at load (`nvm.<key>: unknown option; nvm has no options but enabled`).

## At each spawn

Its `prepare` runs one command on the job's machine through `host.jobs.run` (over SSH for another machine), in the job's worktree there, cut after 30 s:

1. No `.nvmrc` in the worktree: nothing more; the job gets no variable and runs on the machine's default Node.
2. The version is the file's first line that is neither blank nor a `#` comment, its spaces trimmed: `24`, `v24.21.0`, `lts/iron`.
3. `. "$NVM_DIR/nvm.sh" && nvm which <version>`, with `~/.nvm` when `NVM_DIR` is not set (a command over SSH and a systemd service see none). nvm only looks: nothing is downloaded during a spawn.
4. The folder of the node it names goes first on the job's `PATH`: `PATH=<that folder>:<the PATH before>`, the PATH before being the one a prepare before nvm's returned, else the machine's own as a command there sees it. The variable goes into the environment the wrapper and the agent run with, never the record. Each prepare after nvm's gets it as `env.PATH`; prepares run in setup order, which is the config's (required plugins first), so list `nvm()` before a plugin whose prepare must run under that Node.

Refused, the spawn ending with `plugin nvm: prepare failed: <reason>; the job's worktree and record were removed`:

- a version not installed there: `Node <version>, which <worktree>/.nvmrc names, is not installed on machine <machine>; fix: nvm install <version> there`;
- an `.nvmrc` with no version (empty, or comments and blank lines only): `<worktree>/.nvmrc on machine <machine> names no Node version; write the project's, such as 24`;
- an `.nvmrc` that cannot be read (a folder, a broken link, no permission): `<worktree>/.nvmrc on machine <machine> is unreadable: <cat's line>`;
- nvm missing there: `nvm is missing on machine <machine> (no <dir>/nvm.sh), which <worktree>/.nvmrc needs; fix: curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash, then nvm install <version> there`;
- a call that does not end in 30 s: `nvm which on machine <machine> timed out after 30 s`; any other failure, such as a machine that does not answer: `nvm which on machine <machine> exited <code>: <its last line>`.

Bun has no nvm: it stays on the service's `PATH` (`docs/setup.md`, step 8), and on another machine on the `PATH` of a command over SSH.

## `arthur doctor`

One line per machine (`local` and each one another plugin registers), never critical, since a project without `.nvmrc` needs no nvm:

- `nvm <machine>: ok (nvm <version>)`, from `nvm --version` there;
- `nvm <machine>: missing: no <dir>/nvm.sh` (or ssh's line), costing `a job on <machine> of a project with .nvmrc is refused`, fixed by `curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash` (on another machine: `on <machine>: ` before it).
