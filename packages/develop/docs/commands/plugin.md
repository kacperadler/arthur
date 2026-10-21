# arthur plugin

Usage: `arthur plugin new <name> --budget <lines> [--project <name>]`. Comes with the `develop` plugin (roadmap entry 66). Answered without the model.

Makes a new plugin package in Arthur's repository: the checkout of the main project, or of the one `--project` names, the project Arthur develops itself in (`projects({ list: [{ name: "arthur", prefix: "AR", path: "." }] })`). It writes into that checkout as it is, on its current branch, and commits nothing.

```
$ arthur plugin new acme-bot --budget 120
created packages/acme-bot: package.json, src/acme-bot.ts, test/acme-bot.test.ts, docs/acme-bot.md
added "acme-bot": 120 to BUDGETS in test/structure.test.ts, and @arthur/acme-bot to package-lock.json
next: write what it does, and list acmeBot() in the plugins of arthur.config.ts to load it
```

What it writes:

- `packages/<name>/package.json`: `@arthur/<name>`, private, Apache-2.0, no dependency; its `.` and `./options` both the plugin file.
- `packages/<name>/src/<name>.ts`: the plugin file, its options file too (docs/plugin-api.md, "Option tables and `./options`"): `summary`, `tools` and an empty `table`, a `checkOptions` that refuses every option but `enabled`, and the plugin's function, `<name>` in camelCase (`acme-bot`: `acmeBot`), with its `name`, `module` and an empty `setup`.
- `packages/<name>/test/<name>.test.ts`: the plugin set up on the fake host of `@arthur/core/testing`, and its refusal of an unknown option.
- `packages/<name>/docs/<name>.md`: its doc page, with the line for `arthur.config.ts`.
- `<name>: <lines>` added to `BUDGETS` in `test/structure.test.ts`, quoted when the name has a dash: the line budget the plugin's ticket decides. The comment above it, why that number, is the ticket's to write.
- The package in `package-lock.json` as `npm install` writes a workspace, so `npm ci` installs the checkout as it is, and `node_modules/@arthur/<name>` linked when `node_modules/@arthur` exists, so `@arthur/<name>` resolves before the next install.

As created, the package passes `npm run check`, `npm test` and the structure test with no hand edit. The package folder appears whole: it is written under a hidden name in `packages/` and renamed; the lockfile and the structure test are each written to a temporary name and renamed.

Refused, exit 1, with `refused: <why>; nothing was written` on stderr, before any file is written:

- a name that is not lowercase letters and dashes, a dash only between letters (`uptime`, `commit-rules`), as the host takes a plugin's name;
- a name whose function would be a JavaScript reserved word (`new`, `delete`, `class`, ...) or a name the new files declare or import (`assert`, `test`, `fakeHost`, `checkOptions`, `summary`, `tools`, `table`);
- `--budget` missing, not a positive whole number (`0`, `1.5`, `01`, `=-1`), or below the lines the new package's `src/` holds as created (25), which the structure test would refuse;
- a name taken: `packages/<name>` exists, the core's included, or `BUDGETS` has a budget of that name.

Anything but `new <name>` and its flags, an unknown flag, or `--budget` with no value prints the usage and exits 2. An unknown `--project` exits 1 with `unknown project <name>; projects: ...`.
