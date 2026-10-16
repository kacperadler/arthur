# arthur help

Usage: `arthur help [<command>]`, `arthur <command> --help`

`arthur help <command>` and `arthur <command> --help` print the command's doc page, the file it registered with. `arthur help`, `arthur --help` and `arthur` alone print the usage line and every command's name, the core's and the enabled plugins'.

Every command runs as `arthur <command> [args]`, on `arthur.config.ts` in the working folder, and exits with the command's own code. `--project <name>`, anywhere on the line, tells the command which project to act on instead of the main one; the command gets every other argument as written.

Each plugin registers its commands when it is set up, each with its doc page. Refused, and the start with it: a command whose doc file does not exist, a name that is not lowercase letters, digits and dashes, and a name another plugin or the core already registered (the message names both). Names are case-sensitive: `arthur Config` is not `arthur config`.

Said, without running anything:

- An unknown command: `arthur: unknown command <name>`, then every command's name; exit code 2.
- When `arthur.config.ts` or a plugin does not load, only the core's commands (`config`, `help`, `run`) exist; listing the commands then says why, and the core's commands still run (`arthur run` then refuses, naming why).
- A doc file deleted after the command was registered: `arthur <command>: its doc file <path> was deleted after Arthur loaded`; exit code 1.
- `--project` without a name, or given twice: exit code 2.
- A command that throws: `arthur <command>: <message>`; exit code 1.

Phone commands: a command may also answer `/<name> <text>` on a channel, without the model. A channel routes the message to the host and sends back the reply: the command's answer, `unknown command /<name>; phone commands: /a, /b` for a name no phone command has, or `/<name> failed: <first line of the error>` when it throws. A channel's command menu lists the phone commands, each with its one line.

Exit code: 0 when the page or the list is printed, 1 when a doc file is gone, 2 on wrong usage or an unknown command.
