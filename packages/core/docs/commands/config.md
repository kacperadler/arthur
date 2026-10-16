# arthur config check

Usage: `arthur config check`

Loads `arthur.config.ts` from the working folder and lists every env variable the enabled plugins name in their `...Env` options, one line each: `set` or `missing`, the variable, and the option that names it. A value is never printed.

```
set     ARTHUR_YOUTRACK_URL (youtrack.instances[0].urlEnv)
missing ARTHUR_YOUTRACK_TOKEN (youtrack.instances[0].tokenEnv)
```

Where a value comes from:

- The shell first; a shell variable wins even when it is empty.
- Else `core.envFile` (default `.env` next to the config): `KEY=value` lines, `#` comments and blank lines; a value may be in single or double quotes, taken as written; after an unquoted value, ` #` starts a comment. A missing file is fine when every variable is in the shell.

Names: `ARTHUR_<PLUGIN>_<WHAT>`, or inside a named instance (an entry with a `name`, such as a YouTrack server or a Telegram bot) `ARTHUR_<PLUGIN>_<INSTANCE>_<WHAT>`; the plugin and instance names in capitals, a dash as `_`. A plugin with `enabled: false` is skipped: its variables are neither looked up nor listed.

Said, without failing the check:

- A key set twice in the env file: `<file>: KEY is set on lines 2, 5; the last wins`.

Refused, one line each (the same lines refuse the start):

- A name without the plugin's prefix, with another plugin's or another instance's name, or with nothing after the prefix: `<config>: <plugin>.<option>: expected ARTHUR_<PLUGIN>_<WHAT>, got <name>`. A text that is not a variable name is not shown, since it may be a pasted secret.
- An `...Env` option that is not a string.
- An env-file line without `=`, with a key that is not letters, digits and `_`, or with an unclosed quote: named by its line number, never shown.
- An env file that exists but cannot be read.
- A config that does not load (its own refusals, `loadConfig`).

Exit code: 0 when nothing is refused and every variable is set, 1 otherwise, 2 on wrong usage.
