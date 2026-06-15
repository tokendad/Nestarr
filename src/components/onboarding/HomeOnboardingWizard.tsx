import { useState } from "react";
import { createHomeSetup } from "../../lib/api";

interface RoomEntry {
  id: number;
  name: string;
}

interface Props {
  onComplete: (homeId: string, homeName: string) => void;
  onSkip: () => void;
}

const HOME_TYPES = ["House", "Apartment", "Condo", "Townhouse", "Other"];

type Step = 1 | 2 | 3 | 4;

let nextId = 1;

export default function HomeOnboardingWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [homeName, setHomeName] = useState("");
  const [homeType, setHomeType] = useState("House");
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [newRoom, setNewRoom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ home_id: string; home_name: string } | null>(null);

  function addRoom() {
    const name = newRoom.trim();
    if (!name) return;
    setRooms((prev) => [...prev, { id: nextId++, name }]);
    setNewRoom("");
  }

  function removeRoom(id: number) {
    setRooms((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      const resp = await createHomeSetup({
        home_name: `${homeName} (${homeType})`,
        rooms: rooms.map((r) => ({ name: r.name })),
      });
      setResult({ home_id: resp.home_id, home_name: resp.home_name });
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create home.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        <div className="wizard-header">
          <h2>Set Up Your Home</h2>
          <p>Add your primary location to start organising items.</p>
        </div>

        <div className="wizard-step-indicator">
          <div className={`step-dot ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`}>1</div>
          <div className={`step-line ${step > 1 ? "done" : ""}`} />
          <div className={`step-dot ${step >= 2 ? (step > 2 ? "done" : "active") : ""}`}>2</div>
          <div className={`step-line ${step > 2 ? "done" : ""}`} />
          <div className={`step-dot ${step >= 3 ? (step > 3 ? "done" : "active") : ""}`}>3</div>
          <div className={`step-line ${step > 3 ? "done" : ""}`} />
          <div className={`step-dot ${step >= 4 ? "done active" : ""}`}>4</div>
        </div>

        {step === 1 && (
          <>
            <div className="wizard-body">
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                Nestarr organises your items by location. Start by adding your home —
                you can add more locations later.
              </p>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={onSkip}>
                Skip for now
              </button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Let's go →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="wizard-body">
              <div className="field">
                <span>Home Name</span>
                <input
                  type="text"
                  placeholder="e.g. My House, Apartment 4B…"
                  value={homeName}
                  onChange={(e) => setHomeName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <span>Home Type</span>
                <select value={homeType} onChange={(e) => setHomeType(e.target.value)}>
                  {HOME_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(3)}
                disabled={!homeName.trim()}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="wizard-body">
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                Optionally add rooms or areas within your home (you can add more later).
              </p>
              <div className="wizard-room-list">
                {rooms.map((r) => (
                  <div key={r.id} className="wizard-room-item">
                    <span>{r.name}</span>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "0.1rem 0.4rem", fontSize: "0.8rem" }}
                      onClick={() => removeRoom(r.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Room name, e.g. Kitchen"
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRoom()}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.65rem",
                    background: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                    borderRadius: "0.5rem",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                  }}
                />
                <button className="btn btn-secondary" onClick={addRoom} disabled={!newRoom.trim()}>
                  Add
                </button>
              </div>
              {error && <div className="error-banner">{error}</div>}
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>← Back</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={loading}>
                {loading ? "Creating…" : "Create Home"}
              </button>
            </div>
          </>
        )}

        {step === 4 && result && (
          <>
            <div className="wizard-success-icon">🏠</div>
            <div className="wizard-body">
              <p style={{ margin: 0, textAlign: "center", color: "var(--text)", fontSize: "1rem", fontWeight: 500 }}>
                "{result.home_name}" is ready!
              </p>
              <p style={{ margin: 0, textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
                {rooms.length > 0
                  ? `Added ${rooms.length} room${rooms.length === 1 ? "" : "s"}. You can now start adding items.`
                  : "You can now start adding items to your inventory."}
              </p>
            </div>
            <div className="wizard-footer">
              <span />
              <button className="btn btn-primary" onClick={() => onComplete(result.home_id, result.home_name)}>
                Start Adding Items →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
