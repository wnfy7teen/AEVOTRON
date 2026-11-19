import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const entity = async (name) => JSON.parse(
  await readFile(new URL(`../base44/entities/${name}.jsonc`, import.meta.url), "utf8"),
);

test("workspace ownership cannot be changed by a regular user", async () => {
  const schema = await entity("workspace");
  assert.deepEqual(schema.properties.owner_user_id.rls.write, {
    user_condition: { role: "admin" },
  });
  assert.ok(schema.rls.read.$or.some((rule) => rule["data.owner_user_id"] === "{{user.id}}"));
});

test("workspace membership mutations are restricted to trusted backend role", async () => {
  const schema = await entity("workspace-member");
  for (const operation of ["create", "update", "delete"]) {
    assert.deepEqual(schema.rls[operation], { user_condition: { role: "admin" } });
  }
  assert.ok(schema.rls.read.$or.some((rule) => rule["data.user_id"] === "{{user.id}}"));
});

test("provider credentials and API key hashes are admin-only fields", async () => {
  const provider = await entity("provider-connection");
  const apiKey = await entity("api-key");
  for (const field of ["credential_ciphertext", "credential_key_version"]) {
    assert.deepEqual(provider.properties[field].rls.read, { user_condition: { role: "admin" } });
    assert.deepEqual(provider.properties[field].rls.write, { user_condition: { role: "admin" } });
  }
  assert.deepEqual(apiKey.properties.key_hash.rls.read, { user_condition: { role: "admin" } });
  assert.deepEqual(apiKey.properties.key_hash.rls.write, { user_condition: { role: "admin" } });
});

test("usage and audit events are append-only", async () => {
  for (const name of ["usage-event", "audit-event"]) {
    const schema = await entity(name);
    assert.equal(schema.rls.update, false);
    assert.equal(schema.rls.delete, false);
    assert.deepEqual(schema.rls.create, { user_condition: { role: "admin" } });
  }
});
