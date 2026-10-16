# Arthur

Arthur runs coding agents (OMP) for one human: a small core runs each job in its own Git worktree and keeps a ticket board in plain files, and plugins add the rest (the coordinator, schedules, projects, review and merge, GitHub, YouTrack, Telegram) from one config file, `arthur.config.ts`. It exposes nothing to the internet.

**Status: in development, not usable yet.** What runs today: config loading, and `arthur config check`, which loads `arthur.config.ts` and lists the env variables the enabled plugins need, each `set` or `missing`, never their values; the plugin host, and the command registry behind the `arthur` binary (`arthur help`, `arthur <cmd> --help`) and a channel's `/name text`; the ticket board (`arthur ticket new|status|all`, `host.board`), which reads the project list a plugin provides. The rest (the job runner, the plugins) is ordered in [`spec/roadmap.md`](spec/roadmap.md).

- What Arthur is and is not: [`spec/vision.md`](spec/vision.md).
- Diagrams (Mermaid): [core and plugins](docs/architecture/core-and-plugins.mmd), [from config to a running plugin](docs/architecture/config-flow.mmd), [versions](docs/architecture/versions.mmd).
- An example config: [`arthur.config.example.ts`](arthur.config.example.ts).

Development needs Node 24: `npm ci`, then `npm run check` and `npm test`.

## Licence

[FSL-1.1-ALv2](LICENSE), the Functional Source License with Apache 2.0 after two years. Arthur is source-available, not open source: you may read, run, change and fork it for any purpose except offering it as a competing commercial product, and each release becomes Apache-2.0 two years after it is published.
