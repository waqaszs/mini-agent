import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverSkills } from "../src/skills/discover";

let projectDir: string;

function writeSkill(root: string, name: string, description: string): void {
  const skillDir = join(projectDir, root, name);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\nbody for ${name}`);
}

beforeAll(() => {
  projectDir = mkdtempSync(join(tmpdir(), "mini-agent-discover-"));
  writeSkill(".skills", "welcome-me", "Greet new users.");
  writeSkill(".skills", "changelog-generator", "Generate a changelog.");
  // A directory without a SKILL.md must be ignored:
  mkdirSync(join(projectDir, ".skills", "not-a-skill"), { recursive: true });
  // A same-named skill in a lower-precedence root should be shadowed:
  writeSkill(".agents/skills", "welcome-me", "A duplicate that should lose.");
});
afterAll(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

describe("discoverSkills", () => {
  it("discovers every subdirectory that contains a SKILL.md, and ignores those that don't", () => {
    const { skills } = discoverSkills(projectDir, [
      { path: join(projectDir, ".skills"), label: "project:.skills" },
      { path: join(projectDir, ".agents", "skills"), label: "project:.agents/skills" },
    ]);

    expect(skills.map((s) => s.name).sort()).toEqual(["changelog-generator", "welcome-me"]);
  });

  it("applies precedence: the higher-precedence root wins on a name collision", () => {
    const { skills, diagnostics } = discoverSkills(projectDir, [
      { path: join(projectDir, ".skills"), label: "project:.skills" },
      { path: join(projectDir, ".agents", "skills"), label: "project:.agents/skills" },
    ]);

    const welcome = skills.find((s) => s.name === "welcome-me");
    expect(welcome?.description).toBe("Greet new users."); // the .skills/ one, not the .agents/ duplicate
    expect(diagnostics.some((d) => d.message.includes("shadowed"))).toBe(true);
  });
});
