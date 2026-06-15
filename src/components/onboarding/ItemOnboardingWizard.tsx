import { useState } from "react";

interface Props {
  onAddItem: () => void;
  onSkip: () => void;
}

const STEPS = ["Welcome", "Find an Item", "Photo Tips", "Adding Details", "Get Started"];

export default function ItemOnboardingWizard({ onAddItem, onSkip }: Props) {
  const [step, setStep] = useState(0);

  function next() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleAddItem() {
    onAddItem();
  }

  return (
    <div className="wizard-overlay" onClick={onSkip}>
      <div className="wizard-card" onClick={(e) => e.stopPropagation()}>
        {/* Step indicator */}
        <div className="wizard-step-indicator">
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center" }}>
              <div
                className={`step-dot${i === step ? " active" : i < step ? " completed" : ""}`}
                title={label}
              />
              {i < STEPS.length - 1 && (
                <div className={`step-line${i < step ? " completed" : ""}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step 0 — Welcome */}
        {step === 0 && (
          <>
            <div className="wizard-header">
              <div className="wizard-success-icon">📦</div>
              <h2>Build Your Inventory</h2>
              <p>
                You're ready to start tracking what you own. Items can include appliances,
                electronics, furniture, tools, collectibles — anything worth remembering.
              </p>
            </div>
            <div className="wizard-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Tip icon="🔍" text="Find items that have serial numbers or receipts — they're most useful to track." />
                <Tip icon="💰" text="High-value items (electronics, appliances) are great candidates for warranty and insurance purposes." />
                <Tip icon="📍" text="Each item is linked to a location in your home, making it easy to find things later." />
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={onSkip}>
                Skip
              </button>
              <button className="btn btn-primary" onClick={next}>
                Let's Go →
              </button>
            </div>
          </>
        )}

        {/* Step 1 — Find Your First Item */}
        {step === 1 && (
          <>
            <div className="wizard-header">
              <div className="wizard-success-icon">🏠</div>
              <h2>Find Your First Item</h2>
              <p>
                Look around you! A good first item is something nearby that you use every
                day or something valuable you'd want to insure.
              </p>
            </div>
            <div className="wizard-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Tip icon="📺" text="TV, laptop, or gaming console — electronics are quick to add." />
                <Tip icon="🍳" text="Kitchen appliances like a stand mixer or coffee maker work great." />
                <Tip icon="🧰" text="Power tools, cameras, or musical instruments are also excellent choices." />
                <Tip icon="📄" text="Have the receipt, box, or manual nearby? That makes adding details even faster." />
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={back}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={next}>
                I Found One →
              </button>
            </div>
          </>
        )}

        {/* Step 2 — Photo Tips */}
        {step === 2 && (
          <>
            <div className="wizard-header">
              <div className="wizard-success-icon">📷</div>
              <h2>Take a Photo (Optional)</h2>
              <p>
                A photo makes your inventory visual and helps with insurance claims or
                identifying items. It's optional — you can always add one later.
              </p>
            </div>
            <div className="wizard-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Tip icon="☀️" text="Good lighting makes a huge difference — natural light from a window works best." />
                <Tip icon="🏷️" text="Include the label or model number in one photo so you can zoom in later." />
                <Tip icon="🧾" text="Snap the receipt or warranty card if you have it — Nestarr stores documents too." />
                <Tip icon="🤖" text="Nestarr's AI can detect items from photos and pre-fill many fields for you." />
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={back}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={next}>
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 3 — Adding Details */}
        {step === 3 && (
          <>
            <div className="wizard-header">
              <div className="wizard-success-icon">✏️</div>
              <h2>Adding Details</h2>
              <p>
                When you open the Add Item form you'll see several fields. Here's what
                matters most for a useful inventory record.
              </p>
            </div>
            <div className="wizard-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <FieldTip field="Name" desc='A clear, descriptive name — e.g. "Samsung 65-inch TV" not just "TV".' />
                <FieldTip field="Brand / Model" desc="Helps identify the exact item for warranty lookups and repairs." />
                <FieldTip field="Serial Number" desc="Often on a sticker on the back or bottom. Critical for insurance claims." />
                <FieldTip field="Location" desc="Which room or area is it in? Links the item to your home layout." />
                <FieldTip field="Purchase Price" desc="Useful for calculating total home value and insurance coverage." />
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={back}>
                ← Back
              </button>
              <button className="btn btn-primary" onClick={next}>
                Ready to Add →
              </button>
            </div>
          </>
        )}

        {/* Step 4 — CTA */}
        {step === 4 && (
          <>
            <div className="wizard-header">
              <div className="wizard-success-icon">🚀</div>
              <h2>You're All Set!</h2>
              <p>
                Click the button below to open the Add Item form and add your first item
                to Nestarr. You can always come back and add more later.
              </p>
            </div>
            <div className="wizard-body">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Tip icon="💡" text="You can add as many items as you like. Start with a few and build over time." />
                <Tip icon="📋" text="Use Collections to group related items — like all your electronics or tools." />
                <Tip icon="🔔" text="Set maintenance reminders on items like HVAC filters or smoke detectors." />
              </div>
            </div>
            <div className="wizard-footer">
              <button className="btn btn-ghost" onClick={onSkip}>
                Maybe Later
              </button>
              <button className="btn btn-primary" onClick={handleAddItem}>
                ➕ Add My First Item
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tip({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        alignItems: "flex-start",
        padding: "0.6rem 0.75rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
      }}
    >
      <span style={{ fontSize: "1.2rem", lineHeight: 1.4 }}>{icon}</span>
      <span style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function FieldTip({ field, desc }: { field: string; desc: string }) {
  return (
    <div
      style={{
        padding: "0.6rem 0.75rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--accent)", marginBottom: "0.2rem" }}>
        {field}
      </div>
      <div style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}
