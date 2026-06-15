import { useState } from "react";
import { createFirstAdmin } from "../../lib/api";

interface Props {
  onSetupComplete: () => void;
}

type Step = 1 | 2 | 3;

export default function SetupWizard({ onSetupComplete }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateAdmin() {
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      await createFirstAdmin({ email, full_name: fullName, password });
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        <div className="wizard-header">
          <h2>Welcome to Nestarr</h2>
          <p>Let's get your inventory system set up.</p>
        </div>

        <div className="wizard-step-indicator">
          <div className={`step-dot ${step >= 1 ? (step > 1 ? "done" : "active") : ""}`}>1</div>
          <div className={`step-line ${step > 1 ? "done" : ""}`} />
          <div className={`step-dot ${step >= 2 ? (step > 2 ? "done" : "active") : ""}`}>2</div>
          <div className={`step-line ${step > 2 ? "done" : ""}`} />
          <div className={`step-dot ${step >= 3 ? "done active" : ""}`}>3</div>
        </div>

        {step === 1 && (
          <>
            <div className="wizard-body">
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                No administrator account exists yet. You'll create the first admin account
                to control who has access to your inventory.
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.8 }}>
                <li>Full control over users and settings</li>
                <li>Ability to approve new user registrations</li>
                <li>Manage all locations and items</li>
              </ul>
            </div>
            <div className="wizard-footer">
              <span />
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Get Started →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="wizard-body">
              <div className="field">
                <span>Full Name</span>
                <input
                  type="text"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="field">
                <span>Email Address</span>
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <span>Confirm Password</span>
                <input
                  type="password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {error && <div className="error-banner">{error}</div>}
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateAdmin}
                disabled={loading || !email || !fullName || !password || !confirmPassword}
              >
                {loading ? "Creating…" : "Create Admin Account"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="wizard-success-icon">🎉</div>
            <div className="wizard-body">
              <p style={{ margin: 0, textAlign: "center", color: "var(--text)", fontSize: "1rem", fontWeight: 500 }}>
                Admin account created!
              </p>
              <p style={{ margin: 0, textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
                Sign in with your new credentials to start using Nestarr. You can then
                set up your home and start adding items to your inventory.
              </p>
            </div>
            <div className="wizard-footer">
              <span />
              <button className="btn btn-primary" onClick={onSetupComplete}>
                Go to Login →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
