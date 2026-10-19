// A text longer than one Telegram message (spec/roadmap.md, entry 47) in slices of at most `limit` UTF-16 units, as the Bot
// API counts them: each cut at the last line break inside the slice, which it drops; a line longer than a whole slice is cut
// at the limit, never inside a character of two units. Blank slices are left out, since Telegram refuses an empty message.
export function slices(text: string, limit: number): string[] {
	const parts: string[] = [];
	let rest = text;
	while (rest.length > limit) {
		const at = rest.lastIndexOf("\n", limit);
		let end = at > 0 ? at : limit;
		if (at <= 0 && /[\uD800-\uDBFF]/.test(rest[end - 1] ?? "")) end--;
		parts.push(rest.slice(0, end));
		rest = rest.slice(at > 0 ? end + 1 : end);
	}
	return [...parts, rest].filter((part) => part.trim() !== "");
}

// A text that must go as one message (entry 48), cut as its first slice is, with `note` after it, all within `limit`.
export function cut(text: string, limit: number, note: string): string {
	return text.length <= limit ? text : `${slices(text, limit - note.length)[0] ?? ""}${note}`;
}
