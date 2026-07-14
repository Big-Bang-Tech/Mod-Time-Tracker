import React, { useState } from 'react';
import { Project, User, Role } from '../types';

interface DashboardGridProps {
  projects: (Project & { sessionOrigin?: string; isHiddenForUser?: boolean; sessionComment?: string })[];
  manualTodayByProject?: Record<string, number>;
  currentUser: User;
  showHidden: boolean;
  onToggleTimer: (projectId: string) => void;
  onStartWithTime: (projectId: string) => void;
  onToggleHide: (projectId: string) => void;
  onToggleShowHidden: () => void;
  onNewProject: () => void;
  onReorderProjects: (newOrder: string[]) => void;
  onCommentChange?: (projectId: string, sessionComment: string) => void;
  onResetProject?: (projectId: string) => void;
  onAdjustTimer?: (projectId: string, deltaSeconds: number) => void;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({ 
  projects, 
  manualTodayByProject = {},
  currentUser, 
  showHidden, 
  onToggleTimer, 
  onStartWithTime,
  onToggleHide, 
  onToggleShowHidden, 
  onNewProject,
  onReorderProjects,
  onCommentChange,
  onResetProject,
  onAdjustTimer
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [commentFocusedId, setCommentFocusedId] = useState<string | null>(null);
  const isAdmin = currentUser.role === Role.ADMIN;

  const formatTimerWithSeconds = (seconds: number, isRunning: boolean) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    const separator = isRunning ? <span className="timer-blink">:</span> : <span>:</span>;
    return (
      <span className="flex items-center">
        {h}{separator}{m}{separator}{s}
      </span>
    );
  };

  const formatManualTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `+${h}h ${m.toString().padStart(2, '0')}m`;
    return `+${m}m`;
  };

  const currentOrder = localOrder || currentUser.projectOrder || projects.map(p => p.id);
  const fullOrder = Array.from(new Set([...currentOrder, ...projects.map(p => p.id)]));
  const sortedProjects = [...projects].sort((a, b) => fullOrder.indexOf(a.id) - fullOrder.indexOf(b.id));
  
  const filteredProjects = sortedProjects.filter(p => {
    const isActuallyHidden = p.isHiddenForUser;
    const isInactive = p.isActive === false;
    
    if (!isAdmin && isInactive) return false;
    return showHidden || !isActuallyHidden;
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    setLocalOrder(fullOrder);
    e.dataTransfer.effectAllowed = 'move';
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragEnter = (e: React.DragEvent, targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const newOrder = [...fullOrder];
    const oldIndex = newOrder.indexOf(draggedId);
    const newIndex = newOrder.indexOf(targetId);
    if (oldIndex !== -1 && newIndex !== -1) {
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, draggedId);
      setLocalOrder(newOrder);
    }
  };

  const handleDragEnd = () => {
    if (draggedId && localOrder) onReorderProjects(localOrder);
    setDraggedId(null);
    setLocalOrder(null);
  };

  return (
    <div className="p-4 lg:p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500">
      <div className="mb-6 lg:mb-10 flex items-center justify-between">
        <h2 className="text-xl lg:text-4xl font-light text-mod-fg uppercase tracking-tighter">GRID <span className="font-bold">MOD</span></h2>
        <button 
          onClick={onToggleShowHidden}
          className={`flex items-center gap-2 px-3 py-1.5 border text-[8px] font-black uppercase tracking-widest ${showHidden ? 'bg-mod-fg text-mod-dark border-mod-fg' : 'bg-transparent text-slate-500 border-mod-border'}`}
        >
          <span className="material-symbols-outlined text-[12px]">{showHidden ? 'visibility' : 'visibility_off'}</span>
          <span className="hidden sm:inline">{showHidden ? 'Ocultar' : 'Ver Todos'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 landscape:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4 xl:gap-6 transition-all duration-300">
        {filteredProjects.map((project) => {
          const isRunning = project.status === 'Running';
          const isHidden = project.isHiddenForUser;
          const isInactive = project.isActive === false;
          const isLight = ['vibrant-cyan', 'vibrant-yellow', 'vibrant-lime', 'vibrant-emerald'].includes(project.color);

          return (
            <div 
              key={project.id}
              draggable
              onDragStart={(e) => handleDragStart(e, project.id)}
              onDragEnter={(e) => handleDragEnter(e, project.id)}
              onDragEnd={handleDragEnd}
              className={`
                group relative flex flex-col justify-between aspect-square p-4 lg:p-5 xl:p-8 cursor-pointer transition-all duration-300
                ${project.color} ${isRunning ? 'active-project-card scale-[1.03]' : 'opacity-90 hover:brightness-110'}
                ${isLight ? 'text-black' : 'text-mod-fg'}
                ${isHidden || isInactive ? 'grayscale opacity-30 brightness-50' : ''}
              `}
              onClick={() => !isInactive && onToggleTimer(project.id)}
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <span className={`text-[7px] lg:text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 ${isRunning ? (isLight ? 'bg-black text-mod-fg' : 'bg-mod-fg text-black') : 'bg-black/20'}`}>
                    {isRunning ? 'TX' : project.department.slice(0,3)}
                  </span>
                  {isInactive && (
                    <span className={`text-[6px] lg:text-[8px] font-black uppercase tracking-widest px-1 py-0.5 bg-red-600 text-mod-fg`}>
                      INACTIVO
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 lg:gap-2">
                  {!isInactive && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleHide(project.id); }}
                        className={`w-5 h-5 lg:w-6 lg:h-6 xl:w-8 xl:h-8 flex items-center justify-center border transition-all hover:scale-110 ${isLight ? 'border-black/20 hover:bg-black hover:text-mod-fg' : 'border-mod-fg/20 hover:bg-mod-fg hover:text-mod-dark'}`}
                        title={isHidden ? "Mostrar" : "Ocultar"}
                      >
                        <span className="material-symbols-outlined text-xs lg:text-sm xl:text-lg">{isHidden ? 'visibility' : 'visibility_off'}</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onStartWithTime(project.id); }}
                        className={`w-5 h-5 lg:w-6 lg:h-6 xl:w-8 xl:h-8 flex items-center justify-center border transition-all hover:scale-110 ${isLight ? 'border-black/20 hover:bg-black hover:text-mod-fg' : 'border-mod-fg/20 hover:bg-mod-fg hover:text-mod-dark'}`}
                        title="Cargar/Iniciar con tiempo"
                      >
                        <span className="material-symbols-outlined text-xs lg:text-sm xl:text-lg">more_time</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onToggleTimer(project.id); }}
                        className={`w-5 h-5 lg:w-6 lg:h-6 xl:w-8 xl:h-8 flex items-center justify-center border transition-all hover:scale-110 ${isRunning ? (isLight ? 'bg-black text-mod-fg border-black' : 'bg-mod-fg text-mod-dark border-mod-fg') : (isLight ? 'border-black/20 hover:bg-black hover:text-mod-fg' : 'border-mod-fg/20 hover:bg-mod-fg hover:text-mod-dark')}`}
                      >
                        <span className="material-symbols-outlined text-xs lg:text-sm xl:text-lg">{isRunning ? 'pause' : 'play_arrow'}</span>
                      </button>
                    </>
                  )}
                  {isInactive && isAdmin && (
                    <div className="text-[10px] font-black uppercase opacity-50">Solo Admin</div>
                  )}
                </div>
              </div>

              <div className="min-h-0">
                <h3 className="text-xs lg:text-base xl:text-2xl font-black uppercase tracking-tighter truncate drop-shadow-sm">{project.name}</h3>
                <p className="text-[7px] lg:text-[9px] xl:text-[10px] font-bold uppercase opacity-60 truncate">{project.category}</p>
              </div>

              {/* Comentario de sesión: solo cuando el tiempo no es cero (iniciado o pausado) */}
              {(project.currentDaySeconds > 0) && onCommentChange && (
                <div className="min-h-0 py-1 pointer-events-auto" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={(project as Project & { sessionComment?: string }).sessionComment ?? ''}
                    onChange={e => onCommentChange(project.id, e.target.value)}
                    onFocus={() => setCommentFocusedId(project.id)}
                    onBlur={() => setCommentFocusedId(null)}
                    placeholder="Comentario..."
                    className={`w-full text-[7px] lg:text-[8px] xl:text-[9px] font-medium px-2 py-1 border bg-black/10 placeholder:opacity-50 outline-none ${isLight ? 'border-black/30 text-black placeholder:text-black/50' : 'border-mod-fg/20 text-mod-fg placeholder:text-mod-fg/50'}`}
                  />
                </div>
              )}

              <div className={`space-y-1 lg:space-y-2 xl:space-y-4 min-h-0 flex flex-col justify-end ${commentFocusedId === project.id ? '' : 'pointer-events-none'}`}>
                <div className="flex items-center gap-1 lg:gap-2 flex-wrap">
                  <div className="text-base lg:text-xl xl:text-4xl font-mono font-bold tracking-tighter leading-tight overflow-hidden">
                    {formatTimerWithSeconds(project.currentDaySeconds, isRunning)}
                  </div>
                  {manualTodayByProject[project.id] > 0 && (
                    <span className={`text-[10px] lg:text-xs xl:text-sm font-mono font-bold ml-1 ${isLight ? 'text-emerald-700' : 'text-mod-blue'}`}>
                      {formatManualTime(manualTodayByProject[project.id])}
                    </span>
                  )}
                  {(project.currentDaySeconds > 0) && onAdjustTimer && (
                    <div className="flex items-center gap-0.5 pointer-events-auto" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onAdjustTimer(project.id, -60)}
                        className={`w-6 h-6 lg:w-7 lg:h-7 flex items-center justify-center border text-xs font-black ${isLight ? 'border-black/30 hover:bg-black hover:text-mod-fg' : 'border-mod-fg/30 hover:bg-mod-fg hover:text-mod-dark'}`}
                        title="−1 min"
                      >−</button>
                      <button
                        type="button"
                        onClick={() => onAdjustTimer(project.id, 60)}
                        className={`w-6 h-6 lg:w-7 lg:h-7 flex items-center justify-center border text-xs font-black ${isLight ? 'border-black/30 hover:bg-black hover:text-mod-fg' : 'border-mod-fg/30 hover:bg-mod-fg hover:text-mod-dark'}`}
                        title="+1 min"
                      >+</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-0.5 flex-1 bg-black/10">
                    <div className={`h-full bg-current transition-all duration-300 ${isRunning ? 'w-full opacity-100' : 'w-0 opacity-0'}`}></div>
                  </div>
                  {(project.currentDaySeconds > 0) && onResetProject && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onResetProject(project.id); }}
                      className={`pointer-events-auto shrink-0 px-2 py-1 text-[7px] lg:text-[8px] font-black uppercase border ${isLight ? 'border-black/30 hover:bg-black hover:text-mod-fg' : 'border-mod-fg/30 hover:bg-mod-fg hover:text-mod-dark'}`}
                      title="Poner contador a cero"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {filteredProjects.length < 12 && (
          <div 
            onClick={onNewProject}
            className="border-2 border-dashed border-mod-border hover:border-mod-fg/50 flex flex-col items-center justify-center aspect-square text-slate-500 hover:text-mod-fg transition-all bg-mod-card/20"
          >
            <span className="material-symbols-outlined text-3xl">add</span>
            <span className="text-[8px] font-black uppercase mt-2">Nuevo</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardGrid;