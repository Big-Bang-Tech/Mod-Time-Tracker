import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { User, Project, DailyLog } from '../types';

interface AdminDashboardViewProps {
  onUserSelect: (user: User) => void;
}

const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onUserSelect }) => {
  const [data, setData] = useState<{
    users: User[];
    projects: Project[];
    logs: DailyLog[];
  }>({ users: [], projects: [], logs: [] });

  useEffect(() => {
    const load = async () => {
      const [users, projects, logs] = await Promise.all([
        db.getUsers(),
        db.getProjects(),
        db.getLogs()
      ]);
      setData({ users, projects, logs });
    };
    load();
  }, []);

  const formatTimeFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const globalStats = useMemo(() => {
    const totalSeconds = data.logs.reduce((acc, l) => acc + l.durationSeconds, 0);
    return {
      totalHours: (totalSeconds / 3600).toFixed(1),
      totalSeconds,
      activeUsers: data.users.length,
      globalProjects: data.projects.filter(p => p.isGlobal).length,
      privateProjects: data.projects.filter(p => !p.isGlobal).length,
    };
  }, [data.logs, data.users, data.projects]);

  const userStats = useMemo(() => {
    return data.users.map(user => {
      const userLogs = data.logs.filter(l => l.userId === user.id);
      const seconds = userLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
      return {
        ...user,
        totalSeconds: seconds,
        projectsWorked: new Set(userLogs.map(l => l.projectId)).size,
      };
    }).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [data.users, data.logs]);

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const targetDateStr = d.toDateString();
      const daySeconds = data.logs
        .filter(l => l.date === targetDateStr)
        .reduce((acc, l) => acc + l.durationSeconds, 0);
      return {
        label: d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase(),
        date: d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        hours: daySeconds / 3600,
      };
    });
  }, [data.logs]);

  const projectDist = useMemo(() => {
    const byProject: Record<string, { name: string; color: string; seconds: number }> = {};
    data.logs.forEach(l => {
      const p = data.projects.find(pr => pr.id === l.projectId);
      if (!byProject[l.projectId]) {
        byProject[l.projectId] = {
          name: l.projectName,
          color: p?.color ?? 'vibrant-blue',
          seconds: 0,
        };
      }
      byProject[l.projectId].seconds += l.durationSeconds;
    });
    return Object.entries(byProject)
      .map(([id, d]) => ({ id, ...d }))
      .filter(p => p.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds)
      .map(p => ({
        ...p,
        percent: globalStats.totalSeconds > 0 ? (p.seconds / globalStats.totalSeconds) * 100 : 0,
      }));
  }, [data.logs, data.projects, globalStats.totalSeconds]);

  const renderDonut = () => {
    const size = 200;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const gap = 8;

    return (
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full max-h-[240px]">
        {projectDist.slice(0, 8).map((p, i) => {
          const slice = (p.percent / 100) * circumference;
          const rotation = (offset / circumference) * 360 - 90;
          const dash = Math.max(0, slice - gap);
          offset += slice;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              transform={`rotate(${rotation} ${center} ${center})`}
              className={`${p.color} transition-all duration-500 hover:brightness-125`}
            />
          );
        })}
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-white font-mono text-[12px] font-bold">
          TOTAL
        </text>
      </svg>
    );
  };

  const maxHours = Math.max(...last7Days.map(d => d.hours), 0.1);

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-8 lg:mb-10 border-b border-mod-border pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-mod-blue flex items-center justify-center">
            <span className="material-symbols-outlined text-mod-fg text-3xl">dashboard</span>
          </div>
          <div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tighter text-mod-fg uppercase italic">PANEL <span className="text-slate-500 font-light not-italic">GLOBAL</span></h1>
            <p className="text-[10px] text-mod-blue font-bold uppercase tracking-[0.3em] mt-1">Resumen del sistema y estadísticas por operador</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-mod-card border border-mod-border p-6">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Horas totales (sistema)</p>
          <p className="text-2xl lg:text-3xl text-mod-fg font-black font-mono">{globalStats.totalHours} H</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-6">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Operadores</p>
          <p className="text-2xl lg:text-3xl text-mod-blue font-black font-mono">{globalStats.activeUsers}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-6">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Proyectos globales</p>
          <p className="text-2xl lg:text-3xl text-mod-fg font-black font-mono">{globalStats.globalProjects}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-6">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Proyectos privados</p>
          <p className="text-2xl lg:text-3xl text-slate-400 font-black font-mono">{globalStats.privateProjects}</p>
        </div>
      </div>

      {/* Gráficas: barras últimos 7 días + donut por proyecto */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        <div className="bg-mod-card border border-mod-border p-6 lg:p-8">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">bar_chart</span>
            Actividad últimos 7 días
          </h3>
          <div className="flex items-end justify-between gap-2 h-[220px]">
            {last7Days.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="w-full flex flex-col items-center justify-end h-[180px]">
                  <span className="text-[9px] font-mono text-mod-blue opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                    {day.hours.toFixed(1)}h
                  </span>
                  <div
                    className="w-full bg-mod-blue/20 border-t border-mod-blue/50 hover:bg-mod-blue/40 transition-all duration-500 origin-bottom min-h-[4px]"
                    style={{ height: `${Math.max(2, (day.hours / maxHours) * 100)}%` }}
                  />
                </div>
                <span className="text-[8px] font-black text-slate-500 tracking-widest text-center">{day.label}</span>
                <span className="text-[7px] text-slate-600 uppercase">{day.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-mod-card border border-mod-border p-6 lg:p-8">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">donut_large</span>
            Tiempo por proyecto
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-full max-w-[200px]">
              {projectDist.length > 0 ? renderDonut() : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-[10px] uppercase italic">Sin datos</div>
              )}
            </div>
            <div className="flex-1 space-y-3 w-full">
              {projectDist.slice(0, 6).map((p, i) => (
                <div key={i} className="flex justify-between items-center text-[9px] gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 flex-shrink-0 ${p.color}`} />
                    <span className="text-mod-fg font-bold uppercase truncate">{p.name}</span>
                  </div>
                  <span className="text-mod-blue font-mono flex-shrink-0">{p.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla estadísticas usuarios */}
      <div className="bg-mod-card border border-mod-border">
        <div className="p-6 bg-mod-dark border-b border-mod-border flex items-center justify-between">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em]">Estadísticas por operador</h3>
          <span className="material-symbols-outlined text-slate-600 text-sm">group</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-mod-dark/30 text-slate-500 uppercase font-black tracking-widest border-b border-mod-border">
                <th className="px-6 py-4">Operador</th>
                <th className="px-6 py-4 text-right">Tiempo total</th>
                <th className="px-6 py-4 text-right">Proyectos</th>
                <th className="px-6 py-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mod-border">
              {userStats.map(u => (
                <tr key={u.id} className="hover:bg-mod-fg/[0.02] group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${u.avatarSeed}`}
                        className="w-10 h-10 grayscale group-hover:grayscale-0 border border-mod-border bg-mod-dark p-1 transition-all"
                        alt=""
                      />
                      <div>
                        <p className="text-mod-fg font-black uppercase tracking-tighter">{u.username}</p>
                        <p className="text-[8px] text-slate-600 uppercase">{u.role} · {u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-mod-blue font-mono font-bold">{formatTimeFull(u.totalSeconds)}</td>
                  <td className="px-6 py-4 text-right text-mod-fg font-mono">{u.projectsWorked}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onUserSelect(u)}
                      className="w-9 h-9 flex items-center justify-center border border-mod-border text-slate-500 hover:text-mod-fg hover:border-mod-blue transition-all"
                      title="Inspeccionar"
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {userStats.length === 0 && (
          <p className="p-10 text-center text-slate-600 uppercase text-[10px] tracking-widest italic">No hay operadores registrados.</p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardView;
