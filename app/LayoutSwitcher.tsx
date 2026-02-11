'use client';

import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

export default function LayoutSwitcher({
    sidebar,
    topbar,
    children,
}: {
    sidebar: ReactNode;
    topbar: ReactNode;
    children: ReactNode;
}) {
    const pathname = usePathname();
    const isInvestmentPlatform = pathname.startsWith('/h_stocks');

    // If in investment platform, render children only (h_stocks has its own layout)
    if (isInvestmentPlatform) {
        return <>{children}</>;
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-linear-to-br from-amber-50/40 via-yellow-50/20 to-blue-50/30">
            {/* Sidebar */}
            {sidebar}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                {topbar}

                {/* Content */}
                <main className="flex-1 overflow-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
