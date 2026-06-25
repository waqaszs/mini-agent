# mini-agent

A mini coding agent — a **Node.js CLI** that implements the open [Agent Skills](https://agentskills.io) specification, powered by **Claude's Sonnet** model.

> **Status: in progress (scaffolding).** The final README — single run command, example prompts, and the write-up (time spent / challenges) — will be completed when the agent is wired up.

## What it does

The agent discovers **skills** under `.skills/`, shows Claude a lightweight **catalog** (just each skill's `name` + `description`), and loads a skill's **full instructions only when the user's prompt matches it** — the spec's *progressive disclosure*. This "load the right skill at the right time" matching is the core of the tool.

Three skills ship in `.skills/`:

| Skill | Trigger | Source |
| --- | --- | --- |
| `welcome-me` | "I'm new to this project, what should I do" | authored for this project |
| `changelog-generator` | "create a changelog from recent commits" | [CommandCodeAI/agent-skills](https://github.com/CommandCodeAI/agent-skills) |
| `using-git-worktrees` | "set up an isolated git worktree" | [CommandCodeAI/agent-skills](https://github.com/CommandCodeAI/agent-skills) |

When the prompt is unrelated (e.g. "what's the weather?"), **no skill is loaded into context.**

## Quick start (to be finalized)

```bash
pnpm install
cp .env.example .env      # paste your ANTHROPIC_API_KEY (a budget-capped key is provided with the submission)
pnpm dev
```
