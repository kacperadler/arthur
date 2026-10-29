# arthur config check

Usage: `arthur config check`

Loads `arthur.config.ts` from the working folder, runs the host's checks of the plugin list, and lists every env variable the enabled plugins name in their `...Env` options, one line each: `set` or `missing`, the variable, and the option that names it. A value is never printed. Like every `arthur` command, it first runs each enabled plugin's `setup`, so a refusal in a `setup` shows here as it would at the start.

```
set     ARTHUR_YOUTRACK_URL (youtrack.instances[0].urlEnv)
missing ARTHUR_YOUTRACK_TOKEN (youtrack.instances[0].tokenEnv)
```

Where a value comes from:

- The shell first; a shell variable wins even when it is empty.
- Else `core.envFile`, by default `~/.config/arthur/.env` (`$XDG_CONFIG_HOME/arthur/.env` when that is set), outside the config's folder and every project's checkout, where an agent's recursive search would print its values (`arthur doctor` warns of one inside either, `core env`), and ignored by Git in any checkout it lies in (else a critical line of `arthur doctor`, which refuses `arthur run`, `core env ignored`): `KEY=value` lines, `#` comments and blank lines; a value may be in single or double quotes, taken as written; after an unquoted value, ` #` starts a comment. A missing file is fine when every variable is in the shell; but no `ARTHUR_` variable of the shell reaches a job (`arthur spawn --help`), and inside a job the env file is not read either (below).
- Inside a job (`arthur help --help`) the env file is not read, since the job's sandbox closes it (`arthur spawn --help`, "The sandbox"): a variable comes from the job's shell alone, a missing one refuses nothing, and a plugin with a variable not set there is not loaded, nor one that `requires` it, so their commands are unknown; stderr says it once, `arthur: inside a job, not loaded: <names>: each names an env variable, and a job's CLI reads no env file`.

Where a value never goes: a value of 8 characters or more, from the shell or the env file, becomes its variable's name, `ARTHUR_TELEGRAM_BOT_TOKEN` in place of the token, before Arthur writes it: in the event log, so in every notice and channel message made of an event; in a job's record and log (its task, its prompt with the plugins' sections, an `arthur continue` instruction, a steer, a block's reason; and the agent's and the install's output, its final message and its end, which the job's wrapper names from the env file its record guards, since no shell value reaches it; a job on another machine, whose record there guards no env file, is named here as the sweep copies its files and reason, a value split across two copies of its log excepted); in a channel's reply to a phone command and the caption of `arthur send`; and in every text and byte an `arthur` command writes to stdout and stderr, an error included: a plugin's `setup` that fails, and an uncaught exception or unhandled rejection, which it prints named and exits 1 on. A value split across two such writes is not named. A shorter value stays as it is: replacing it would garble common text. A pipe's output that ends on what may be a value's first characters waits for the next chunk, or the pipe's end, so a value split across two chunks is named whole. The MCP servers' secrets a job's role gets are the exception the job needs, in `mcp/` while it runs (`arthur spawn --help`).

Names: `ARTHUR_<PLUGIN>_<WHAT>`, or inside a named instance (an entry with a `name`, such as a YouTrack server or a Telegram bot) `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`; the plugin and instance names in capitals, a dash as `_`. A plugin with `enabled: false` is skipped: its variables are neither looked up nor listed.

Said, without failing the check:

- A key set twice in the env file: `<file>: KEY is set on lines 2, 5; the last wins`.
- A variable set in the shell but not in the env file: `ARTHUR_X is set in the shell only; the arthur service does not see it, put it in <envFile>`. The service runs `arthur run` without the login shell (`docs/setup.md`, step 9), so there the variable is missing and refuses the start; a job sees neither (above). `arthur setup` prints the same line.

Refused, one line each (the same lines refuse the start):

- A name without the plugin's prefix, with another plugin's or another instance's name, or with nothing after the prefix: `<config>: <plugin>.<option>: expected ARTHUR_<PLUGIN>_<WHAT>, got <name>`. A text that is not a variable name, or not one starting with `ARTHUR_`, is not shown, since it may be a pasted secret.
- An `...Env` option that is not a string.
- An env-file line without `=`, with a key that is not letters, digits and `_`, or with an unclosed quote: named by its line number, never shown.
- An env file that exists but cannot be read.
- A config that does not load (its own refusals, `loadConfig`).
- A plugin list the host refuses, printed before the env lines: an entry that is not a plugin (its variables are then neither looked up nor listed), a plugin's `module` that is not its own `import.meta.url` (a `file:` URL), two plugins with one name, `orchestration` missing or disabled, an `enabled` that is not true or false, a `requires` naming a plugin that is missing or disabled, a cycle in `requires` and `after`, and each enabled plugin's own `check` (its problems, or `plugin <name>: check failed: ...` when it throws).
- A refusal in a plugin's `setup`, printed before the env lines when nothing above is refused (any of those stops the start before a `setup` runs): a command name the core or another plugin already registered, or a `setup` that throws: `plugin <name>: setup failed: ...`.

Exit code: 0 when nothing is refused and every variable is set, 1 otherwise, 2 on wrong usage.
