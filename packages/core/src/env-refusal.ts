import { statSync } from "node:fs";
import { resolve } from "node:path";
import { decodeEscapes, literal, shellWords } from "./shell-words.ts";

// The env guard's refusal (spec/roadmap.md, entry 19), which the extension env-guard.ts asks before a tool runs. A secrets
// file is `.env` or `.env<suffix>` (`.env.local`, `.env-prod`, `dir/.env`, `.env:1-5`, a read selector), in any case, since
// macOS folds it; not `.env.example` (it holds no secret, and a job edits it), `.envrc`, `.venv`, `src/env.ts`,
// `process.env.X`, nor a path through a folder named `.env` (`.env/bin`, when `.env` is a folder where the call runs). So is
// `.mcp.json` and `.mcp.json<suffix>`, which holds MCP servers' secrets, a job record's among them (job-record.ts, AR0337).

// `.env` or `.mcp.json` where a name starts: after a character that cannot be part of a name, after a variable (`$DIR.env`), or
// right after an option's letters (`-f.env`, `--env-file=.env` already starts after `=`); then the rest of the name.
const NAME = /(?:(?<![\w.])|(?<=\$\w+)|(?<=(?<![\w.-])-{1,2}[\w'"\\$-]*))\.(?:env(?!\w)(?!\.example(?![\w.-]))|mcp\.json(?!\w))[\w.-]*/gi;
const GUARDED = ["read", "grep", "glob", "find", "edit", "write", "bash", "eval", "ast_grep", "ast_edit"];
// What these arguments say rather than name: the intent line, a search pattern, the text a write puts into a file. Not
// checked, so a grep for `\.env` goes through. A bash command or eval code is all text, and all of it is checked.
const TEXT = ["i", "pattern", "content"];

// The one command that sets a key without printing: `sed -i[.suffix] 's/^KEY=.*/KEY=value/[g]' <path>`, the whole command
// and nothing else. Single quotes, so the shell expands nothing; a value without quote or backslash, so the expression
// ends at its closing quote; exactly three delimiters, so no flag such as `w /dev/stdout`, `e` or `p` rides along; a path
// of plain characters that does not start with `-`, so it is sed's one file operand and no `;`, pipe or second file
// follows. Any other spelling is refused, and the way round it is the human. GNU sed's option syntax is assumed.
const SET_KEY = /^sed -i(?:\.[\w-]+)? 's([/|#,:@])\^[A-Za-z_]\w*=(?:\.\*)?\$?\1[A-Za-z_]\w*=[^'\\\n]*\1g?' (?:[\w./~][\w./~-]*)?\.env(?:\.[\w-]+)?$/i;

function setsOneKey(command: string): boolean {
	const text = command.trim();
	const delimiter = SET_KEY.exec(text)?.[1];
	return delimiter !== undefined && text.slice(text.indexOf("'") + 1, text.lastIndexOf("'")).split(delimiter).length === 4;
}

// What bash's brace expansion makes of the comma lists in a word, `.{env,}` being `.env` and `.`; an escaped brace or comma
// is not one. A word whose lists make more than 256 words is kept as it is; sequences (`{a..z}`) are not expanded.
function braces(word: string): string[] {
	let found = [word];
	for (let changed = true; changed; ) {
		changed = false;
		const next = found.flatMap((item) => {
			const list = /(?<!\\)(?:\\\\)*\{((?:\\.|[^{}\\])*,(?:\\.|[^{}\\])*)\}/.exec(item);
			if (list === null) return [item];
			changed = true;
			const start = list.index + list[0].indexOf("{");
			const alternatives = list[1]!.replace(/\\.|,/gs, (token) => (token === "," ? "\0" : token)).split("\0");
			return alternatives.map((alternative) => item.slice(0, start) + alternative + item.slice(list.index + list[0].length));
		});
		if (next.length > 256) return [word];
		found = next;
	}
	return found;
}

// The secrets file `text` names as written, or undefined: a path whose last part is a secrets name, or one that goes on
// through it with `/` when it is not a folder where the call runs.
function namedFile(text: string, cwd: string): string | undefined {
	for (const match of text.matchAll(NAME)) {
		const end = match.index + match[0].length;
		const start = text.slice(0, match.index).search(/[^\s"'`=<>|;&()[]*$/);
		const path = text.slice(start, end);
		if (text[end] !== "/") return path;
		try {
			if (!statSync(resolve(cwd, path)).isDirectory()) return path;
		} catch {
			return path;
		}
	}
	return undefined;
}

// The glob in `word` that matches a secrets name, and the name: a part between slashes with an unescaped `*`, `?` or
// `[…]` that starts with a dot, as bash needs to match a hidden file, tried on `.env` and on `.env` with the part's own
// literal tail (`.e*.local` on `.env.local`). A bracket expression is taken as any one character.
function namedGlob(word: string): string | undefined {
	for (const part of word.split(/[\s/;'"=]/)) {
		if (!part.startsWith(".") || !/(?<!\\)(?:\\\\)*[*?[]/.test(part)) continue;
		const source = part.replace(/\\(.)|\[(?:\\.|[^\]\\])+\]|[*?]|\W/gsu, (token, escaped?: string) =>
			token === "*" ? ".*" : token === "?" || (token.startsWith("[") && token.length > 1) ? "." : `\\u{${(escaped ?? token).codePointAt(0)!.toString(16)}}`,
		);
		const tail = literal(/[^*?\]]*$/.exec(part)![0]);
		const names = [".env", ".mcp.json", ...(tail.startsWith(".") && tail.toLowerCase() !== ".example" ? [`.env${tail}`] : [])];
		const name = names.find((candidate) => new RegExp(`^${source}$`, "iu").test(candidate));
		if (name !== undefined) return `${name} (through the glob ${literal(part)})`;
	}
	return undefined;
}

// The secrets file one argument of a call names, or undefined: as written; for bash also in each word as the shell reads
// it, brace lists expanded and globs matched; for eval also with escapes decoded and quotes dropped; for every other
// tool also through a glob in its value.
function named(toolName: string, value: string, cwd: string): string | undefined {
	const written = namedFile(value, cwd);
	if (written !== undefined || toolName === "eval") return written ?? namedFile(decodeEscapes(value).replace(/['"\\]/g, ""), cwd);
	for (const word of toolName === "bash" ? shellWords(value) : [value]) {
		for (const expanded of braces(word)) {
			const file = namedFile(literal(expanded), cwd) ?? namedGlob(expanded);
			if (file !== undefined) return file;
		}
	}
	return undefined;
}

// The line that refuses a call naming a secrets file, or undefined. Checked on what the call says before it runs, so
// what a shell or a program builds only when it runs is not seen: a variable's value, a string joined at run time, a
// script that builds the path, a symlink. It stops the plain read and is not a sandbox.
export function envRefusal(toolName: string, input: Readonly<Record<string, unknown>>, cwd = process.cwd()): string | undefined {
	if (!GUARDED.includes(toolName)) return undefined;
	if (toolName === "bash" && typeof input.command === "string" && setsOneKey(input.command)) return undefined;
	for (const [key, value] of Object.entries(input)) {
		if (key === "i" || (TEXT.includes(key) && toolName !== "bash" && toolName !== "eval")) continue;
		const text = typeof value === "string" ? value : JSON.stringify(value);
		// An edit's `input` holds file headers, `MV` targets, and `+` body lines: only the first two name files.
		const file = named(toolName, toolName === "edit" && key === "input" ? text.split("\n").filter((line) => !line.startsWith("+")).join("\n") : text, cwd);
		if (file !== undefined) {
			return `arthur: refused: this call names the secrets file ${file}, whose values no tool call may read; set one key with sed -i 's/^KEY=.*/KEY=value/' <file>, or ask the human`;
		}
	}
	return undefined;
}
