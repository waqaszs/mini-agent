/**
 * Central configuration and safety guardrails.
 *
 * Keeping these in one place makes the agent's behaviour easy to audit and tune,
 * and the spend-bounding caps explicit (important since we ship a budget-limited key).
 */

/** The model the assignment requires: Claude's Sonnet. */
export const MODEL = "claude-sonnet-4-6";

/** Max output tokens per model call — bounds cost. Kept generous enough that a skill's reply
 *  (e.g. welcome-me's required header + a short onboarding) is never truncated mid-output. */
export const MAX_TOKENS = 2048;

/** Max iterations of the tool-use loop in a single turn — prevents a runaway
 *  activate → respond → activate cycle from draining the budget. */
export const MAX_AGENT_TURNS = 6;
