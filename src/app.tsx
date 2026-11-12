// The app's state, shared with every screen. Changes show straight away and save in the background.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { db, makeBackup, restoreBackup } from "./db";
import { dayKey, dueDate, makeGroup, makeMember, newId, type Group } from "./model";

type Ajo = {
  ready: boolean;
  groups: Group[];
  error: string | null;
  clearError(): void;
  saveGroup(g: Group): void;
  deleteGroup(id: string): void;
  addExample(): Group;
  backup(): Promise<Blob>;
  restore(file: File): Promise<number>;
};

const Ctx = createContext<Ajo | null>(null);

export function useAjo() {
  const a = useContext(Ctx);
  if (!a) throw new Error("useAjo must be used inside AjoProvider");
  return a;
}

/** An example group that's two rounds in, so every screen has something to show. */
function example(): Group {
  const start = new Date();
  start.setMonth(start.getMonth() - 2);
  const members = [
    ["Mummy Kemi", ""],
    ["Tobi", ""],
    ["Aunty Funmi", ""],
    ["Ade", ""],
    ["Bisi", ""],
    ["Ola", ""],
  ].map(([n, p]) => makeMember(n, p));
  const g = makeGroup({ name: "Family Ajo (example)", amount: 100, frequency: "monthly", start: dayKey(start), members });
  const paid = (who: number, round: number, lateDays = -2, amount = 100) => {
    const d = new Date(dueDate(g, round) + "T12:00:00");
    d.setDate(d.getDate() + lateDays);
    g.payments.push({ id: newId(), memberId: members[who].id, round, amount, date: dayKey(d) });
  };
  for (let r = 0; r < 2; r++) for (let who = 0; who < 6; who++) paid(who, r, who === 3 && r === 1 ? 4 : -2);
  g.payouts = [0, 1].map((round) => ({ round, date: dueDate(g, round) }));
  [0, 1, 2].forEach((who) => paid(who, 2));
  paid(4, 2, -1, 40);
  return g;
}

export function AjoProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((e: unknown) => {
    console.error(e);
    setError("Couldn't save that change on this device. If your storage is full, free some space and try again.");
  }, []);

  useEffect(() => {
    db.allGroups()
      .then((all) => setGroups(all.sort((a, b) => b.created_at.localeCompare(a.created_at))))
      .catch((e) => {
        console.error(e);
        setError("This browser won't let Ajo save on the device. Private browsing blocks it, so try a normal tab.");
      })
      .finally(() => setReady(true));
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  const value: Ajo = {
    ready,
    groups,
    error,
    clearError: () => setError(null),
    saveGroup(g) {
      setGroups((all) => (all.some((x) => x.id === g.id) ? all.map((x) => (x.id === g.id ? g : x)) : [g, ...all]));
      db.putGroup(g).catch(fail);
    },
    deleteGroup(id) {
      setGroups((all) => all.filter((g) => g.id !== id));
      db.deleteGroup(id).catch(fail);
    },
    addExample() {
      const g = example();
      setGroups((all) => [g, ...all]);
      db.putGroup(g).catch(fail);
      return g;
    },
    async backup() {
      return new Blob([JSON.stringify(await makeBackup())], { type: "application/json" });
    },
    async restore(file) {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't an Ajo backup.");
      }
      const n = await restoreBackup(data);
      setGroups((await db.allGroups()).sort((a, b) => b.created_at.localeCompare(a.created_at)));
      return n;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
