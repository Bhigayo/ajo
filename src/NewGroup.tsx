import { useState } from "react";
import { useAjo } from "./app";
import { dayKey, drawLots, dueDate, FREQUENCY_NAMES, makeGroup, makeMember, money, prettyDate, type Currency, type Frequency, type Member } from "./model";
import { Field, Segmented } from "./ui";

export default function NewGroup() {
  const a = useAjo();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [start, setStart] = useState(dayKey());
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [shuffling, setShuffling] = useState(false);

  const value = parseFloat(amount);
  const valid = name.trim() && value > 0 && members.length >= 2 && start;

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setMembers((m) => [...m, makeMember(newName, newPhone)]);
    setNewName("");
    setNewPhone("");
  }

  function move(i: number, by: number) {
    setMembers((m) => {
      const next = [...m];
      const [x] = next.splice(i, 1);
      next.splice(i + by, 0, x);
      return next;
    });
  }

  // A short shuffle animation so the draw feels like a draw
  function draw() {
    setShuffling(true);
    let n = 0;
    const t = setInterval(() => {
      setMembers((m) => drawLots(m));
      if (++n >= 8) {
        clearInterval(t);
        setShuffling(false);
      }
    }, 90);
  }

  function create() {
    if (!valid) return;
    const g = makeGroup({ name: name.trim(), amount: Math.round(value * 100) / 100, currency, frequency, start, members });
    a.saveGroup(g);
    location.hash = `#/group/${g.id}`;
  }

  const plan = { start, frequency };
  return (
    <div className="page">
      <header className="page-head">
        <a className="back" href="#/" aria-label="Back">
          ←
        </a>
        <h1>New group</h1>
      </header>

      <section className="card">
        <Field label="Group name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Family Ajo 2026" maxLength={50} />
        </Field>
        <div className="two">
          <Field label="Each person pays">
            <span className="money-input">
              <span>{currency === "GBP" ? "£" : "₦"}</span>
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            </span>
          </Field>
          <div className="field">
            <span className="field-label">Currency</span>
            <Segmented<Currency>
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={[
                { value: "GBP", label: "£" },
                { value: "NGN", label: "₦" },
              ]}
            />
          </div>
        </div>
        <div className="field">
          <span className="field-label">How often</span>
          <Segmented<Frequency> label="How often" value={frequency} onChange={setFrequency} options={(["weekly", "fortnightly", "monthly"] as Frequency[]).map((f) => ({ value: f, label: f === "fortnightly" ? "2 weeks" : FREQUENCY_NAMES[f] }))} />
        </div>
        <Field label="First payment due">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Members</h2>
          {members.length >= 2 && (
            <button className="button ghost small" onClick={draw} disabled={shuffling}>
              {shuffling ? "Drawing…" : "Draw lots"}
            </button>
          )}
        </div>
        <p className="muted small">The order is the order people collect the pot. Draw lots for a fair order, or arrange it yourself.</p>
        <ol className={`member-order ${shuffling ? "shuffling" : ""}`}>
          {members.map((m, i) => (
            <li key={m.id}>
              <span className="turn">{i + 1}</span>
              <span className="who">
                <b>{m.name}</b>
                <small>{start && prettyDate(dueDate(plan, i))}</small>
              </span>
              <button className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${m.name} earlier`}>
                ↑
              </button>
              <button className="icon" onClick={() => move(i, 1)} disabled={i === members.length - 1} aria-label={`Move ${m.name} later`}>
                ↓
              </button>
              <button className="icon" onClick={() => setMembers((all) => all.filter((x) => x.id !== m.id))} aria-label={`Remove ${m.name}`}>
                ×
              </button>
            </li>
          ))}
        </ol>
        <form className="add-member" onSubmit={add}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" aria-label="Member name" />
          <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="WhatsApp number (optional)" inputMode="tel" aria-label="WhatsApp number" />
          <button className="button small" disabled={!newName.trim()}>
            Add
          </button>
        </form>
      </section>

      {members.length >= 2 && value > 0 && (
        <p className="summary">
          {members.length} people pay {money(value, currency)} {frequency === "weekly" ? "a week" : frequency === "monthly" ? "a month" : "every two weeks"}. Each pot is{" "}
          <b>{money(value * members.length, currency)}</b>, and the last turn is on {prettyDate(dueDate(plan, members.length - 1))}.
        </p>
      )}

      <button className="button wide" onClick={create} disabled={!valid}>
        {members.length < 2 ? "Add at least two members" : "Start the group"}
      </button>
    </div>
  );
}
