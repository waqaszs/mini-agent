import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseSkillFile } from "./parse";
import type { Diagnostic, Skill } from "./types";

/** The exact filename a skill directory must contain. */
const SKILL_FILE = "SKILL.md";

/** A directory we scan for skills, plus a human label for diagnostics. */
export interface SkillRoot {
  path: string;
  label: string;
}

/**
 * Skill roots to scan, in PRECEDENCE order (highest first):
 *   1. `<project>/.skills`           — this project (the path the assignment uses)
 *   2. `<project>/.agents/skills`    — cross-client convention, project scope
 *   3. `~/.agents/skills`            — cross-client convention, user scope
 *
 * Project-level beats user-level; `.skills/` beats `.agents/skills/`.
 */
export function defaultSkillRoots(projectDir: string): SkillRoot[] {
  return [
    { path: join(projectDir, ".skills"), label: "project:.skills" },
    { path: join(projectDir, ".agents", "skills"), label: "project:.agents/skills" },
    { path: join(homedir(), ".agents", "skills"), label: "user:~/.agents/skills" },
  ];
}

export interface DiscoverResult {
  skills: Skill[];
  diagnostics: Diagnostic[];
}

/**
 * Discover skills (spec Step 1 — "Discover skills").
 *
 * For each root in precedence order, scan its immediate subdirectories for a `SKILL.md`.
 * The first occurrence of a given `name` wins; later duplicates are shadowed with a warning
 * (so project skills override user skills deterministically).
 */
export function discoverSkills(projectDir: string, roots: SkillRoot[] = defaultSkillRoots(projectDir)): DiscoverResult {
  const skills: Skill[] = [];
  const diagnostics: Diagnostic[] = [];
  const winner = new Map<string, string>(); // skill name -> root label that owns it

  for (const root of roots) {
    if (!isDirectory(root.path)) continue;

    for (const entry of readdirSync(root.path)) {
      const dir = join(root.path, entry);
      if (!isDirectory(dir)) continue;

      const skillFile = join(dir, SKILL_FILE);
      if (!existsSync(skillFile)) continue; // not a skill directory — ignore

      const { skill, diagnostics: parseDiagnostics } = parseSkillFile(skillFile);
      diagnostics.push(...parseDiagnostics);
      if (!skill) continue;

      const existingOwner = winner.get(skill.name);
      if (existingOwner) {
        diagnostics.push({ level: "warn", skill: skill.name, path: skillFile, message: `shadowed by higher-precedence "${skill.name}" from ${existingOwner}` });
        continue;
      }

      winner.set(skill.name, root.label);
      skills.push({ ...skill, source: root.label }); // parsed skill + the root it won from
    }
  }

  return { skills, diagnostics };
}

/** Safe `isDirectory` that never throws (e.g. on a broken symlink). */
function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}
