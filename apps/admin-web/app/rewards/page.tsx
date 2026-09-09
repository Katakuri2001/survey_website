"use client";

import { useCallback, useEffect, useState } from "react";

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
    const res = await fetch("/admin/rewards");
    if (!res.ok) throw new Error("Failed to fetch rewards");
    return res.json();
  }, []);

  const fetchInventory = useCallback(async () => {
    const res = await fetch("/admin/rewards/inventory");
    if (!res.ok) throw new Error("Failed to fetch inventory");
    return res.json();
  }, []);

  const fetchHistory = useCallback(async (offset: number) => {
    const res = await fetch(`/admin/rewards/history?limit=${historyLimit}&offset=${offset}`);
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
      const url = editingReward ? `/admin/rewards/${editingReward.id}` : "/admin/rewards";

      if (editingReward) {
        body.isActive = form.isActive;
        body.status = form.status;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`/admin/rewards/${adjustModal.reward.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      archived: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  const deliveryBadge = (status: string) => {
    const colors: Record<string, string> = {
      delivered: "bg-green-100 text-green-800",
      pending: "bg-yellow-100 text-yellow-800",
      failed: "bg-red-100 text-red-800",
    };
    return (
      <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || "bg-gray-100 text-gray-800"}`}>
        {status}
      </span>
    );
  };

  const lowStockIndicator = (reward: InventoryReward) => {
    if (reward.remaining_quantity <= reward.low_stock_threshold) {
      return (
        <span className="ml-2 inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
          Low Stock
        </span>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Rewards Management</h1>
          {tab === "rewards" && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Reward
            </button>
          )}
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-6">
            {(["rewards", "inventory", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === "history") setHistoryOffset(0);
                }}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
            <button onClick={() => setError("")} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {tab === "rewards" && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rewards.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {r.image_url && (
                              <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded object-cover" />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{r.name}</div>
                              <div className="text-xs text-gray-500 line-clamp-1">{r.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {r.remaining_quantity} / {r.total_quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{r.weight}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {statusBadge(r.status)}
                            {!r.is_active && <span className="text-xs text-gray-400">(disabled)</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          Rewarded: {r.rewarded_count} | Delivered: {r.delivered_count}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditModal(r)}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => openAdjustModal(r)}
                              className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rewards.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No rewards found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "inventory" && (
              <>
                {inventorySummary && (
                  <div className="grid grid-cols-5 gap-4 mb-6">
                    {[
                      { label: "Total Stock", value: inventorySummary.total_stock },
                      { label: "Total Rewarded", value: inventorySummary.total_rewarded },
                      { label: "Total Remaining", value: inventorySummary.total_remaining },
                      { label: "Total Delivered", value: inventorySummary.total_delivered },
                      { label: "Total Pending", value: inventorySummary.total_pending },
                    ].map((item) => (
                      <div key={item.label} className="bg-white rounded-lg shadow p-4">
                        <div className="text-sm text-gray-500">{item.label}</div>
                        <div className="text-2xl font-bold text-gray-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Threshold</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rewarded</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilization</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {inventory.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{r.total_quantity}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{r.remaining_quantity}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              {statusBadge(r.status)}
                              {lowStockIndicator(r)}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{r.low_stock_threshold}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{r.rewarded_count}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{r.delivered_count}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{r.pending_count}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{(r.utilization_rate * 100).toFixed(1)}%</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                const reward = rewards.find((rew) => rew.id === r.id);
                                if (reward) openAdjustModal(reward);
                              }}
                              className="text-amber-600 hover:text-amber-800 text-sm font-medium"
                            >
                              Adjust
                            </button>
                          </td>
                        </tr>
                      ))}
                      {inventory.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                            No inventory data found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "history" && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reward</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Won At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivered At</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{h.user_name}</div>
                          <div className="text-xs text-gray-500">{h.user_email}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{h.reward_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{h.product_name || "-"}</td>
                        <td className="px-6 py-4">{deliveryBadge(h.delivery_status)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(h.won_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {h.delivered_at ? new Date(h.delivered_at).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No history found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {historyTotal > historyLimit && (
                  <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                      Showing {historyOffset + 1}–{Math.min(historyOffset + historyLimit, historyTotal)} of {historyTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        disabled={historyOffset === 0}
                        onClick={() => setHistoryOffset(Math.max(0, historyOffset - historyLimit))}
                        className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      <button
                        disabled={historyOffset + historyLimit >= historyTotal}
                        onClick={() => setHistoryOffset(historyOffset + historyLimit)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-50"
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingReward ? "Edit Reward" : "Add Reward"}
                </h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (Myanmar)</label>
                  <input
                    type="text"
                    value={form.nameMy}
                    onChange={(e) => setForm({ ...form, nameMy: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (English)</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Myanmar)</label>
                  <textarea
                    value={form.descriptionMy}
                    onChange={(e) => setForm({ ...form, descriptionMy: e.target.value })}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Quantity *</label>
                    <input
                      type="number"
                      min={0}
                      value={form.totalQuantity}
                      onChange={(e) => setForm({ ...form, totalQuantity: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight *</label>
                    <input
                      type="number"
                      min={0}
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Low Stock Threshold</label>
                    <input
                      type="number"
                      min={0}
                      value={form.lowStockThreshold}
                      onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign ID</label>
                  <input
                    type="text"
                    value={form.campaignId}
                    onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {editingReward && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.isActive}
                          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        Active
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReward}
                  disabled={saving || !form.name}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingReward ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        )}

        {adjustModal.open && adjustModal.reward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Adjust Stock: {adjustModal.reward.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Current stock: {adjustModal.reward.remaining_quantity} / {adjustModal.reward.total_quantity}
                </p>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment (positive to add, negative to subtract)</label>
                  <input
                    type="number"
                    value={adjustment}
                    onChange={(e) => setAdjustment(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Restock, Damaged, etc."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setAdjustModal({ open: false, reward: null })}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveStockAdjustment}
                  disabled={adjusting || !reason}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50"
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
