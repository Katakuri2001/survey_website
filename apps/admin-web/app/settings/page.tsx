"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, adminHeaders } from "../lib/api";

export default function AccountSettingsPage() {
  const router = useRouter();

  const [admin, setAdmin] = useState<{ full_name: string; email: string; created_at: string } | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/login");
      return;
    }
    fetch(`${API_BASE}/admin/account`, {
      headers: adminHeaders(),
    })
      .then((res) => {
        if (res.status === 401) {
          localStorage.removeItem("admin_token");
          router.replace("/login");
          throw new Error("Unauthorized");
        }
        return res.json();
      })
      .then((data) => {
        if (data.success) setAdmin(data.data.user);
        else setMessage({ type: "error", text: data.error?.message || "Failed to load account" });
      })
      .catch(() => {
        /* handled by redirect above */
      })
      .finally(() => setLoadingAccount(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setLoggedOut(true);
    router.replace("/login");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "New password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New password and confirmation do not match" });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/account/password`, {
        method: "PATCH",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Password updated successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to update password" });
      }
    } catch {
      setMessage({ type: "error", text: "Connection failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {message && (
        <div
          className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={message.type === "success" ? "M5 13l4 4L19 7" : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"}
            />
          </svg>
          {message.text}
        </div>
      )}

      {/* Profile card */}
      <div className="card rounded-2xl p-6 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <svg className="h-5 w-5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Signed in account
        </h2>
        {loadingAccount ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : admin ? (
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-lg font-bold text-warm ring-2 ring-gold/70">
              {(admin.full_name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{admin.full_name}</p>
              <p className="truncate text-sm text-slate-500">{admin.email}</p>
              {admin.created_at && (
                <p className="mt-0.5 text-xs text-slate-400">
                  Admin since {new Date(admin.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Account details unavailable.</p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={handleLogout} disabled={loggedOut} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50">
            {loggedOut ? "Signing out…" : "Log out"}
          </button>
          <p className="self-center text-xs text-slate-400">
            Log out to sign in to a different admin account.
          </p>
        </div>
      </div>

      {/* Change password card */}
      <div className="card rounded-2xl p-6 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <svg className="h-5 w-5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Change password
        </h2>

        <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
          <div>
            <label htmlFor="currentPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input"
              placeholder="Enter current password"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-gold px-5 py-2.5 shadow-gold disabled:opacity-50">
            {saving ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}