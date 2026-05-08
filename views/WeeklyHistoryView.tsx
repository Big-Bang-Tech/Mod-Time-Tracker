import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { User, Project, DailyLog, Role } from '../types';

interface WeekData {
  total: number;
  projects: Record<string, number>;
  weekNum: number;
  year: number;
}

interface WeeklyHistoryViewProps {
  currentUser: User;
}

const WeeklyHistoryView: React.FC<WeeklyHistoryViewProps> = ({ currentUser }) => {
  const [data, setData] = useState<{ users: User[]; logs: DailyLog[]; projects: Project[] }>({ users: [], logs: [], projects: [] });
  const [selectedWeek, setSelectedWeek] = useState<{ userId: string; key: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      const [u, l, p] = await Promise.all([db.getUsers(), db.getLogs(), db.getProjects()]);
      setData({ users: u, logs: l, projects: p });
    };
    load();
  }, []);

  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getWeekRange = (week: number, year: number) => {
    const firstDayOfYear = new Date(year, 0, 1);
    const days = (week - 1) * 7;
    const start = new Date(year, 0, firstDayOfYear.getDay() <= 4 ? firstDayOfYear.getDate() - firstDayOfYear.getDay() + 1 + days : firstDayOfYear.getDate() + 8 - firstDayOfYear.getDay() + days);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const getUserWeeks = (userId: string): [string, WeekData][] => {
    const userLogs = data.logs.filter((l) => l.userId === userId);
    const weeks: Record<string, WeekData> = {};

    userLogs.forEach((log) => {
      const date = new Date(log.date);
      if (isNaN(date.getTime())) return;
      const weekNum = getWeekNumber(date);
      const year = date.getFullYear();
      const key = `${year}-W${weekNum}`;

      if (!weeks[key]) weeks[key] = { total: 0, projects: {}, weekNum, year };
      weeks[key].total += log.durationSeconds;
      weeks[key].projects[log.projectName] = (weeks[key].projects[log.projectName] || 0) + log.durationSeconds;
    });

    return Object.entries(weeks).sort((a, b) => {
      const [aYear, aWeek] = a[0].split('-W').map(Number);
      const [bYear, bWeek] = b[0].split('-W').map(Number);
      return bYear - aYear || bWeek - aWeek;
    });
  };

  const filteredUsers = currentUser.role === Role.ADMIN ? data.users : data.users.filter((u) => u.id === currentUser.id);

  const selectedWeekData =
    selectedWeek &&
    (() => {
      const weeks = getUserWeeks(selectedWeek.userId);
      return weeks.find(([k]) => k === selectedWeek.key);
    })();

  return (
    <div className="p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-10 flex items-end justify-between border-b border-mod-border pb-6">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-mod-blue text-4xl">history</span>
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">
              CRONOGRAMA <span className="text-slate-500 font-light not-italic">OPERATIVO</span>
            </h2>
            <p className="text-[10px] text-mod-blue font-bold uppercase tracking-[0.3em] mt-1">
              Archivo de Tiempos y Rendimiento por Personal
            </p>
          </div>
        </div>
      </div>

      {filteredUsers.map((user) => {
        const weeks = getUserWeeks(user.id);
        return (
          <div key={user.id} className="mb-12">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.avatarSeed}`}
                className="w-12 h-12 border border-mod-border bg-mod-dark p-1"
              />
              <div>
                <h3 className="text-xl font-black text-mod-fg uppercase tracking-tighter">{user.username}</h3>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">{user.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {weeks.map(([key, week]) => {
                const range = getWeekRange(week.weekNum, week.year);
                const isSelected = selectedWeek?.userId === user.id && selectedWeek?.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedWeek(isSelected ? null : { userId: user.id, key })}
                    className={`text-left p-5 border transition-all hover:border-mod-blue/50 ${
                      isSelected ? 'border-mod-blue bg-mod-blue/10' : 'border-mod-border hover:bg-mod-fg/[0.02]'
                    }`}
                  >
                    <div className="text-mod-blue text-[9px] font-black uppercase tracking-widest mb-1">
                      Semana {week.weekNum} · {week.year}
                    </div>
                    <div className="text-slate-400 text-[10px] font-mono mb-2">
                      {range.start.toLocaleDateString()} – {range.end.toLocaleDateString()}
                    </div>
                    <div className="text-mod-fg font-mono font-black text-lg">{formatTime(week.total)}</div>
                  </button>
                );
              })}
            </div>

            {weeks.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-[10px] uppercase tracking-widest italic">
                Sin datos históricos para este operador.
              </div>
            )}
          </div>
        );
      })}

      {selectedWeekData && selectedWeek && (() => {
        const weekDetail = selectedWeekData[1];
        const range = getWeekRange(weekDetail.weekNum, weekDetail.year);
        return (
          <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-md z-[200] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setSelectedWeek(null)}>
            <div
              className="bg-mod-card border border-mod-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-mod-card border-b border-mod-border p-6 flex justify-between items-center">
                <h4 className="text-mod-fg font-black uppercase tracking-widest">
                  Semana {weekDetail.weekNum} · {weekDetail.year}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedWeek(null)}
                  className="w-10 h-10 flex items-center justify-center border border-mod-border hover:border-mod-fg text-slate-500 hover:text-mod-fg transition-all"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Rango</p>
                  <p className="text-mod-fg font-mono text-sm">{range.start.toLocaleDateString()} – {range.end.toLocaleDateString()}</p>
                </div>
                <div className="mb-6">
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-1">Total</p>
                  <p className="text-mod-blue font-mono font-black text-2xl">{formatTime(weekDetail.total)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mb-3">Por proyecto</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(weekDetail.projects).map(([name, seconds]) => (
                      <div key={name} className="flex justify-between items-center p-3 border border-mod-border bg-mod-dark/50">
                        <span className="text-mod-fg text-[10px] font-bold uppercase truncate pr-2">{name}</span>
                        <span className="text-mod-blue font-mono font-bold text-xs shrink-0">{formatTime(seconds)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default WeeklyHistoryView;
