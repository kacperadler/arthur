import { basename } from "node:path";

// Commands that run the command after them, with their options that take a value: `timeout 60 rm x` is `rm`. The long options are there as their sources list them (sudo's `parse_args.c`, coreutils' `env.c`, `timeout.c`, `nice.c` and `stdbuf.c`, util-linux's `ionice.c`, GNU time's `time.c`, findutils' `xargs.c`; master, 2026-10), a newer one missing, with `=` after those that take a value (not xargs' optional ones, which take one only after `=`, as `-i`, `-e` and `-l` take one only in their word): getopt_long reads a word as the option it names whole, else as the options it is a prefix of, which run the command only when they agree on taking a value; none that takes a value is the whole name of one and a prefix of one that does not (`sudo --login` is, and takes none).
const WRAPPERS: Readonly<Record<string, readonly string[]>> = {
	...Object.fromEntries(["command", "builtin", "exec", "nohup", "setsid", "unbuffer", "chrt"].map((name) => [name, []])),
	...{ sudo: ["-u", "-g", "-h", "-p", "-a", "-c", "-r", "-t", "-C", "-D", "-R", "-T", "-U", "--auth-type=", "--close-from=", "--login-class=", "--chdir=", "--group=", "--host=", "--prompt=", "--chroot=", "--role=", "--type=", "--other-user=", "--command-timeout=", "--user=", "--askpass", "--bell", "--background", "--preserve-env", "--edit", "--set-home", "--help", "--login", "--remove-timestamp", "--reset-timestamp", "--list", "--no-update", "--non-interactive", "--preserve-groups", "--stdin", "--shell", "--version", "--validate"], doas: ["-u", "-C"], env: ["-a", "-u", "-C", "-S", "--argv0=", "--env0-from=", "--unset=", "--chdir=", "--quoting-style=", "--split-string=", "--ignore-environment", "--null", "--block-signal", "--default-signal", "--ignore-signal", "--list-signal-handling", "--debug", "--help", "--version"], time: ["-f", "-o", "--format=", "--output=", "--output-file=", "--append", "--portability", "--quiet", "--verbose", "--help", "--version"], timeout: ["-s", "-k", "--signal=", "--kill-after=", "--foreground", "--preserve-status", "--verbose", "--help", "--version"], nice: ["-n", "--adjustment=", "--help", "--version"], ionice: ["-c", "-n", "-p", "-P", "-u", "--class=", "--classdata=", "--pid=", "--pgid=", "--uid=", "--ignore", "--help", "--version"], stdbuf: ["-i", "-o", "-e", "--input=", "--output=", "--error=", "--help", "--version"], xargs: ["-n", "-P", "-I", "-L", "-s", "-a", "-d", "-E", "--arg-file=", "--delimiter=", "--max-args=", "--max-chars=", "--max-procs=", "--process-slot-var=", "--max-lines", "--replace", "--eof", "--null", "--open-tty", "--interactive", "--no-run-if-empty", "--verbose", "--show-limits", "--exit", "--help", "--version"] },
};
// Words that start a command without being one.
const RESERVED = ["{", "}", "!", "if", "then", "else", "elif", "do", "while", "until"];

// The index in `words` of the command they run, after assignments, reserved words (`function` with the name it defines, so its body's first command is read) and wrappers with their options (-1 if none), and the folders `env -C` and `sudo -D` run it in. A cluster takes a value after its first letter that does (`-iC dir`, `-iCdir`); a long option is any prefix of those that agree on taking a value (`env --c=dir`, `sudo --us root`, `time --out f`).
// At an `env -S` (`--split-string`) it stops: the index of its option, then where the words after its value start and the value, which env splits into words that it reads on before those.
export function commandIndex(words: readonly string[], dirs: string[] = []): [number, string[], [number, string]?] {
	for (let index = 0; index < words.length; ) {
		if (words[index] === "function") {
			index += 2;
			continue;
		}
		const name = basename(words[index]!);
		const [values, flag] = [Object.hasOwn(WRAPPERS, name) ? WRAPPERS[name]! : undefined, name === "env" ? "C" : name === "sudo" ? "D" : ""];
		if (values === undefined && !RESERVED.includes(words[index]!) && !/^[A-Za-z_]\w*(\[[^\]]*\])?\+?=/.test(words[index]!)) return [index, dirs];
		for (index++; values !== undefined && index < words.length && /^-|^[\d.]+[smhd]?$/.test(words[index]!); ) {
			const [word, at, long] = [words[index]!, /^-[^-]/.test(words[index]!) ? [...words[index]!].findIndex((letter, position) => position > 0 && values.includes(`-${letter}`)) : -1, /^(--[^=]+)(=?)/.exec(words[index]!)];
			const options = long === null ? [] : values.filter((each) => each.startsWith(long[1]!)), option = new Set(options.map((each) => each.endsWith("="))).size === 1 ? options[0] : undefined;
			const takes = at > 0 ? at === word.length - 1 : long !== null ? option?.endsWith("=") === true && long[2] === "" : values.includes(word);
			const value = takes ? (words[index + 1] ?? "") : word.slice(at > 0 ? at + 1 : word.indexOf("=") + 1);
			if (name === "env" && (at > 0 ? word[at] === "S" : option === "--split-string=")) return [index, dirs, [index + (takes ? 2 : 1), value]];
			if (at > 0 ? word[at] === flag : option === "--chdir=") dirs.push(value);
			index += takes ? 2 : 1;
		}
	}
	return [-1, dirs];
}
