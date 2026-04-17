'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type GroupedMarket = {
    grouped_market_id: number;
    market_id: string;
    question: string;
    category: string | null;
    is_closed: boolean;
    last_seen_at: string;
};

type GroupRow = {
    group_id: number;
    name: string;
    slug: string;
    source_url: string | null;
    source_type: string;
    match_keywords: string;
    is_system: boolean;
    created_at: string;
    updated_at: string;
    keywords: string[];
    market_count: number;
    snapshot_count: number;
    latest_sync_at: string | null;
    markets: GroupedMarket[];
};

type NoticeType = 'success' | 'error';

function formatDateTime(value: string | null) {
    if (!value) return 'Never';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
}

export default function PolymarketGroupsUI() {
    const [groups, setGroups] = useState<GroupRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState<{ type: NoticeType; text: string } | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [syncingGroupIds, setSyncingGroupIds] = useState<Set<number>>(new Set());

    const [name, setName] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [keywords, setKeywords] = useState('');
    const [submitting, setSubmitting] = useState(false);

    function showNotice(type: NoticeType, text: string) {
        setNotice({ type, text });
    }

    function closeNotice() {
        setNotice(null);
    }

    async function loadGroups() {
        setLoading(true);

        try {
            const res = await fetch('/api/polymarket/groups?includeMarkets=1&marketLimit=20', {
                cache: 'no-store',
            });
            const data = await res.json();
            if (!res.ok) {
                showNotice('error', data?.error || 'Failed to load groups');
                return;
            }

            setGroups(Array.isArray(data.groups) ? data.groups : []);
        } catch {
            showNotice('error', 'Failed to load groups');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        if (!notice) return;

        const timer = window.setTimeout(() => {
            setNotice(null);
        }, 2500);

        return () => window.clearTimeout(timer);
    }, [notice]);

    async function createGroup() {
        closeNotice();

        const trimmedName = name.trim();
        const trimmedKeywords = keywords.trim();
        if (!trimmedName) {
            showNotice('error', 'Group name is required');
            return;
        }
        if (!trimmedKeywords) {
            showNotice('error', 'Keywords are required');
            return;
        }

        setSubmitting(true);
        try {
            const keywordList = trimmedKeywords
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);

            const res = await fetch('/api/polymarket/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: trimmedName,
                    sourceUrl: sourceUrl.trim() || null,
                    keywords: keywordList,
                }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showNotice('error', data?.error || 'Failed to create group');
                return;
            }

            showNotice('success', `Created group: ${data?.group?.name || trimmedName}`);
            setName('');
            setSourceUrl('');
            setKeywords('');
            await loadGroups();
        } catch {
            showNotice('error', 'Failed to create group');
        } finally {
            setSubmitting(false);
        }
    }

    async function syncAllGroups() {
        closeNotice();
        setSyncingAll(true);

        try {
            const res = await fetch('/api/polymarket/groups/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showNotice('error', data?.error || 'Failed to sync groups');
                return;
            }

            showNotice('success', `Synced ${data?.synced_group_count || 0} group(s).`);
            await loadGroups();
        } catch {
            showNotice('error', 'Failed to sync groups');
        } finally {
            setSyncingAll(false);
        }
    }

    async function syncSingleGroup(groupId: number) {
        closeNotice();
        setSyncingGroupIds((prev) => new Set(prev).add(groupId));

        try {
            const res = await fetch('/api/polymarket/groups/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showNotice('error', data?.error || 'Failed to sync group');
                return;
            }

            showNotice('success', `Synced group #${groupId}.`);
            await loadGroups();
        } catch {
            showNotice('error', 'Failed to sync group');
        } finally {
            setSyncingGroupIds((prev) => {
                const next = new Set(prev);
                next.delete(groupId);
                return next;
            });
        }
    }

    const systemCount = useMemo(() => groups.filter((group) => group.is_system).length, [groups]);

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-340 mx-auto px-6 py-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Market Groups</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Group Polymarket markets for backtests and keep historical snapshots.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href="/polymarket"
                            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                        >
                            Back To Markets
                        </Link>
                        <button
                            onClick={syncAllGroups}
                            disabled={syncingAll}
                            className="px-4 py-2 rounded-xl border border-indigo-200 bg-indigo-100 text-indigo-700 text-sm font-semibold hover:bg-indigo-200 disabled:opacity-60"
                        >
                            {syncingAll ? 'Syncing All...' : 'Sync All Groups'}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">Total Groups</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{groups.length}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">Default Groups</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{systemCount}</p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 p-4">
                        <p className="text-xs text-gray-500">Latest Data Sync</p>
                        <p className="text-sm font-semibold text-gray-900 mt-2">
                            {formatDateTime(
                                groups
                                    .map((group) => group.latest_sync_at)
                                    .filter((value): value is string => Boolean(value))
                                    .sort()
                                    .pop() || null,
                            )}
                        </p>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 p-4 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-900">Create New Group</h2>
                    <p className="text-sm text-gray-600 mt-1">Example: NFL with keywords like nfl, super bowl, chiefs</p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Group name (e.g., NFL)"
                            className="px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
                        />
                        <input
                            value={sourceUrl}
                            onChange={(event) => setSourceUrl(event.target.value)}
                            placeholder="Source URL (optional)"
                            className="px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
                        />
                        <input
                            value={keywords}
                            onChange={(event) => setKeywords(event.target.value)}
                            placeholder="Keywords, comma separated"
                            className="px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
                        />
                    </div>

                    <div className="mt-3">
                        <button
                            onClick={createGroup}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl border border-blue-200 bg-blue-100 text-blue-700 text-sm font-semibold hover:bg-blue-200 disabled:opacity-60"
                        >
                            {submitting ? 'Creating...' : 'Create Group'}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">Loading groups...</div>
                ) : groups.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 p-6 text-sm text-gray-600">No groups found.</div>
                ) : (
                    <div className="space-y-4">
                        {groups.map((group) => {
                            const isSyncing = syncingGroupIds.has(group.group_id);
                            return (
                                <div key={group.group_id} className="rounded-2xl border border-gray-200 p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                                                    {group.slug}
                                                </span>
                                                {group.is_system ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Default</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Custom</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Keywords: {group.keywords.join(', ') || 'None'}
                                            </p>
                                            {group.source_url && (
                                                <a
                                                    href={group.source_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                                                >
                                                    {group.source_url}
                                                </a>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => syncSingleGroup(group.group_id)}
                                                disabled={isSyncing}
                                                className="px-3 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                                            >
                                                {isSyncing ? 'Syncing...' : 'Sync Group'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                                        <div className="rounded-xl border border-gray-200 p-3">
                                            <p className="text-xs text-gray-500">Markets In Group</p>
                                            <p className="text-lg font-bold text-gray-900">{group.market_count}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-3">
                                            <p className="text-xs text-gray-500">Snapshots Stored</p>
                                            <p className="text-lg font-bold text-gray-900">{group.snapshot_count}</p>
                                        </div>
                                        <div className="rounded-xl border border-gray-200 p-3">
                                            <p className="text-xs text-gray-500">Latest Sync</p>
                                            <p className="text-sm font-semibold text-gray-900 mt-1">{formatDateTime(group.latest_sync_at)}</p>
                                        </div>
                                    </div>

                                    {group.markets.length > 0 && (
                                        <div className="mt-3 overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead>
                                                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                                                        <th className="py-2 pr-3">Market</th>
                                                        <th className="py-2 pr-3">Category</th>
                                                        <th className="py-2 pr-3">State</th>
                                                        <th className="py-2 pr-3">Last Seen</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.markets.map((market) => (
                                                        <tr key={market.grouped_market_id} className="border-b border-gray-100 align-top">
                                                            <td className="py-2 pr-3">
                                                                <div className="font-medium text-gray-900">{market.question}</div>
                                                                <div className="text-xs text-gray-500 mt-0.5">{market.market_id}</div>
                                                            </td>
                                                            <td className="py-2 pr-3 text-gray-700">{market.category || 'Other'}</td>
                                                            <td className="py-2 pr-3">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-full text-xs font-semibold ${market.is_closed ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-700'
                                                                        }`}
                                                                >
                                                                    {market.is_closed ? 'Closed' : 'Open'}
                                                                </span>
                                                            </td>
                                                            <td className="py-2 pr-3 text-gray-700">{formatDateTime(market.last_seen_at)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {notice && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <button
                            type="button"
                            aria-label="Close notification"
                            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
                            onClick={closeNotice}
                        />

                        <div className="relative w-full max-w-sm rounded-2xl border border-indigo-200 bg-indigo-50 shadow-xl p-4">
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={closeNotice}
                                className="absolute right-3 top-3 h-7 w-7 rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
                            >
                                x
                            </button>

                            <p
                                className={`pr-8 text-sm font-semibold ${notice.type === 'error' ? 'text-rose-700' : 'text-emerald-700'
                                    }`}
                            >
                                {notice.text}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
