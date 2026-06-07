import React, { useState, useEffect } from "react";
import { api, type UserProfile } from "../services/api";
import { Mail, Server, ShieldCheck, KeyRound, X, Check, AlertTriangle, RefreshCw } from "lucide-react";

interface IMAPSettingsProps {
  onClose: () => void;
  onSave: () => void;
}

export const IMAPSettings: React.FC<IMAPSettingsProps> = ({ onClose, onSave }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Form state
  const [imapEnabled, setImapEnabled] = useState(false);
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState(993);
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    // Fetch user profile on mount
    api.getProfile()
      .then((data) => {
        setProfile(data);
        setImapEnabled(data.imapEnabled);
        setImapHost(data.imapHost || "imap.gmail.com");
        setImapPort(data.imapPort || 993);
        setImapUser(data.imapUser || data.email);
        setLoading(false);
      })
      .catch((err) => {
        setFeedback({ type: "error", msg: err.message || "Failed to load user profile" });
        setLoading(false);
      });
  }, []);

  const handleTestConnection = async () => {
    setFeedback(null);
    setTesting(true);
    try {
      const payload: any = {
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort),
        imapUser: imapUser.trim()
      };
      
      if (imapPassword.trim() !== "") {
        payload.imapPassword = imapPassword;
      }

      const res = await api.testImap(payload);
      if (res.ok) {
        setFeedback({ type: "success", msg: "IMAP Connection Successful! ✓" });
      } else {
        setFeedback({ type: "error", msg: res.message || "Connection failed. Please double check settings." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to connect to IMAP server." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSaving(true);

    try {
      const payload: any = {
        imapEnabled,
        imapHost: imapHost.trim(),
        imapPort: Number(imapPort),
        imapUser: imapUser.trim()
      };

      if (imapPassword.trim() !== "") {
        payload.imapPassword = imapPassword;
      }

      await api.updateProfile(payload);
      setFeedback({ type: "success", msg: "Settings saved successfully! ✓" });
      setTimeout(() => {
        onSave();
        onClose();
      }, 1200);
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message || "Failed to save configurations" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ display: "flex", justifyContent: "center", padding: "40px" }}>
          <RefreshCw className="animate-spin" style={{ color: "rgba(55, 53, 47, 0.4)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
        <div className="modal-header">
          <h3>Email Integration Settings</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: "12px", color: "rgba(55, 53, 47, 0.6)", marginBottom: "20px", lineHeight: "1.5" }}>
          <p>
            Configure your IMAP settings to automatically track and synchronize job applications directly from confirmation and interview emails.
          </p>
          <p style={{ marginTop: "8px", fontWeight: 500, color: "rgba(55, 53, 47, 0.8)" }}>
            ⚠️ Gmail/Outlook users: You must generate and enter an <strong>App Password</strong> from your Google/Microsoft account settings. Do not use your primary password.
          </p>
        </div>

        {feedback && (
          <div className={`feedback-msg ${feedback.type}`} style={{ marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
            {feedback.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
            <span style={{ fontSize: "13px" }}>{feedback.msg}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="field" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 0", borderBottom: "1px solid rgba(55, 53, 47, 0.06)", marginBottom: "15px" }}>
            <label htmlFor="imapEnabled" style={{ fontWeight: 600, display: "flex", flexDirection: "column", gap: "2px", cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ShieldCheck size={14} style={{ color: imapEnabled ? "#2b6e4c" : "inherit" }} />
                Enable Automated Email Sync
              </span>
              <span style={{ fontSize: "11px", fontWeight: 400, color: "rgba(55, 53, 47, 0.5)" }}>
                Run background checks every 10 minutes
              </span>
            </label>
            <input
              type="checkbox"
              id="imapEnabled"
              checked={imapEnabled}
              onChange={(e) => setImapEnabled(e.target.checked)}
              style={{ width: "18px", height: "18px", cursor: "pointer" }}
            />
          </div>

          <div className="field">
            <label htmlFor="imapHost" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Server size={12} />
              IMAP Server Host
            </label>
            <input
              type="text"
              id="imapHost"
              value={imapHost}
              onChange={(e) => setImapHost(e.target.value)}
              placeholder="e.g. imap.gmail.com"
              required={imapEnabled}
              disabled={!imapEnabled}
            />
          </div>

          <div className="field">
            <label htmlFor="imapPort" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Server size={12} />
              IMAP Port
            </label>
            <input
              type="number"
              id="imapPort"
              value={imapPort}
              onChange={(e) => setImapPort(Number(e.target.value))}
              placeholder="e.g. 993"
              required={imapEnabled}
              disabled={!imapEnabled}
            />
          </div>

          <div className="field">
            <label htmlFor="imapUser" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Mail size={12} />
              IMAP Username (Email Address)
            </label>
            <input
              type="email"
              id="imapUser"
              value={imapUser}
              onChange={(e) => setImapUser(e.target.value)}
              placeholder="yourname@gmail.com"
              required={imapEnabled}
              disabled={!imapEnabled}
            />
          </div>

          <div className="field">
            <label htmlFor="imapPassword" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <KeyRound size={12} />
              App Password
            </label>
            <input
              type="password"
              id="imapPassword"
              value={imapPassword}
              onChange={(e) => setImapPassword(e.target.value)}
              placeholder={profile?.hasImapPassword ? "•••••••• (Password Saved)" : "Enter 16-character App Password"}
              required={imapEnabled && !profile?.hasImapPassword}
              disabled={!imapEnabled}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={testing || saving || !imapEnabled}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
            
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={saving || testing}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || testing}
              >
                {saving ? "Saving..." : "Save Config"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
