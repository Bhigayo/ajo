// Ajo (also called esusu or susu): a rotating savings group. Everyone pays the same amount each round,
// and each round one member, in turn, takes the whole pot. This file holds the rules; no UI or storage code.

export type Frequency = "weekly" | "fortnightly" | "monthly";
export const FREQUENCY_NAMES: Record<Frequency, string> = { weekly: "Weekly", fortnightly: "Every two weeks", monthly: "Monthly" };

export type Currency = "GBP" | "NGN";

export type Member = { id: string; name: string; phone: string };

/** Money a member paid in towards one round. A member can pay a round in parts. */
export type Payment = { id: string; memberId: string; round: number; amount: number; date: string };

export type Payout = { round: number; date: string };

export type Group = {
  id: string;
  name: string;
  amount: number; // each member, each round
  frequency: Frequency;
  start: string; // "YYYY-MM-DD", when round 1 is due
  currency: Currency;
  members: Member[]; // in payout order: members[0] collects round 1
  payments: Payment[];
  payouts: Payout[];
  created_at: string;
};

export function newId() {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeGroup(fields: Partial<Group> = {}): Group {
  return {
    id: newId(),
    name: "",
    amount: 50,
    frequency: "monthly",
    start: dayKey(),
    currency: "GBP",
    members: [],
    payments: [],
    payouts: [],
    created_at: new Date().toISOString(),
    ...fields,
  };
}

export const makeMember = (name: string, phone = ""): Member => ({ id: newId(), name: name.trim(), phone: phone.trim() });

// ---------- Dates ----------

/** "YYYY-MM-DD" in local time. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const parseDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m, d };
};

export function daysBetween(from: string, to: string) {
  const a = parseDay(from);
  const b = parseDay(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/**
 * When a round is due (round 0 is the first). Monthly groups keep the same day of the month,
 * moving to the last day in shorter months (31 Jan → 28 Feb → 31 Mar).
 */
export function dueDate(group: Pick<Group, "start" | "frequency">, round: number) {
  const { y, m, d } = parseDay(group.start);
  if (group.frequency === "monthly") {
    const total = m - 1 + round;
    const year = y + Math.floor(total / 12);
    const month = total % 12;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  }
  const step = group.frequency === "weekly" ? 7 : 14;
  const t = new Date(Date.UTC(y, m - 1, d + round * step));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export function prettyDate(day: string, withWeekday = true) {
  return new Date(day + "T12:00:00").toLocaleDateString("en-GB", { ...(withWeekday ? { weekday: "short" } : {}), day: "numeric", month: "short" });
}

// ---------- Money ----------

export function money(n: number, currency: Currency) {
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol", // ₦ rather than NGN
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- Rounds ----------

export const potSize = (g: Group) => round2(g.amount * g.members.length);

export function paidTowards(g: Group, round: number, memberId: string) {
  return round2(g.payments.filter((p) => p.round === round && p.memberId === memberId).reduce((n, p) => n + p.amount, 0));
}

export function roundStatus(g: Group, round: number, today = dayKey()) {
  const due = dueDate(g, round);
  const lines = g.members.map((member) => {
    const paid = paidTowards(g, round, member.id);
    return { member, paid, owed: round2(Math.max(0, g.amount - paid)) };
  });
  const collected = round2(lines.reduce((n, l) => n + l.paid, 0));
  const payout = g.payouts.find((p) => p.round === round) ?? null;
  return {
    round,
    due,
    recipient: g.members[round] ?? null,
    expected: potSize(g),
    collected,
    paid: lines.filter((l) => l.owed === 0),
    waiting: lines.filter((l) => l.owed > 0),
    complete: lines.every((l) => l.owed === 0),
    payout,
    overdue: !payout && daysBetween(due, today) > 0 && lines.some((l) => l.owed > 0),
    daysToDue: daysBetween(today, due),
  };
}

/** The round being collected now: the first one that hasn't been paid out. Equals the member count when the cycle is finished. */
export function currentRound(g: Group) {
  for (let r = 0; r < g.members.length; r++) if (!g.payouts.some((p) => p.round === r)) return r;
  return g.members.length;
}

export const isFinished = (g: Group) => g.members.length > 0 && currentRound(g) >= g.members.length;

/**
 * Each member's position: what they've paid in, what they should have paid by today,
 * what they've received, and how many rounds they paid late or haven't paid.
 */
export function ledger(g: Group, today = dayKey()) {
  const roundsDue = g.members.filter((_, r) => daysBetween(dueDate(g, r), today) >= 0).length;
  return g.members.map((member, turn) => {
    const mine = g.payments.filter((p) => p.memberId === member.id);
    const paidIn = round2(mine.reduce((n, p) => n + p.amount, 0));
    const shouldHave = round2(roundsDue * g.amount);
    const received = g.payouts.some((p) => p.round === turn) ? potSize(g) : 0;
    let late = 0;
    for (let r = 0; r < roundsDue; r++) {
      const due = dueDate(g, r);
      const onTime = round2(mine.filter((p) => p.round === r && p.date <= due).reduce((n, p) => n + p.amount, 0));
      if (onTime < g.amount) late++;
    }
    return {
      member,
      turn,
      paidIn,
      shouldHave,
      behind: round2(Math.max(0, shouldHave - paidIn)),
      received,
      late,
      collectsOn: dueDate(g, turn),
    };
  });
}

// ---------- Changing the order ----------

/** Shuffles members into a fair random payout order ("drawing lots"). */
export function drawLots<T>(items: T[], random = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Two members can swap turns only while neither turn has been paid out. Payments move with the round, not the person. */
export function canSwap(g: Group, a: number, b: number) {
  return a !== b && [a, b].every((r) => r >= 0 && r < g.members.length && !g.payouts.some((p) => p.round === r));
}

export function swapTurns(g: Group, a: number, b: number): Group {
  if (!canSwap(g, a, b)) return g;
  const members = [...g.members];
  [members[a], members[b]] = [members[b], members[a]];
  return { ...g, members };
}

/** A member can only be removed before the group has any money recorded for them. */
export const canRemove = (g: Group, memberId: string) => !g.payments.some((p) => p.memberId === memberId) && g.payouts.length === 0;

// ---------- Messages ----------

export function reminderText(g: Group, round: number, member: Member, today = dayKey()) {
  const s = roundStatus(g, round, today);
  const owed = paidTowards(g, round, member.id) > 0 ? `the rest of your contribution (${money(Math.max(0, g.amount - paidTowards(g, round, member.id)), g.currency)})` : `your ${money(g.amount, g.currency)} contribution`;
  const whose = s.recipient?.id === member.id ? "your own turn" : `${s.recipient?.name ?? "this"}'s turn`;
  const when = s.daysToDue < 0 ? `was due on ${prettyDate(s.due)}` : s.daysToDue === 0 ? "is due today" : `is due on ${prettyDate(s.due)}`;
  return `Hi ${member.name.split(" ")[0]}, a quick reminder that ${owed} for ${g.name} round ${round + 1} (${whose}) ${when}. Thank you!`;
}

export function groupUpdateText(g: Group, today = dayKey()) {
  const r = currentRound(g);
  if (r >= g.members.length) return `${g.name}: all ${g.members.length} rounds are complete. Everyone has had their turn. Well done, everyone!`;
  const s = roundStatus(g, r, today);
  const lines = [
    `${g.name}: round ${r + 1} of ${g.members.length}`,
    `${s.recipient!.name}'s turn · due ${prettyDate(s.due)}`,
    "",
    ...s.paid.map((l) => `✅ ${l.member.name}`),
    ...s.waiting.map((l) => `⏳ ${l.member.name}${l.paid > 0 ? ` (${money(l.owed, g.currency)} left)` : ""}`),
    "",
    `Collected ${money(s.collected, g.currency)} of ${money(s.expected, g.currency)}.`,
  ];
  const next = g.members[r + 1];
  if (next) lines.push(`Next: ${next.name}, ${prettyDate(dueDate(g, r + 1))}.`);
  return lines.join("\n");
}

/** A WhatsApp link with the message ready to send. Without a number, WhatsApp asks which chat to send it to. */
export function whatsappLink(text: string, phone = "") {
  const digits = phone.replace(/[^\d]/g, "").replace(/^0(?=7\d{9}$)/, "44"); // UK mobiles: 07… → 447…
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
