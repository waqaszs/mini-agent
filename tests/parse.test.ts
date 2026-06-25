import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseSkillFile } from "../src/skills/parse";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "mini-agent-parse-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Helper: write a SKILL.md in a `<folder>/SKILL.md` and return its path. */
function makeSkill(folder: string, content: string): string {
  const skillDir = join(dir, folder);
  mkdirSync(skillDir, { recursive: true });
  const path = join(skillDir, "SKILL.md");
  writeFileSync(path, content);
  return path;
}

describe("parseSkillFile", () => {
  it("parses a valid skill into frontmatter + body", () => {
    const path = makeSkill("greet", "---\nname: greet\ndescription: Greet the user warmly.\n---\nSay hello to the user.");
    const { skill, diagnostics } = parseSkillFile(path);

    expect(skill).toBeDefined();
    expect(skill?.name).toBe("greet");
    expect(skill?.description).toBe("Greet the user warmly.");
    expect(skill?.body).toBe("Say hello to the user.");
    expect(diagnostics.filter((d) => d.level === "error")).toHaveLength(0);
  });

  it("SKIPS a skill with a missing description (spec: a description is essential)", () => {
    const path = makeSkill("nodesc", "---\nname: nodesc\n---\nbody only");
    const { skill, diagnostics } = parseSkillFile(path);

    expect(skill).toBeUndefined();
    expect(diagnostics.some((d) => d.level === "error")).toBe(true);
  });

  it("WARNS but still loads when name does not match the folder (lenient)", () => {
    const path = makeSkill("the-folder", "---\nname: different-name\ndescription: Does a thing.\n---\nbody");
    const { skill, diagnostics } = parseSkillFile(path);

    expect(skill).toBeDefined();
    expect(diagnostics.some((d) => d.level === "warn" && d.message.includes("does not match folder"))).toBe(true);
  });
});
