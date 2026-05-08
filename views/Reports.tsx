
import React, { useState, useEffect, useMemo } from 'react';
import { Project, DailyLog, ActivityLog } from '../types';
import { getIntelligentInsights } from '../services/geminiService';

interface ReportsProps {
  projects: Project[];
  historicalLogs: DailyLog[];
  onManualCommit: () => void;
}

const Reports: React.FC<ReportsProps> = ({ projects, historicalLogs, onManualCommit }) => {
  const [insight, setInsight] = useState("ANALIZANDO PATRONES OPERATIVOS...");

  useEffect(() => {
    const fetchInsight = async () => {
      const logsToAnalyze: ActivityLog[] = historicalLogs.length > 0 
        ? historicalLogs.map(l => ({
            id: l.id,
            projectName: l.projectName,
            startTime: '-',
            endTime: '-',
            duration: (l.durationSeconds / 60).toFixed(0) + 'm',
            status: l.status,
            color: 'vibrant-blue'
          }))
        : [];
        
      if (logsToAnalyze.length > 0) {
        const text = await getIntelligentInsights(logsToAnalyze);
        setInsight(text);
      } else {
        setInsight("SIN REGISTROS DETECTADOS. INICIE EL SEGUIMIENTO PARA COMENZAR EL ANÁLISIS.");
      }
    };
    fetchInsight();
  }, [historicalLogs]);

  const totalTrackedToday = useMemo(() => 
    projects.reduce((acc, p) => acc + p.currentDaySeconds, 0),
  [projects]);

  const formatSecondsFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleExportCSV = () => {
    const escapeCSV = (str: any) => {
      const stringified = String(str ?? '');
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };
    const headers = ['ID', 'Fecha', 'Proyecto', 'Duracion (Segundos)', 'Estado'];
    const rows = historicalLogs.map(l => [l.id, l.date, l.projectName, l.durationSeconds, l.status]);
    const csvContent = [headers, ...rows].map(row => row.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `log_sistema_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-light tracking-tighter text-mod-fg">ANALÍTICA DEL <span className="font-bold">SISTEMA</span></h2>
          <div className="h-1 w-20 bg-mod-blue mt-2"></div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 h-10 px-6 border border-mod-border bg-transparent text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-mod-fg hover:text-mod-dark transition-all"
          >
            <span className="material-symbols-outlined text-sm">description</span>
            <span>Exportar Registro</span>
          </button>
          <button 
            onClick={onManualCommit}
            className="flex items-center gap-2 h-10 px-6 bg-mod-blue text-mod-fg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-xl"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            <span>Sincronizar Día</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Uptime de Sesión', value: formatSecondsFull(totalTrackedToday), icon: 'schedule', unit: 'HH:MM:SS' },
          { label: 'Proceso Primario', value: projects.find(p => p.status === 'Running')?.name || 'INACTIVO', icon: 'emergency', unit: 'ACTIVO' },
          { label: 'Logs Indexados', value: historicalLogs.length.toString(), icon: 'history', unit: 'REGISTROS' },
        ].map((stat, i) => (
          <div key={i} className="bg-mod-card border border-mod-border p-8">
            <div className="flex justify-between items-start mb-4">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">{stat.label}</p>
              <span className="material-symbols-outlined text-mod-blue text-lg">{stat.icon}</span>
            </div>
            <p className="text-mod-fg tracking-tighter text-3xl font-black leading-tight truncate uppercase">{stat.value}</p>
            <p className="text-mod-blue text-[10px] font-bold mt-2 uppercase tracking-widest">{stat.unit}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-10">
        <div className="flex-1 bg-mod-card border border-mod-border p-8">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.3em] mb-10">Desglose de Utilización</h3>
          <div className="space-y-6">
            {projects.filter(p => p.currentDaySeconds > 0).map((p, i) => {
              const percent = Math.round((p.currentDaySeconds / (totalTrackedToday || 1)) * 100);
              return (
                <div key={p.id} className="flex flex-col gap-2">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-400">{p.name}</span>
                    <span className="text-mod-fg font-mono">{percent}%</span>
                  </div>
                  <div className="w-full bg-mod-dark h-1 border border-mod-border overflow-hidden">
                    <div 
                      className={`${p.color} h-full transition-all duration-1000`} 
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
            {totalTrackedToday === 0 && <p className="text-center text-slate-500 py-4 uppercase text-[10px] tracking-widest">Sin telemetría activa hoy.</p>}
          </div>
        </div>

        <div className="w-full lg:w-80 bg-mod-blue p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-mod-fg text-xl">psychology</span>
              <p className="text-mod-fg text-[10px] font-black uppercase tracking-widest">Inteligencia Central</p>
            </div>
            <p className="text-mod-fg text-sm leading-relaxed font-light italic">
              "{insight}"
            </p>
          </div>
          <div className="pt-6 border-t border-mod-fg/20 mt-6">
            <p className="text-[10px] font-bold text-mod-fg/60 uppercase tracking-widest">Estado Sistema: Óptimo</p>
          </div>
        </div>
      </div>

      <div className="bg-mod-card border border-mod-border overflow-hidden">
        <div className="p-6 bg-mod-dark border-b border-mod-border">
          <h3 className="text-mod-fg text-xs font-black uppercase tracking-[0.3em]">Historial Operativo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-mod-dark text-slate-500 uppercase font-bold tracking-widest border-b border-mod-border">
                <th className="px-8 py-4">Fecha Índice</th>
                <th className="px-8 py-4">Identificador Proyecto</th>
                <th className="px-8 py-4">Uptime Total</th>
                <th className="px-8 py-4">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mod-border">
              {historicalLogs.slice().reverse().map((log) => (
                <tr key={log.id} className="hover:bg-mod-fg/5 transition-colors group">
                  <td className="px-8 py-5 text-slate-500 font-mono">{log.date.toUpperCase()}</td>
                  <td className="px-8 py-5">
                    <span className="text-mod-fg font-bold uppercase tracking-tight">{log.projectName}</span>
                  </td>
                  <td className="px-8 py-5 font-mono text-mod-blue">
                    {formatSecondsFull(log.durationSeconds)}
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-2 py-0.5 border border-emerald-500/50 text-emerald-400 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5">
                      SINCRONIZADO
                    </span>
                  </td>
                </tr>
              ))}
              {historicalLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-12 text-center text-slate-600 uppercase tracking-widest italic text-[10px]">Sin datos históricos indexados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
