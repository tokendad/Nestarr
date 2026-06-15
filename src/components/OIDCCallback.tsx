import React, { useEffect, useState } from "react";
import { oidcCallback } from "../lib/api";
import { APP_NAME } from "../lib/constants";

interface OIDCCallbackProps {
  onSuccess: (token: string, email: string) => void;
  onError: (error: string) => void;
}

const OIDCCallback: React.FC<OIDCCallbackProps> = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState("Processing login...");

  useEffect(() => {
    const processCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      
      // Get the redirect URI we used (base URL without search params)
      const redirectUri = window.location.origin + window.location.pathname;

      if (!code) {
        onError("No authorization code found in URL");
        return;
      }

      try {
        setStatus("Exchanging code for token...");
        const resp = await oidcCallback(code, redirectUri);
        
        // Decode token to get email if possible, or fetch user
        // We'll trust the token works for now, but we need email for UI
        // We can parse the JWT payload
        let email = "";
        try {
            const parts = resp.access_token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                // Try to find email in payload, though it might not be there depending on backend implementation
                // Backend creates token with sub=user_id. It doesn't put email in it by default.
                // But LoginForm expects email.
                // We might need to fetch user info immediately.
            }
        } catch (e) {
            console.warn("Failed to parse token payload", e);
        }

        // We can fetch the user details in App.tsx or pass empty email and let App.tsx fetch it.
        // App.tsx calls loadCurrentUser() which fetches /users/me.
        // So passing empty email is fine, App.tsx will update it.
        
        onSuccess(resp.access_token, email);
      } catch (err: any) {
        console.error("OIDC Callback Error:", err);
        onError(err.message || "Login failed");
      }
    };

    processCallback();
  }, [onSuccess, onError]);

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt={APP_NAME} className="login-logo" />
          <p className="muted">{status}</p>
        </div>
        <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    </div>
  );
};

export default OIDCCallback;
