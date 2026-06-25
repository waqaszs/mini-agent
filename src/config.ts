/**
 * Central configuration and safety guardrails.
 *
 * Keeping these in one place makes the agent's behaviour easy to audit and tune,
 * and the spend-bounding caps explicit (important since we ship a budget-limited key).
 */

/** The model the assignment requires: Claude's Sonnet. */
export const MODEL = "claude-sonnet-4-6";

/** Max output tokens per model call — bounds cost and keeps replies concise. */
export const MAX_TOKENS = 1024;

/** Max iterations of the tool-use loop in a single turn — prevents a runaway
 *  activate → respond → activate cycle from draining the budget. */
export const MAX_AGENT_TURNS = 6;
