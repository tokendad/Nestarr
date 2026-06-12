import React, { useState, useEffect } from "react";
import type { ConfigStatusResponse } from "../lib/api";
import { getConfigStatus, updateApiKeys, fetchLocalLLMModels } from "../lib/api";

/**
 * Admin settings for the local/OpenAI-compatible LLM provider (issue #560).
 * Lets an admin choose which provider answers AI requests: Google Gemini
 * (default) or a local OpenAI-compatible server (Ollama, vLLM, LM Studio, etc.).
 */
const LocalLLMSettings: React.FC = () => {
  const [configStatus, setConfigStatus] = useState<ConfigStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [providerType, setProviderType] = useState<string>("gemini");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  // Model list state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const status = await getConfigStatus();
      setConfigStatus(status);
      setProviderType(status.llm_provider_type || "gemini");
      setBaseUrl(status.llm_base_url || "");
      setModel(status.llm_model || "");
    } catch (err: any) {
      setError(err.message || "Failed to load LLM provider settings");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      // Save the base URL / API key first so the backend can use them
      await updateApiKeys({
        llm_base_url: baseUrl.trim() || null,
        ...(apiKey.trim() ? { llm_api_key: apiKey.trim() } : {}),
      });
      const result = await fetchLocalLLMModels();
      setAvailableModels(result.models);
      if (result.models.length === 0) {
        setModelsError("Connected, but the server reported no models.");
      }
    } catch (err: any) {
      setAvailableModels([]);
      setModelsError(err.message || "Failed to fetch model list");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    if (providerType === "openai_compat") {
      if (!baseUrl.trim()) {
        setError("Base URL is required for a local provider.");
        return;
      }
      if (!model.trim()) {
        setError("Model name is required for a local provider.");
        return;
      }
    }

    setSaving(true);
    try {
      await updateApiKeys({
        llm_provider_type: providerType,
        llm_base_url: baseUrl.trim() || null,
        llm_model: model.trim() || null,
        // Only send the API key if the admin typed one (blank keeps current)
        ...(apiKey.trim() ? { llm_api_key: apiKey.trim() } : {}),
      });
      setSuccess("LLM provider settings saved.");
      setEditing(false);
      setApiKey("");
      await loadStatus();
    } catch (err: any) {
      setError(err.message || "Failed to save LLM provider settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError(null);
    setModelsError(null);
    setAvailableModels([]);
    setProviderType(configStatus?.llm_provider_type || "gemini");
    setBaseUrl(configStatus?.llm_base_url || "");
    setModel(configStatus?.llm_model || "");
    setApiKey("");
  };

  if (loading) {
    return null;
  }

  const fromEnv = configStatus?.llm_from_env;
  const isLocalActive = configStatus?.llm_provider_type === "openai_compat" && configStatus?.llm_configured;

  return (
    <div style={{
      marginTop: "1rem",
      marginBottom: "1rem",
      padding: "1rem",
      border: "1px solid var(--border-subtle)",
      borderRadius: "0.5rem"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <strong>AI Provider Selection</strong>
        <span style={{
          fontSize: "0.75rem",
          color: isLocalActive ? "#2e7d32" : "var(--muted)",
          backgroundColor: isLocalActive ? "#e8f5e9" : "var(--bg-elevated-softer)",
          padding: "0.25rem 0.5rem",
          borderRadius: "4px"
        }}>
          Active: {isLocalActive ? `Local (${configStatus?.llm_model})` : "Google Gemini"}
          {fromEnv && " (via environment)"}
        </span>
      </div>

      {error && (
        <div style={{ fontSize: "0.8rem", color: "#d32f2f", marginBottom: "0.5rem" }}>{error}</div>
      )}
      {success && (
        <div style={{ fontSize: "0.8rem", color: "#2e7d32", marginBottom: "0.5rem" }}>{success}</div>
      )}

      {!editing ? (
        <div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 0.5rem 0" }}>
            Choose which provider answers AI requests: Google Gemini (cloud) or a local
            OpenAI-compatible server such as Ollama, vLLM, or LM Studio.
          </p>
          {isLocalActive && (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
              Server: <code>{configStatus?.llm_base_url}</code> · Model: <code>{configStatus?.llm_model}</code>
              {configStatus?.llm_api_key_masked && <> · API key: <code>{configStatus.llm_api_key_masked}</code></>}
            </div>
          )}
          {!fromEnv && (
            <button
              type="button"
              className="btn-outline"
              onClick={() => setEditing(true)}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
            >
              ✏️ {isLocalActive ? "Edit" : "Configure"} AI Provider
            </button>
          )}
          {fromEnv && (
            <small style={{ color: "var(--muted)", fontSize: "0.7rem", display: "block" }}>
              Configured via LLM_* environment variables (read-only)
            </small>
          )}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: "0.75rem" }}>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="llm-provider-type"
                checked={providerType !== "openai_compat"}
                onChange={() => setProviderType("gemini")}
                style={{ marginRight: "0.5rem" }}
              />
              Google Gemini (cloud)
            </label>
            <label style={{ display: "block", fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="radio"
                name="llm-provider-type"
                checked={providerType === "openai_compat"}
                onChange={() => setProviderType("openai_compat")}
                style={{ marginRight: "0.5rem" }}
              />
              Local / OpenAI-compatible (Ollama, vLLM, LM Studio…)
            </label>
          </div>

          {providerType === "openai_compat" && (
            <div style={{ marginLeft: "1.5rem", marginBottom: "0.75rem" }}>
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Base URL *
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://ollama:11434/v1"
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem", padding: "0.5rem" }}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  Model *
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {availableModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      style={{ flex: 1, padding: "0.5rem", fontSize: "0.85rem" }}
                    >
                      <option value="" disabled>-- Select a model --</option>
                      {model && !availableModels.includes(model) && (
                        <option value={model}>{model} (current — not in list)</option>
                      )}
                      {availableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="llama3.2-vision"
                      style={{ flex: 1, fontFamily: "monospace", fontSize: "0.85rem", padding: "0.5rem" }}
                    />
                  )}
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={handleFetchModels}
                    disabled={modelsLoading || !baseUrl.trim()}
                    style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}
                  >
                    {modelsLoading ? "Fetching..." : "Fetch Models"}
                  </button>
                </div>
                {modelsError && (
                  <small style={{ color: "#e65100", fontSize: "0.7rem", display: "block", marginTop: "0.25rem" }}>
                    {modelsError}
                  </small>
                )}
                {availableModels.length > 0 && !modelsError && (
                  <small style={{ color: "#2e7d32", fontSize: "0.7rem", display: "block", marginTop: "0.25rem" }}>
                    ✓ Connected — {availableModels.length} models available
                  </small>
                )}
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                  API Key (optional)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configStatus?.llm_api_key_masked ? "Leave blank to keep current key" : "Leave blank for Ollama and most local servers"}
                  style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem", padding: "0.5rem" }}
                />
              </div>

              <div style={{
                padding: "0.5rem",
                backgroundColor: "var(--bg-elevated-softer)",
                borderRadius: "0.25rem",
                fontSize: "0.7rem",
                color: "var(--muted)"
              }}>
                <ul style={{ margin: 0, paddingLeft: "1rem" }}>
                  <li>Vision features (photo scanning) require a multimodal model such as <code>llama3.2-vision</code> or <code>qwen2.5vl</code>.</li>
                  <li>If this provider is unreachable, requests fall back to Gemini automatically (when configured).</li>
                  <li>Or set LLM_PROVIDER_TYPE, LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY in your .env file.</li>
                </ul>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
            >
              {saving ? "Saving..." : "Save AI Provider"}
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={handleCancel}
              disabled={saving}
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocalLLMSettings;
