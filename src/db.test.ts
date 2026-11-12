import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { db, makeBackup, restoreBackup } from "./db";
import { makeGroup, makeMember } from "./model";

it("saves groups and round-trips a backup", async () => {
  const g = makeGroup({ name: "Family Ajo", members: [makeMember("Ada"), makeMember("Tobi")] });
  await db.putGroup(g);
  const backup = JSON.parse(JSON.stringify(await makeBackup()));
  await db.deleteGroup(g.id);
  expect(await db.allGroups()).toEqual([]);
  expect(await restoreBackup(backup)).toBe(1);
  expect((await db.allGroups())[0].members.map((m) => m.name)).toEqual(["Ada", "Tobi"]);
  await expect(restoreBackup({})).rejects.toThrow(/isn't an Ajo backup/);
});
