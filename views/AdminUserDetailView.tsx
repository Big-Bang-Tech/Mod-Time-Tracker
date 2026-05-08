import React, { useState, useEffect, useMemo } from 'react';
import { User, Project, DailyLog } from '../types';
import { db } from '../services/db';

const PAGE_SIZE = 10;

interface AdminUserDetailViewProps {
  user: User;
  onBack: () => void;
  onProjectClick?: (projectId: string) => void;
}

const AdminUserDetailView: React.FC<AdminUserDetailViewProps> = ({ user, onBack, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);

  const [filterProjectId, setFilterProjectId] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    const userProjects = await db.getProjects(user.id);
    const userLogs = await db.getLogs(user.id);
    setProjects(userProjects);
    setLogs(userLogs);
    setPage(0);
  };

  const formatTimeFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const totalTimeSeconds = useMemo(() => logs.reduce((acc, l) => acc + l.durationSeconds, 0), [logs]);

  // Suma total por proyecto (para gráfico y despliegue). Incluye proyectos con 0 tiempo.
  const projectTotals = useMemo(() => {
    const byProject: Record<string, { name: string; color: string; seconds: number }> = {};
    projects.forEach(p => {
      byProject[p.id] = { name: p.name, color: p.color, seconds: 0 };
    });
    logs.forEach(l => {
      if (byProject[l.projectId]) {
        byProject[l.projectId].seconds += l.durationSeconds;
      } else {
        byProject[l.projectId] = {
          name: l.projectName,
          color: projects.find(p => p.id === l.projectId)?.color ?? 'vibrant-blue',
          seconds: l.durationSeconds
        };
      }
    });
    return Object.entries(byProject)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [logs, projects]);

  // Solo proyectos con tiempo > 0 para el gráfico circular
  const chartData = useMemo(() => {
    return projectTotals
      .filter(p => p.seconds > 0)
      .map(p => ({
        ...p,
        percent: totalTimeSeconds > 0 ? (p.seconds / totalTimeSeconds) * 100 : 0
      }));
  }, [projectTotals, totalTimeSeconds]);

  const renderPieChart = () => {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;
    const gap = 10;

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-h-[280px]">
        {chartData.map((p, i) => {
          const sliceLength = (p.percent / 100) * circumference;
          const rotation = (currentOffset / circumference) * 360 - 90;
          const actualDash = Math.max(0, sliceLength - gap);
          currentOffset += sliceLength;

          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${actualDash} ${circumference - actualDash}`}
              strokeDashoffset={0}
              transform={`rotate(${rotation} ${center} ${center})`}
              className={`${p.color} transition-all duration-700 hover:brightness-125`}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-white font-mono text-[14px] font-bold">
          TOTAL
        </text>
      </svg>
    );
  };

  // Filtros para registros
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const projectMatch = filterProjectId === 'ALL' || log.projectId === filterProjectId;
      const d = new Date(log.date);
      const fromMatch = !filterDateFrom || d >= new Date(filterDateFrom + 'T00:00:00');
      const toMatch = !filterDateTo || d <= new Date(filterDateTo + 'T23:59:59');
      return projectMatch && fromMatch && toMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, filterProjectId, filterDateFrom, filterDateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const paginatedLogs = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, page]);

  return (
    <div className="p-10 max-w-[1400px] mx-auto animate-in slide-in-from-right duration-500 pb-20">
      {/* Primera franja: cabecera + panel de resumen */}
      <div className="mb-10 flex items-center gap-6 border-b border-mod-border pb-8">
        <button
          onClick={onBack}
          className="w-12 h-12 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg hover:border-mod-fg transition-all"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex items-center gap-4">
          <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.avatarSeed}`} className="w-16 h-16 border border-mod-border bg-mod-card p-1" alt="" />
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">INSPECCIÓN <span className="text-slate-500 font-light not-italic">{user.username}</span></h2>
            <p className="text-[10px] text-mod-blue font-bold uppercase tracking-[0.3em] mt-1">Status: Conexión Activa | ID: {user.id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-10">
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Uptime Total Acumulado</p>
          <p className="text-3xl text-mod-fg font-black font-mono">{formatTimeFull(totalTimeSeconds)}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Unidades de Trabajo</p>
          <p className="text-3xl text-mod-fg font-black font-mono">{projects.length}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-4">Última Sincronización</p>
          <p className="text-lg text-mod-fg font-bold uppercase">{user.lastLogin === '-' || !user.lastLogin ? 'NUNCA' : new Date(user.lastLogin).toLocaleDateString()}</p>
        </div>
        <div className="bg-mod-card border border-red-600/30 p-8">
          <p className="text-red-500/50 text-[9px] font-black uppercase tracking-widest mb-4">Protocolo de Seguridad</p>
          <p className="text-lg text-red-500 font-black uppercase tracking-tighter">{user.role}</p>
        </div>
      </div>

      {/* Gráfico circular: inversión temporal por proyecto */}
      <div className="bg-mod-card border border-mod-border p-8 mb-10">
        <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-mod-blue text-sm">donut_large</span>
          Inversión Temporal por Proyecto
        </h3>
        <div className="flex flex-col md:flex-row items-center gap-10">
          <div className="flex-shrink-0 w-full max-w-[200px]">
            {chartData.length > 0 ? renderPieChart() : (
              <div className="h-[200px] flex items-center justify-center text-slate-500 text-[10px] uppercase tracking-widest italic">Sin datos</div>
            )}
          </div>
          <div className="flex-1 space-y-4 w-full">
            {chartData.slice(0, 8).map((p, i) => (
              <div key={i}>
                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 ${p.color} border border-mod-fg/10`}></div>
                    <span className="text-mod-fg truncate max-w-[200px]">{p.name}</span>
                  </div>
                  <span className="text-mod-blue font-mono">{p.percent.toFixed(1)}% · {formatTimeFull(p.seconds)}</span>
                </div>
                <div className="h-1 bg-mod-dark border border-mod-border w-full overflow-hidden">
                  <div className={`h-full ${p.color} transition-all duration-1000`} style={{ width: `${p.percent}%` }}></div>
                </div>
              </div>
            ))}
            {chartData.length === 0 && (
              <p className="text-slate-500 text-[10px] uppercase tracking-widest italic">Sin registros de tiempo</p>
            )}
          </div>
        </div>
      </div>

      {/* Suma total de tiempos por proyecto */}
      <div className="bg-mod-card border border-mod-border mb-10">
        <div className="p-6 bg-mod-dark border-b border-mod-border flex items-center justify-between">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em]">Despliegue de Proyectos · Suma Total por Unidad</h3>
          <span className="material-symbols-outlined text-slate-600 text-sm">layers</span>
        </div>
        <div className="divide-y divide-mod-border">
          {projectTotals.length > 0 ? projectTotals.map(p => (
            <div
              key={p.id}
              onClick={() => onProjectClick?.(p.id)}
              className={`p-6 flex items-center justify-between hover:bg-mod-fg/[0.02] transition-colors group ${onProjectClick ? 'cursor-pointer hover:border-l-2 hover:border-l-mod-blue' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 ${p.color}`}></div>
                <div>
                  <p className="text-mod-fg font-bold uppercase text-sm">{p.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {p.id}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <p className="text-mod-blue font-mono text-sm font-bold">{formatTimeFull(p.seconds)}</p>
                  <p className="text-[9px] text-slate-600 uppercase">total acumulado</p>
                </div>
                {onProjectClick && <span className="material-symbols-outlined text-slate-500 group-hover:text-mod-blue transition-colors">chevron_right</span>}
              </div>
            </div>
          )) : (
            <p className="p-10 text-center text-slate-600 uppercase text-[10px] tracking-widest italic">Sin registros de sincronización para este operador.</p>
          )}
        </div>
      </div>

      {/* Registros de sincronización con paginación y filtros */}
      <div className="bg-mod-card border border-mod-border">
        <div className="p-6 bg-mod-dark border-b border-mod-border flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-600 text-sm">history</span>
            Registros de Sincronización
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterProjectId}
              onChange={e => { setFilterProjectId(e.target.value); setPage(0); }}
              className="bg-mod-dark border border-mod-border text-[10px] font-bold uppercase text-mod-fg px-3 py-2 outline-none focus:border-mod-blue cursor-pointer"
            >
              <option value="ALL">Todos los proyectos</option>
              {projectTotals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }}
              className="bg-mod-dark border border-mod-border text-[10px] font-mono text-mod-fg px-3 py-2 outline-none focus:border-mod-blue"
              placeholder="Desde"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); setPage(0); }}
              className="bg-mod-dark border border-mod-border text-[10px] font-mono text-mod-fg px-3 py-2 outline-none focus:border-mod-blue"
              placeholder="Hasta"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-mod-dark/30 text-slate-500 uppercase font-bold tracking-widest border-b border-mod-border">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Proyecto</th>
                <th className="px-6 py-4 text-right">Duración</th>
                <th className="px-6 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mod-border">
              {paginatedLogs.map(log => (
                <tr key={log.id} className="hover:bg-mod-fg/[0.02]">
                  <td className="px-6 py-4 text-slate-500 font-mono uppercase">{log.date}</td>
                  <td className="px-6 py-4 text-mod-fg font-bold uppercase">{log.projectName}</td>
                  <td className="px-6 py-4 text-right text-mod-blue font-mono">{formatTimeFull(log.durationSeconds)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest border ${
                      log.status === 'NORMAL' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                      log.status === 'MANUAL' ? 'bg-mod-blue/10 text-mod-blue border-mod-blue/20' :
                      'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>{log.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <p className="p-10 text-center text-slate-600 uppercase text-[10px] tracking-widest italic">No hay registros con los filtros aplicados.</p>
        )}
        {totalPages > 1 && (
          <div className="p-4 border-t border-mod-border flex items-center justify-between">
            <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">
              Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredLogs.length)} de {filteredLogs.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="w-10 h-10 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg hover:border-mod-fg transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-lg">chevron_left</span>
              </button>
              <span className="text-[10px] font-mono text-mod-fg font-bold px-2">Pág. {page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="w-10 h-10 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg hover:border-mod-fg transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserDetailView;
