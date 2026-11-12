import { useState } from "react";
import { useAjo } from "./app";
import {
  canRemove,
  canSwap,
  currentRound,
  dayKey,
  dueDate,
  FREQUENCY_NAMES,
  groupUpdateText,
  ledger,
  money,
  newId,
  paidTowards,
  prettyDate,
  reminderText,
  roundStatus,
  swapTurns,
  whatsappLink,
  type Group,
  type Member,
} from "./model";
import { Segmented } from "./ui";

type Tab = "round" | "members" | "schedule";

export default function GroupPage({ id }: { id: string }) {
  const a = useAjo();
  const g = a.groups.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("round");
  if (!g)
    return (
      <div className="page">
        <p className="muted">That group isn't here any more.</p>
        <a className="button" href="#/">
          All groups
        </a>
      </div>
    );
  return (
    <div className="page">
      <header className="page-head">
        <a className="back" href="#/" aria-label="All groups">
          ←
        </a>
        <div>
          <h1>{g.name}</h1>
          <p className="muted small head-sub">
            {g.members.length} members · {money(g.amount, g.currency)} {FREQUENCY_NAMES[g.frequency].toLowerCase()} · pot {money(g.amount * g.members.length, g.currency)}
          </p>
        </div>
      </header>
      <Segmented<Tab>
        label="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: "round", label: "This round" },
          { value: "members", label: "Members" },
          { value: "schedule", label: "Schedule" },
        ]}
      />
      {tab === "round" && <Round g={g} />}
      {tab === "members" && <Members g={g} />}
      {tab === "schedule" && <Schedule g={g} />}
    </div>
  );
}

function Round({ g }: { g: Group }) {
  const a = useAjo();
  const r = currentRound(g);
  const [open, setOpen] = useState<string | null>(null);
  const [part, setPart] = useState("");
  const [date, setDate] = useState(dayKey());
  const [confirmPayout, setConfirmPayout] = useState(false);

  if (r >= g.members.length) {
    return (
      <div className="finished card">
        <h2>All {g.members.length} rounds complete</h2>
        <p className="muted">Everyone has had their turn. Start a new cycle by making a new group with the same people.</p>
        <a className="button ghost" href={whatsappLink(groupUpdateText(g))} target="_blank" rel="noreferrer">
          Tell the group
        </a>
      </div>
    );
  }

  const s = roundStatus(g, r);
  const record = (memberId: string, amount: number) => {
    if (!(amount > 0)) return;
    a.saveGroup({ ...g, payments: [...g.payments, { id: newId(), memberId, round: r, amount: Math.round(amount * 100) / 100, date }] });
    setOpen(null);
    setPart("");
  };
  const undo = (memberId: string) => {
    const last = [...g.payments].reverse().find((p) => p.memberId === memberId && p.round === r);
    if (last) a.saveGroup({ ...g, payments: g.payments.filter((p) => p.id !== last.id) });
  };
  const payOut = () => {
    a.saveGroup({ ...g, payouts: [...g.payouts, { round: r, date: dayKey() }] });
    setConfirmPayout(false);
  };

  const dueText = s.daysToDue > 1 ? `in ${s.daysToDue} days` : s.daysToDue === 1 ? "tomorrow" : s.daysToDue === 0 ? "today" : `${-s.daysToDue} day${s.daysToDue === -1 ? "" : "s"} ago`;

  return (
    <>
      <section className={`round-card ${s.overdue ? "late" : ""}`}>
        <p className="eyebrow">
          Round {r + 1} of {g.members.length}
        </p>
        <h2>
          {s.recipient?.name}
          <span>'s turn</span>
        </h2>
        <p className="due">
          Due {prettyDate(s.due)} · <b>{dueText}</b>
        </p>
        <div className="pot">
          <span>
            <b>{money(s.collected, g.currency)}</b> of {money(s.expected, g.currency)}
          </span>
          <span>
            {s.paid.length}/{g.members.length} paid
          </span>
        </div>
        <div className="bar big" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (s.collected / s.expected) * 100)}%` }} />
        </div>
      </section>

      <ul className="pay-list">
        {g.members.map((m) => {
          const paid = paidTowards(g, r, m.id);
          const owed = Math.max(0, g.amount - paid);
          const isOpen = open === m.id;
          return (
            <li key={m.id} className={`pay ${owed === 0 ? "paid" : paid > 0 ? "partial" : ""}`}>
              <button className="pay-row" onClick={() => (setOpen(isOpen ? null : m.id), setPart(""), setDate(dayKey()))} aria-expanded={isOpen}>
                <span className="tick" aria-hidden="true">
                  {owed === 0 ? "✓" : paid > 0 ? "◐" : ""}
                </span>
                <span className="who">
                  <b>
                    {m.name}
                    {m.id === s.recipient?.id && <em> · collecting</em>}
                  </b>
                  <small>{owed === 0 ? `Paid ${money(paid, g.currency)}` : paid > 0 ? `${money(paid, g.currency)} paid · ${money(owed, g.currency)} left` : s.overdue ? "Not paid · overdue" : "Not paid yet"}</small>
                </span>
              </button>
              {isOpen && (
                <div className="pay-actions">
                  {owed > 0 && (
                    <>
                      <label className="date-pick">
                        Paid on <input type="date" value={date} max={dayKey()} onChange={(e) => setDate(e.target.value || dayKey())} />
                      </label>
                      <div className="row">
                        <button className="button small" onClick={() => record(m.id, owed)}>
                          Paid {money(owed, g.currency)}
                        </button>
                        <form
                          className="part"
                          onSubmit={(e) => {
                            e.preventDefault();
                            record(m.id, Math.min(owed, parseFloat(part)));
                          }}
                        >
                          <input inputMode="decimal" placeholder="Part" value={part} onChange={(e) => setPart(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Part payment amount" />
                          <button className="button ghost small" disabled={!(parseFloat(part) > 0)}>
                            Add
                          </button>
                        </form>
                      </div>
                      <a className="text-button wa" href={whatsappLink(reminderText(g, r, m), m.phone)} target="_blank" rel="noreferrer">
                        Remind on WhatsApp
                      </a>
                    </>
                  )}
                  {paid > 0 && (
                    <button className="text-button muted" onClick={() => undo(m.id)}>
                      Undo last payment
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="round-actions">
        <a className="button ghost" href={whatsappLink(groupUpdateText(g))} target="_blank" rel="noreferrer">
          Share update on WhatsApp
        </a>
        {confirmPayout ? (
          <div className="confirm">
            <p>{s.complete ? `Mark the ${money(s.collected, g.currency)} pot as handed to ${s.recipient?.name}?` : `Only ${money(s.collected, g.currency)} of ${money(s.expected, g.currency)} is in. Pay out to ${s.recipient?.name} anyway?`}</p>
            <div className="row">
              <button className="button small" onClick={payOut}>
                Yes, paid out
              </button>
              <button className="text-button" onClick={() => setConfirmPayout(false)}>
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <button className={`button ${s.complete ? "" : "ghost"}`} onClick={() => setConfirmPayout(true)}>
            Pot paid to {s.recipient?.name}
          </button>
        )}
      </div>
    </>
  );
}

function Members({ g }: { g: Group }) {
  const a = useAjo();
  const rows = ledger(g);
  const [editing, setEditing] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMember = (m: Member) => a.saveGroup({ ...g, members: g.members.map((x) => (x.id === m.id ? m : x)) });

  return (
    <>
      {swapFrom !== null && (
        <p className="swap-hint" role="status">
          Swap {g.members[swapFrom].name}'s turn with whose?{" "}
          <button className="text-button" onClick={() => setSwapFrom(null)}>
            Cancel
          </button>
        </p>
      )}
      <ul className="ledger">
        {rows.map((row) => {
          const isEditing = editing === row.member.id;
          const swapTarget = swapFrom !== null && canSwap(g, swapFrom, row.turn);
          return (
            <li key={row.member.id} className={swapTarget ? "swappable" : ""}>
              <div
                className="ledger-row"
                onClick={() => {
                  if (swapTarget) {
                    a.saveGroup(swapTurns(g, swapFrom!, row.turn));
                    setSwapFrom(null);
                  }
                }}
              >
                <span className="turn">{row.turn + 1}</span>
                <span className="who">
                  <b>{row.member.name}</b>
                  <small>
                    {row.received ? `Collected ${money(row.received, g.currency)}` : `Collects ${prettyDate(row.collectsOn, false)}`}
                    {row.late > 0 && ` · late ${row.late}×`}
                  </small>
                </span>
                <span className="figures">
                  <b>{money(row.paidIn, g.currency)} in</b>
                  <small className={row.behind ? "owes" : ""}>{row.behind ? `${money(row.behind, g.currency)} behind` : "up to date"}</small>
                </span>
              </div>
              {swapFrom === null && (
                <div className="ledger-tools">
                  <button className="text-button" onClick={() => setEditing(isEditing ? null : row.member.id)}>
                    {isEditing ? "Done" : "Edit"}
                  </button>
                  {g.members.some((_, other) => canSwap(g, row.turn, other)) && (
                    <button className="text-button" onClick={() => setSwapFrom(row.turn)}>
                      Swap turn
                    </button>
                  )}
                  {canRemove(g, row.member.id) && (
                    <button className="text-button danger-text" onClick={() => a.saveGroup({ ...g, members: g.members.filter((m) => m.id !== row.member.id) })}>
                      Remove
                    </button>
                  )}
                </div>
              )}
              {isEditing && (
                <div className="edit-member">
                  <input value={row.member.name} onChange={(e) => updateMember({ ...row.member, name: e.target.value })} aria-label="Name" />
                  <input value={row.member.phone} onChange={(e) => updateMember({ ...row.member, phone: e.target.value })} placeholder="WhatsApp number" inputMode="tel" aria-label="WhatsApp number" />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">"Behind" counts every round due so far. "Late" counts rounds that weren't paid in full by the due date.</p>

      <div className="danger-zone">
        {confirmDelete ? (
          <>
            <button
              className="button danger small"
              onClick={() => {
                a.deleteGroup(g.id);
                location.hash = "#/";
              }}
            >
              Delete {g.name}
            </button>
            <button className="text-button" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="text-button muted" onClick={() => setConfirmDelete(true)}>
            Delete this group
          </button>
        )}
      </div>
    </>
  );
}

function Schedule({ g }: { g: Group }) {
  const now = currentRound(g);
  return (
    <ol className="schedule">
      {g.members.map((m, r) => {
        const s = roundStatus(g, r);
        const state = s.payout ? "done" : r === now ? "now" : "later";
        return (
          <li key={m.id} className={state}>
            <span className="dot" aria-hidden="true" />
            <span className="who">
              <b>
                Round {r + 1} · {m.name}
              </b>
              <small>
                {s.payout ? `Paid out ${prettyDate(s.payout.date)}` : r === now ? `Collecting now · due ${prettyDate(s.due)}` : `Due ${prettyDate(dueDate(g, r))}`}
              </small>
            </span>
            <span className="amount">{money(s.payout ? s.collected : s.expected, g.currency)}</span>
          </li>
        );
      })}
    </ol>
  );
}
