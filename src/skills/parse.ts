import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import matter from "gray-matter";
import { NAME_MAX_LENGTH, SkillFrontmatterSchema, type Diagnostic, type Skill } from "./types";

/** Outcome of parsing one SKILL.md: the loaded skill (if usable) plus any diagnostics. */
export interface ParseResult {
  skill?: Skill;
  diagnostics: Diagnostic[];
}

/**
 * Parse a single `SKILL.md` (spec Step 2 — "Parse SKILL.md files").
 *
 * - Splits the YAML frontmatter from the Markdown body (via gray-matter).
 * - Validates the required `name` + `description` with Zod.
 * - Stays LENIENT per the client-implementation guide: warn on minor issues but still
 *   load; only SKIP when the description is missing/empty or the YAML is unparseable.
 */
export function parseSkillFile(filePath: string): ParseResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    return { diagnostics: [{ level: "error", path: filePath, message: `cannot read file: ${asMessage(err)}` }] };
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    // Malformed YAML (e.g. an unquoted value containing a colon) → skip, per the spec.
    return { diagnostics: [{ level: "error", path: filePath, message: `unparseable YAML frontmatter: ${asMessage(err)}` }] };
  }

  const result = SkillFrontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    // A missing/empty `name` or `description` is fatal for this skill — skip it.
    const why = result.error.issues.map((i) => i.message).join("; ");
    return { diagnostics: [{ level: "error", path: filePath, message: `invalid frontmatter (${why})` }] };
  }

  const { name, description } = result.data;
  const baseDir = dirname(filePath);
  const folderName = basename(baseDir);
  const diagnostics: Diagnostic[] = [];

  // Non-fatal spec deviations: warn, but still load (cross-client tolerance).
  if (name !== folderName) {
    diagnostics.push({ level: "warn", skill: name, path: filePath, message: `name "${name}" does not match folder "${folderName}" (loaded anyway)` });
  }
  if (name.length > NAME_MAX_LENGTH) {
    diagnostics.push({ level: "warn", skill: name, path: filePath, message: `name exceeds ${NAME_MAX_LENGTH} characters (loaded anyway)` });
  }

  const skill: Skill = {
    name,
    description,
    body: parsed.content.trim(),
    location: filePath,
    baseDir,
    source: "", // filled in by the discoverer once the winning root is known
  };
  return { skill, diagnostics };
}

function asMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
