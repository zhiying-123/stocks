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
        <div className="space-y-4">
            {/* Name */}
            <div className="group">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
                    {!isEditingName ? (
                        <button
                            onClick={() => setIsEditingName(true)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
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
                                className="text-xs font-semibold text-gray-600 hover:text-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveName}
                                disabled={saving}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
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
                        className="w-full px-3 py-2 text-base font-semibold text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your name"
                    />
                ) : (
                    <p className="text-base font-semibold text-gray-900">
                        {name || 'Not set'}
                    </p>
                )}
                {error && (
                    <p className="text-xs text-red-600 mt-1">{error}</p>
                )}
            </div>

            {/* Email */}
            <div className="group pt-4 border-t border-gray-100">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Address</label>
                <p className="text-base font-semibold text-gray-900 mt-2">
                    {email}
                </p>
            </div>
        </div>
    );
}
