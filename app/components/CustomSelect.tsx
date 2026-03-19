'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type SelectOption<T extends string> = {
    value: T;
    label: string;
};

export default function CustomSelect<T extends string>({
    value,
    options,
    onChange,
    disabled,
    placeholder,
    size = 'default',
    tone = 'default',
}: {
    value: T;
    options: Array<SelectOption<T>>;
    onChange: (value: T) => void;
    disabled?: boolean;
    placeholder?: string;
    size?: 'default' | 'compact';
    tone?: 'default' | 'soft';
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    const selectedLabel = useMemo(() => {
        return options.find((option) => option.value === value)?.label ?? placeholder ?? '';
    }, [options, placeholder, value]);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                className={`w-full border text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors ${size === 'compact' ? 'px-3 py-2 rounded-xl' : 'px-3 py-2.5 rounded-2xl'} ${tone === 'soft' ? 'border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:bg-gray-100' : 'border-gray-300 bg-white shadow-sm hover:bg-gray-50 disabled:bg-gray-100'}`}
            >
                <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{selectedLabel}</span>
                    <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>

            {open && !disabled && (
                <div className={`absolute z-40 mt-1 w-full border border-gray-200 bg-white shadow-lg overflow-hidden ${size === 'compact' ? 'rounded-xl' : 'rounded-2xl'}`}>
                    <div className="py-1">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm transition-colors ${isSelected
                                        ? (tone === 'soft' ? 'bg-gray-200 text-gray-900' : 'bg-gray-900 text-white')
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
