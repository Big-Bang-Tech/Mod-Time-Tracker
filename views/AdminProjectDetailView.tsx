import React, { useState, useEffect, useMemo } from 'react';
import { User, Project, DailyLog } from '../types';
import { db } from '../services/db';

const PAGE_SIZE = 10;

interface AdminProjectDetailViewProps {
  projectId: string;
  onBack: () => void;
  onUserSelect?: (user: User) => void;
}

const AdminProjectDetailView: React.FC<AdminProjectDetailViewProps> = ({ projectId, onBack, onUserSelect }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    const [allProjects, allUsers, allLogs] = await Promise.all([
      db.getProjects(),
      db.getUsers(),
      db.getLogs()
    ]);
    const found = allProjects.find((p: Project) => p.id === projectId) ?? null;
    setProject(found);
    setUsers(allUsers);
    setLogs(allLogs);
    setPage(0);
  };

  const formatTimeFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const projectLogs = useMemo(() => logs.filter(l => l.projectId === projectId), [logs, projectId]);
  const totalTimeSeconds = useMemo(() => projectLogs.reduce((acc, l) => acc + l.durationSeconds, 0), [projectLogs]);

  const userBreakdown = useMemo(() => {
    return users.map(user => {
      const time = projectLogs
        .filter(l => l.userId === user.id)
        .reduce((acc, l) => acc + l.durationSeconds, 0);
      return { user, seconds: time };
    }).filter(u => u.seconds > 0).sort((a, b) => b.seconds - a.seconds);
  }, [users, projectLogs]);

  const chartData = useMemo(() => {
    return userBreakdown.map(u => ({
      ...u,
      percent: totalTimeSeconds > 0 ? (u.seconds / totalTimeSeconds) * 100 : 0
    }));
  }, [userBreakdown, totalTimeSeconds]);

  const renderDonut = () => {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const gap = 8;
    const colors = ['vibrant-blue', 'vibrant-green', 'vibrant-orange', 'vibrant-purple', 'vibrant-pink', 'vibrant-cyan', 'vibrant-yellow', 'vibrant-red'];

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-h-[240px]">
        {chartData.slice(0, 8).map((item, i) => {
          const slice = (item.percent / 100) * circumference;
          const rotation = (offset / circumference) * 360 - 90;
          const dash = Math.max(0, slice - gap);
          offset += slice;
          const color = colors[i % colors.length];
          return (
            <circle
              key={item.user.id}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              transform={`rotate(${rotation} ${center} ${center})`}
              className={`${color} transition-all duration-500 hover:brightness-125`}
            />
          );
        })}
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-white font-mono text-[12px] font-bold">
          TOTAL
        </text>
      </svg>
    );
  };

  const filteredLogs = useMemo(() => {
    return projectLogs.filter(log => {
      const userMatch = filterUserId === 'ALL' || log.userId === filterUserId;
      const d = new Date(log.date);
      const fromMatch = !filterDateFrom || d >= new Date(filterDateFrom + 'T00:00:00');
      const toMatch = !filterDateTo || d <= new Date(filterDateTo + 'T23:59:59');
      return userMatch && fromMatch && toMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [projectLogs, filterUserId, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  if (!project) {
    return (
      <div className="p-10 max-w-[1400px] mx-auto">
        <button onClick={onBack} className="mb-6 w-12 h-12 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <p className="text-slate-500 uppercase text-sm">Proyecto no encontrado.</p>
      </div>
    );
  }

  const creator = users.find(u => u.id === project.creatorId);

  return (
    <div className="p-10 max-w-[1400px] mx-auto animate-in slide-in-from-right duration-500 pb-20">
      <div className="mb-10 flex items-center gap-6 border-b border-mod-border pb-8">
        <button onClick={onBack} className="w-12 h-12 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg hover:border-mod-fg transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className={`w-16 h-16 flex-shrink-0 ${project.color} border border-mod-fg/20 flex items-center justify-center`}>
          <span className="material-symbols-outlined text-mod-fg/50 text-3xl">layers</span>
        </div>
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">INSPECCIÓN <span className="text-slate-500 font-light not-italic">{project.name}</span></h2>
          <p className="text-[10px] text-mod-blue font-bold uppercase tracking-[0.3em] mt-1">{project.category} | ID: {project.id} {!project.isActive && '· INACTIVO'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Tiempo total acumulado</p>
          <p className="text-3xl text-mod-fg font-black font-mono">{formatTimeFull(totalTimeSeconds)}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Operadores que trabajaron</p>
          <p className="text-3xl text-mod-blue font-black font-mono">{userBreakdown.length}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Registros de tiempo</p>
          <p className="text-3xl text-mod-fg font-black font-mono">{projectLogs.length}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Propietario</p>
          <p className="text-lg text-mod-fg font-bold uppercase truncate">{creator?.username ?? 'Sistema'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-mod-card border border-mod-border p-8">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">donut_large</span>
            Participación por operador
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-full max-w-[200px]">
              {chartData.length > 0 ? renderDonut() : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-[10px] uppercase italic">Sin datos</div>
              )}
            </div>
            <div className="flex-1 space-y-3 w-full">
              {chartData.slice(0, 8).map((item, i) => (
                <div
                  key={item.user.id}
                  className="flex justify-between items-center text-[9px] gap-2 cursor-pointer hover:bg-mod-fg/[0.03] p-2 -m-2 rounded"
                  onClick={() => onUserSelect?.(item.user)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${item.user.avatarSeed}`} className="w-6 h-6 grayscale flex-shrink-0" alt="" />
                    <span className="text-mod-fg font-bold uppercase truncate">{item.user.username}</span>
                  </div>
                  <span className="text-mod-blue font-mono flex-shrink-0">{item.percent.toFixed(1)}% · {formatTimeFull(item.seconds)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-mod-card border border-mod-border">
          <div className="p-6 bg-mod-dark border-b border-mod-border">
            <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em]">Desglose por operador</h3>
          </div>
          <div className="divide-y divide-mod-border max-h-[320px] overflow-y-auto">
            {userBreakdown.map(({ user, seconds }) => (
              <div
                key={user.id}
                className="p-6 flex items-center justify-between hover:bg-mod-fg/[0.01] cursor-pointer group"
                onClick={() => onUserSelect?.(user)}
              >
                <div className="flex items-center gap-4">
                  <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.avatarSeed}`} className="w-10 h-10 grayscale group-hover:grayscale-0 border border-mod-border" alt="" />
                  <div>
                    <p className="text-mod-fg font-bold uppercase text-sm">{user.username}</p>
                    <p className="text-[9px] text-slate-500 uppercase">{user.role}</p>
                  </div>
                </div>
                <p className="text-mod-blue font-mono text-sm font-bold">{formatTimeFull(seconds)}</p>
              </div>
            ))}
            {userBreakdown.length === 0 && (
              <p className="p-10 text-center text-slate-600 uppercase text-[10px] tracking-widest italic">Ningún operador ha registrado tiempo en este proyecto.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-mod-card border border-mod-border">
        <div className="p-6 bg-mod-dark border-b border-mod-border flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em]">Registros de sincronización</h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterUserId}
              onChange={e => { setFilterUserId(e.target.value); setPage(0); }}
              className="bg-mod-dark border border-mod-border text-[10px] font-bold uppercase text-mod-fg px-3 py-2 outline-none focus:border-mod-blue cursor-pointer"
            >
              <option value="ALL">Todos los operadores</option>
              {userBreakdown.map(u => (
                <option key={u.user.id} value={u.user.id}>{u.user.username}</option>
              ))}
            </select>
            <input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }} className="bg-mod-dark border border-mod-border text-[10px] font-mono text-mod-fg px-3 py-2 outline-none focus:border-mod-blue" />
            <input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(0); }} className="bg-mod-dark border border-mod-border text-[10px] font-mono text-mod-fg px-3 py-2 outline-none focus:border-mod-blue" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-mod-dark/30 text-slate-500 uppercase font-bold tracking-widest border-b border-mod-border">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Operador</th>
                <th className="px-6 py-4 text-right">Duración</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mod-border">
              {paginatedLogs.map(log => {
                const u = users.find(us => us.id === log.userId);
                return (
                  <tr key={log.id} className="hover:bg-mod-fg/[0.02]">
                    <td className="px-6 py-4 text-slate-500 font-mono uppercase">{log.date}</td>
                    <td className="px-6 py-4 text-mod-fg font-bold uppercase">{u?.username ?? log.userId}</td>
                    <td className="px-6 py-4 text-right text-mod-blue font-mono">{formatTimeFull(log.durationSeconds)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border ${
                        log.status === 'NORMAL' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        log.status === 'MANUAL' ? 'bg-mod-blue/10 text-mod-blue border-mod-blue/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      }`}>{log.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && <p className="p-10 text-center text-slate-600 uppercase text-[10px] tracking-widest italic">No hay registros con los filtros aplicados.</p>}
        {totalPages > 1 && (
          <div className="p-4 border-t border-mod-border flex items-center justify-between">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredLogs.length)} de {filteredLogs.length}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="w-10 h-10 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg disabled:opacity-30 disabled:pointer-events-none">
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <span className="text-[10px] font-mono text-mod-fg font-bold px-2">Pág. {page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="w-10 h-10 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg disabled:opacity-30 disabled:pointer-events-none">
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProjectDetailView;
