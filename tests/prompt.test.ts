import { describe, expect, it } from "vitest";
import { ACTIVATE_TOOL_NAME, buildActivateSkillTool, buildSystemPrompt } from "../src/agent/prompt";
import type { Skill } from "../src/skills/types";

const skills: Skill[] = [
  {
    name: "welcome-me",
    description: "Greet a user who is new to this project.",
    body: "SECRET_BODY_MARKER — these instructions must NOT appear in the catalog.",
    location: "/x/welcome-me/SKILL.md",
    baseDir: "/x/welcome-me",
    source: "test",
  },
  {
    name: "changelog-generator",
    description: "Generate a user-facing changelog from git commits.",
    body: "ANOTHER_BODY_MARKER",
    location: "/x/changelog-generator/SKILL.md",
    baseDir: "/x/changelog-generator",
    source: "test",
  },
];

describe("buildSystemPrompt (the catalog the model sees)", () => {
  it("includes each skill's name + description", () => {
    const prompt = buildSystemPrompt(skills);
    expect(prompt).toContain("welcome-me");
    expect(prompt).toContain("Greet a user who is new to this project.");
    expect(prompt).toContain("changelog-generator");
  });

  it("NEVER leaks skill bodies (progressive disclosure — bodies load only on activation)", () => {
    const prompt = buildSystemPrompt(skills);
    expect(prompt).not.toContain("SECRET_BODY_MARKER");
    expect(prompt).not.toContain("ANOTHER_BODY_MARKER");
  });

  it("falls back to a plain prompt when there are no skills", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).not.toContain("<available_skills>");
  });

  it("escapes XML special characters in skill descriptions", () => {
    const tricky: Skill[] = [
      { name: "x", description: "Handle <tags> & ampersands", body: "b", location: "/x/x/SKILL.md", baseDir: "/x/x", source: "test" },
    ];
    const prompt = buildSystemPrompt(tricky);
    expect(prompt).toContain("&lt;tags&gt;");
    expect(prompt).toContain("&amp;");
  });
});

describe("buildActivateSkillTool", () => {
  it("constrains the name parameter to the EXACT set of skill names (enum)", () => {
    const tool = buildActivateSkillTool(skills);
    expect(tool.name).toBe(ACTIVATE_TOOL_NAME);
    expect(tool.input_schema.properties.name.enum).toEqual(["welcome-me", "changelog-generator"]);
    expect(tool.input_schema.required).toContain("name");
  });
});
