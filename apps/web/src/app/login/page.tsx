"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login({ email, password });
      setToken(res.token);
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box card">
        <h1>SK Mobile Shop</h1>
        <p style={{ color: "var(--muted)" }}>Sign in to your dashboard</p>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
          Default: owner@skmobile.local — check SEED_PASSWORD in apps/api/.env
        </p>
        <form onSubmit={handleSubmit} style={{ marginTop: "1.5rem" }}>
          <label className="stat-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <label className="stat-label" style={{ marginTop: "1rem" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", marginTop: "1.25rem" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
