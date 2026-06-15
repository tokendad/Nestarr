import React, { useState, useEffect, useCallback } from "react";
import { registerUser, getGoogleOAuthStatus, googleAuth, type UserCreate } from "../lib/api";

interface RegisterFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onCancel }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Callback for Google Sign-In response
  const handleGoogleCallback = useCallback(async (response: any) => {
    try {
      await googleAuth(response.credential);
      onSuccess();
    } catch (err: any) {
      // Check if it's an approval pending message
      if (err.message && err.message.includes("pending approval")) {
        setRegistrationComplete(true);
        setGoogleLoading(false);
      } else {
        setError(err.message || "Google registration failed");
        setGoogleLoading(false);
      }
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
            };
            document.body.appendChild(script);
          } else {
            setGoogleScriptLoaded(true);
          }
        }
      })
      .catch(() => setGoogleEnabled(false));
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

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      const userCreate: UserCreate = {
        email,
        password,
        full_name: fullName || null,
      };
      await registerUser(userCreate);
      // Registration successful - show pending approval message
      setRegistrationComplete(true);
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleRegister() {
    setError(null);
    setGoogleLoading(true);
    
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      setError("Google Sign-In not ready. Please try again.");
      setGoogleLoading(false);
      return;
    }

    google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setError("Google One Tap sign-in is unavailable. This is common in incognito mode or when third-party cookies are blocked. Please register with a username and password instead.");
        setGoogleLoading(false);
      }
    });
  }

  // Show success message after registration
  if (registrationComplete) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: "500px", textAlign: "center" }}>
          <h2 style={{ color: "#4ecdc4" }}>Registration Successful!</h2>
          <div style={{ margin: "1.5rem 0" }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4ecdc4" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <p style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>
            Your account has been created successfully.
          </p>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Your account is pending approval by an administrator. 
            You will be able to log in once your account has been approved.
          </p>
          <button className="btn-primary" onClick={onCancel}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "500px" }}>
        <h2>Register New Account</h2>
        {googleEnabled && googleScriptLoaded && (
          <>
            <button
              type="button"
              className="btn-google"
              onClick={handleGoogleRegister}
              disabled={googleLoading}
              style={{ width: "100%", marginBottom: "1rem" }}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {googleLoading ? "Registering..." : "Register with Google"}
            </button>
            <div className="login-divider" style={{ marginBottom: "1rem" }}>
              <span>or register with email</span>
            </div>
          </>
        )}
        <form onSubmit={handleSubmit} className="form-vertical">
          <div className="form-group">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="register-fullname">Full Name (optional)</label>
            <input
              id="register-fullname"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <input
              id="register-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn-outline" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Registering..." : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;
