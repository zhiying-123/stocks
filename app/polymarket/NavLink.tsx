'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavLinkProps {
    href: string;
    children: React.ReactNode;
    exact?: boolean;
}

export function NavLink({ href, children, exact = false }: NavLinkProps) {
    const pathname = usePathname();
    const isActive = exact ? pathname === href : pathname.startsWith(href);

    return (
        <Link
            href={href}
            className={`text-sm font-medium transition-colors py-2 border-b-2 ${isActive
                    ? 'text-gray-900 border-gray-900'
                    : 'text-gray-600 hover:text-gray-900 border-transparent hover:border-gray-300'
                }`}
        >
            {children}
        </Link>
    );
}
