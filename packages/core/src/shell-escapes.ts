// A word's escapes as the shell parser (shell-words.ts) writes them: `quoted` keeps a backslash before each special character, `literal` removes it.

const SPECIAL = "\\*?[]{},()~";
const ESCAPES: Readonly<Record<string, string>> = { a: "\x07", b: "\b", e: "\x1b", E: "\x1b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };

export const quoted = (text: string): string => [...text].map((char) => (SPECIAL.includes(char) ? `\\${char}` : char)).join("");

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
