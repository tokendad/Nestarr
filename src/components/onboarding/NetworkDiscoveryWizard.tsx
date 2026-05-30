import { useState, useEffect, useMemo } from "react";
import {
  scanNetwork,
  importNetworkDevices,
  type DiscoveredDevice,
  type NetworkImportDevice,
  type NetworkScanResponse,
  type NetworkImportResponse,
} from "../../lib/api";

interface Location {
  id: string;
  name: string;
  friendly_name?: string | null;
  is_primary_location?: boolean;
  location_category?: string | null;
  parent_id?: string | null;
}

interface Props {
  locations: Location[];
  onComplete: () => void;
  onSkip: () => void;
  defaultLocationId?: string;
}

type Step = 1 | 2 | 3 | 4;

type DeviceAction = "create" | "update" | "skip";

interface DeviceRow {
  device: DiscoveredDevice;
  action: DeviceAction;
  customName: string;
  roomLocationId: string | null;
}

const DEVICE_ICONS: Record<string, string> = {
  router: "🌐",
  camera: "📷",
  computer: "💻",
  laptop: "💻",
  phone: "📱",
  tablet: "📱",
  printer: "🖨️",
  tv: "📺",
  "smart tv": "📺",
  nas: "🖥️",
  server: "🖥️",
  iot: "🔌",
  default: "📡",
};

function getDeviceIcon(typeGuess: string | null): string {
  if (!typeGuess) return DEVICE_ICONS.default;
  const key = typeGuess.toLowerCase();
  for (const [k, icon] of Object.entries(DEVICE_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return DEVICE_ICONS.default;
}

function defaultName(d: DiscoveredDevice): string {
  return d.hostname || `Network Device (${d.ip})`;
}

export default function NetworkDiscoveryWizard({
  locations,
  onComplete,
  onSkip,
  defaultLocationId,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [locationId, setLocationId] = useState(defaultLocationId || locations[0]?.id || "");
  const [subnet, setSubnet] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<NetworkScanResponse | null>(null);
  const [scanError, setScanError] = useState("");
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<NetworkImportResponse | null>(null);
  const [importError, setImportError] = useState("");
  const [allChecked, setAllChecked] = useState(true);

  // Primary-only locations for Step 1 selector (fall back to all if none tagged)
  const primaryLocations = useMemo(() => {
    const filtered = locations.filter(
      (l) => l.is_primary_location || (l.location_category || "").toLowerCase() === "primary"
    );
    return filtered.length > 0 ? filtered : locations;
  }, [locations]);

  // Child rooms of the selected primary location for per-device assignment
  const roomLocations = useMemo(
    () => locations.filter((l) => l.parent_id?.toString() === locationId),
    [locations, locationId]
  );

  // Pre-populate location when defaultLocationId arrives after mount
  useEffect(() => {
    if (defaultLocationId) setLocationId(defaultLocationId);
  }, [defaultLocationId]);

  async function startScan() {
    setScanning(true);
    setScanError("");
    setStep(2);
    try {
      const result = await scanNetwork(subnet || undefined);
      setScanResult(result);
      const initialRows: DeviceRow[] = result.devices.map((d) => ({
        device: d,
        action: d.existing_item_id ? "skip" : "create",
        customName: defaultName(d),
        roomLocationId: null,
      }));
      setRows(initialRows);
      setStep(3);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
      setStep(3);
    } finally {
      setScanning(false);
    }
  }

  function toggleAll(checked: boolean) {
    setAllChecked(checked);
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        action: r.device.existing_item_id
          ? r.action // don't force-check already-tracked devices
          : checked
          ? "create"
          : "skip",
      }))
    );
  }

  function setRowAction(ip: string, action: DeviceAction) {
    setRows((prev) => prev.map((r) => (r.device.ip === ip ? { ...r, action } : r)));
  }

  function setRowName(ip: string, name: string) {
    setRows((prev) => prev.map((r) => (r.device.ip === ip ? { ...r, customName: name } : r)));
  }

  function setRowRoom(ip: string, roomId: string | null) {
    setRows((prev) => prev.map((r) => (r.device.ip === ip ? { ...r, roomLocationId: roomId } : r)));
  }

  async function doImport() {
    if (!locationId) return;
    setImporting(true);
    setImportError("");
    const payload: NetworkImportDevice[] = rows.map((r) => ({
      action: r.action,
      device: r.device,
      item_id: r.device.existing_item_id || undefined,
      item_name: r.customName || undefined,
      location_id: r.roomLocationId || undefined,
    }));
    try {
      const result = await importNetworkDevices({ location_id: locationId, devices: payload });
      setImportResult(result);
      setStep(4);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const TOTAL_STEPS = 4;
  const STEP_LABELS = ["Setup", "Scanning", "Review", "Done"];

  function renderStepIndicator() {
    return (
      <div className="wizard-step-indicator">
        {STEP_LABELS.map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div
              className={`step-dot${step === i + 1 ? " active" : step > i + 1 ? " completed" : ""}`}
              title={label}
            />
            {i < TOTAL_STEPS - 1 && (
              <div className={`step-line${step > i + 1 ? " completed" : ""}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ── Step 1: Setup ─────────────────────────────────────────────────────────
  function renderStep1() {
    const showLocationPicker = primaryLocations.length > 1;
    return (
      <>
        <div className="wizard-header">
          <h2>🔍 Network Discovery</h2>
          <p>Scan your local network for connected devices</p>
          {renderStepIndicator()}
        </div>
        <div className="wizard-body">
          <div
            style={{
              background: "var(--info-bg, #eff6ff)",
              border: "1px solid var(--info-border, #bfdbfe)",
              borderRadius: "8px",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              color: "var(--info-text, #1e40af)",
              marginBottom: "1.25rem",
            }}
          >
            ℹ️ This scan is <strong>read-only</strong> and does not modify any devices on your
            network. Results are shown for review before anything is added to your inventory.
          </div>

          {showLocationPicker && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: "0.35rem", fontSize: "0.9rem" }}>
                Home
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid var(--border-color, #d1d5db)" }}
              >
                {primaryLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.friendly_name || l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "0.35rem", fontSize: "0.9rem" }}>
              Subnet <span style={{ fontWeight: 400, color: "var(--muted, #6b7280)" }}>(optional — leave blank to auto-detect)</span>
            </label>
            <input
              type="text"
              value={subnet}
              onChange={(e) => setSubnet(e.target.value)}
              placeholder="e.g. 192.168.1.0/24"
              style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "6px", border: "1px solid var(--border-color, #d1d5db)", boxSizing: "border-box" }}
            />
          </div>
        </div>
        <div className="wizard-footer" style={{ display: "flex", justifyContent: "space-between" }}>
          <button className="btn btn-secondary" onClick={onSkip}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={startScan}
            disabled={locations.length === 0 || !locationId}
          >
            Start Scan
          </button>
        </div>
      </>
    );
  }

  // ── Step 2: Scanning ──────────────────────────────────────────────────────
  function renderStep2() {
    return (
      <>
        <div className="wizard-header">
          <h2>🔍 Network Discovery</h2>
          <p>Scanning in progress…</p>
          {renderStepIndicator()}
        </div>
        <div className="wizard-body" style={{ textAlign: "center", padding: "2rem 1rem" }}>
          <div
            style={{
              height: "6px",
              borderRadius: "3px",
              background: "var(--border-color, #e5e7eb)",
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "40%",
                borderRadius: "3px",
                background: "var(--color-primary, #6366f1)",
                animation: "progressIndeterminate 1.4s infinite ease-in-out",
              }}
            />
          </div>
          <style>{`
            @keyframes progressIndeterminate {
              0%   { transform: translateX(-150%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
            Scanning your network for connected devices…
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--muted, #6b7280)" }}>
            This may take up to 90 seconds depending on the size of your network.
          </p>
        </div>
      </>
    );
  }

  // ── Step 3: Review ────────────────────────────────────────────────────────
  function renderStep3() {
    if (scanError) {
      return (
        <>
          <div className="wizard-header">
            <h2>🔍 Network Discovery</h2>
            <p>Scan error</p>
            {renderStepIndicator()}
          </div>
          <div className="wizard-body">
            <div
              style={{
                background: "var(--error-bg, #fef2f2)",
                border: "1px solid var(--error-border, #fecaca)",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                color: "var(--error-text, #b91c1c)",
                marginBottom: "1rem",
              }}
            >
              ⚠️ {scanError}
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--muted, #6b7280)" }}>
              Make sure nmap is installed and the container has network access. For MAC address
              collection, run with <code>--cap-add=NET_RAW</code>.
            </p>
          </div>
          <div className="wizard-footer" style={{ display: "flex", justifyContent: "space-between" }}>
            <button className="btn btn-secondary" onClick={onSkip}>
              Skip
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setScanError("");
                setStep(1);
              }}
            >
              Try Again
            </button>
          </div>
        </>
      );
    }

    const newDevices = rows.filter((r) => !r.device.existing_item_id);
    const selectedCount = rows.filter((r) => r.action !== "skip").length;

    return (
      <>
        <div className="wizard-header">
          <h2>🔍 Network Discovery</h2>
          <p>
            Found {scanResult?.devices_found ?? rows.length} device
            {rows.length !== 1 ? "s" : ""} on {scanResult?.subnet_scanned}
          </p>
          {renderStepIndicator()}
        </div>
        <div className="wizard-body" style={{ padding: "0" }}>
          {importError && (
            <div
              style={{
                margin: "0.75rem 1.25rem 0",
                background: "var(--error-bg, #fef2f2)",
                border: "1px solid var(--error-border, #fecaca)",
                borderRadius: "8px",
                padding: "0.65rem 1rem",
                color: "var(--error-text, #b91c1c)",
                fontSize: "0.875rem",
              }}
            >
              ⚠️ {importError}
            </div>
          )}

          {/* Bulk select */}
          {newDevices.length > 0 && (
            <div
              style={{
                padding: "0.65rem 1.25rem",
                borderBottom: "1px solid var(--border-color, #e5e7eb)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.875rem",
              }}
            >
              <input
                type="checkbox"
                id="bulk-check"
                checked={allChecked}
                onChange={(e) => toggleAll(e.target.checked)}
              />
              <label htmlFor="bulk-check" style={{ cursor: "pointer" }}>
                Select all new devices
              </label>
            </div>
          )}

          {/* Device list */}
          <div style={{ maxHeight: "340px", overflowY: "auto" }}>
            {rows.length === 0 && (
              <p style={{ padding: "1.5rem", color: "var(--muted, #6b7280)", textAlign: "center" }}>
                No devices discovered.
              </p>
            )}
            {rows.map((row) => {
              const { device } = row;
              const isTracked = !!device.existing_item_id;
              const statusBadge = isTracked ? (
                <span style={{ fontSize: "0.75rem", background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: "12px" }}>
                  🔵 Already Tracked
                </span>
              ) : (
                <span style={{ fontSize: "0.75rem", background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "12px" }}>
                  🟢 New Device
                </span>
              );

              return (
                <div
                  key={device.ip}
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderBottom: "1px solid var(--border-color, #f3f4f6)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.25rem" }}>{getDeviceIcon(device.device_type_guess)}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{device.ip}</span>
                      {device.hostname && (
                        <span style={{ fontSize: "0.8rem", color: "var(--muted, #6b7280)", marginLeft: "0.4rem" }}>
                          ({device.hostname})
                        </span>
                      )}
                    </div>
                    {statusBadge}
                  </div>

                  {(device.manufacturer || device.device_type_guess) && (
                    <div style={{ fontSize: "0.8rem", color: "var(--muted, #6b7280)", paddingLeft: "1.75rem" }}>
                      {[device.manufacturer, device.device_type_guess].filter(Boolean).join(" · ")}
                    </div>
                  )}

                  {/* Action controls */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", paddingLeft: "1.75rem", flexWrap: "wrap" }}>
                    {!isTracked && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.875rem", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`action-${device.ip}`}
                          checked={row.action === "create"}
                          onChange={() => setRowAction(device.ip, "create")}
                        />
                        Add
                      </label>
                    )}
                    {isTracked && (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.875rem", cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`action-${device.ip}`}
                          checked={row.action === "update"}
                          onChange={() => setRowAction(device.ip, "update")}
                        />
                        Update ({device.existing_item_name})
                      </label>
                    )}
                    <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.875rem", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={`action-${device.ip}`}
                        checked={row.action === "skip"}
                        onChange={() => setRowAction(device.ip, "skip")}
                      />
                      Skip
                    </label>
                  </div>

                  {/* Device name + room selector — shown when adding or updating */}
                  {row.action !== "skip" && (
                    <div style={{ paddingLeft: "1.75rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {!isTracked && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <label
                            htmlFor={`name-${device.ip}`}
                            style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted, #6b7280)" }}
                          >
                            Device Name
                          </label>
                          <input
                            id={`name-${device.ip}`}
                            type="text"
                            value={row.customName}
                            onChange={(e) => setRowName(device.ip, e.target.value)}
                            style={{
                              fontSize: "0.875rem",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "4px",
                              border: "1px solid var(--border-color, #d1d5db)",
                              width: "100%",
                              boxSizing: "border-box",
                            }}
                            placeholder="Device name"
                          />
                        </div>
                      )}
                      {roomLocations.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                          <label
                            htmlFor={`room-${device.ip}`}
                            style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--muted, #6b7280)" }}
                          >
                            Assign to Room <span style={{ fontWeight: 400 }}>(optional)</span>
                          </label>
                          <select
                            id={`room-${device.ip}`}
                            value={row.roomLocationId || ""}
                            onChange={(e) => setRowRoom(device.ip, e.target.value || null)}
                            style={{
                              fontSize: "0.875rem",
                              padding: "0.4rem 0.6rem",
                              borderRadius: "4px",
                              border: "1px solid var(--border-color, #d1d5db)",
                              width: "100%",
                              boxSizing: "border-box",
                            }}
                          >
                            <option value="">— Primary location —</option>
                            {roomLocations.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.friendly_name || r.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="wizard-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn btn-secondary" onClick={onSkip} disabled={importing}>
            Skip
          </button>
          <button
            className="btn btn-primary"
            onClick={doImport}
            disabled={importing || selectedCount === 0}
          >
            {importing ? "Importing…" : `Import ${selectedCount > 0 ? `${selectedCount} ` : ""}Selected`}
          </button>
        </div>
      </>
    );
  }

  // ── Step 4: Done ──────────────────────────────────────────────────────────
  function renderStep4() {
    const r = importResult!;
    return (
      <>
        <div className="wizard-header">
          <h2>✅ Import Complete</h2>
          <p>Network discovery finished</p>
          {renderStepIndicator()}
        </div>
        <div className="wizard-body" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>🎉</div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "1.5rem",
              marginBottom: "1rem",
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Added", value: r.created, color: "#15803d", bg: "#dcfce7" },
              { label: "Updated", value: r.updated, color: "#1d4ed8", bg: "#dbeafe" },
              { label: "Skipped", value: r.skipped, color: "#6b7280", bg: "#f3f4f6" },
            ].map(({ label, value, color, bg }) => (
              <div
                key={label}
                style={{ textAlign: "center", background: bg, borderRadius: "10px", padding: "0.75rem 1.25rem" }}
              >
                <div style={{ fontSize: "1.75rem", fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: "0.8rem", color }}>{label}</div>
              </div>
            ))}
          </div>
          {r.errors.length > 0 && (
            <div
              style={{
                background: "var(--error-bg, #fef2f2)",
                border: "1px solid var(--error-border, #fecaca)",
                borderRadius: "8px",
                padding: "0.65rem 1rem",
                color: "var(--error-text, #b91c1c)",
                fontSize: "0.8rem",
                textAlign: "left",
                marginTop: "0.75rem",
              }}
            >
              {r.errors.map((e, i) => (
                <div key={i}>⚠️ {e}</div>
              ))}
            </div>
          )}
        </div>
        <div className="wizard-footer" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={onComplete}>
            Go to Inventory
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="wizard-overlay">
      <div className="wizard-card" style={{ maxWidth: "600px" }}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>
    </div>
  );
}
