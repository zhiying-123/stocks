'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProfileUIProps {
    userId: number;
    initialName: string;
    email: string;
}

export default function ProfileUI({ userId, initialName, email }: ProfileUIProps) {
    const router = useRouter();
    const [isEditingName, setIsEditingName] = useState(false);
    const [name, setName] = useState(initialName);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSaveName = async () => {
        if (!name.trim()) {
            setError('Name cannot be empty');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const res = await fetch('/api/profile/update-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name }),
            });

            const data = await res.json();

            if (res.ok) {
                setIsEditingName(false);
                router.refresh();
            } else {
                setError(data.error || 'Failed to update name');
            }
        } catch {
            setError('Network error, please try again');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Name */}
            <div className="group rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-[0.12em]">Display Name</label>
                    {!isEditingName ? (
                        <button
                            onClick={() => setIsEditingName(true)}
                            className="text-xs font-semibold text-gray-700 hover:text-gray-900"
                        >
                            Edit
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setIsEditingName(false);
                                    setName(initialName);
                                    setError('');
                                }}
                                className="text-xs font-semibold text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveName}
                                disabled={saving}
                                className="text-xs font-semibold text-gray-900 hover:text-black disabled:opacity-50"
                            >
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    )}
                </div>
                {isEditingName ? (
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 text-base font-semibold text-gray-900 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
                        placeholder="Enter your name"
                    />
                ) : (
                    <p className="text-lg font-semibold text-gray-900">
                        {name || 'Not set'}
                    </p>
                )}
                {error && (
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                )}
            </div>

            {/* Email */}
            <div className="group rounded-2xl border border-gray-200 bg-white p-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-[0.12em]">Email Address</label>
                <p className="text-base font-semibold text-gray-900 mt-2 break-all">
                    {email}
                </p>
            </div>
        </div>
    );
}
