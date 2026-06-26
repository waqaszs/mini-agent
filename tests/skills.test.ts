import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { discoverSkills } from "../src/skills/discover";
import { parseSkillFile } from "../src/skills/parse";

/**
 * Guards on the actual skills shipped in this repo's `.skills/` directory.
 * These run against the real files so we catch any accidental breakage of the
 * required welcome-me header or a missing skill.
 */
describe("shipped skills", () => {
  it("welcome-me's body carries the EXACT required header", () => {
    const { skill } = parseSkillFile(join(process.cwd(), ".skills", "welcome-me", "SKILL.md"));
    expect(skill).toBeDefined();
    expect(skill?.body).toContain("> Welcome to our coding agent!");
  });

  it("all three skills are discovered from .skills/, each name matching its folder", () => {
    const { skills, diagnostics } = discoverSkills(process.cwd(), [
      { path: join(process.cwd(), ".skills"), label: "project:.skills" },
    ]);

    expect(skills.map((s) => s.name).sort()).toEqual(["changelog-generator", "domain-name-brainstormer", "welcome-me"]);
    // No name/folder mismatch warnings expected for our own skills.
    expect(diagnostics.filter((d) => d.message.includes("does not match folder"))).toHaveLength(0);
  });
});
