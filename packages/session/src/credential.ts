// A credential an agent's error may carry, never repeated in a notice (spec/roadmap.md, entry 38): the value of every variable
// whose name says it holds one, a bearer token, a key with a vendor's prefix, and any run of 20 or more letters, digits, `_` and
// `-` that mixes letters and digits, as tokens and keys are.

const NAME = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/i;
const REDACTED = "[redacted]";

export function redact(text: string): string {
	const values = Object.entries(process.env).flatMap(([name, value]) => (NAME.test(name) && value !== undefined && value.length >= 8 ? [value] : []));
	return values
		.reduce((said, value) => said.replaceAll(value, REDACTED), text)
		.replace(/\bBearer\s+\S+/gi, `Bearer ${REDACTED}`)
		.replace(/\b(?:sk|pk|rk|xox[a-z]|xapp|gh[pousr]|github_pat|glpat)[-_][\w-]{6,}/g, REDACTED)
		.replace(/[\w-]{20,}/g, (run) => (/\d/.test(run) && /[a-z]/i.test(run) ? REDACTED : run));
}
