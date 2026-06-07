import React, { useState } from "react";
import { api } from "../services/api";
import { Compass, Mail, Lock } from "lucide-react";

interface AuthPageProps {
  onAuthSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await api.login(email, password);
        onAuthSuccess();
      } else {
        await api.register(email, password);
        // Automatically log in after successful registration
        await api.login(email, password);
        onAuthSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <span className="logo-icon" style={{ justifyContent: "center" }}>
            <Compass size={36} />
          </span>
          <h2>{isLogin ? "Log in to DevBoard" : "Create your account"}</h2>
          <p>{isLogin ? "Enter your credentials below" : "Sign up to start tracking job postings"}</p>
        </div>

        {error && <div className="feedback-msg error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Mail size={12} />
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Lock size={12} />
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "8px" }} disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Sign In" : "Register"}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? (
            <>
              New to DevBoard?{" "}
              <span onClick={() => { setIsLogin(false); setError(null); }}>Create an account</span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span onClick={() => { setIsLogin(true); setError(null); }}>Sign in</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
