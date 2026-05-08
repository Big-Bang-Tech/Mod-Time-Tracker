import React from 'react';
import { View, User, Role } from '../types';

interface SidebarProps {
  currentView: View;
  isOpen: boolean;
  onClose: () => void;
  onViewChange: (view: View) => void;
  onNewProject: () => void;
  user: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, isOpen, onClose, onViewChange, onNewProject, user, onLogout }) => {
  const isAdmin = user.role === Role.ADMIN;
  
  const navItems = [
    { id: View.DASHBOARD, label: 'Terminal', icon: 'terminal', role: 'all' as const },
    { id: View.MOVEMENTS, label: 'Movimientos', icon: 'list_alt', role: 'all' as const },
    { id: View.REPORTS, label: 'Mis Reportes', icon: 'analytics', role: 'all' as const },
    { id: View.WEEKLY_HISTORY, label: 'Historial', icon: 'history', role: 'all' as const },
    { id: View.ADMIN_DASHBOARD, label: 'Panel Global', icon: 'dashboard', role: 'ADMIN' as const },
    { id: View.ADMIN_USERS, label: 'Operadores', icon: 'group', role: 'ADMIN' as const },
    { id: View.ADMIN_PROJECTS, label: 'Proyectos Global', icon: 'layers', role: 'ADMIN' as const },
    { id: View.ADMIN_STATS, label: 'Estadísticas', icon: 'monitoring', role: 'ADMIN' as const },
  ];

  const adminHiddenViews = [View.DASHBOARD, View.ADMIN_STATS, View.REPORTS];
  const filteredNav = navItems
    .filter(item => {
      const roleMatch = item.role === 'all' || (item.role === 'ADMIN' && isAdmin);
      const notHiddenForAdmin = !isAdmin || !adminHiddenViews.includes(item.id);
      return roleMatch && notHiddenForAdmin;
    })
    .sort((a, b) => {
      if (!isAdmin) return 0;
      if (a.id === View.ADMIN_DASHBOARD) return -1;
      if (b.id === View.ADMIN_DASHBOARD) return 1;
      return 0;
    });

  return (
    <>
      {/* Backdrop cuando el menú está en modo overlay (por debajo de 1366px) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] sidebar:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed sidebar:static inset-y-0 left-0 w-64 flex-shrink-0 border-r border-mod-border bg-mod-dark flex flex-col justify-between p-6 z-[120]
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full sidebar:translate-x-0'}
      `}>
        <div className="flex flex-col gap-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-mod-blue flex items-center justify-center">
                <span className="material-symbols-outlined text-mod-fg text-xl">grid_view</span>
              </div>
              <h1 className="text-mod-fg text-lg font-bold tracking-tighter italic">MOD <span className="font-light not-italic text-slate-400">TRACKER</span></h1>
            </div>
            <button onClick={onClose} className="sidebar:hidden text-slate-500 hover:text-mod-fg">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {filteredNav.map((item) => (
              <div
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-4 px-3 py-3 transition-all cursor-pointer border-l-2 ${
                  currentView === item.id
                    ? 'text-mod-blue border-mod-blue bg-mod-blue/5'
                    : 'text-slate-400 border-transparent hover:text-mod-fg hover:bg-mod-fg/5'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                <p className="text-[10px] font-bold uppercase tracking-widest">{item.label}</p>
              </div>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3 pt-6">
          <div className="flex items-center justify-between py-4 border-t border-mod-border">
            <div className="flex items-center gap-3">
              <img 
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.avatarSeed}`}
                className="w-8 h-8 grayscale border border-mod-border bg-mod-card p-1" 
                alt="avatar"
              />
              <p className="text-[10px] font-bold uppercase text-mod-fg truncate max-w-[80px]">{user.username}</p>
            </div>
            <button onClick={onLogout} className="text-slate-600 hover:text-red-500" aria-label="Cerrar sesión">
              <span className="material-symbols-outlined text-sm">logout</span>
            </button>
          </div>
          <button 
            onClick={onNewProject}
            className="w-full flex items-center justify-center gap-2 h-10 bg-mod-fg text-mod-dark text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Nuevo Proyecto</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;