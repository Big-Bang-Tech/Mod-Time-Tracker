import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { DailyLog, User, Project, Role, LogModificationRecord } from '../types';

interface MovementsViewProps {
  currentUser: User;
  onDeleteLog: (logId: string) => void;
  onEditLog?: (payload: { id: string; durationSeconds: number; date: string; comment?: string | null }) => void;
}

interface GroupedLog {
  key: string; // date + projectId + userId
  date: string;
  projectId: string;
  projectName: string;
  userId: string;
  totalDuration: number;
  entries: (DailyLog & { created_at?: string })[];
}

const MovementsView: React.FC<MovementsViewProps> = ({ currentUser, onDeleteLog, onEditLog }) => {
  const [logs, setLogs] = useState<(DailyLog & { created_at?: string })[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingLog, setEditingLog] = useState<(DailyLog & { created_at?: string }) | null>(null);
  const [historyLogId, setHistoryLogId] = useState<string | null>(null);
  const [historyRecords, setHistoryRecords] = useState<LogModificationRecord[]>([]);
  
  const [filterUser, setFilterUser] = useState<string>(currentUser.role === Role.ADMIN ? 'ALL' : currentUser.id);
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const isAdmin = currentUser.role === Role.ADMIN;
  const canModify = isAdmin || (currentUser.canModifyLogs ?? true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [allLogs, allUsers, allProjects] = await Promise.all([
      db.getLogs(),
      db.getUsers(),
      db.getProjects()
    ]);
    setLogs(allLogs);
    setUsers(allUsers);
    setProjects(allProjects);
  };

  const formatTimeFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NORMAL':
        return <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 text-[8px] font-black tracking-widest rounded-full">NORMAL</span>;
      case 'PRESET':
        return <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 text-[8px] font-black tracking-widest rounded-full">PRESET</span>;
      case 'MANUAL':
        return <span className="bg-mod-blue/10 text-mod-blue border border-mod-blue/20 px-2 py-0.5 text-[8px] font-black tracking-widest rounded-full">MANUAL</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-500 border border-slate-500/20 px-2 py-0.5 text-[8px] font-black tracking-widest rounded-full">LEGACY</span>;
    }
  };

  const openHistory = async (logId: string) => {
    setHistoryLogId(logId);
    const records = await db.getLogModificationHistory(logId);
    setHistoryRecords(records);
  };

  const groupedLogs = useMemo(() => {
    const filtered = logs.filter(log => {
      const userMatch = filterUser === 'ALL' ? true : log.userId === filterUser;
      const projectMatch = filterProject === 'ALL' ? true : log.projectId === filterProject;
      const logDate = new Date(log.date);
      const fromMatch = filterDateFrom ? logDate >= new Date(filterDateFrom) : true;
      const toMatch = filterDateTo ? logDate <= new Date(filterDateTo) : true;
      return userMatch && projectMatch && fromMatch && toMatch;
    });

    const groups: Record<string, GroupedLog> = {};

    filtered.forEach(log => {
      const key = `${log.date}_${log.projectId}_${log.userId}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          date: log.date,
          projectId: log.projectId,
          projectName: log.projectName,
          userId: log.userId,
          totalDuration: 0,
          entries: []
        };
      }
      groups[key].totalDuration += log.durationSeconds;
      groups[key].entries.push(log);
    });

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, filterUser, filterProject, filterDateFrom, filterDateTo]);

  return (
    <div className="p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500 pb-20">
      <div className="mb-10 flex items-end justify-between border-b border-mod-border pb-6">
        <div className="flex items-center gap-4">
          <span className="material-symbols-outlined text-mod-blue text-4xl">list_alt</span>
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">REGISTRO <span className="text-slate-500 font-light not-italic">MOVIMIENTOS</span></h2>
            <p className="text-[10px] text-mod-blue font-bold uppercase tracking-[0.3em] mt-1">Archivo Crítico de Sesiones y Cargas Temporales</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-mod-card border border-mod-border p-6 mb-8 flex flex-wrap gap-6 items-end">
        {isAdmin && (
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Operador</label>
            <select 
              value={filterUser} 
              onChange={e => setFilterUser(e.target.value)}
              className="bg-mod-dark border border-mod-border text-mod-fg text-[10px] font-bold px-4 py-2 outline-none focus:border-mod-blue"
            >
              <option value="ALL">TODOS LOS OPERADORES</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Proyecto</label>
          <select 
            value={filterProject} 
            onChange={e => setFilterProject(e.target.value)}
            className="bg-mod-dark border border-mod-border text-mod-fg text-[10px] font-bold px-4 py-2 outline-none focus:border-mod-blue"
          >
            <option value="ALL">TODOS LOS PROYECTOS</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Desde</label>
          <input 
            type="date" 
            value={filterDateFrom} 
            onChange={e => setFilterDateFrom(e.target.value)}
            className="bg-mod-dark border border-mod-border text-mod-fg text-[10px] font-bold px-4 py-2 outline-none focus:border-mod-blue"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Hasta</label>
          <input 
            type="date" 
            value={filterDateTo} 
            onChange={e => setFilterDateTo(e.target.value)}
            className="bg-mod-dark border border-mod-border text-mod-fg text-[10px] font-bold px-4 py-2 outline-none focus:border-mod-blue"
          />
        </div>

        <button 
          onClick={() => { setFilterUser(isAdmin ? 'ALL' : currentUser.id); setFilterProject('ALL'); setFilterDateFrom(''); setFilterDateTo(''); }}
          className="h-10 px-4 border border-mod-border text-slate-500 hover:text-mod-fg hover:border-mod-fg transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">filter_alt_off</span>
          Reiniciar
        </button>
      </div>

      <div className="bg-mod-card border border-mod-border overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-mod-dark text-slate-500 uppercase font-black tracking-widest border-b border-mod-border">
              <tr>
                <th className="px-8 py-5">Fecha</th>
                {isAdmin && <th className="px-8 py-5">Operador</th>}
                <th className="px-8 py-5">Proyecto</th>
                <th className="px-8 py-5">Comentario</th>
                <th className="px-8 py-5">Carga Temporal</th>
                <th className="px-8 py-5 text-right">Sesiones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mod-border">
              {groupedLogs.map((group) => {
                const operator = users.find(u => u.id === group.userId);
                const isExpanded = expandedGroups.has(group.key);
                
                return (
                  <React.Fragment key={group.key}>
                    <tr className={`hover:bg-mod-fg/[0.02] transition-colors group ${isExpanded ? 'bg-mod-blue/5' : ''}`}>
                      <td className="px-8 py-5 font-mono text-slate-400 uppercase">{group.date}</td>
                      {isAdmin && (
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${operator?.avatarSeed}`} className="w-6 h-6 border border-mod-border bg-mod-dark p-1" />
                            <span className="text-mod-fg font-bold uppercase">{operator?.username || 'SISTEMA'}</span>
                          </div>
                        </td>
                      )}
                      <td className="px-8 py-5">
                        <span className="text-mod-fg font-black uppercase tracking-tight">{group.projectName}</span>
                      </td>
                      <td className="px-8 py-5 max-w-[200px]">
                        {(() => {
                          const withComment = group.entries.filter(e => e.comment?.trim());
                          if (withComment.length === 0) return <span className="text-slate-600 italic">—</span>;
                          if (withComment.length === 1) return <span className="text-slate-300 text-[10px]" title={withComment[0].comment}>💬 {withComment[0].comment}</span>;
                          return <span className="text-slate-400 text-[9px]">💬 {withComment.length} comentarios</span>;
                        })()}
                      </td>
                      <td className="px-8 py-5 font-mono text-mod-blue text-sm font-bold">
                        {formatTimeFull(group.totalDuration)}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => toggleGroup(group.key)}
                          className={`flex items-center gap-2 ml-auto h-8 px-3 border transition-all text-[9px] font-black uppercase tracking-widest ${isExpanded ? 'bg-mod-blue text-mod-fg border-mod-blue' : 'border-mod-border text-slate-500 hover:text-mod-fg'}`}
                        >
                          <span className="material-symbols-outlined text-sm">{isExpanded ? 'keyboard_arrow_up' : 'expand_more'}</span>
                          <span>{group.entries.length > 1 ? `DESGLOSE (${group.entries.length})` : 'DETALLES'}</span>
                        </button>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr>
                        <td colSpan={isAdmin ? 6 : 5} className="bg-mod-dark/40 p-0">
                          <div className="animate-in slide-in-from-top duration-300">
                             <table className="w-full text-[10px]">
                                <thead className="text-slate-500 uppercase font-black tracking-widest text-[8px] border-b border-mod-border/50">
                                  <tr>
                                    <td className="px-8 py-2">Estado / ID</td>
                                    <td className="px-8 py-2">Hora</td>
                                    <td className="px-8 py-2">Comentario</td>
                                    <td className="px-8 py-2 text-right">Duración</td>
                                    <td className="px-8 py-2 text-right">Acciones</td>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-mod-border/50">
                                  {group.entries.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-mod-fg/[0.05]">
                                      <td className="px-8 py-3 text-slate-500 italic flex items-center gap-2">
                                        {getStatusBadge(entry.status)}
                                        <span className="font-mono text-slate-300 opacity-30">{entry.id}</span>
                                      </td>
                                      <td className="px-8 py-3 text-slate-500">
                                        <span className="text-mod-fg font-mono">{entry.created_at ? new Date(entry.created_at).toLocaleTimeString() : '---'}</span>
                                      </td>
                                      <td className="px-8 py-3 text-slate-300 max-w-[280px]">
                                        {entry.comment ? <span title={entry.comment}>💬 {entry.comment}</span> : <span className="text-slate-600 italic">—</span>}
                                      </td>
                                      <td className="px-8 py-3 text-mod-blue font-mono font-bold w-40 text-right">
                                        {formatTimeFull(entry.durationSeconds)}
                                      </td>
                                      <td className="px-8 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {onEditLog && canModify && (
                                            <button
                                              onClick={() => setEditingLog(entry)}
                                              className="text-mod-blue hover:text-mod-fg hover:bg-mod-blue w-8 h-8 flex items-center justify-center transition-all"
                                              title="Editar movimiento"
                                            >
                                              <span className="material-symbols-outlined text-sm">edit</span>
                                            </button>
                                          )}
                                          {isAdmin && (
                                            <button
                                              onClick={() => openHistory(entry.id)}
                                              className="text-amber-500 hover:text-mod-fg hover:bg-amber-600 w-8 h-8 flex items-center justify-center transition-all"
                                              title="Historial de modificaciones"
                                            >
                                              <span className="material-symbols-outlined text-sm">history</span>
                                            </button>
                                          )}
                                          {canModify && (
                                            <button
                                              onClick={() => { if(confirm('¿Eliminar esta sesión individual?')) { onDeleteLog(entry.id); setTimeout(loadData, 300); } }}
                                              className="text-red-500 hover:text-mod-fg hover:bg-red-600 w-8 h-8 flex items-center justify-center transition-all"
                                              title="Borrar Sesión"
                                            >
                                              <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                             </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {groupedLogs.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-8 py-16 text-center text-slate-600 uppercase text-[10px] tracking-[0.4em] italic">No se han encontrado registros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar movimiento */}
      {editingLog && onEditLog && (
        <EditLogModal
          entry={editingLog}
          onClose={() => setEditingLog(null)}
          onSave={async (payload) => {
            await onEditLog(payload);
            await loadData();
            setEditingLog(null);
          }}
        />
      )}

      {/* Modal historial de modificaciones (Admin) */}
      {historyLogId !== null && (
        <HistoryModal
          logId={historyLogId}
          records={historyRecords}
          users={users}
          onClose={() => { setHistoryLogId(null); setHistoryRecords([]); }}
        />
      )}
    </div>
  );
};

function formatTimeFromSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

const EditLogModal: React.FC<{
  entry: DailyLog & { created_at?: string };
  onClose: () => void;
  onSave: (payload: { id: string; durationSeconds: number; date: string; comment?: string | null }) => void | Promise<void>;
}> = ({ entry, onClose, onSave }) => {
  // input type="date" requiere YYYY-MM-DD; entry.date puede venir como "Tue Mar 03 2026"
  const toDateInputValue = (d: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const t = new Date(d).getTime();
    return Number.isNaN(t) ? new Date().toISOString().split('T')[0] : new Date(t).toISOString().split('T')[0];
  };
  const [hours, setHours] = useState(Math.floor(entry.durationSeconds / 3600).toString());
  const [minutes, setMinutes] = useState(Math.floor((entry.durationSeconds % 3600) / 60).toString());
  const [seconds, setSeconds] = useState(Math.floor(entry.durationSeconds % 60).toString());
  const [date, setDate] = useState(toDateInputValue(entry.date));
  const [comment, setComment] = useState(entry.comment ?? '');

  const handleSave = async () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    const totalSeconds = h * 3600 + m * 60 + s;
    await onSave({
      id: entry.id,
      durationSeconds: totalSeconds,
      date,
      comment: comment.trim() || null
    });
  };

  return (
    <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-mod-card border border-mod-border w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-mod-fg font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue">edit</span>
            Editar movimiento
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-mod-fg transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Duración (HH:MM:SS)</label>
            <div className="flex items-center gap-2">
              <input type="text" value={hours} onChange={e => setHours(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="00" className="w-16 bg-mod-dark border border-mod-border text-mod-fg text-center py-2 font-mono outline-none focus:border-mod-blue" />
              <span className="text-mod-blue">:</span>
              <input type="text" value={minutes} onChange={e => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="00" className="w-16 bg-mod-dark border border-mod-border text-mod-fg text-center py-2 font-mono outline-none focus:border-mod-blue" />
              <span className="text-mod-blue">:</span>
              <input type="text" value={seconds} onChange={e => setSeconds(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="00" className="w-16 bg-mod-dark border border-mod-border text-mod-fg text-center py-2 font-mono outline-none focus:border-mod-blue" />
            </div>
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Fecha</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-mod-dark border border-mod-border text-mod-fg py-2 px-3 font-mono outline-none focus:border-mod-blue" />
          </div>
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Comentario</label>
            <input type="text" value={comment} onChange={e => setComment(e.target.value)} placeholder="Opcional" className="w-full bg-mod-dark border border-mod-border text-mod-fg py-2 px-3 outline-none focus:border-mod-blue" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 border border-mod-border text-slate-400 py-2 text-[10px] font-black uppercase tracking-widest hover:text-mod-fg hover:border-mod-fg transition-all">Cancelar</button>
            <button onClick={handleSave} className="flex-1 bg-mod-blue text-mod-fg py-2 text-[10px] font-black uppercase tracking-widest hover:bg-mod-blue/80 transition-all">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const HistoryModal: React.FC<{
  logId: string;
  records: LogModificationRecord[];
  users: User[];
  onClose: () => void;
}> = ({ logId, records, users, onClose }) => {
  const getUser = (id: string) => users.find(u => u.id === id)?.username ?? id;
  return (
    <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-mod-card border border-mod-border w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b border-mod-border">
          <h3 className="text-mod-fg font-black uppercase tracking-widest text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">history</span>
            Historial de modificaciones
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-mod-fg transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          <p className="text-[9px] text-slate-500 font-mono mb-4">Log ID: {logId}</p>
          {records.length === 0 ? (
            <p className="text-slate-500 text-sm italic">Sin modificaciones registradas.</p>
          ) : (
            <ul className="space-y-4">
              {records.map((r, i) => (
                <li key={r.id || i} className="border border-mod-border p-4 bg-mod-dark/50">
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">
                    {new Date(r.modified_at).toLocaleString()} · Por {getUser(r.modified_by_user_id)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>Duración: <span className="text-red-400 line-through">{formatTimeFromSeconds(r.old_duration_seconds)}</span> → <span className="text-mod-blue font-mono">{formatTimeFromSeconds(r.new_duration_seconds)}</span></div>
                    <div>Fecha: <span className="text-red-400 line-through">{r.old_date_str}</span> → <span className="text-mod-blue">{r.new_date_str}</span></div>
                    {(r.old_comment != null || r.new_comment != null) && (
                      <div className="col-span-2">
                        Comentario: <span className="text-red-400 line-through">{r.old_comment ?? '—'}</span> → <span className="text-mod-blue">{r.new_comment ?? '—'}</span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default MovementsView;
