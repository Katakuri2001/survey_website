"use client";

import { useEffect, useState, useCallback } from "react";
import { API_BASE, adminHeaders } from "../lib/api";

type DeliveryStatus = "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface Delivery {
  id: string;
  delivery_status: DeliveryStatus;
  won_at: string;
  delivered_at: string | null;
  user_name: string;
  user_email: string;
  user_phone: string;
  reward_name: string;
  delivery_name: string;
  delivery_phone: string;
  address: string;
  city: string;
  township: string;
  postal_code: string;
}

interface DeliveriesResponse {
  deliveries: Delivery[];
  total: number;
}

const STATUS_TABS: { label: string; value: DeliveryStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const STATUS_STYLES: Record<DeliveryStatus, string> = {
  PROCESSING: "bg-amber-50 text-amber-700 ring-amber-200",
  SHIPPED: "bg-gold/10 text-gold-700 ring-gold-300",
  DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
};

const NEXT_STATUS_OPTIONS: { label: string; value: DeliveryStatus }[] = [
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "">("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const limit = 50;

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`${API_BASE}/admin/deliveries?${params}`, { headers: adminHeaders() });
      if (!res.ok) throw new Error("Failed to fetch deliveries");

      const data: DeliveriesResponse = await res.json();
      setDeliveries(data.deliveries);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDeliveries();
  }, [fetchDeliveries]);

  const updateStatus = async (id: string, status: DeliveryStatus) => {
    setUpdatingId(id);

    try {
      const res = await fetch(`${API_BASE}/admin/deliveries/${id}/status`, {
        method: "PATCH",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      setDeliveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, delivery_status: status } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update delivery status");
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (date: string | null) => (date ? new Date(date).toLocaleDateString() : "—");

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-ink">Deliveries</h1>
          <p className="mt-1 text-sm text-slate-500">Track reward shipments from order to doorstep</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 font-semibold underline hover:text-rose-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setOffset(0);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                statusFilter === tab.value
                  ? "bg-forest text-white shadow-forest"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-slate-500">
          {total} {total === 1 ? "delivery" : "deliveries"} found
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-gold" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="card py-16 text-center text-slate-500">
            No deliveries found.
          </div>
        ) : (
          <div className="card overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Reward
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Won At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Delivered At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-ink">{delivery.user_name}</div>
                        <div className="text-xs text-slate-500">{delivery.user_email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{delivery.reward_name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[delivery.delivery_status]}`}
                        >
                          {delivery.delivery_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(delivery.won_at)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(delivery.delivered_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              setExpandedId(expandedId === delivery.id ? null : delivery.id)
                            }
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            {expandedId === delivery.id ? "Hide" : "Details"}
                          </button>
                          {NEXT_STATUS_OPTIONS.filter((opt) => opt.value !== delivery.delivery_status).map(
                            (opt) => (
                              <button
                                key={opt.value}
                                onClick={() => updateStatus(delivery.id, opt.value)}
                                disabled={updatingId === delivery.id}
                                className="rounded-lg bg-forest px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-forest-600 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {opt.label}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {deliveries.map((delivery) =>
              expandedId === delivery.id ? (
                <div
                  key={`detail-${delivery.id}`}
                  className="border-t border-slate-200 bg-surface-alt px-4 py-4"
                >
                  <h3 className="font-display mb-2 text-sm font-semibold text-ink">Delivery Details</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
                    <dt className="font-medium text-slate-500">Contact Name</dt>
                    <dd className="text-ink">{delivery.delivery_name}</dd>

                    <dt className="font-medium text-slate-500">Phone</dt>
                    <dd className="text-ink">{delivery.user_phone || delivery.delivery_phone}</dd>

                    <dt className="font-medium text-slate-500">Address</dt>
                    <dd className="text-ink">{delivery.address}</dd>

                    <dt className="font-medium text-slate-500">City</dt>
                    <dd className="text-ink">{delivery.city}</dd>

                    <dt className="font-medium text-slate-500">Township</dt>
                    <dd className="text-ink">{delivery.township}</dd>

                    <dt className="font-medium text-slate-500">Postal Code</dt>
                    <dd className="text-ink">{delivery.postal_code}</dd>
                  </dl>
                </div>
              ) : null
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600">
              Page {Math.floor(offset / limit) + 1} of {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}