'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Comment {
    comment_id: number;
    u_id: number;
    user_name: string;
    content: string;
    sentiment: string | null;
    created_at: string;
}

interface SocialPanelProps {
    marketId: string;
    question: string;
    currentUserId?: number;
    currentUserName?: string;
}

function timeAgo(dateStr: string) {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

const SENTIMENT_CONFIG = {
    bullish: { label: '🟢 Bullish', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
    bearish: { label: '🔴 Bearish', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' },
    neutral: { label: '⚪ Neutral', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
};

export default function SocialPanel({ marketId, question, currentUserId, currentUserName }: SocialPanelProps) {
    const [activeTab, setActiveTab] = useState<'comments' | 'share'>('comments');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [sentiment, setSentiment] = useState<'bullish' | 'bearish' | 'neutral'>('neutral');
    const [submitting, setSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const isLoggedIn = !!currentUserId;

    // Derived sentiment counts
    const sentimentCounts = comments.reduce(
        (acc, c) => {
            const s = (c.sentiment || 'neutral') as keyof typeof acc;
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        },
        { bullish: 0, bearish: 0, neutral: 0 }
    );
    const total = comments.length || 1;

    const fetchComments = useCallback(async () => {
        setLoadingComments(true);
        try {
            const res = await fetch(`/api/polymarket/comments?marketId=${encodeURIComponent(marketId)}`);
            if (res.ok) {
                const data = await res.json();
                setComments(data.comments || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingComments(false);
        }
    }, [marketId]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleSubmit = async () => {
        if (!newComment.trim() || !isLoggedIn) return;
        setSubmitting(true);
        try {
            const res = await fetch('/api/polymarket/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId, content: newComment, sentiment }),
            });
            if (res.ok) {
                setNewComment('');
                await fetchComments();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (commentId: number) => {
        setDeletingId(commentId);
        try {
            const res = await fetch(`/api/polymarket/comments?commentId=${commentId}`, { method: 'DELETE' });
            if (res.ok) {
                setComments(prev => prev.filter(c => c.comment_id !== commentId));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDeletingId(null);
        }
    };

    // Share helpers
    const marketUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/polymarket/market/${encodeURIComponent(marketId)}`
        : '';
    const shareText = `${question} — Check this prediction market!`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(marketUrl).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    };

    const shareLinks = [
        {
            name: 'X (Twitter)',
            bg: 'bg-slate-100 hover:bg-slate-200',
            text: 'text-slate-800',
            border: 'border-slate-200',
            url: `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(marketUrl)}`,
            icon: (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
            ),
        },
        {
            name: 'Facebook',
            bg: 'bg-blue-100 hover:bg-blue-200',
            text: 'text-blue-800',
            border: 'border-blue-200',
            url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(marketUrl)}`,
            icon: (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
            ),
        },
        {
            name: 'WhatsApp',
            bg: 'bg-green-100 hover:bg-green-200',
            text: 'text-green-800',
            border: 'border-green-200',
            url: `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + marketUrl)}`,
            icon: (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
            ),
        },
        {
            name: 'Telegram',
            bg: 'bg-sky-100 hover:bg-sky-200',
            text: 'text-sky-800',
            border: 'border-sky-200',
            url: `https://t.me/share/url?url=${encodeURIComponent(marketUrl)}&text=${encodeURIComponent(shareText)}`,
            icon: (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
            ),
        },
    ];

    // Copy-trade quick amounts
    const quickAmounts = [10, 25, 50, 100];
    const [copyAmount, setCopyAmount] = useState(10);

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Tab Bar */}
            <div className="flex border-b border-gray-100">
                {[
                    { id: 'comments', label: '💬 Discussion', count: comments.length },
                    { id: 'share', label: '📤 Share' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'comments' | 'share')}
                        className={`flex-1 px-6 py-4 text-sm font-semibold transition-all ${activeTab === tab.id
                            ? 'text-gray-900 border-b-2 border-gray-900 bg-gray-50'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        {tab.label}
                        {tab.count != null && tab.count > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Comments Tab ── */}
            {activeTab === 'comments' && (
                <div className="p-6">
                    {/* Sentiment Bar */}
                    {comments.length > 0 && (
                        <div className="mb-5 p-4 bg-gray-50 rounded-xl">
                            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-2.5">
                                <span>Community Sentiment</span>
                                <span>{comments.length} {comments.length === 1 ? 'comment' : 'comments'}</span>
                            </div>
                            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                                {sentimentCounts.bullish > 0 && (
                                    <div
                                        className="bg-emerald-400 rounded-l-full transition-all"
                                        style={{ width: `${(sentimentCounts.bullish / total) * 100}%` }}
                                    />
                                )}
                                {sentimentCounts.neutral > 0 && (
                                    <div
                                        className="bg-gray-300 transition-all"
                                        style={{ width: `${(sentimentCounts.neutral / total) * 100}%` }}
                                    />
                                )}
                                {sentimentCounts.bearish > 0 && (
                                    <div
                                        className="bg-rose-400 rounded-r-full transition-all"
                                        style={{ width: `${(sentimentCounts.bearish / total) * 100}%` }}
                                    />
                                )}
                            </div>
                            <div className="flex gap-5 mt-2.5">
                                {(['bullish', 'bearish', 'neutral'] as const).map((s) => (
                                    <div key={s} className="flex items-center gap-1.5">
                                        <span className={`w-2.5 h-2.5 rounded-full ${SENTIMENT_CONFIG[s].dot}`} />
                                        <span className="text-xs text-gray-500 capitalize">{s}</span>
                                        <span className="text-xs font-bold text-gray-700">{sentimentCounts[s]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add Comment */}
                    {isLoggedIn ? (
                        <div className="mb-5">
                            <div className="flex gap-3 mb-3">
                                <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                                    {(currentUserName || 'U')[0].toUpperCase()}
                                </div>
                                <textarea
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder="Share your thoughts on this market..."
                                    rows={3}
                                    maxLength={500}
                                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent hover:border-gray-300 transition-all leading-relaxed"
                                />
                            </div>
                            <div className="flex items-center justify-between pl-12">
                                <div className="flex gap-2">
                                    {(['bullish', 'bearish', 'neutral'] as const).map((s) => {
                                        const cfg = SENTIMENT_CONFIG[s];
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => setSentiment(s)}
                                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${sentiment === s
                                                    ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{newComment.length}/500</span>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !newComment.trim()}
                                        className="px-5 py-1.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-xs font-semibold rounded-full transition-all"
                                    >
                                        {submitting ? '...' : 'Post'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-5 p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500 border border-gray-100">
                            <a href="/login" className="text-blue-600 hover:underline font-semibold">Log in</a> to join the discussion
                        </div>
                    )}

                    {/* Divider */}
                    {comments.length > 0 && <div className="border-t border-gray-100 mb-4" />}

                    {/* Comment List */}
                    {loadingComments ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="animate-pulse flex gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 bg-gray-200 rounded w-28" />
                                        <div className="h-3 bg-gray-200 rounded w-full" />
                                        <div className="h-3 bg-gray-200 rounded w-2/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-3">💬</div>
                            <p className="text-sm font-medium text-gray-500">No comments yet.</p>
                            <p className="text-xs text-gray-400 mt-1">Be the first to share your view!</p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                            {comments.map((c) => {
                                const cfg = SENTIMENT_CONFIG[(c.sentiment || 'neutral') as keyof typeof SENTIMENT_CONFIG];
                                return (
                                    <div key={c.comment_id} className="flex gap-3">
                                        <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold shrink-0 border border-gray-200">
                                            {c.user_name[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-bold text-gray-800">{c.user_name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                                                    {c.sentiment || 'neutral'}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-auto shrink-0">{timeAgo(c.created_at)}</span>
                                                {currentUserId === c.u_id && (
                                                    <button
                                                        onClick={() => handleDelete(c.comment_id)}
                                                        disabled={deletingId === c.comment_id}
                                                        className="text-gray-300 hover:text-rose-400 transition-colors disabled:opacity-40"
                                                        title="Delete"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── Share Tab ── */}
            {activeTab === 'share' && (
                <div className="p-6 space-y-5">
                    {/* Market preview */}
                    <div className="p-4 bg-violet-50 rounded-xl border border-violet-100">
                        <p className="text-xs font-semibold text-violet-500 mb-1 uppercase tracking-wide">You&apos;re sharing</p>
                        <p className="text-sm text-gray-800 font-semibold leading-snug line-clamp-2">{question}</p>
                    </div>

                    {/* Social platform grid */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Share via</p>
                        <div className="grid grid-cols-2 gap-3">
                            {shareLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all border ${link.bg} ${link.text} ${link.border}`}
                                >
                                    {link.icon}
                                    {link.name}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Copy link */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Copy link</p>
                        <div className="flex gap-2">
                            <div className="flex-1 flex items-center px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl min-w-0">
                                <svg className="w-4 h-4 text-gray-400 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span className="text-xs text-gray-600 truncate">{marketUrl}</span>
                            </div>
                            <button
                                onClick={handleCopyLink}
                                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${copySuccess
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-gray-900 hover:bg-gray-700 text-white'
                                    }`}
                            >
                                {copySuccess ? '✓ Copied!' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    {/* Embed */}
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Embed</p>
                        <div className="p-4 bg-gray-900 rounded-xl">
                            <code className="text-xs text-emerald-400 break-all leading-relaxed font-mono">
                                {`<iframe src="${marketUrl}" width="400" height="200" frameborder="0" />`}
                            </code>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
