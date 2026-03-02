"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { InvestmentRouteConfig } from "./h_s_routes";

interface SidebarNavProps {
    routes: InvestmentRouteConfig[];
}

export default function SidebarNav({ routes }: SidebarNavProps) {
    const pathname = usePathname();

    const isActive = (path: string) => {
        if (path === "/h_stocks") {
            return pathname === path;
        }
        return pathname.startsWith(path);
    };

    return (
        <nav className="space-y-1">
            {routes.map((route) => {
                const active = isActive(route.path);

                return (
                    <Link
                        key={route.path}
                        href={route.path}
                        className={`
                            group flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                            ${active
                                ? `bg-linear-to-r ${route.gradient} text-white shadow-lg shadow-${route.color}-200`
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }
                        `}
                    >
                        {/* Icon */}
                        <span className="text-2xl">{route.icon}</span>

                        {/* Label & Description */}
                        <div className="flex-1 min-w-0">
                            <div className={`text-sm font-bold ${active ? 'text-white' : 'text-gray-900'}`}>
                                {route.label}
                            </div>
                            <div className={`text-xs ${active ? 'text-white/80' : 'text-gray-500'}`}>
                                {route.description}
                            </div>
                        </div>

                        {/* Active Indicator */}
                        {active && (
                            <div className="w-2 h-2 rounded-full bg-white/80 animate-pulse" />
                        )}
                    </Link>
                );
            })}
        </nav>
    );
}
