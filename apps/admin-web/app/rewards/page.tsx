"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, adminHeaders } from "../lib/api";

type Reward = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  total_quantity: number;
  remaining_quantity: number;
  weight: number;
  is_active: boolean;
  status: string;
  low_stock_threshold: number;
  rewarded_count: number;
  delivered_count: number;
};

type InventoryReward = {
  id: string;
  name: string;
  total_quantity: number;
  remaining_quantity: number;
  status: string;
  low_stock_threshold: number;
  rewarded_count: number;
  delivered_count: number;
  pending_count: number;
  utilization_rate: number;
};

type InventorySummary = {
  total_stock: number;
  total_rewarded: number;
  total_remaining: number;
  total_delivered: number;
  total_pending: number;
};

type HistoryEntry = {
  id: string;
  delivery_status: string;
  won_at: string;
  delivered_at: string | null;
  user_name: string;
  user_email: string;
  reward_name: string;
  product_name: string;
};

type RewardForm = {
  name: string;
  nameMy: string;
  description: string;
  descriptionMy: string;
  imageUrl: string;
  totalQuantity: number;
  weight: number;
  lowStockThreshold: number;
  campaignId: string;
  isActive: boolean;
  status: string;
};

type Tab = "rewards" | "inventory" | "history";

const defaultForm: RewardForm = {
  name: "",
  nameMy: "",
  description: "",
  descriptionMy: "",
  imageUrl: "",
  totalQuantity: 1,
  weight: 1,
  lowStockThreshold: 5,
  campaignId: "",
  isActive: true,
  status: "active",
};

export default function RewardsPage() {
  const [tab, setTab] = useState<Tab>("rewards");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [inventory, setInventory] = useState<InventoryReward[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [form, setForm] = useState<RewardForm>(defaultForm);
  const [saving, setSaving] = useState(false);

  const [adjustModal, setAdjustModal] = useState<{ open: boolean; reward: Reward | null }>({
    open: false,
    reward: null,
  });
  const [adjustment, setAdjustment] = useState(0);
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const historyLimit = 50;

  const fetchRewards = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/rewards`, { headers: adminHeaders() });
    if (!res.ok) throw new Error("Failed to fetch rewards");
    return res.json();
  }, []);

  const fetchInventory = useCallback(async () => {
    const res = await fetch(`${API_BASE}/admin/rewards/inventory`, { headers: adminHeaders() });
    if (!res.ok) throw new Error("Failed to fetch inventory");
    return res.json();
  }, []);

  const fetchHistory = useCallback(async (offset: number) => {
    const res = await fetch(`${API_BASE}/admin/rewards/history?limit=${historyLimit}&offset=${offset}`, { headers: adminHeaders() });
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "rewards") {
        const data = await fetchRewards();
        setRewards(data);
      } else if (tab === "inventory") {
        const data = await fetchInventory();
        setInventory(data.rewards);
        setInventorySummary(data.summary);
      } else {
        const data = await fetchHistory(historyOffset);
        setHistory(data.history);
        setHistoryTotal(data.total);
      }
    } catch {
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tab, historyOffset, fetchRewards, fetchInventory, fetchHistory]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const openAddModal = () => {
    setEditingReward(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward);
    setForm({
      name: reward.name,
      nameMy: "",
      description: reward.description,
      descriptionMy: "",
      imageUrl: reward.image_url,
      totalQuantity: reward.total_quantity,
      weight: reward.weight,
      lowStockThreshold: reward.low_stock_threshold,
      campaignId: "",
      isActive: reward.is_active,
      status: reward.status,
    });
    setShowModal(true);
  };

  const saveReward = async () => {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        imageUrl: form.imageUrl,
        totalQuantity: form.totalQuantity,
        weight: form.weight,
        lowStockThreshold: form.lowStockThreshold,
        translations: {
          en: { name: form.name, description: form.description },
          my: { name: form.nameMy, description: form.descriptionMy },
        },
      };
      if (form.campaignId) body.campaignId = form.campaignId;

      const method = editingReward ? "PATCH" : "POST";
      const url = editingReward ? `${API_BASE}/admin/rewards/${editingReward.id}` : `${API_BASE}/admin/rewards`;

      if (editingReward) {
        body.isActive = form.isActive;
        body.status = form.status;
      }

      const res = await fetch(url, {
        method,
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save reward");
      setShowModal(false);
      loadData();
    } catch {
      setError("Failed to save reward. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const openAdjustModal = (reward: Reward) => {
    setAdjustModal({ open: true, reward });
    setAdjustment(0);
    setReason("");
  };

  const saveStockAdjustment = async () => {
    if (!adjustModal.reward) return;
    setAdjusting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/admin/rewards/${adjustModal.reward.id}/stock`, {
        method: "PATCH",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ adjustment, reason }),
      });
      if (!res.ok) throw new Error("Failed to adjust stock");
      setAdjustModal({ open: false, reward: null });
      loadData();
    } catch {
      setError("Failed to adjust stock. Please try again.");
    } finally {
      setAdjusting(false);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      inactive: "bg-slate-100 text-slate-600 ring-slate-200",
      archived: "bg-rose-50 text-rose-700 ring-rose-200",
    };
    return (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${colors[status] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>
        {status}
      </span>
    );
  };

  const deliveryBadge = (status: string) => {
    const colors: Record<string, string> = {
      delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      pending: "bg-amber-50 text-amber-700 ring-amber-200",
      failed: "bg-rose-50 text-rose-700 ring-rose-200",
    };
    return (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${colors[status] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>
        {status}
      </span>
    );
  };

  const lowStockIndicator = (reward: InventoryReward) => {
    if (reward.remaining_quantity <= reward.low_stock_threshold) {
      return (
        <span className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
          Low Stock
        </span>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Rewards Management</h1>
            <p className="mt-1 text-sm text-slate-500">Gifts, inventory and delivery history</p>
          </div>
          {tab === "rewards" && (
            <button onClick={openAddModal} className="btn-gold shadow-gold">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Reward
            </button>
          )}
        </div>

        <div className="mb-6 border-b border-slate-200">
          <nav className="flex gap-6">
            {(["rewards", "inventory", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === "history") setHistoryOffset(0);
                }}
                className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? "border-gold-500 text-gold-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
            <button onClick={() => setError("")} className="ml-4 font-semibold underline">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gold" />
          </div>
        ) : (
          <>
            {tab === "rewards" && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Weight</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stats</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rewards.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {r.image_url && (
                                <>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />
                                </>
                              )}

                              <div>
                                <div className="text-sm font-medium text-ink">{r.name}</div>
                                <div className="line-clamp-1 text-xs text-slate-500">{r.description}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {r.remaining_quantity} / {r.total_quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{r.weight}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {statusBadge(r.status)}
                              {!r.is_active && <span className="text-xs text-slate-400">(disabled)</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            Rewarded: {r.rewarded_count} | Delivered: {r.delivered_count}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditModal(r)}
                                className="text-sm font-semibold text-gold-600 hover:text-gold-700"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => openAdjustModal(r)}
                                className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                              >
                                Adjust
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {rewards.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            No rewards found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "inventory" && (
              <>
                {inventorySummary && (
                  <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      { label: "Total Stock", value: inventorySummary.total_stock },
                      { label: "Total Rewarded", value: inventorySummary.total_rewarded },
                      { label: "Total Remaining", value: inventorySummary.total_remaining },
                      { label: "Total Delivered", value: inventorySummary.total_delivered },
                      { label: "Total Pending", value: inventorySummary.total_pending },
                    ].map((item) => (
                      <div key={item.label} className="card p-4">
                        <div className="text-sm text-slate-500">{item.label}</div>
                        <div className="font-display text-2xl font-bold text-ink">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Remaining</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Threshold</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rewarded</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Utilization</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inventory.map((r) => (
                          <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                            <td className="px-6 py-4 text-sm font-medium text-ink">{r.name}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{r.total_quantity}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{r.remaining_quantity}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                {statusBadge(r.status)}
                                {lowStockIndicator(r)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-700">{r.low_stock_threshold}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{r.rewarded_count}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{r.delivered_count}</td>
                            <td className="px-6 py-4 text-sm text-slate-700">{r.pending_count}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gold-600">{(r.utilization_rate * 100).toFixed(1)}%</td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => {
                                  const reward = rewards.find((rew) => rew.id === r.id);
                                  if (reward) openAdjustModal(reward);
                                }}
                                className="text-sm font-semibold text-amber-600 hover:text-amber-700"
                              >
                                Adjust
                              </button>
                            </td>
                          </tr>
                        ))}
                        {inventory.length === 0 && (
                          <tr>
                            <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                              No inventory data found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {tab === "history" && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Won At</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((h) => (
                        <tr key={h.id} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-ink">{h.user_name}</div>
                            <div className="text-xs text-slate-500">{h.user_email}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{h.reward_name}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">{h.product_name || "-"}</td>
                          <td className="px-6 py-4">{deliveryBadge(h.delivery_status)}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {new Date(h.won_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">
                            {h.delivered_at ? new Date(h.delivered_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                            No history found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {historyTotal > historyLimit && (
                  <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
                    <span className="text-sm text-slate-500">
                      Showing {historyOffset + 1}–{Math.min(historyOffset + historyLimit, historyTotal)} of {historyTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={historyOffset === 0}
                        onClick={() => setHistoryOffset(Math.max(0, historyOffset - historyLimit))}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        disabled={historyOffset + historyLimit >= historyTotal}
                        onClick={() => setHistoryOffset(historyOffset + historyLimit)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl max-h-[90vh]">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {editingReward ? "Edit Reward" : "Add Reward"}
                </h2>
              </div>
              <div className="space-y-4 px-6 py-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name (English) *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name (Myanmar)</label>
                  <input
                    type="text"
                    value={form.nameMy}
                    onChange={(e) => setForm({ ...form, nameMy: e.target.value })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description (English)</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="input resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description (Myanmar)</label>
                  <textarea
                    value={form.descriptionMy}
                    onChange={(e) => setForm({ ...form, descriptionMy: e.target.value })}
                    rows={3}
                    className="input resize-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Image URL</label>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="input"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Total Quantity *</label>
                    <input
                      type="number"
                      min={0}
                      value={form.totalQuantity}
                      onChange={(e) => setForm({ ...form, totalQuantity: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Weight *</label>
                    <input
                      type="number"
                      min={0}
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Low Stock Threshold</label>
                    <input
                      type="number"
                      min={0}
                      value={form.lowStockThreshold}
                      onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Campaign ID</label>
                  <input
                    type="text"
                    value={form.campaignId}
                    onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                    className="input"
                  />
                </div>
                {editingReward && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="input"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-gold-600 accent-gold focus:ring-gold"
                        />
                        Active
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReward}
                  disabled={saving || !form.name}
                  className="btn-gold disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingReward ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {adjustModal.open && adjustModal.reward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-lg font-semibold text-ink">Adjust Stock: {adjustModal.reward.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Current stock: {adjustModal.reward.remaining_quantity} / {adjustModal.reward.total_quantity}
                </p>
              </div>
              <div className="space-y-4 px-6 py-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Adjustment (positive to add, negative to subtract)</label>
                  <input
                    type="number"
                    value={adjustment}
                    onChange={(e) => setAdjustment(Number(e.target.value))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Restock, Damaged, etc."
                    className="input"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  onClick={() => setAdjustModal({ open: false, reward: null })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStockAdjustment}
                  disabled={adjusting || !reason}
                  className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
                >
                  {adjusting ? "Saving..." : "Apply"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}