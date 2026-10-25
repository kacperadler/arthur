// A credential never repeated in the inbox's notice nor the decision log: `secrets` (`host.secrets`), the value of every variable whose name says it holds one,
// a bearer token, a key with a vendor's prefix, and any run of 20 or more letters, digits, `_` and `-` that mixes letters and digits; a value
// under 8 characters is no secret. A copy of the session plugin's (spec/roadmap.md, entry 38), which a plugin cannot import: change both together.

const NAME = /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH/i;
const REDACTED = "[redacted]";

export function redact(text: string, secrets: readonly string[]): string {
	const values = Object.entries(process.env).flatMap(([name, value]) => (NAME.test(name) && value !== undefined ? [value] : [])).concat(secrets).filter((value) => value.length >= 8);
	return values
		.reduce((said, value) => said.replaceAll(value, REDACTED), text)
		.replace(/\bBearer\s+\S+/gi, `Bearer ${REDACTED}`)
		.replace(/\b(?:sk|pk|rk|xox[a-z]|xapp|gh[pousr]|github_pat|glpat)[-_][\w-]{6,}/g, REDACTED)
		.replace(/[\w-]{20,}/g, (run) => (/\d/.test(run) && /[a-z]/i.test(run) ? REDACTED : run));
}
