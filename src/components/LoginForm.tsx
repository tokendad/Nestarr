import React, { useState, useEffect, useCallback } from "react";
import { login, getGoogleOAuthStatus, googleAuth, getRegistrationStatus, getOIDCStatus, getOIDCLoginUrl } from "../lib/api";
import { APP_NAME, STORAGE_KEYS } from "../lib/constants";

interface LoginFormProps {
  onSuccess: (token: string, email: string) => void;
  onRegisterClick?: () => void;
  onMustChangePassword?: () => void;  // Callback when user must change password
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onRegisterClick, onMustChangePassword }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [oidcEnabled, setOidcEnabled] = useState(false);
  const [oidcButtonText, setOidcButtonText] = useState("Sign in with OIDC");
  const [oidcLoading, setOidcLoading] = useState(false);

  // Callback for Google Sign-In response
  const handleGoogleCallback = useCallback(async (response: any) => {
    try {
      const authResp = await googleAuth(response.credential);
      // Token is now stored in HttpOnly cookie - no need to store in localStorage
      // Try to decode the JWT to get email, with fallback
      let userEmail = "";
      try {
        const parts = response.credential.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          userEmail = payload.email || "";
        }
      } catch {
        // If JWT parsing fails, we'll fetch user info from /users/me later
        console.warn("Could not parse email from Google credential");
      }
      localStorage.setItem(STORAGE_KEYS.USER_EMAIL, userEmail);
      // Token is stored in HttpOnly cookie, pass a truthy value to indicate authenticated state
      onSuccess("authenticated", userEmail);
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
      setGoogleLoading(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    // Check if Google OAuth is enabled
    getGoogleOAuthStatus()
      .then((status) => {
        setGoogleEnabled(status.enabled);
        if (status.enabled && status.client_id) {
          setGoogleClientId(status.client_id);
          // Load Google Identity Services script if not already loaded
          if (!(window as any).google?.accounts?.id) {
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            script.onload = () => setGoogleScriptLoaded(true);
            script.onerror = () => {
              setGoogleEnabled(false);
              setError("Failed to load Google Sign-In");
            };
            document.body.appendChild(script);
          } else {
            setGoogleScriptLoaded(true);
          }
        }
      })
      .catch(() => setGoogleEnabled(false));
    
    // Check if registration is enabled
    getRegistrationStatus()
      .then((status) => {
        setRegistrationEnabled(status.enabled);
      })
      .catch(() => {
        // Default to showing register button if check fails - backend still enforces the setting
        // This prevents locking users out from seeing the option due to network issues
        setRegistrationEnabled(true);
      });

    // Check if OIDC is enabled
    getOIDCStatus()
      .then((status) => {
        setOidcEnabled(status.enabled);
        if (status.enabled) {
          setOidcButtonText(status.button_text);
        }
      })
      .catch(() => setOidcEnabled(false));
  }, []);

  // Initialize Google Sign-In when script is loaded and client_id is available
  useEffect(() => {
    if (googleScriptLoaded && googleClientId) {
      const google = (window as any).google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCallback,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      }
    }
  }, [googleScriptLoaded, googleClientId, handleGoogleCallback]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPendingApproval(false);
    setLoading(true);
    try {
      const resp = await login(email, password);
      // Token is now stored in HttpOnly cookie - no need to store in localStorage
      localStorage.setItem(STORAGE_KEYS.USER_EMAIL, email);

      // Check if user must change password
      if (resp.must_change_password && onMustChangePassword) {
        onMustChangePassword();
        return;
      }

      // Token is stored in HttpOnly cookie, pass a truthy value to indicate authenticated state
      // The actual token value doesn't matter since it's in the cookie, but must be truthy
      onSuccess("authenticated", email);
    } catch (err: any) {
      if (err?.code === "PENDING_APPROVAL") {
        setPendingApproval(true);
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      setError("Google Sign-In not ready. Please try again.");
      setGoogleLoading(false);
      return;
    }

    // Prompt One Tap or redirect to Google Sign-In
    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap is unavailable — common causes: third-party cookies blocked (incognito/strict
        // browser settings), user dismissed the prompt before, or no active Google session.
        setError("Google One Tap sign-in is unavailable. This is common in incognito mode or when third-party cookies are blocked. Please sign in with your username and password instead.");
        setGoogleLoading(false);
      }
    });
  }

  async function handleOIDCLogin() {
    setError(null);
    setOidcLoading(true);
    try {
      // Get the current URL as the base for redirect URI
      // We want to redirect back to the same page, but the App component will handle the code
      const redirectUri = window.location.origin + window.location.pathname;
      const resp = await getOIDCLoginUrl(redirectUri);
      
      // Redirect to the authorization URL
      window.location.href = resp.authorization_url;
    } catch (err: any) {
      setError(err.message || "Failed to initialize OIDC login");
      setOidcLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt={APP_NAME} className="login-logo" />
          <p className="muted">Sign in to your home inventory</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="field">
            <span>Username or Email</span>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="username or user@example.com"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="error-banner">{error}</div>}
          {pendingApproval && (
            <div className="info-banner">
              ⏳ Your account is awaiting admin approval. You'll be able to sign in once an
              administrator reviews your registration.
            </div>
          )}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          {googleEnabled && googleScriptLoaded && (
            <>
              <div className="login-divider">
                <span>or</span>
              </div>
              <button
                type="button"
                className="btn-google"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
              >
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {googleLoading ? "Signing in..." : "Sign in with Google"}
              </button>
            </>
          )}
          {oidcEnabled && (
            <>
              {/* Only show divider if Google didn't already show it */}
              {!(googleEnabled && googleScriptLoaded) && (
                <div className="login-divider">
                  <span>or</span>
                </div>
              )}
              <button
                type="button"
                className="btn-outline"
                style={{ width: "100%", marginTop: googleEnabled && googleScriptLoaded ? "0.5rem" : "0" }}
                onClick={handleOIDCLogin}
                disabled={oidcLoading}
              >
                {oidcLoading ? "Redirecting..." : oidcButtonText}
              </button>
            </>
          )}
          {onRegisterClick && registrationEnabled && (
            <button
              type="button"
              className="btn-outline"
              onClick={onRegisterClick}
              style={{ marginTop: "0.5rem" }}
            >
              Register New Account
            </button>
          )}
        </form>
        <p className="login-footer">
          API: <code>{import.meta.env.VITE_API_BASE_URL || window.location.origin}</code>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
