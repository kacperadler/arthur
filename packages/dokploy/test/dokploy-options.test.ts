import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOptions } from "../src/dokploy-options.ts";

// The dokploy plugin's options, checked before any setup: docs/dokploy.md, "Options".

const URL_PROBLEM = "expected an https url, or an http one on loopback, a private or a Tailscale address (localhost, 10.0.0.1, 100.64.0.1, *.ts.net), without a user, query or fragment; the url given is not shown";
const at = (url: unknown) => checkOptions({ instances: [{ url, tokenEnv: "ARTHUR_DOKPLOY_TOKEN" }] });

test("a url: https anywhere, under a path too; http only on loopback, RFC 1918, unique local IPv6, Tailscale's 100.64.0.0/10 or a *.ts.net name", () => {
	for (const url of [
		"https://dokploy.example.com",
		"https://203.0.113.5:3000",
		"https://panel.client.example/dokploy/",
		"http://127.0.0.1:3000",
		"http://localhost:3000",
		"http://10.0.0.5:3000",
		"http://172.16.0.1",
		"http://172.31.255.255",
		"http://192.168.1.10",
		"http://100.64.1.2:3000",
		"http://100.127.255.255",
		"http://dokploy.tail1234.ts.net:3000",
		"http://[::1]:3000",
		"http://[fd7a:115c:a1e0::1]:3000",
	])
		assert.deepEqual(at(url), [], url);
});

test("a url refused, never shown: http on a public address or name, the metadata address, a user, a query, a fragment, another scheme, no url", () => {
	for (const url of [
		"http://dokploy.example.com",
		"http://203.0.113.5:3000",
		"http://172.32.0.1",
		"http://100.128.0.1",
		"http://100.63.255.255",
		"http://100.100.100.200",
		"http://[fd00:ec2::254]",
		"http://[2001:db8::1]",
		"http://localhost.example",
		"http://evil.ts.net.example",
		"https://me:s3cr3t@dokploy.example.com",
		"https://me@dokploy.example.com",
		"https://dokploy.example.com/?token=s3cr3t",
		"https://dokploy.example.com/?",
		"https://dokploy.example.com/#top",
		"ftp://dokploy.example.com",
		"dokploy.example.com",
		"",
	]) {
		assert.deepEqual(at(url), [{ path: "instances[0].url", problem: URL_PROBLEM }], url);
		assert.ok(!JSON.stringify(at(url)).includes("s3cr3t"), url);
	}
	assert.deepEqual(at(3000), [{ path: "instances[0].url", problem: URL_PROBLEM.replace("; the url given is not shown", ", got 3000") }]);
	assert.deepEqual(at(undefined), [{ path: "instances[0].url", problem: URL_PROBLEM.replace("; the url given is not shown", ", got nothing") }]);
});

test("instances: at least one, at most one without a name, each name once, no other key; timeoutSeconds above 0 and at most 600; no other option", () => {
	const unnamed = { url: "https://a.example", tokenEnv: "ARTHUR_DOKPLOY_TOKEN" };
	const client = { name: "client", url: "https://b.example", tokenEnv: "ARTHUR_DOKPLOY_CLIENT_TOKEN" };
	assert.deepEqual(checkOptions({ instances: [unnamed, client], timeoutSeconds: 600 }), []);
	assert.deepEqual(checkOptions({ instances: [unnamed, { ...unnamed }] }), [{ path: "instances[1]", problem: "instances[0] has no name either; at most one instance is unnamed" }]);
	assert.deepEqual(checkOptions({ instances: [client, unnamed, { ...client }] }), [{ path: "instances[2].name", problem: "client is the name of instances[0] too" }]);
	assert.deepEqual(checkOptions({ instances: [{ ...client, name: "Client" }] }), [{ path: "instances[0].name", problem: 'expected lowercase letters, digits and single dashes, from a letter, got "Client"' }]);
	assert.deepEqual(checkOptions({ instances: [{ ...unnamed, urlEnv: "ARTHUR_DOKPLOY_URL" }] }), [{ path: "instances[0].urlEnv", problem: "unknown key; keys: name, url, tokenEnv" }]);
	assert.deepEqual(checkOptions({ instances: [{ url: unnamed.url }] }), [{ path: "instances[0].tokenEnv", problem: "expected the name of an env variable, got nothing" }]);
	assert.deepEqual(checkOptions({ instances: ["https://a.example"] }), [{ path: "instances[0]", problem: 'expected an instance { name?, url, tokenEnv }, got "https://a.example"' }]);
	assert.deepEqual(checkOptions({ instances: [] }), [{ path: "instances", problem: "expected a list of at least one instance, got an empty list" }]);
	assert.deepEqual(checkOptions({}), [{ path: "instances", problem: "expected a list of at least one instance, got nothing" }]);
	for (const timeoutSeconds of [0, 601, "60"])
		assert.deepEqual(checkOptions({ instances: [unnamed], timeoutSeconds }), [{ path: "timeoutSeconds", problem: `expected a number of seconds above 0, at most 600, got ${JSON.stringify(timeoutSeconds)}` }], String(timeoutSeconds));
	assert.deepEqual(checkOptions({ instances: [unnamed], url: unnamed.url }), [{ path: "url", problem: "unknown option; options: instances, timeoutSeconds" }]);
});
