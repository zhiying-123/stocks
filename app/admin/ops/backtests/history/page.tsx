"use client";

import { useEffect, useState } from "react";

interface BacktestRecord {
  id: number;
  market_id: string;
  clob_token_id?: string;
  market_name: string;
  group_name?: string;
  net_pnl: number;
  return_pct: number;
  trades_count: number;
  start_date: string;
  end_date: string;
  initial_cash: number;
  final_equity: number;
  vs_buy_hold: number;
  max_drawdown: number;
  executed_at: string;
  created_at: string;
}

export default function BacktestHistoryPage() {
  const [records, setRecords] = useState<BacktestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Filter states
  const [filterMarketId, setFilterMarketId] = useState("");
  const [filterGroupName, setFilterGroupName] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  async function loadRecords() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      params.append("offset", offset.toString());
      if (filterMarketId) params.append("marketId", filterMarketId);
      if (filterGroupName) params.append("groupName", filterGroupName);
      if (filterStartDate) params.append("startDate", filterStartDate);
      if (filterEndDate) params.append("endDate", filterEndDate);

      const res = await fetch(`/api/admin/backtest-history?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load records");

      const data = await res.json();
      setRecords(data.results || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to load backtest history:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecords();
  }, [offset, limit]);

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this record?")) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/backtest-history?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");

      setRecords(records.filter((r) => r.id !== id));
      setDeleteSuccess(`Record deleted`);
      setTimeout(() => setDeleteSuccess(""), 3000);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected record(s)?`)) return;

    try {
      const query = selectedIds.join(",");
      const res = await fetch(`/api/admin/backtest-history?id=${encodeURIComponent(query)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");

      setRecords(records.filter((r) => !selectedIds.includes(r.id)));
      setSelectedIds([]);
      setDeleteSuccess(`${selectedIds.length} record(s) deleted`);
      setTimeout(() => setDeleteSuccess(""), 3000);
    } catch (error) {
      console.error("Bulk delete error:", error);
      alert("Bulk delete failed");
    }
  }

  function handleFilter() {
    setOffset(0);
    loadRecords();
  }

  function handleReset() {
    setFilterMarketId("");
    setFilterGroupName("");
    setFilterStartDate("");
    setFilterEndDate("");
    setOffset(0);
    setTimeout(loadRecords, 100);
  }

  const pages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <h1 className="text-3xl font-bold text-gray-900">Backtest History</h1>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Filters</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Market ID</label>
            <input
              type="text"
              value={filterMarketId}
              onChange={(e) => setFilterMarketId(e.target.value)}
              placeholder="Search market ID..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Group Name</label>
            <input
              type="text"
              value={filterGroupName}
              onChange={(e) => setFilterGroupName(e.target.value)}
              placeholder="Search group..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Start Date</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2 items-center">
          <button
            onClick={handleFilter}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Search
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-400"
          >
            Reset
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.length === 0}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>
        </div>
      </div>

      {/* Success message */}
      {deleteSuccess && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">{deleteSuccess}</div>
      )}

      {/* Results table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No matching backtest records found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === records.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(records.map((r) => r.id));
                      else setSelectedIds([]);
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Market</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Group</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Net PnL</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Return %</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Trades</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Executed</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, idx) => (
                <tr key={record.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(record.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds((s) => [...s, record.id]);
                        else setSelectedIds((s) => s.filter((id) => id !== record.id));
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium">{record.market_name}</div>
                    <div className="text-xs text-gray-500">{record.market_id}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{record.group_name || "-"}</td>
                  <td className={`px-4 py-3 text-right font-medium ${record.net_pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {record.net_pnl >= 0 ? "+" : ""}{record.net_pnl.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${record.return_pct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {record.return_pct >= 0 ? "+" : ""}{record.return_pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{record.trades_count}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {new Date(record.executed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(record.id)}
                      disabled={deleting === record.id}
                      className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === record.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm text-gray-600">
            Total: <span className="font-medium">{total}</span> records (Page {currentPage}/{pages})
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={currentPage >= pages}
              className="rounded px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
