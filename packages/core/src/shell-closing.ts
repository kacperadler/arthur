// The index of the character that closes the one opened just before `from`: `)` for `(`, `}` for `{`, nested pairs and quoted text skipped, an escaped `"` in double quotes not closing them; the end of the text when it is never closed.
export function closing(text: string, from: number, open: string, close: string): number {
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
