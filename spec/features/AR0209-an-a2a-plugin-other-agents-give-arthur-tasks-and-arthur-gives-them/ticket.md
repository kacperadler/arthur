# AR0209 - An a2a plugin: other agents give Arthur tasks, and Arthur gives them

```json
{
  "id": "AR0209",
  "title": "An a2a plugin: other agents give Arthur tasks, and Arthur gives them",
  "date": "2026-10-19"
}
```

## Description

An `a2a` plugin speaks the Agent2Agent protocol (A2A, https://a2a-protocol.org), so that agents outside Arthur can work with it:
- an agent of a client or another company can give Arthur a task and read its result;
- Arthur's coordinator can give an outside agent a task.

Arthur's own agents keep talking through files, as now.

## Goal

Arthur works with agents in other systems through an open standard, without a custom integration for each one.

- Kind: improvement

## Done means

- An agent card that names Arthur's skills, and an A2A endpoint that takes a task, runs it as a job under the usual rules (a ticket, the owner's approval, limits) and reports its state and result.
- Authentication on every call; an unauthenticated or unknown agent is refused; nothing reaches a job without the owner's approval.
- The coordinator can send a task to an outside agent listed in the config and read its answer.
- Tests against a fake A2A agent on an OS-chosen loopback port.

## Scope

In: the plugin, its options, docs and tests. Out: Arthur's own agents, which stay on files.

## Decisions

- 2026-10-19: The owner asked whether Arthur uses A2A. It does not; he decided to add it later. It waits, like AR0182, until the roadmap is built.
