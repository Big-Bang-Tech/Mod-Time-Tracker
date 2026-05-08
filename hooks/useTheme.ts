import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'mod_tracker_theme';

const readStoredMode = (): ThemeMode => {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
    } catch {
        return 'system';
    }
};

const getSystemTheme = (): ResolvedTheme =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const applyTheme = (resolved: ResolvedTheme) => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
};

export const useTheme = () => {
    const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
    const [resolved, setResolved] = useState<ResolvedTheme>(() =>
        readStoredMode() === 'system' ? getSystemTheme() : (readStoredMode() as ResolvedTheme)
    );

    useEffect(() => {
        const next: ResolvedTheme = mode === 'system' ? getSystemTheme() : mode;
        setResolved(next);
        applyTheme(next);
        try {
            localStorage.setItem(STORAGE_KEY, mode);
        } catch {}
    }, [mode]);

    useEffect(() => {
        if (mode !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = (e: MediaQueryListEvent) => {
            const next: ResolvedTheme = e.matches ? 'dark' : 'light';
            setResolved(next);
            applyTheme(next);
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, [mode]);

    const setMode = useCallback((m: ThemeMode) => setModeState(m), []);

    const cycleMode = useCallback(() => {
        setModeState(prev => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'));
    }, []);

    return { mode, resolved, setMode, cycleMode };
};
