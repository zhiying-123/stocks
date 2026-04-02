// Main Navigation Component with Dropdown Menus
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { modules, sharedRoutes } from "../config/routes";
import LogoutButton from "../logout/LogoutButton";

interface MainNavProps {
    userName?: string;
}

export default function MainNav({ userName }: MainNavProps) {
    const pathname = usePathname();
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isModuleActive = (moduleKey: string) => {
        if (moduleKey === "stocks") {
            return pathname.startsWith("/h_stocks");
        }
        return pathname.startsWith(`/${moduleKey}`);
    };

    const toggleDropdown = (moduleKey: string) => {
        setOpenDropdown(openDropdown === moduleKey ? null : moduleKey);
    };

    return (
        <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.02)]">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-18">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="h-9 w-9 rounded-lg bg-gray-900 text-white flex items-center justify-center text-[11px] font-bold tracking-[0.18em]">
                            TP
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[15px] font-semibold text-gray-900 tracking-tight leading-tight">
                                Trading Platform
                            </span>
                            <span className="text-[11px] uppercase tracking-[0.14em] text-gray-500 mt-0.5">
                                Markets Workspace
                            </span>
                        </div>
                    </Link>

                    {/* Main Navigation */}
                    <div className="flex items-center gap-1.5" ref={dropdownRef}>
                        {/* Module Dropdowns */}
                        {modules.map((module) => {
                            const isActive = isModuleActive(module.key);
                            const isOpen = openDropdown === module.key;

                            return (
                                <div key={module.key} className="relative">
                                    <button
                                        onClick={() => toggleDropdown(module.key)}
                                        className={`
                                            flex items-center gap-2 px-3.5 py-2 rounded-lg
                                            text-[13px] font-medium transition-all
                                            ${isActive
                                                ? "bg-gray-900 text-white"
                                                : "text-gray-700 hover:bg-gray-100"
                                            }
                                        `}
                                    >
                                        <span>{module.label}</span>
                                        <svg
                                            className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isOpen && (
                                        <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
                                            {module.routes.map((route) => (
                                                <Link
                                                    key={route.path}
                                                    href={route.path}
                                                    onClick={() => setOpenDropdown(null)}
                                                    className={`
                                                        flex items-center gap-3 px-4 py-3 transition-colors
                                                        ${pathname === route.path
                                                            ? "bg-gray-100 text-gray-900 font-semibold"
                                                            : "text-gray-700 hover:bg-gray-50"
                                                        }
                                                    `}
                                                >
                                                    <div className="flex-1">
                                                        <div className="font-medium text-sm">
                                                            {route.label}
                                                        </div>
                                                        {route.description && (
                                                            <div className={`text-xs ${pathname === route.path ? "text-gray-600" : "text-gray-500"}`}>
                                                                {route.description}
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Divider */}
                        <div className="w-px h-6 bg-gray-300 mx-2" />

                        {/* Shared Routes */}
                        {sharedRoutes.map((route) => {
                            const isActive = pathname === route.path;
                            return (
                                <Link
                                    key={route.path}
                                    href={route.path}
                                    className={`
                                        flex items-center gap-2 px-3.5 py-2 rounded-lg
                                        text-[13px] font-medium transition-all
                                        ${isActive
                                            ? "bg-gray-900 text-white"
                                            : "text-gray-700 hover:bg-gray-100"
                                        }
                                    `}
                                >
                                    <span>{route.label}</span>
                                </Link>
                            );
                        })}

                        {/* User Info */}
                        {userName && (
                            <>
                                <div className="w-px h-6 bg-gray-300 mx-2" />
                                <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-xl border border-gray-200 bg-white shadow-sm">
                                    <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-semibold">
                                        {userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="max-w-36">
                                        <p className="text-[10px] uppercase tracking-[0.12em] text-gray-500">Account</p>
                                        <p className="text-sm font-semibold text-gray-900 truncate -mt-0.5">{userName}</p>
                                    </div>
                                    <LogoutButton
                                        iconOnly
                                        className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
}
