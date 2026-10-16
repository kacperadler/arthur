// The words of a shell command as bash sees them before brace and pathname expansion (spec/roadmap.md, entries 19 and 20):
// split at unquoted blanks and the operators `; & | < > ( )`, quotes removed, a backslash-newline gone, the escapes of
// `$'…'` decoded, a `#` comment dropped. An expansion whose value is known only when the command runs (`$x`, `${x}`, `$1`)
// is nothing, or the word it falls back to (`${x:-word}`, also with `=`, `+`, `?` and without the colon). The words of a
// command substitution (`$(…)`, backticks) count as words of their own. A quoted or escaped character that brace or
// pathname expansion would take as special (`\ * ? [ ] { } ,`) keeps a backslash before it, so a glob is told apart from
// a quoted star; `literal` removes those backslashes. A heredoc body is split like any other text.

const SPECIAL = "\\*?[]{},";
const OPERATORS = ";&|<>()";
const ESCAPES: Readonly<Record<string, string>> = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };

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
// quoted text skipped; the end of the text when it is never closed.
function closing(text: string, from: number, open: string, close: string): number {
	let depth = 1;
	for (let at = from; at < text.length; at++) {
		const char = text[at]!;
		if (char === "\\") at++;
		else if (char === "'" || char === '"') {
			const end = text.indexOf(char, at + 1);
			at = end < 0 ? text.length : end;
		} else if (char === open) depth++;
		else if (char === close && --depth === 0) return at;
	}
	return text.length;
}

export function shellWords(command: string): string[] {
	const words: string[] = [];
	let word = "";
	let started = false;
	const add = (text: string) => {
		word += text;
		started = true;
	};
	const end = () => {
		if (started) words.push(word);
		word = "";
		started = false;
	};
	// The expansion that starts with `$` at `at`, inside double quotes or not: what it adds to the word, and where it ends.
	const dollar = (at: number, inDouble: boolean): [string, number] => {
		const next = command[at + 1];
		if (next === "(") {
			const close = closing(command, at + 2, "(", ")");
			words.push(...shellWords(command.slice(at + 2, close)));
			return ["", close + 1];
		}
		if (next === "{") {
			const close = closing(command, at + 2, "{", "}");
			const fallback = /^[#!]?(?:[A-Za-z_]\w*|\d+|[@*#?$!-])(?:\[[^\]]*\])?:?[-=+?]([^]*)$/.exec(command.slice(at + 2, close));
			return [fallback === null ? "" : shellWords(fallback[1]!).join(" "), close + 1];
		}
		if (next === "'" && !inDouble) {
			let close = at + 2;
			while (close < command.length && command[close] !== "'") close += command[close] === "\\" ? 2 : 1;
			return [quoted(decodeEscapes(command.slice(at + 2, close))), close + 1];
		}
		const name = /^(?:[A-Za-z_]\w*|[0-9@*#?$!-])/.exec(command.slice(at + 1));
		if (name !== null) return ["", at + 1 + name[0].length];
		if (next === '"' && !inDouble) return ["", at + 1];
		return ["$", at + 1];
	};
	// A backtick substitution that starts at `at`: its words are added, and the index after its closing backtick returned.
	const backtick = (at: number): number => {
		let close = at + 1;
		while (close < command.length && command[close] !== "`") close += command[close] === "\\" ? 2 : 1;
		words.push(...shellWords(command.slice(at + 1, close)));
		return close + 1;
	};

	let at = 0;
	while (at < command.length) {
		const char = command[at]!;
		if (char === "\\") {
			if (command[at + 1] !== "\n") add(quoted(command[at + 1] ?? "\\"));
			at += 2;
		} else if (char === "'") {
			const close = command.indexOf("'", at + 1);
			add(quoted(command.slice(at + 1, close < 0 ? undefined : close)));
			at = close < 0 ? command.length : close + 1;
		} else if (char === '"') {
			add("");
			for (at++; at < command.length && command[at] !== '"'; ) {
				const inner = command[at]!;
				if (inner === "\\" && '$`"\\\n'.includes(command[at + 1] ?? "")) {
					if (command[at + 1] !== "\n") add(quoted(command[at + 1]!));
					at += 2;
				} else if (inner === "$") {
					const [text, next] = dollar(at, true);
					add(text);
					at = next;
				} else if (inner === "`") at = backtick(at);
				else {
					add(quoted(inner));
					at++;
				}
			}
			at++;
		} else if (char === "$") {
			const [text, next] = dollar(at, false);
			add(text);
			at = next;
		} else if (char === "`") at = backtick(at);
		else if (char === "#" && !started) {
			const newline = command.indexOf("\n", at);
			at = newline < 0 ? command.length : newline;
		} else if (OPERATORS.includes(char) || /\s/.test(char)) {
			end();
			at++;
		} else {
			add(char);
			at++;
		}
	}
	end();
	return words;
}
