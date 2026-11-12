import { useRef, useState } from "react";
import { useAjo } from "./app";
import { currentRound, isFinished, money, prettyDate, roundStatus } from "./model";

export default function Home() {
  const a = useAjo();
  const file = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function backup() {
    const url = URL.createObjectURL(await a.backup());
    const link = document.createElement("a");
    link.href = url;
    link.download = `ajo-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus("Backup saved. Keep it somewhere safe, like iCloud Drive or Google Drive.");
  }

  return (
    <div className="page">
      <header className="home-head">
        <h1>Ajo</h1>
        <p className="lede">Run your savings group without the paper notebook. Who's paid, whose turn it is, and reminders sent on WhatsApp in one tap.</p>
        <a className="button" href="#/new">
          Start a group
        </a>
      </header>

      {a.groups.length === 0 ? (
        <div className="empty-card">
          <p>No groups yet.</p>
          <button
            className="text-button"
            onClick={() => {
              const g = a.addExample();
              location.hash = `#/group/${g.id}`;
            }}
          >
            See an example group
          </button>
        </div>
      ) : (
        <ul className="group-list">
          {a.groups.map((g) => {
            const r = currentRound(g);
            const done = isFinished(g);
            const s = done ? null : roundStatus(g, r);
            return (
              <li key={g.id}>
                <a href={`#/group/${g.id}`} className="group-card">
                  <div className="group-card-top">
                    <b>{g.name || "Untitled group"}</b>
                    {s?.overdue && <span className="badge late">Overdue</span>}
                    {done && <span className="badge good">Complete</span>}
                  </div>
                  {s ? (
                    <>
                      <span className="group-card-sub">
                        Round {r + 1} of {g.members.length} · <b>{s.recipient?.name}</b>'s turn · {prettyDate(s.due)}
                      </span>
                      <div className="bar" aria-hidden="true">
                        <span style={{ width: `${Math.min(100, (s.collected / s.expected) * 100)}%` }} />
                      </div>
                      <span className="group-card-sub muted">
                        {money(s.collected, g.currency)} of {money(s.expected, g.currency)} collected · {s.paid.length}/{g.members.length} paid
                      </span>
                    </>
                  ) : (
                    <span className="group-card-sub muted">Everyone has had their turn.</span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <section className="backup">
        <h2>Backup</h2>
        <p className="muted">Your groups are saved only on this phone. Save a backup after big changes, and restore it on a new phone.</p>
        {status && (
          <p className="ok-text" role="status">
            {status}
          </p>
        )}
        <div className="row">
          <button className="button ghost small" onClick={backup} disabled={!a.groups.length}>
            Save a backup
          </button>
          <button className="button ghost small" onClick={() => file.current?.click()}>
            Restore
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const n = await a.restore(f);
                setStatus(`Restored ${n} group${n === 1 ? "" : "s"}.`);
              } catch (err) {
                setStatus(err instanceof Error ? err.message : "Couldn't restore that file.");
              }
            }}
          />
        </div>
        <p className="muted small">Ajo is a record-keeper. No money moves through the app.</p>
      </section>
    </div>
  );
}
