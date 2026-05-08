import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { User, Project, Role } from '../types';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  title: string;
  user: User;
  onMenuToggle: () => void;
  onSearch: (query: string) => void;
  activeTime?: string;
  onActionButton: () => void;
  onManualEntry: () => void;
  actionLabel: string;
  onResultClick: (type: 'USER' | 'PROJECT', item: any) => void;
}

const Header: React.FC<HeaderProps> = ({ title, user, onMenuToggle, onSearch, activeTime, onActionButton, onManualEntry, actionLabel, onResultClick }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ users: User[], projects: Project[] }>({ users: [], projects: [] });
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const isAdmin = user.role === Role.ADMIN;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const performSearch = async () => {
      if (query.length < 2) {
        setResults({ users: [], projects: [] });
        return;
      }
      const allUsers = await db.getUsers();
      const allProjects = await db.getProjects();
      const filteredUsers = allUsers.filter(u => u.username.toLowerCase().includes(query.toLowerCase()));
      const filteredProjects = allProjects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
      setResults({ users: filteredUsers, projects: filteredProjects });
    };
    const timeout = setTimeout(performSearch, 300);
    return () => clearTimeout(timeout);
  }, [query, isAdmin]);

  return (
    <header className="flex items-center justify-between border-b border-mod-border bg-mod-dark px-4 lg:px-10 py-4 lg:py-6 z-[60] relative">
      <div className="flex items-center gap-4 lg:gap-6">
        <button onClick={onMenuToggle} className="sidebar:hidden text-mod-fg">
          <span className="material-symbols-outlined">menu</span>
        </button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 lg:w-10 lg:h-10 bg-mod-fg flex items-center justify-center">
            <span className="material-symbols-outlined text-mod-dark text-xl lg:text-2xl font-bold">emergency</span>
          </div>
          <h2 className="text-mod-fg text-sm lg:text-xl font-black tracking-tight uppercase truncate max-w-[120px] lg:max-w-none">{title}</h2>
        </div>
        
        {isAdmin && (
          <div className="hidden sidebar:block relative w-80" ref={searchRef}>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); onSearch(e.target.value); setShowResults(true); }}
              className="block w-full pl-4 pr-3 py-2 bg-transparent border-b border-mod-border focus:border-mod-blue text-xs outline-none placeholder:text-slate-700 uppercase"
              placeholder="BUSCAR..."
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 lg:gap-6">
        {activeTime && (
          <div className="flex flex-col items-end">
            <span className="hidden lg:block text-[8px] uppercase font-bold text-slate-500">Sesión</span>
            <span className="text-sm lg:text-lg font-mono text-mod-blue">{activeTime}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onManualEntry}
            className="flex items-center gap-2 h-9 lg:h-10 px-3 lg:px-5 border border-mod-blue text-mod-blue text-[10px] font-bold uppercase tracking-widest hover:bg-mod-blue hover:text-mod-fg transition-all shadow-lg active:scale-95"
            title="Inyección de Datos (Manual/Retroactiva)"
          >
            <span className="material-symbols-outlined text-sm">history_edu</span>
            <span className="hidden md:inline">Inyectar</span>
          </button>
          
          <button 
            onClick={onActionButton}
            className="flex items-center gap-2 h-9 lg:h-10 px-4 lg:px-6 bg-mod-fg text-mod-dark text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span className="hidden sm:inline">{actionLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;