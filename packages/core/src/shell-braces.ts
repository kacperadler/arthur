import type { Item } from "./shell-words.ts";

// What bash's brace expansion makes of a word as shell-words.ts gives it: each comma list (`.{env,}` being `.env` and `.`) and each sequence (`{a..c}`,
// `{1..9..4}`, `{01..10}` padded) in turn, a brace, comma or dot with a backslash (quoted or escaped) not one; undefined when they make more than 256 words.
const LIST = /(?<!\\)(?:\\\\)*\{((?:\\.|[^{}\\])*,(?:\\.|[^{}\\])*)\}/;
const SEQUENCE = /(?<!\\)(?:\\\\)*\{(?:([-+]?\d+)\.\.([-+]?\d+)|([A-Za-z])\.\.([A-Za-z]))(?:\.\.([-+]?\d+))?\}/;
const LIMIT = 256;

export function braces(word: string): string[] | undefined {
	let found = [word];
	for (let changed = true; changed; ) {
		changed = false;
		const next: string[] = [];
		for (const item of found) {
			const [list, sequence] = [LIST.exec(item), SEQUENCE.exec(item)];
			const match = list !== null && (sequence === null || list.index <= sequence.index) ? list : sequence;
			if (match === null) next.push(item);
			else {
				const [start, end] = [match.index + match[0].indexOf("{"), match.index + match[0].length];
				const parts = match === list ? list[1]!.replace(/\\.|,/gs, (token) => (token === "," ? "\0" : token)).split("\0") : steps(match);
				next.push(...parts.map((part) => item.slice(0, start) + part + item.slice(end)));
				changed = true;
			}
			if (next.length > LIMIT) return undefined;
		}
		found = next;
	}
	return found;
}

// A command with each word and write target as `braces` makes them, a word whose lists make more than 256 unknown (`\0`), as the worktree guard reads it (bash-refusal.ts); a word known only at run time (`dynamic`) makes each of its words so.
export function expanded(item: Item): Item {
	if (typeof item === "string") return item;
	const lists = item.words.map((word) => braces(word) ?? ["\0"]), words = lists.flat(), firsts = lists.map((_, index) => lists.slice(0, index).flat().length);
	return { ...item, words, writes: item.writes.flatMap((word) => braces(word) ?? ["\0"]), dynamic: item.dynamic?.flatMap((index) => (lists[index] ?? [""]).map((_, at) => (firsts[index] ?? words.length) + at)) };
}

// The words of a sequence, at most one past the limit: numbers padded with zeros to the wider end when either starts with one, or letters by their code; a step of 0 is 1.
function steps([, from, to, first, last, by]: RegExpExecArray): string[] {
	const [start, end, step] = [first === undefined ? Number(from) : first.charCodeAt(0), first === undefined ? Number(to) : last!.charCodeAt(0), Math.max(1, Math.abs(Number(by ?? 1)))];
	const width = /^[-+]?0\d/.test(from ?? "") || /^[-+]?0\d/.test(to ?? "") ? Math.max(from!.length, to!.length) : 0;
	const words: string[] = [];
	for (let at = start; (start <= end ? at <= end : at >= end) && words.length <= LIMIT; at += start <= end ? step : -step) {
		words.push(first !== undefined ? String.fromCharCode(at) : at < 0 ? `-${String(-at).padStart(width - 1, "0")}` : String(at).padStart(width, "0"));
	}
	return words;
}
