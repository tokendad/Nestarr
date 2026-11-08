import React, { useState, useCallback } from "react";
import type { Item, Warranty } from "../lib/api";
import { updateItem } from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type WarrantyStatus = "active" | "expiring-soon" | "expired" | "no-expiry";

// ─── Constants ────────────────────────────────────────────────────────────────

const WARRANTY_TYPES = [
  { value: "manufacturer", label: "🏭 Manufacturer Warranty" },
  { value: "dealer",       label: "🚗 Dealer Warranty" },
  { value: "extended",     label: "📋 Extended Warranty" },
] as const;

const EMPTY_FORM: Omit<Warranty, "id"> = {
  type:             "manufacturer",
  provider:         "",
  policy_number:    "",
  duration_months:  undefined,
  expiration_date:  "",
  notes:            "",
};

const EXPIRY_WARNING_DAYS = 90;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWarrantyStatus(warranty: Warranty): WarrantyStatus {
  if (!warranty.expiration_date) return "no-expiry";
  const expiry = new Date(warranty.expiration_date);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  if (expiry < today) return "expired";
  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  return daysLeft <= EXPIRY_WARNING_DAYS ? "expiring-soon" : "active";
}

function daysUntilExpiry(dateStr: string): number {
  const expiry = new Date(dateStr);
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function sortWarranties(list: Warranty[]): Warranty[] {
  return [...list].sort((a, b) => {
    // No expiry goes to bottom
    if (!a.expiration_date && !b.expiration_date) return 0;
    if (!a.expiration_date) return 1;
    if (!b.expiration_date) return -1;
    return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
  });
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WarrantyStatus, { label: string; className: string }> = {
  "active":        { label: "● Active",        className: "warranty-status-active" },
  "expiring-soon": { label: "⚠ Expiring Soon", className: "warranty-status-expiring" },
  "expired":       { label: "✕ Expired",        className: "warranty-status-expired" },
  "no-expiry":     { label: "○ No Expiry",      className: "warranty-status-none" },
};

const StatusBadge: React.FC<{ status: WarrantyStatus }> = ({ status }) => {
  const { label, className } = STATUS_CONFIG[status];
  return <span className={`warranty-status-badge ${className}`}>{label}</span>;
};

// ─── WarrantyCard ─────────────────────────────────────────────────────────────

interface WarrantyCardProps {
  warranty: Warranty;
  onEdit:   (w: Warranty) => void;
  onDelete: (w: Warranty) => void;
}

const WarrantyCard: React.FC<WarrantyCardProps> = ({ warranty, onEdit, onDelete }) => {
  const status   = getWarrantyStatus(warranty);
  const typeConf = WARRANTY_TYPES.find(t => t.value === warranty.type) ?? WARRANTY_TYPES[0];

  const expiryLine = (() => {
    if (!warranty.expiration_date) {
      return warranty.duration_months
        ? `${warranty.duration_months} months duration — no expiry date set`
        : null;
    }
    const days = daysUntilExpiry(warranty.expiration_date);
    const formatted = formatDate(warranty.expiration_date);
    if (days < 0)   return `Expired ${formatted} (${Math.abs(days)} days ago)`;
    if (days === 0) return `Expires today (${formatted})`;
    return `Expires ${formatted} (in ${days} days)`;
  })();

  const copyPolicyNumber = () => {
    if (warranty.policy_number) {
      navigator.clipboard.writeText(warranty.policy_number).catch(() => {});
    }
  };

  return (
    <div className={`warranty-card warranty-card--${status}`}>
      <div className="warranty-card-header">
        <span className="warranty-type-label">{typeConf.label}</span>
        <StatusBadge status={status} />
        <div className="warranty-card-actions">
          <button
            className="warranty-btn-icon"
            onClick={() => onEdit(warranty)}
            title="Edit warranty"
            aria-label="Edit warranty"
          >
            ✎
          </button>
          <button
            className="warranty-btn-icon warranty-btn-delete"
            onClick={() => onDelete(warranty)}
            title="Delete warranty"
            aria-label="Delete warranty"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="warranty-card-body">
        {warranty.provider && (
          <div className="warranty-provider">{warranty.provider}</div>
        )}
        {warranty.policy_number && (
          <div className="warranty-policy-row">
            <span className="warranty-policy-label">Policy:</span>
            <code className="warranty-policy-number">{warranty.policy_number}</code>
            <button
              className="warranty-copy-btn"
              onClick={copyPolicyNumber}
              title="Copy policy number"
              aria-label="Copy policy number to clipboard"
            >
              📋
            </button>
          </div>
        )}
        {expiryLine && (
          <div className={`warranty-expiry-line warranty-expiry--${status}`}>
            🗓 {expiryLine}
          </div>
        )}
        {warranty.notes && (
          <div className="warranty-notes">{warranty.notes}</div>
        )}
      </div>
    </div>
  );
};

// ─── WarrantyForm ─────────────────────────────────────────────────────────────

interface WarrantyFormProps {
  initial:   Partial<Warranty>;
  isEditing: boolean;
  isSaving:  boolean;
  onSave:    (data: Omit<Warranty, "id">) => void;
  onCancel:  () => void;
}

const WarrantyForm: React.FC<WarrantyFormProps> = ({
  initial,
  isEditing,
  isSaving,
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState<Omit<Warranty, "id">>({
    ...EMPTY_FORM,
    ...Object.fromEntries(
      Object.entries(initial).filter(([k]) => k !== "id" && initial[k as keyof Warranty] != null)
    ),
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === "duration_months"
        ? (value === "" ? undefined : parseInt(value, 10))
        : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <form className="warranty-form" onSubmit={handleSubmit} noValidate>
      <div className="warranty-form-header">
        <h4>{isEditing ? "✎ Edit Warranty" : "＋ Add Warranty"}</h4>
      </div>

      {/* Type */}
      <div className="form-group">
        <label htmlFor="wf-type">Warranty Type *</label>
        <select
          id="wf-type"
          name="type"
          value={form.type}
          onChange={handleChange}
          required
          disabled={isSaving}
        >
          {WARRANTY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Provider + Policy */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="wf-provider">Provider / Seller</label>
          <input
            type="text"
            id="wf-provider"
            name="provider"
            value={form.provider ?? ""}
            onChange={handleChange}
            placeholder="e.g., Best Buy, Manufacturer"
            disabled={isSaving}
          />
        </div>
        <div className="form-group">
          <label htmlFor="wf-policy">Policy Number</label>
          <input
            type="text"
            id="wf-policy"
            name="policy_number"
            value={form.policy_number ?? ""}
            onChange={handleChange}
            placeholder="e.g., BB-2024-12345"
            disabled={isSaving}
            className="font-mono"
          />
        </div>
      </div>

      {/* Duration + Expiration */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="wf-duration">Duration (months)</label>
          <input
            type="number"
            id="wf-duration"
            name="duration_months"
            value={form.duration_months ?? ""}
            onChange={handleChange}
            placeholder="e.g., 24"
            min={1}
            max={600}
            disabled={isSaving}
          />
        </div>
        <div className="form-group">
          <label htmlFor="wf-expiry">Expiration Date</label>
          <input
            type="date"
            id="wf-expiry"
            name="expiration_date"
            value={form.expiration_date ?? ""}
            onChange={handleChange}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="form-group">
        <label htmlFor="wf-notes">Notes</label>
        <textarea
          id="wf-notes"
          name="notes"
          value={form.notes ?? ""}
          onChange={handleChange}
          rows={2}
          placeholder="Contact info, claim instructions, phone numbers…"
          disabled={isSaving}
        />
      </div>

      <div className="warranty-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : isEditing ? "Update" : "Add Warranty"}
        </button>
      </div>
    </form>
  );
};

// ─── WarrantyTab ─────────────────────────────────────────────────────────────

interface WarrantyTabProps {
  item:     Item;
  onUpdate: () => void;
}

const WarrantyTab: React.FC<WarrantyTabProps> = ({ item, onUpdate }) => {
  const [entries, setEntries]           = useState<Warranty[]>(item.warranties ?? []);
  const [showForm, setShowForm]         = useState(false);
  const [editingEntry, setEditingEntry] = useState<Warranty | null>(null);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const persist = async (next: Warranty[]) => {
    setSaving(true);
    setError(null);
    try {
      await updateItem(item.id.toString(), { warranties: next });
      setEntries(next);
      onUpdate();
    } catch (err: any) {
      setError(err.message ?? "Failed to save warranty");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = useCallback(() => {
    setEditingEntry(null);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("warranty-form-anchor")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  const handleEdit = useCallback((w: Warranty) => {
    setEditingEntry(w);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById("warranty-form-anchor")?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingEntry(null);
  }, []);

  const handleSave = useCallback(async (data: Omit<Warranty, "id">) => {
    const next = editingEntry
      ? entries.map(e => e.id === editingEntry.id ? { ...editingEntry, ...data } : e)
      : [...entries, { id: crypto.randomUUID(), ...data }];
    await persist(next);
    if (!error) {
      setShowForm(false);
      setEditingEntry(null);
    }
  }, [entries, editingEntry, error]);

  const handleDelete = useCallback(async (w: Warranty) => {
    const typeLabel = w.type === "manufacturer" ? "Manufacturer" : w.type === "dealer" ? "Dealer" : "Extended";
    const label = `${typeLabel} warranty` + (w.provider ? ` from ${w.provider}` : "");
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    await persist(entries.filter(e => e.id !== w.id));
  }, [entries]);

  const sorted = sortWarranties(entries);

  return (
    <div className="warranty-tab">
      {/* Header */}
      <div className="warranty-tab-header">
        <div className="warranty-tab-title">
          <h3>Warranties</h3>
          <span className="warranty-count" aria-label={`${entries.length} warranties`}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {!showForm && (
          <button className="btn-primary" onClick={handleAdd} aria-label="Add warranty">
            + Add Warranty
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner" role="alert">{error}</div>
      )}

      {/* Inline form */}
      {showForm && (
        <div id="warranty-form-anchor">
          <WarrantyForm
            initial={editingEntry ?? {}}
            isEditing={editingEntry !== null}
            isSaving={saving}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && !showForm && (
        <div className="warranty-empty-state">
          <div className="warranty-empty-icon" aria-hidden="true">🛡️</div>
          <p className="warranty-empty-title">No warranties recorded</p>
          <p className="warranty-empty-sub">
            Track manufacturer, dealer, and extended warranties so you always know
            what's covered and when coverage expires.
          </p>
          <button className="btn-primary" onClick={handleAdd}>
            + Add First Warranty
          </button>
        </div>
      )}

      {/* Entry list */}
      {entries.length > 0 && (
        <div className="warranty-list">
          {sorted.map(w => (
            <WarrantyCard
              key={w.id ?? `${w.type}-${w.provider}`}
              warranty={w}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WarrantyTab;
