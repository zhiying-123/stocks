'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginLink() {
    const router = useRouter();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        console.log('Login button clicked!');
        router.push('/login');
    };

    return (
        <Link
            href="/login"
            onClick={handleClick}
            className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-all shadow-sm"
        >
            Login
        </Link>
    );
}
