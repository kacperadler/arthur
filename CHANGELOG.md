# Changelog

Generated from `spec/features/` by `h changelog`; a hand edit is overwritten at the next merge.

## 2026-10-16

### Added

- AR0027 Dev dependencies beyond the toolchain are not checked (226d399)
- AR0031 `arthur config check` passes a plugin list the host refuses (19a97a0)
- AR0038 Roadmap: Later entries for the web panel, a knowledge base and a company edition (ea98772)
- AR0039 `arthur config check` says ok when a plugin's `setup` refuses the start (82a9965)

### Fixed

- AR0026 `arthur plugin new` meets the line-budget rule (a263149)
- AR0028 An instance name can produce the same variable prefix as another plugin (859864c)
- AR0030 Owner lookup takes the first longer prefix, not the longest (6ec64d6)
- AR0036 The lock's dead-holder takeover race has no test (73aa034)

### Changed

- AR0029 README still says no feature code exists (e58e20e)

### Other

- AR0001 Bootstrap: Arthur repository, docs, toolchain and the feature roadmap (bf0b60a)
- AR0002 Roadmap: job state, several machines, and resource-based limits (31d5a1d)
- AR0004 Roadmap 1: Repository rules as a test (705dc1f)
- AR0005 Roadmap 2: Config: defineConfig and the core's options (dd698ee)
- AR0006 Roadmap 3: Config: env names, .env, and arthur config check (dfa9ef5)
- AR0007 Roadmap 4: Plugin host, and the fake host (287f0c7)
- AR0008 Roadmap 5: Event stream (7c8a5ce)
- AR0009 Roadmap 6: Command registry and the arthur CLI (3e5fc73)
- AR0010 Roadmap 7: Clock: time zone and quiet hours (db203fd)
- AR0011 Roadmap 8: arthur run: Arthur as a process (dd9cacd)
- AR0012 Roadmap 9: Job runner: spawn and the job record (30a43af)
- AR0020 Roadmap 17: Ticket board: tickets and the board file (9819d29)
- AR0034 Roadmap: disk space and Docker cleanup with each worktree (af0e47f)
