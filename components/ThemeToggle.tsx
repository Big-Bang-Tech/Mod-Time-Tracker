import React from 'react';
import { useTheme, ThemeMode } from '../hooks/useTheme';

const iconForMode = (mode: ThemeMode): string => {
    if (mode === 'light') return 'light_mode';
    if (mode === 'dark') return 'dark_mode';
    return 'desktop_windows';
};

const labelForMode = (mode: ThemeMode): string => {
    if (mode === 'light') return 'Tema: claro (clic para oscuro)';
    if (mode === 'dark') return 'Tema: oscuro (clic para sistema)';
    return 'Tema: sistema (clic para claro)';
};

const ThemeToggle: React.FC = () => {
    const { mode, cycleMode } = useTheme();
    return (
        <button
            onClick={cycleMode}
            title={labelForMode(mode)}
            aria-label={labelForMode(mode)}
            className="flex items-center justify-center h-9 w-9 lg:h-10 lg:w-10 border border-mod-blue text-mod-blue hover:bg-mod-blue hover:text-mod-fg transition-all shadow-lg active:scale-95"
        >
            <span className="material-symbols-outlined text-base">{iconForMode(mode)}</span>
        </button>
    );
};

export default ThemeToggle;
