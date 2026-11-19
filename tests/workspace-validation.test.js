import assert from "node:assert/strict";
import test from "node:test";
import { toPublicWorkspace, validateWorkspaceInput } from "../src/lib/workspace.validation.js";

test("workspace input trims names and applies the default", () => {
  assert.deepEqual(validateWorkspaceInput({ name: "  Team Alpha  " }), { name: "Team Alpha" });
  assert.deepEqual(validateWorkspaceInput({}), { name: "Personal workspace" });
  assert.deepEqual(validateWorkspaceInput({ name: 42 }), { name: "Personal workspace" });
});

test("workspace input rejects empty names and names longer than 80 characters", () => {
  assert.throws(() => validateWorkspaceInput({ name: "   " }), /between 1 and 80/);
  assert.throws(() => validateWorkspaceInput({ name: "x".repeat(81) }), /between 1 and 80/);
  assert.equal(validateWorkspaceInput({ name: "x".repeat(80) }).name.length, 80);
});

test("public workspace response excludes ownership and internal fields", () => {
  const result = toPublicWorkspace({
    id: "workspace-1",
    owner_user_id: "user-secret",
    name: "Team Alpha",
    region: "eu",
    status: "active",
    internal_token: "must-not-leak",
  });

  assert.deepEqual(result, {
    id: "workspace-1",
    name: "Team Alpha",
    region: "eu",
    status: "active",
  });
  assert.equal("owner_user_id" in result, false);
  assert.equal("internal_token" in result, false);
});
