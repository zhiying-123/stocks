'use client';

import { logout } from './logout';
import { useRouter } from 'next/navigation';

interface LogoutButtonProps {
    className?: string;
    iconOnly?: boolean;
}

export default function LogoutButton({ className = '', iconOnly = false }: LogoutButtonProps) {
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await logout();
            router.push('/');
            router.refresh();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    return (
        <button
            onClick={handleLogout}
            className={
                className ||
                `inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 text-sm font-semibold text-white transition-all hover:bg-white/20 ${iconOnly ? 'p-2.5' : 'px-5 py-2.5'}`
            }
            title="Logout"
            aria-label="Logout"
        >
            <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
            </svg>
            {!iconOnly && 'Logout'}
        </button>
    );
}
