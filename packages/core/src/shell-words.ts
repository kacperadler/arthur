// The shell parser the guards share (spec/roadmap.md, entries 19 and 20). `shellCommands` reads a command line as bash does before brace and pathname expansion: its simple commands in the order they run, split at `;`, `&&`, `||`, `|`, `&` and
// newlines, and `(` and `)` around a subshell, a `$(…)` or a backtick substitution, also one in a fallback word, whose commands come before the command they are in. A word has its quotes removed, a backslash-newline gone, the escapes of `$'…'` decoded; a comment is dropped.
// An expansion known only when the command runs (`$x`, `${x}`, `$1`) is nothing, or the word it falls back to (`${x:-word}`, also with `=`, `+`, `?` and without the colon; in double quotes read as their text, `~` and `'` as written,
// inner `"` gone, and `\0-` with a `$'…'` or `$"…"`, which `shopt extquote` reads two ways; outside, one with an unquoted blank or `<>;&|()#` is `\0-`, as the guard does not follow how bash splits it); a variable in `known` (`HOME`, `ARTHUR_JOB`) is its value, also with `-`, `=`, `?`; `known.HOME` is an unquoted `~` at a word's start, after an assignment's `=` or after an unquoted `:` in its value (`~+` and `~-` there stay, any other `~name` there, a user's home or a `dirs` entry, is `\0-`). `$PWD` is
// `~+` and `$OLDPWD` `~-` (also with `-`, `=`, `?`); one of them or of a set variable in `known` with another operator but `+` (`%`, `#`, `/`, `:1`, `${!x}`, `${#x}`) is `\0-`, in no bash word. A here-string's `~+` and an unquoted heredoc's `$PWD` or `${PWD}` (also with `-`, `=`, `?`) are `\0+`, the folder of the shell that reads them; its `${PWD` with another operator but `+` `\0-`. A quoted or escaped
// `\*?[]{},()~`, or any other `~`, keeps a backslash, so a glob is told apart from a quoted star and a bare `~+` is `$PWD` or that prefix; `literal` removes it. `shellWords`: every word, a heredoc's body one.

const SPECIAL = "\\*?[]{},()~";
const ESCAPES: Readonly<Record<string, string>> = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };
// A redirect operator where the text starts; `&>` and `&>>` write stdout and stderr. Any operator not in TARGETS writes.
const REDIRECT = /^(?:&>>?|>>|>\||>&|<>|<<<|<<-?|<&|>|<)/;
type Target = "write" | "read" | "duplicate" | "here";
const TARGETS: Readonly<Record<string, Target>> = { "<": "read", "<&": "read", ">&": "duplicate", "<<<": "here" };

// One simple command: its `words`; `writes`, the targets of the redirects that write a file (`>`, `>>`, `>|`, `<>`, `&>`, `>&name`); `reads`, those of the others and a heredoc's delimiter;
// `stdin`, the text of a heredoc or a here string. `alone` is false in a pipeline or in the background, where it runs in a subshell and a `cd` does not last.
export type Command = { readonly words: string[]; readonly writes: string[]; readonly reads: string[]; readonly stdin: string[]; readonly alone: boolean };
export type Item = Command | "(" | ")";

const quoted = (text: string): string => [...text].map((char) => (SPECIAL.includes(char) ? `\\${char}` : char)).join("");

export function literal(word: string): string {
	return word.replace(/\\(.)/gs, "$1");
}

// Text with the escapes of bash's `$'…'` resolved: `\xHH`, `\uHHHH`, `\UHHHHHHHH` (one digit or more), octal `\NNN`,
// `\cX`, and the letters of ESCAPES; any other escaped character stands for itself.
export function decodeEscapes(text: string): string {
	return text.replace(/\\(?:x([0-9a-fA-F]{1,2})|u([0-9a-fA-F]{1,4})|U([0-9a-fA-F]{1,8})|([0-7]{1,3})|c(.)|(.))/gs, (_, hex?: string, short?: string, long?: string, octal?: string, control?: string, other?: string) => {
		if (control !== undefined) return String.fromCharCode(control.charCodeAt(0) & 31);
		if (other !== undefined) return ESCAPES[other] ?? other;
		const code = parseInt(hex ?? short ?? long ?? octal ?? "", octal === undefined ? 16 : 8);
		return code <= 0x10ffff ? String.fromCodePoint(code) : "";
	});
}

// The index of the character that closes the one opened just before `from`: `)` for `(`, `}` for `{`, nested pairs and
// quoted text skipped, an escaped `"` in double quotes not closing them; the end of the text when it is never closed.
function closing(text: string, from: number, open: string, close: string): number {
	let depth = 1;
	for (let at = from; at < text.length; at++) {
		const char = text[at]!;
		if (char === "\\") at++;
		else if (char === "'" || char === '"') at += /^(?:'[^']*'?|"(?:\\.|[^"\\])*"?)/s.exec(text.slice(at))![0].length - 1;
		else if (char === open) depth++;
		else if (char === close && --depth === 0) return at;
	}
	return text.length;
}

export function shellWords(command: string): string[] {
	return shellCommands(command).flatMap((item) => (typeof item === "string" ? [] : [...item.words, ...item.writes, ...item.reads, ...item.stdin.flatMap(shellWords)]));
}

export function shellCommands(command: string, known: Readonly<Record<string, string | undefined>> = {}): Item[] {
	const items: Item[] = [];
	let current: Command = { words: [], writes: [], reads: [], stdin: [], alone: true };
	// The substitutions of the command being read, which run before it.
	let before: Item[] = [];
	let word = "";
	let target: Target | undefined;
	let heredocs: { readonly into: string[]; readonly delimiter: string; readonly expands: boolean; readonly strip: boolean }[] = [];
	const end = () => {
		if (word === "") return;
		if (target === undefined) current.words.push(word);
		else if (target === "here") current.stdin.push(literal(word.replace(/(?<!\\)((?:\\\\)*)~\+/g, "$1\0+")));
		else (target === "write" || (target === "duplicate" && !/^\d*-?$/.test(word)) ? current.writes : current.reads).push(word);
		[word, target] = ["", undefined];
	};
	const finish = (alone: boolean) => {
		end();
		items.push(...before);
		if (Object.values(current).some((part) => Array.isArray(part) && part.length > 0)) items.push(current);
		[before, current, target] = [[], { words: [], writes: [], reads: [], stdin: [], alone }, undefined];
	};
	const value = (name: string): string | undefined => (Object.hasOwn(known, name) && known[name] !== undefined ? quoted(known[name]) : undefined);
	// The expansion that starts with `$` at `at`, inside double quotes or not: adds its text to the word, and the substitutions of a fallback word to `before`; returns where it ends.
	const dollar = (at: number, inDouble: boolean): number => {
		const next = command[at + 1];
		if (next === "(") {
			const close = closing(command, at + 2, "(", ")");
			before.push("(", ...shellCommands(command.slice(at + 2, close), known), ")");
			return close + 1;
		}
		if (next === "{") {
			const close = closing(command, at + 2, "{", "}");
			const inner = command.slice(at + 2, close);
			const [fallback, name, of] = [/^[#!]?(?:[A-Za-z_]\w*|\d+|[@*#?$!-])(?:\[[^\]]*\])?:?[-=+?]([^]*)$/.exec(inner), /^([A-Za-z_]\w*)(?:\[0\])?(?::?[-=?]|$)/.exec(inner)?.[1], /^[#!]?([A-Za-z_]\w*)/.exec(inner)?.[1]];
			const unsure = fallback !== null && (inDouble ? /(?<!\\)(?:\\\\)*\$['"]/.test(fallback[1]!) : /[\s<>;&|()#]/.test(fallback[1]!.replace(/\\.|'[^']*'|"(?:\\.|[^"\\])*"/gs, "")));
			const parsed = fallback === null ? [] : shellCommands(inDouble ? `"${fallback[1]!.replace(/(?<!\\)((?:\\\\)*)"/g, "$1")}"` : fallback[1]!, known);
			let depth = 0;
			before.push(...parsed.filter((item) => (depth += item === "(" ? 1 : item === ")" ? -1 : 0) > 0 || item === ")"));
			word += name === "OLDPWD" ? "~-" : fallback === null && name === undefined && of !== undefined && (of === "OLDPWD" || of === "PWD" || value(of) !== undefined) ? "\0-" : name === "PWD" ? "~+" : ((name && value(name)) ?? (unsure ? "\0-" : parsed.flatMap((item) => (typeof item === "string" ? [] : item.words)).join(" ")));
			return close + 1;
		}
		if (next === "'" && !inDouble) {
			let close = at + 2;
			while (close < command.length && command[close] !== "'") close += command[close] === "\\" ? 2 : 1;
			word += quoted(decodeEscapes(command.slice(at + 2, close)));
			return close + 1;
		}
		const name = /^(?:[A-Za-z_]\w*|[0-9@*#?$!-])/.exec(command.slice(at + 1))?.[0];
		if (name !== undefined) word += name === "OLDPWD" ? "~-" : name === "PWD" ? "~+" : (value(name) ?? "");
		else if (next !== '"' || inDouble) word += "$";
		return at + 1 + (name?.length ?? 0);
	};
	// A backtick substitution that starts at `at`: its commands are added, and the index after its closing backtick returned.
	const backtick = (at: number): number => {
		let close = at + 1;
		while (close < command.length && command[close] !== "`") close += command[close] === "\\" ? 2 : 1;
		before.push("(", ...shellCommands(command.slice(at + 1, close), known), ")");
		return close + 1;
	};
	// The delimiter of a heredoc whose `<<` ends at `from`, noted for the body the next line starts; returns where it ends.
	const heredoc = (from: number, strip: boolean): number => {
		const raw = /^[ \t]*((?:\\.|'[^']*'|"(?:\\.|[^"\\])*"|[^\s;&|<>()'"\\])+)/s.exec(command.slice(from));
		if (raw === null) return from;
		const delimiter = literal(shellWords(raw[1]!).join(""));
		current.reads.push(delimiter);
		heredocs.push({ into: current.stdin, delimiter, expands: !/['"\\]/.test(raw[1]!), strip });
		return from + raw[0].length;
	};
	// An unquoted heredoc's body as the outer shell hands it on: a backslash before `$`, `` ` ``, `\` or a newline gone, `$name` or `${name}` of a variable in `known` its value.
	const outer = (body: string): string => body.replace(/\\([$`\\\n])|\$(?:([A-Za-z_]\w*)|\{([A-Za-z_]\w*)\})/g, (match, escaped?: string, plain?: string, braced?: string) => (escaped !== undefined ? escaped.replace("\n", "") : ((Object.hasOwn(known, (plain ?? braced)!) ? known[(plain ?? braced)!] : undefined) ?? match)));
	// The bodies of the heredocs noted on the line before `from`, each up to its delimiter's line; with an unquoted
	// delimiter, the substitutions in the body run and the body is read as `outer` hands it on. Returns where the line after the last delimiter starts.
	const bodies = (from: number): number => {
		for (const { into, delimiter, expands, strip } of heredocs) {
			let [body, at, last] = ["", from, from];
			while (at < command.length) {
				const stop = at + /^[^\n]*/.exec(command.slice(at))![0].length;
				const line = strip ? command.slice(at, stop).replace(/^\t+/, "") : command.slice(at, stop);
				[last, at] = [at, stop + 1];
				if (line === delimiter) break;
				body += `${line}\n`;
				last = at;
			}
			into.push(expands ? outer(body.replace(/(?<!\\)((?:\\\\)*)\$(?:PWD(?!\w)|\{PWD(?:\[0\])?(?::?[-=?][^{}]*)?\})/g, "$1\0+").replace(/(?<!\\)((?:\\\\)*)\$\{[#!]?PWD(?!\w|:?\+)/g, "$1\0-")) : body);
			for (let index = from; expands && index < last; ) index = command[index] === "\\" ? index + 2 : command[index] === "$" ? dollar(index, true) : command[index] === "`" ? backtick(index) : index + 1;
			word = "";
			from = Math.min(at, command.length);
		}
		heredocs = [];
		return from;
	};

	let [at, colon] = [0, -1];
	while (at < command.length) {
		const char = command[at]!;
		const redirect = REDIRECT.exec(command.slice(at, at + 3))?.[0];
		if (char === "\\") [word, at] = [word + (command[at + 1] === "\n" ? "" : quoted(command[at + 1] ?? "\\")), at + 2];
		else if (char === "'") {
			const close = command.indexOf("'", at + 1);
			word += quoted(command.slice(at + 1, close < 0 ? undefined : close));
			at = close < 0 ? command.length : close + 1;
		} else if (char === '"') {
			for (at++; at < command.length && command[at] !== '"'; ) {
				const inner = command[at]!;
				if (inner === "\\" && '$`"\\\n'.includes(command[at + 1] ?? "")) [word, at] = [word + (command[at + 1] === "\n" ? "" : quoted(command[at + 1]!)), at + 2];
				else if (inner === "$") at = dollar(at, true);
				else if (inner === "`") at = backtick(at);
				else word += quoted(command[at++]!);
			}
			at++;
		} else if (char === "$") at = dollar(at, false);
		else if (char === "`") at = backtick(at);
		else if (redirect !== undefined) {
			// The number of the file descriptor it redirects, written right before it, is no word.
			if (/^\d+$/.test(word)) word = "";
			end();
			if (redirect.startsWith("<<") && redirect !== "<<<") at = heredoc(at + redirect.length, redirect === "<<-");
			else [target, at] = [TARGETS[redirect] ?? "write", at + redirect.length];
		} else if (";&|\n".includes(char)) {
			const two = command.slice(at, at + 2);
			const pipe = two === "|&" || (char === "|" && two !== "||");
			if (pipe || (char === "&" && two !== "&&")) current = { ...current, alone: false };
			finish(!pipe);
			at += ["&&", "||", ";;", "|&"].includes(two) ? 2 : 1;
			if (char === "\n") at = bodies(at);
		} else if (char === "(" && /^[A-Za-z_]\w*(\[[^\]]*\])?\+?=$/.test(word)) {
			// A list assigned, `name=(a b)`, is the word `name=(a`, its first element; the elements are a subshell's words before it.
			const close = closing(command, at + 1, "(", ")");
			const inner = shellCommands(command.slice(at + 1, close), known);
			before.push("(", ...inner, ")");
			[word, at] = [`${word}(${inner.flatMap((item) => (typeof item === "string" ? [] : item.words))[0] ?? ""}`, close + 1];
		} else if (char === "(" || char === ")") {
			finish(true);
			items.push(command[at++] === "(" ? "(" : ")");
		} else if (char === "#" && word === "" && (at === 0 || /[\s;&|()<>]/.test(command[at - 1]!))) at += /^[^\n]*/.exec(command.slice(at))![0].length;
		else if (/\s/.test(char)) {
			end();
			at++;
		} else {
			const tilde = char === "~" && (colon === at ? /^[A-Za-z_]\w*(?:\[[^\]]*\])?\+?=/ : /^(?:[A-Za-z_]\w*(?:\[[^\]]*\])?\+?=)?$/).test(word) ? /^~([^/\s;&|()<>'"\\$`]*)(?=[/\s;&|()<>]|$)/.exec(command.slice(at))?.[1] : undefined;
			[word, at, colon] = [word + (char !== "~" ? char : tilde === "" ? (value("HOME") ?? char) : tilde === undefined ? "\\~" : tilde === "+" || tilde === "-" ? char : "\0-"), at + 1, char === ":" ? at + 1 : colon];
		}
	}
	finish(true);
	return items;
}
