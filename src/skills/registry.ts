import { defaultSkillRoots, discoverSkills, type SkillRoot } from "./discover";
import type { Diagnostic, Skill } from "./types";

/**
 * An immutable, queryable set of discovered skills — the single place skill lookup lives.
 *
 * Built once (at startup, via `fromProject`) and then passed to the agent loop and the UI,
 * so neither has to know how skills are found or re-build a name→skill map.
 */
export class SkillRegistry {
  private readonly byName: Map<string, Skill>;

  constructor(
    readonly skills: Skill[],
    readonly diagnostics: Diagnostic[] = [],
  ) {
    this.byName = new Map(skills.map((skill) => [skill.name, skill]));
  }

  /** Discover the skills under a project directory and wrap them in a registry. */
  static fromProject(projectDir: string, roots: SkillRoot[] = defaultSkillRoots(projectDir)): SkillRegistry {
    const { skills, diagnostics } = discoverSkills(projectDir, roots);
    return new SkillRegistry(skills, diagnostics);
  }

  /** Look up a skill by its exact name (the only way a skill is ever resolved). */
  get(name: string): Skill | undefined {
    return this.byName.get(name);
  }

  /** All skill names, in discovery order. */
  names(): string[] {
    return this.skills.map((skill) => skill.name);
  }

  get isEmpty(): boolean {
    return this.skills.length === 0;
  }
}
