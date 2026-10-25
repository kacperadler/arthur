// A credential an agent's error may carry, never in a notice (spec/roadmap.md, entry 38): `secrets` (`host.secrets`), the value of every variable whose name says it holds one, a bearer token,
// a vendor-prefixed key, any run of 20+ letters, digits, `_` and `-` mixing letters and digits; a value under 8 characters is no secret. Orchestration keeps a copy: change both together.

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
