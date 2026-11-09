import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The proof behind an owner's answer (AR0664): his own channel message, as the inbox keeps it (inbox.ts), holding its words.
// Text from anywhere else (a forward, a job's message, the terminal) never answers for him: docs/commands/decision.md, "Answering".

// `words`, case and spacing ignored, neither starting nor ending inside a word.
function pattern(words: string, flags = ""): RegExp {
	const chars = [...words.replace(/\s+/g, "")].map((char) => char.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"));
	return new RegExp(`(?<![\\p{L}\\p{N}])${chars.join("\\s*")}(?![\\p{L}\\p{N}])`, `iu${flags}`);
}

// His own words: a part's line (message-parts.ts, docs/listen.md, a channel's `[<kind> ... not saved: ...]`) holds a file name the
// sender chose, so of it only a transcript counts, `[voice|audio <seconds> s] <transcript> (<path>)`.
function said(text: string): string {
	const own = (line: string) => /^\[(?:voice|audio) \d+(?:\.\d+)? s\] (.*?)(?: \(\/.*\))?$/.exec(line)?.[1] ?? "";
	return text.split("\n").map((line) => (/^\[(?:photo|video|voice|audio|file)\b/.test(line) ? own(line) : line)).join("\n");
}

// The latest owner message that holds `words`, and names `id` too when given, else why none does: a message of the turn in
// progress, or one answered since the second after `asked` (ms); a channel's only, never one holding a forward. With `id`, the
// words hold a word besides it, and it or a second word (AR0668: a "no" never proves a "yes"). `answered/` is listed after the
// turn, so a file the extension moves meanwhile is still found.
export function proof(folder: string, words: string, asked: number, id?: string): { readonly seq: number; readonly text: string } | string {
	const rest = id === undefined ? [] : (words.replace(pattern(id, "g"), " ").match(/[\p{L}\p{N}]+/gu) ?? []);
	if (id !== undefined && !(rest.length > 1 || (rest.length === 1 && pattern(id).test(words)))) {
		return `${JSON.stringify(words.trim())} is a fragment of the owner's message: quote his answer as he wrote it, as in "${id} yes", not only its id, a sign or one word`;
	}
	const found = ["turn", "answered"].flatMap((box) => {
		const dir = join(folder, "inbox", box);
		return (existsSync(dir) ? readdirSync(dir) : []).flatMap((name) => {
			const [, seq, ms] = /^(\d+)-(\d+)$/.exec(name) ?? [];
			if (seq === undefined || (box === "answered" && !(Number(ms) >= asked + 1000))) return [];
			let message: { readonly channel?: unknown; readonly text?: unknown } | null;
			try {
				message = JSON.parse(readFileSync(join(dir, name), "utf8"));
			} catch {
				return [];
			}
			const { channel, text } = message ?? {};
			return typeof channel === "string" && channel !== "" && typeof text === "string" && !text.includes("[forwarded from ") && pattern(words).test(said(text)) ? [{ seq: Number(seq), text }] : [];
		});
	});
	const named = id === undefined ? found : found.filter((each) => pattern(id).test(said(each.text)));
	const latest = named.sort((a, b) => b.seq - a.seq)[0];
	if (latest !== undefined) return latest;
	if (found.length > 0) return `the owner's message must name ${id} too, as in "${id} yes"; ask him to answer with its id`;
	return "no message of the owner holds these words: his own [via <channel>] message of this turn, or one sent after the question was asked, never a forward or the terminal; quote his words exactly as he wrote them";
}
