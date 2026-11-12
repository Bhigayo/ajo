import { describe, expect, it } from "vitest";
import {
  canRemove,
  canSwap,
  currentRound,
  drawLots,
  dueDate,
  groupUpdateText,
  isFinished,
  ledger,
  makeGroup,
  makeMember,
  money,
  newId,
  reminderText,
  roundStatus,
  swapTurns,
  whatsappLink,
  type Group,
} from "./model";

function group(): Group {
  const members = ["Ada Obi", "Tobi", "Kemi", "Ola"].map((n) => makeMember(n));
  return makeGroup({ name: "Family Ajo", amount: 100, frequency: "monthly", start: "2026-01-31", members });
}
const pay = (g: Group, who: number, round: number, amount: number, date: string): Group => ({
  ...g,
  payments: [...g.payments, { id: newId(), memberId: g.members[who].id, round, amount, date }],
});

describe("schedule", () => {
  it("keeps the day of the month, using the last day in short months", () => {
    const g = group();
    expect([0, 1, 2, 3].map((r) => dueDate(g, r))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(dueDate({ start: "2026-11-30", frequency: "monthly" }, 3)).toBe("2027-02-28");
  });

  it("steps weekly and fortnightly across month and year ends", () => {
    expect(dueDate({ start: "2026-12-26", frequency: "weekly" }, 1)).toBe("2027-01-02");
    expect(dueDate({ start: "2026-11-14", frequency: "fortnightly" }, 3)).toBe("2026-12-26");
  });
});

describe("rounds", () => {
  it("tracks who has paid and how much is collected, including part payments", () => {
    let g = group();
    g = pay(g, 0, 0, 100, "2026-01-30");
    g = pay(g, 1, 0, 60, "2026-01-30");
    const s = roundStatus(g, 0, "2026-02-02");
    expect(s.recipient?.name).toBe("Ada Obi");
    expect(s.collected).toBe(160);
    expect(s.expected).toBe(400);
    expect(s.paid.map((l) => l.member.name)).toEqual(["Ada Obi"]);
    expect(s.waiting.map((l) => [l.member.name, l.owed])).toEqual([
      ["Tobi", 40],
      ["Kemi", 100],
      ["Ola", 100],
    ]);
    expect(s.overdue).toBe(true);
  });

  it("moves on to the next round once the pot is paid out, and finishes after everyone's turn", () => {
    let g = group();
    expect(currentRound(g)).toBe(0);
    g = { ...g, payouts: [{ round: 0, date: "2026-01-31" }] };
    expect(currentRound(g)).toBe(1);
    g = { ...g, payouts: [0, 1, 2, 3].map((round) => ({ round, date: "2026-04-30" })) };
    expect(isFinished(g)).toBe(true);
    expect(groupUpdateText(g)).toMatch(/all 4 rounds are complete/);
  });
});

describe("ledger", () => {
  it("shows what each member has paid, owes and received, and counts late rounds", () => {
    let g = group();
    for (let who = 0; who < 4; who++) g = pay(g, who, 0, 100, "2026-01-31");
    g = pay(g, 0, 1, 100, "2026-02-27");
    g = pay(g, 1, 1, 100, "2026-03-05"); // late
    g = { ...g, payouts: [{ round: 0, date: "2026-01-31" }] };
    const rows = ledger(g, "2026-03-10");
    const [ada, tobi, kemi] = rows;
    expect(ada).toMatchObject({ paidIn: 200, shouldHave: 200, behind: 0, received: 400, late: 0 });
    expect(tobi).toMatchObject({ paidIn: 200, behind: 0, late: 1 });
    expect(kemi).toMatchObject({ paidIn: 100, behind: 100, late: 1, collectsOn: "2026-03-31" });
  });
});

describe("turn order", () => {
  it("draws lots fairly and keeps everyone", () => {
    const names = ["a", "b", "c", "d", "e"];
    const shuffled = drawLots(names, () => 0.3);
    expect([...shuffled].sort()).toEqual(names);
    expect(shuffled).not.toEqual(names);
  });

  it("only swaps turns that haven't been paid out", () => {
    let g = group();
    g = { ...g, payouts: [{ round: 0, date: "2026-01-31" }] };
    expect(canSwap(g, 0, 2)).toBe(false);
    expect(canSwap(g, 1, 3)).toBe(true);
    const swapped = swapTurns(g, 1, 3);
    expect(swapped.members.map((m) => m.name)).toEqual(["Ada Obi", "Ola", "Kemi", "Tobi"]);
    expect(swapTurns(g, 0, 1)).toBe(g);
  });

  it("only removes members with no money recorded", () => {
    const g = pay(group(), 1, 0, 100, "2026-01-31");
    expect(canRemove(g, g.members[0].id)).toBe(true);
    expect(canRemove(g, g.members[1].id)).toBe(false);
  });
});

describe("messages", () => {
  it("writes a friendly reminder that says what's owed and when", () => {
    let g = group();
    expect(reminderText(g, 1, g.members[2], "2026-02-20")).toBe(
      "Hi Kemi, a quick reminder that your £100 contribution for Family Ajo round 2 (Tobi's turn) is due on Sat 28 Feb. Thank you!",
    );
    g = pay(g, 2, 1, 30, "2026-02-25");
    expect(reminderText(g, 1, g.members[2], "2026-03-02")).toMatch(/the rest of your contribution \(£70\).*was due on Sat 28 Feb/);
    expect(reminderText(g, 0, g.members[0], "2026-01-31")).toMatch(/\(your own turn\) is due today/);
  });

  it("writes a group update with ticks and the next turn", () => {
    let g = group();
    g = pay(g, 0, 0, 100, "2026-01-20");
    const text = groupUpdateText(g, "2026-01-25");
    expect(text).toContain("Family Ajo: round 1 of 4");
    expect(text).toContain("✅ Ada Obi");
    expect(text).toContain("⏳ Tobi");
    expect(text).toContain("Collected £100 of £400.");
    expect(text).toContain("Next: Tobi, Sat 28 Feb.");
  });

  it("builds WhatsApp links, turning UK 07 numbers into international ones", () => {
    expect(whatsappLink("Hi there", "07436 013614")).toBe("https://wa.me/447436013614?text=Hi%20there");
    expect(whatsappLink("Hi", "+234 803 123 4567")).toBe("https://wa.me/2348031234567?text=Hi");
    expect(whatsappLink("Hi")).toBe("https://wa.me/?text=Hi");
  });

  it("formats pounds and naira without needless pence", () => {
    expect(money(1250, "GBP")).toBe("£1,250");
    expect(money(12.5, "GBP")).toBe("£12.50");
    expect(money(50000, "NGN")).toBe("₦50,000");
  });
});
