import { z } from "zod";

/**
 * Types and validation for Agent Skills (https://agentskills.io/specification).
 *
 * A skill is a folder containing a `SKILL.md` (YAML frontmatter + Markdown body).
 * We require `name` + `description`; everything else in the frontmatter is optional
 * and intentionally ignored here (we only use name/description for matching).
 */

/** Spec limit: `name` must be at most 64 characters. */
export const NAME_MAX_LENGTH = 64;

/** Spec limit: `description` must be at most 1024 characters. */
export const DESCRIPTION_MAX_LENGTH = 1024;

/**
 * The two required frontmatter fields. We validate these strictly (a skill with no
 * usable description is skipped, per the spec). Unknown extra fields are tolerated.
 */
export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1, "name is required"),
  description: z.string().min(1, "description is required"),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

/**
 * A skill as it comes out of the parser — everything except where it was found.
 * (Discovery decides which root "wins" a given name, so `source` is added there, not here.)
 */
export interface ParsedSkill {
  /** Skill identifier (should match the folder name). */
  name: string;
  /** What the skill does + when to use it — drives matching (catalog tier 1). */
  description: string;
  /** The Markdown instructions — loaded into context ONLY when the skill is activated. */
  body: string;
  /** Absolute path to the SKILL.md file. */
  location: string;
  /** The skill's directory (parent of SKILL.md) — for resolving relative references. */
  baseDir: string;
}

/** A discovered skill: a parsed skill plus the root it was loaded from. */
export interface Skill extends ParsedSkill {
  /** Which skills root this came from (for diagnostics / collision reporting). */
  source: string;
}

/** A non-fatal issue we surface to the user instead of silently swallowing. */
export interface Diagnostic {
  level: "warn" | "error";
  /** Skill name, when known. */
  skill?: string;
  /** File path the diagnostic relates to. */
  path: string;
  message: string;
}
