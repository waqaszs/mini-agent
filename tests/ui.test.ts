import { describe, expect, it } from "vitest";
import { renderBanner } from "../src/ui";
import { SkillRegistry } from "../src/skills/registry";
import type { Skill } from "../src/skills/types";

const skill: Skill = {
  name: "welcome-me",
  description: "Greet new users.",
  body: "b",
  location: "/x/welcome-me/SKILL.md",
  baseDir: "/x/welcome-me",
  source: "test",
};

describe("renderBanner", () => {
  it("includes the version and each skill name", () => {
    const out = renderBanner(new SkillRegistry([skill]), "9.9.9");
    expect(out).toContain("9.9.9");
    expect(out).toContain("welcome-me");
  });

  it("notes when there are no skills", () => {
    const out = renderBanner(new SkillRegistry([]), "1.0.0");
    expect(out.toLowerCase()).toContain("no skills");
  });
});
