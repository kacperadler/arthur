# arthur help

Usage: `arthur help [<command>]`, `arthur <command> --help`

`arthur help <command>` and `arthur <command> --help` print the command's doc page, the file it registered with. `arthur help`, `arthur --help` and `arthur` alone print the usage line and every command's name, the core's and the enabled plugins'.

Every command runs as `arthur <command> [args]`, on `arthur.config.ts` in the working folder, and exits with the command's own code. `--project <name>`, anywhere on the line, tells the command which project to act on instead of the main one; the command gets every other argument as written.

Each plugin registers its commands when it is set up, each with its doc page. Refused, and the start with it: a command whose doc file does not exist, a name that is not lowercase letters, digits and dashes, and a name another plugin or the core already registered (the message names both). Names are case-sensitive: `arthur Config` is not `arthur config`.

Said, without running anything:

- An unknown command: `arthur: unknown command <name>`, then every command's name; exit code 2.
- When `arthur.config.ts` or a plugin does not load, only the core's commands (`config`, `continue`, `help`, `roles`, `run`, `spawn`, `steer`, `stop`, `ticket`) exist; listing the commands then says why, and the core's commands still run (`arthur run`, `arthur spawn`, `arthur roles`, `arthur stop`, `arthur continue` and `arthur steer` then refuse, naming why; `arthur ticket` refuses, since the board needs the plugins' project list).
- A doc file deleted after the command was registered: `arthur <command>: its doc file <path> was deleted after Arthur loaded`; exit code 1.
- `--project` without a name, or given twice: exit code 2.
- A `--project` name Arthur does not know, before any command runs (its `--help` still prints): with the list of the `projects` plugin, a name not in it, `arthur <command>: unknown project <name>; projects: <names>`; without that plugin, any name but the repository's folder name, `unknown project <name>; the only project is <name>`, or, outside Git, `unknown project <name>; no plugin provides the project list and <folder> is not in a Git repository`; exit code 1. When `arthur.config.ts` does not load, the project list is unknown and the name is not checked; the commands that read it refuse anyway.
- A command that throws: `arthur <command>: <message>`; exit code 1.

Phone commands: a command may also answer `/<name> <text>` on a channel, without the model. A channel routes the message to the host with where it came from, its channel, the place the message names (a topic, a channel id) and the channel's named instance it came through (a named bot), which the command gets beside the text, and sends the reply back to that place: the command's answer, `unknown command /<name>; phone commands: /a, /b` for a name no phone command has, or `/<name> failed: <first line of the error>` when it throws. A channel's command menu lists the phone commands, each with its one line. So that every phone command fits Telegram's menu, a phone command is also refused at start when its name has a dash or more than 32 characters, or its line is empty, only spaces, or longer than 256 characters; a command without a phone side keeps its dashes (`arthur review-needed`).

Exit code: 0 when the page or the list is printed, 1 when a doc file is gone, 2 on wrong usage or an unknown command.
