
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { User, Project, DailyLog } from '../types';

interface AdminStatsViewProps {
  onUserSelect: (user: User) => void;
}

const AdminStatsView: React.FC<AdminStatsViewProps> = ({ onUserSelect }) => {
  const [data, setData] = useState<{
    users: User[];
    projects: Project[];
    logs: DailyLog[];
  }>({ users: [], projects: [], logs: [] });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const loadAllData = async () => {
      const [users, projects, logs] = await Promise.all([
        db.getUsers(),
        db.getProjects(),
        db.getLogs()
      ]);
      setData({ users, projects, logs });
      
      if (projects.length > 0) {
        setSelectedProjectId(projects[0].id);
      }
    };
    loadAllData();
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
      activeUsers: data.users.length,
      globalProjects: data.projects.filter(p => p.isGlobal).length,
      privateProjects: data.projects.filter(p => !p.isGlobal).length,
      totalSeconds
    };
  }, [data.logs, data.users, data.projects]);

  const operatorsStats = useMemo(() => {
    return data.users.map(user => {
      const userLogs = data.logs.filter(l => l.userId === user.id);
      const seconds = userLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
      return {
        ...user,
        totalSeconds: seconds,
        projectsWorked: new Set(userLogs.map(l => l.projectId)).size
      };
    }).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [data.users, data.logs]);

  const projectDetail = useMemo(() => {
    if (!selectedProjectId) return null;
    const project = data.projects.find(p => p.id === selectedProjectId);
    if (!project) return null;

    const projectLogs = data.logs.filter(l => l.projectId === selectedProjectId);
    const usersBreakdown = data.users.map(user => {
      const userTime = projectLogs
        .filter(l => l.userId === user.id)
        .reduce((acc, l) => acc + l.durationSeconds, 0);
      return {
        user: user,
        username: user.username,
        time: userTime
      };
    }).filter(u => u.time > 0).sort((a, b) => b.time - a.time);

    return {
      project,
      totalTime: projectLogs.reduce((acc, l) => acc + l.durationSeconds, 0),
      users: usersBreakdown
    };
  }, [selectedProjectId, data.projects, data.logs, data.users]);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const targetDateStr = d.toDateString();
      
      const daySeconds = data.logs
        .filter(l => l.date === targetDateStr)
        .reduce((acc, l) => acc + l.durationSeconds, 0);

      return {
        label: d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase(),
        hours: daySeconds / 3600
      };
    });

    const projectDist = data.projects.map(p => {
      const time = data.logs
        .filter(l => l.projectId === p.id)
        .reduce((acc, l) => acc + l.durationSeconds, 0);
      return {
        id: p.id,
        name: p.name,
        time,
        colorClass: p.color,
        percent: globalStats.totalSeconds > 0 ? (time / globalStats.totalSeconds) * 100 : 0
      };
    }).filter(p => p.time > 0).sort((a, b) => b.time - a.time);

    return { last7Days, projectDist };
  }, [data.logs, data.projects, globalStats.totalSeconds]);

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
        {chartData.projectDist.map((p, i) => {
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
              className={`${p.colorClass} transition-all duration-700 hover:brightness-125`}
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedProjectId(p.id)}
            />
          );
        })}
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" className="fill-white font-mono text-[14px] font-bold">
          TOTAL
        </text>
      </svg>
    );
  };

  return (
    <div className="p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-10 flex items-end justify-between border-b border-mod-border pb-6">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-mod-blue text-4xl">monitoring</span>
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">CENTRAL <span className="text-slate-500 font-light not-italic">ANALYTICS</span></h2>
            <p className="text-[10px] text-mod-blue font-bold uppercase tracking-[0.3em] mt-1">Supervisión de Rendimiento Global del Sistema</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="bg-mod-card border border-mod-border p-8 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-mod-blue opacity-50"></div>
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Horas Totales (Sistema)</p>
          <p className="text-4xl text-mod-fg font-black font-mono">{globalStats.totalHours}H</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Operadores Activos</p>
          <p className="text-4xl text-mod-fg font-black font-mono">{globalStats.activeUsers}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Unidades Globales</p>
          <p className="text-4xl text-mod-blue font-black font-mono">{globalStats.globalProjects}</p>
        </div>
        <div className="bg-mod-card border border-mod-border p-8">
          <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-2">Unidades Privadas</p>
          <p className="text-4xl text-slate-400 font-black font-mono">{globalStats.privateProjects}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-mod-card border border-mod-border p-8 min-h-[400px]">
          <div className="flex justify-between items-start mb-10">
            <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="material-symbols-outlined text-mod-blue text-sm">bar_chart</span>
              Carga Diaria Total (Global)
            </h3>
            <span className="text-[9px] font-mono text-slate-600">Sincronizado {new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex items-end justify-between h-[250px] gap-4">
            {chartData.last7Days.map((day, i) => {
              const maxHours = Math.max(...chartData.last7Days.map(d => d.hours), 1);
              const height = (day.hours / maxHours) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end">
                  <div className="w-full relative group flex items-end justify-center h-full">
                    <div 
                      className="w-full bg-mod-blue/10 border-t border-mod-blue/40 hover:bg-mod-blue/30 transition-all duration-700 origin-bottom"
                      style={{ height: `${Math.max(2, height)}%` }}
                    >
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-mod-fg text-mod-dark text-[10px] px-2 py-1 font-black whitespace-nowrap shadow-xl z-20">
                        {day.hours.toFixed(1)}H TOTAL
                      </div>
                    </div>
                  </div>
                  <span className="text-[8px] font-black text-slate-500 tracking-widest">{day.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-mod-card border border-mod-border p-8 min-h-[400px]">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em] mb-10 flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue text-sm">donut_large</span>
            Inversión Temporal por Proyecto
          </h3>
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="flex-shrink-0 w-full max-w-[200px]">
              {renderPieChart()}
            </div>
            <div className="flex-1 space-y-4 w-full">
              {chartData.projectDist.slice(0, 6).map((p, i) => (
                <div key={i} className="group cursor-pointer" onClick={() => setSelectedProjectId(p.id)}>
                  <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 ${p.colorClass} border border-mod-fg/10`}></div>
                      <span className="text-mod-fg truncate max-w-[150px]">{p.name}</span>
                    </div>
                    <span className="text-mod-blue font-mono">{p.percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-mod-dark border border-mod-border w-full overflow-hidden">
                    <div 
                      className={`h-full ${p.colorClass} transition-all duration-1000`} 
                      style={{ width: `${p.percent}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-mod-card border border-mod-border">
          <div className="p-6 bg-mod-dark border-b border-mod-border flex items-center justify-between">
            <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em]">Clasificación de Operadores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-mod-dark/30 text-slate-500 uppercase font-black tracking-widest border-b border-mod-border">
                <tr>
                  <th className="px-6 py-5">Identidad</th>
                  <th className="px-6 py-5 text-right">Inversión Temporal</th>
                  <th className="px-6 py-5 text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mod-border">
                {operatorsStats.map(op => (
                  <tr key={op.id} className="hover:bg-mod-fg/[0.02] group transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${op.avatarSeed}`} className="w-10 h-10 grayscale group-hover:grayscale-0 border border-mod-border bg-mod-dark p-1" />
                        <span className="text-mod-fg font-black uppercase tracking-tighter">{op.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right text-mod-blue font-mono font-bold text-sm">{formatTimeFull(op.totalSeconds)}</td>
                    <td className="px-6 py-5 text-right">
                       <button 
                         onClick={() => onUserSelect(op)}
                         className="w-8 h-8 flex items-center justify-center border border-mod-border text-slate-600 hover:text-mod-fg hover:border-mod-fg transition-all"
                       >
                         <span className="material-symbols-outlined text-lg">visibility</span>
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-mod-card border border-mod-border h-full flex flex-col min-h-[400px]">
            <div className="p-6 bg-mod-dark border-b border-mod-border flex items-center justify-between">
              <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.2em]">Filtro de Despliegue</h3>
              <select 
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-mod-dark border border-mod-border text-[10px] font-bold uppercase text-mod-fg px-4 py-2 outline-none focus:border-mod-blue cursor-pointer"
              >
                <option value="" disabled>SELECCIONAR UNIDAD</option>
                {data.projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1 flex flex-col">
              {projectDetail ? (
                <div className="p-8 h-full animate-in slide-in-from-right duration-300">
                  <div className="flex items-start justify-between mb-10 pb-6 border-b border-mod-border">
                     <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-4 h-4 ${projectDetail.project.color} border border-mod-fg/20 shadow-xl`}></div>
                          <h4 className="text-3xl text-mod-fg font-black uppercase tracking-tighter">{projectDetail.project.name}</h4>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Carga Global Acumulada</p>
                        <p className="text-3xl text-mod-blue font-black font-mono tracking-tighter">{formatTimeFull(projectDetail.totalTime)}</p>
                     </div>
                  </div>

                  <div className="space-y-6">
                     {projectDetail.users.map((u, i) => (
                        <div key={i} className="group/user cursor-pointer" onClick={() => onUserSelect(u.user)}>
                          <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest mb-2">
                            <span className="text-slate-400 group-hover/user:text-mod-fg transition-colors">{u.username}</span>
                            <span className="text-mod-blue font-mono">{formatTimeFull(u.time)}</span>
                          </div>
                          <div className="h-1 bg-mod-dark border border-mod-border w-full overflow-hidden">
                            <div 
                              className="h-full bg-mod-blue transition-all duration-1000 shadow-[0_0_10px_rgba(0,163,224,0.3)]" 
                              style={{ width: `${(u.time / projectDetail.totalTime) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                     ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-slate-500 italic p-10">
                  <p className="text-[11px] font-black uppercase tracking-[0.4em] text-center">Seleccione un nodo del sistema</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStatsView;
