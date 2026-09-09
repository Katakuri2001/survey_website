"use client";

import { useEffect, useState, useCallback } from "react";

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
  PROCESSING: "bg-yellow-100 text-yellow-800 border-yellow-300",
  SHIPPED: "bg-blue-100 text-blue-800 border-blue-300",
  DELIVERED: "bg-green-100 text-green-800 border-green-300",
  CANCELLED: "bg-red-100 text-red-800 border-red-300",
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

      const res = await fetch(`/admin/deliveries?${params}`);
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
    fetchDeliveries();
  }, [fetchDeliveries]);

  const updateStatus = async (id: string, status: DeliveryStatus) => {
    setUpdatingId(id);

    try {
      const res = await fetch(`/admin/deliveries/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Deliveries</h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 font-medium underline hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setOffset(0);
              }}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                statusFilter === tab.value
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-gray-500">
          {total} {total === 1 ? "delivery" : "deliveries"} found
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white py-16 text-center text-gray-500">
            No deliveries found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Reward
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Won At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Delivered At
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <tr key={delivery.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{delivery.user_name}</div>
                      <div className="text-xs text-gray-500">{delivery.user_email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{delivery.reward_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[delivery.delivery_status]}`}
                      >
                        {delivery.delivery_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(delivery.won_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(delivery.delivered_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setExpandedId(expandedId === delivery.id ? null : delivery.id)
                          }
                          className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          {expandedId === delivery.id ? "Hide" : "Details"}
                        </button>
                        {NEXT_STATUS_OPTIONS.filter((opt) => opt.value !== delivery.delivery_status).map(
                          (opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updateStatus(delivery.id, opt.value)}
                              disabled={updatingId === delivery.id}
                              className="rounded bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
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

            {deliveries.map((delivery) =>
              expandedId === delivery.id ? (
                <div
                  key={`detail-${delivery.id}`}
                  className="border-t border-gray-200 bg-gray-50 px-4 py-4"
                >
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Delivery Details</h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
                    <dt className="font-medium text-gray-500">Contact Name</dt>
                    <dd className="text-gray-900">{delivery.delivery_name}</dd>

                    <dt className="font-medium text-gray-500">Phone</dt>
                    <dd className="text-gray-900">{delivery.user_phone || delivery.delivery_phone}</dd>

                    <dt className="font-medium text-gray-500">Address</dt>
                    <dd className="text-gray-900">{delivery.address}</dd>

                    <dt className="font-medium text-gray-500">City</dt>
                    <dd className="text-gray-900">{delivery.city}</dd>

                    <dt className="font-medium text-gray-500">Township</dt>
                    <dd className="text-gray-900">{delivery.township}</dd>

                    <dt className="font-medium text-gray-500">Postal Code</dt>
                    <dd className="text-gray-900">{delivery.postal_code}</dd>
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
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {Math.floor(offset / limit) + 1} of {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
