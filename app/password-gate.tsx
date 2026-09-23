"use client";

import { FormEvent, useState } from "react";

export function PasswordGate() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsChecking(true);

    try {
      const response = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error("That password did not match.");
      }

      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock the list.");
      setIsChecking(false);
    }
  }

  return (
    <main className="password-shell">
      <section className="password-card" aria-labelledby="password-title">
        <div className="password-brand" aria-hidden="true">K</div>
        <p className="eyebrow">Kurz family</p>
        <h1 id="password-title">The family list</h1>
        <p className="password-copy">
          Enter the family password to see tasks and make updates.
        </p>

        <form onSubmit={unlock}>
          <label htmlFor="family-password">Password</label>
          <input
            autoComplete="current-password"
            autoFocus
            id="family-password"
            inputMode="numeric"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Family password"
            type="password"
            value={password}
          />
          {error ? <p className="password-error" role="alert">{error}</p> : null}
          <button className="primary-action" disabled={isChecking} type="submit">
            {isChecking ? "Opening..." : "Open the list"}
          </button>
        </form>
      </section>
    </main>
  );
}
