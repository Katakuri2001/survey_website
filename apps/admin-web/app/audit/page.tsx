"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE, adminHeaders } from "../lib/api";

interface LogEntry {
  id: string;
  timestamp: string;
  action: string;
  source: "ADMIN" | "USER";
  admin_email: string | null;
  user_email: string | null;
  details: string;
}

interface AuditLogsResponse {
  logs: LogEntry[];
  total: number;
}

const MAX_LIMIT = 50;

const ACTION_STYLES: Record<string, string> = {
  VIEW: "bg-gold/10 text-gold-700 ring-gold-300",
  LOGIN: "bg-sky-50 text-sky-700 ring-sky-200",
  ADD: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  UPDATE: "bg-amber-50 text-amber-700 ring-amber-200",
  DELETE: "bg-rose-50 text-rose-700 ring-rose-200",
  MODERATE: "bg-gold/10 text-gold-700 ring-gold-300",
  DOWNLOAD: "bg-slate-100 text-slate-600 ring-slate-200",
};

const SOURCES = ["ALL", "ADMIN", "USER"];
const ACTIONS = ["ALL", "VIEW", "LOGIN", "ADD", "UPDATE", "DELETE", "MODERATE", "DOWNLOAD"];

const FILTER_BUTTON = (active: boolean) => {
  return active
    ? "bg-forest text-white shadow-forest shadow-sm"
    : "text-slate-600 hover:bg-slate-100";
};

export default function AuditPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterSource, setFilterSource] = useState("ALL");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [offset, setOffset] = useState(0);
  const [rawModalItem, setRawModalItem] = useState<LogEntry | null>(null);
  const [userModalItem, setUserModalItem] = useState<LogEntry | null>(null);
  const [tab, setTab] = useState<"raw" | "parsed">("raw");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const actualLimit = Math.min(MAX_LIMIT, 50);

    const params = new URLSearchParams({
      limit: String(actualLimit),
      offset: String(offset),
    });

    if (filterSource !== "ALL") params.set("source", filterSource);
    if (filterAction !== "ALL") params.set("action", filterAction);
    if (filterStatus !== "ALL") params.set("status", filterStatus);
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    try {
      const res = await fetch(`${API_BASE}/admin/audit-logs?${params}`, {
        headers: adminHeaders(),
      });

      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const data: { success: boolean; data: AuditLogsResponse } = await res.json();
      setLogs(data.data.logs);
      setTotal(data.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [filterSource, filterAction, filterStatus, startDate, endDate, offset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / MAX_LIMIT);
  const formatDate = (timestamp: string) => new Date(timestamp).toLocaleString();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/10 ring-1 ring-gold/40">
          <svg className="h-6 w-6 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-500">Complete audit trail of all platform activity</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Source
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((source) => (
              <button
                key={source}
                onClick={() => {
                  setFilterSource(source);
                  setOffset(0);
                }}
                className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${FILTER_BUTTON(filterSource === source)}`}
              >
                {source}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Action
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((action) => (
              <button
                key={action}
                onClick={() => {
                  setFilterAction(action);
                  setOffset(0);
                }}
                className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${FILTER_BUTTON(filterAction === action)}`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Status
          </label>
          <div className="flex flex-wrap gap-1.5">
            {["ALL", "SUCCESS", "FAILED"].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setFilterStatus(status);
                  setOffset(0);
                }}
                className={`rounded-lg px-2.5 py-1 text-sm font-medium transition ${FILTER_BUTTON(filterStatus === status)}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold-400/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setOffset(0);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold-400/30"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setFilterSource("ALL");
              setFilterAction("ALL");
              setFilterStatus("ALL");
              setStartDate("");
              setEndDate("");
              setOffset(0);
            }}
            className="btn-outline"
          >
            Reset
          </button>
          <button
            onClick={() => fetchLogs()}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-medium text-white shadow-forest transition-colors hover:bg-forest-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 font-semibold underline hover:text-rose-900">
            Dismiss
          </button>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-slate-500">
        {total} {total === 1 ? "entry" : "entries"} found
      </p>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-gold" />
        </div>
      )}

      {/* Empty */}
      {!loading && !error && logs.length === 0 && (
        <div className="card py-16 text-center text-slate-500">
          No audit logs match your filters.
        </div>
      )}

      {/* Table */}
      {!loading && !error && logs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Details</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(log.timestamp)}</td>

                    <td className="px-4 py-3">
                      {log.admin_email ? (
                        <button
                          onClick={() => setUserModalItem(log)}
                          className="inline-flex items-center gap-2 font-medium text-ink hover:text-gold-700"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40">
                            <span className="text-xs font-semibold text-gold-600">
                              {log.admin_email.charAt(0).toUpperCase()}
                            </span>
                          </span>
                          <span className="truncate">{log.admin_email}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {log.user_email ? (
                        <button
                          onClick={() => setUserModalItem(log)}
                          className="inline-flex items-center gap-2 font-medium text-ink hover:text-gold-700"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40">
                            <span className="text-xs font-semibold text-gold-600">
                              {log.user_email.charAt(0).toUpperCase()}
                            </span>
                          </span>
                          <span className="truncate">{log.user_email}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          log.source === "ADMIN" ? "bg-forest-50 text-forest-700 ring-forest-200" : "bg-sky-50 text-sky-700 ring-sky-200"
                        }`}
                      >
                        {log.source}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          ACTION_STYLES[log.action] || "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="max-w-[200px] truncate text-slate-600">{log.details}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          log.details?.toLowerCase().includes("fail")
                            ? "bg-rose-50 text-rose-700 ring-rose-200"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        }`}
                      >
                        {log.details?.toLowerCase().includes("fail") ? "FAILED" : "SUCCESS"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setRawModalItem(log);
                            setTab("parsed");
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          onClick={() => {
                            setRawModalItem(log);
                            setTab("raw");
                          }}
                          className="rounded-lg bg-forest px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-forest-600"
                        >
                          Raw
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - MAX_LIMIT))}
            disabled={offset === 0}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {Math.floor(offset / MAX_LIMIT) + 1} of {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + MAX_LIMIT)}
            disabled={offset + MAX_LIMIT >= total}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {/* View/Raw Modal */}
      {rawModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRawModalItem(null)} />
          <div className="relative w-full max-w-3xl animate-fade-up overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">Log Details</h2>
              <button
                onClick={() => setRawModalItem(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <div className="mb-4 flex border-b border-slate-200">
                {(["parsed", "raw"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                      tab === t ? "border-gold-500 text-gold-600" : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {t === "parsed" ? "Parsed" : "Raw JSON"}
                  </button>
                ))}
              </div>

              {tab === "parsed" ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Log ID</p>
                    <p className="mt-0.5 font-mono text-xs text-ink">{rawModalItem.id}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Timestamp</p>
                    <p className="mt-0.5 text-ink">{formatDate(rawModalItem.timestamp)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source</p>
                    <p className="mt-0.5 text-ink">{rawModalItem.source}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Action</p>
                    <p className="mt-0.5 text-ink">{rawModalItem.action}</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
                    <p className="mt-0.5 break-words text-ink">{rawModalItem.details}</p>
                  </div>
                </div>
              ) : (
                <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-100">
                  {JSON.stringify(rawModalItem, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Modal */}
      {userModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setUserModalItem(null)} />
          <div className="relative w-full max-w-md animate-fade-up overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">User Information</h2>
              <button
                onClick={() => setUserModalItem(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-6">
              {userModalItem.admin_email && (
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 ring-2 ring-gold/60">
                    <span className="font-display text-lg font-bold text-gold-600">
                      {userModalItem.admin_email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">Administrator</p>
                    <p className="text-sm text-slate-500">{userModalItem.admin_email}</p>
                  </div>
                </div>
              )}
              {userModalItem.user_email && (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/10 ring-2 ring-gold/60">
                    <span className="font-display text-lg font-bold text-gold-600">
                      {userModalItem.user_email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">User</p>
                    <p className="text-sm text-slate-500">{userModalItem.user_email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}