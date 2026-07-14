import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardGrid from './views/DashboardGrid';
import ProjectList from './views/ProjectList';
import Reports from './views/Reports';
import LoginView from './views/LoginView';
import AdminView from './views/AdminView';
import ProfileView from './views/ProfileView';
import AdminUserDetailView from './views/AdminUserDetailView';
import AdminProjectDetailView from './views/AdminProjectDetailView';
import AdminStatsView from './views/AdminStatsView';
import AdminDashboardView from './views/AdminDashboardView';
import WeeklyHistoryView from './views/WeeklyHistoryView';
import MovementsView from './views/MovementsView';
import { View, Project, DailyLog, User, Role } from './types';
import { db } from './services/db';

const VIBRANT_COLORS = [
  'vibrant-red', 'vibrant-blue', 'vibrant-green', 'vibrant-orange', 
  'vibrant-purple', 'vibrant-pink', 'vibrant-cyan', 'vibrant-yellow', 
  'vibrant-indigo', 'vibrant-emerald', 'vibrant-crimson', 'vibrant-teal', 
  'vibrant-amber', 'vibrant-violet', 'vibrant-lime'
];

interface LocalProject extends Project {
  runningSince?: string | null;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.REPORTS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isStartWithTimeModalOpen, setIsStartWithTimeModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<LocalProject | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAdminUser, setSelectedAdminUser] = useState<User | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingNewProjectId, setPendingNewProjectId] = useState<string | null>(null);
  
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [historicalLogs, setHistoricalLogs] = useState<DailyLog[]>([]);
  const [lastSaveDate, setLastSaveDate] = useState(new Date().toDateString());
  
  const projectsRef = useRef<LocalProject[]>([]);
  const wakeLockRef = useRef<any>(null);
  const isCommittingRef = useRef(false);
  // Fecha (toDateString) en la que ya se hizo el auto-guardado de las 23:59
  const autoSaveDoneRef = useRef<string | null>(null);

  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const handleWakeLock = async (active: boolean) => {
    if ('wakeLock' in navigator) {
      try {
        if (active && !wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } else if (!active && wakeLockRef.current) {
          await wakeLockRef.current.release();
          wakeLockRef.current = null;
        }
      } catch (err) {
        console.warn("WakeLock Error", err);
      }
    }
  };

  useEffect(() => {
    db.init().then(() => {
      const savedSession = localStorage.getItem('mod_tracker_session');
      if (savedSession) {
        const user = JSON.parse(savedSession);
        setCurrentUser(user);
        if (user.role === Role.ADMIN) setCurrentView(View.ADMIN_DASHBOARD);
        else setCurrentView(View.REPORTS);
      }
    });
  }, []);

  // Admin no tiene Terminal ni Estadísticas: redirigir al Panel Global
  useEffect(() => {
    if (currentUser?.role === Role.ADMIN && (currentView === View.DASHBOARD || currentView === View.ADMIN_STATS || currentView === View.REPORTS)) {
      setCurrentView(View.ADMIN_DASHBOARD);
    }
  }, [currentUser?.role, currentView]);

  useEffect(() => {
    if (currentUser?.id) {
      loadUserData(currentUser.id);
      refreshCurrentUserFromServer(currentUser.id);
      const poll = setInterval(() => {
        loadUserData(currentUser.id);
        refreshCurrentUserFromServer(currentUser.id);
      }, 15000);
      return () => clearInterval(poll);
    }
  }, [currentUser?.id]);

  const refreshCurrentUserFromServer = async (userId: string) => {
    try {
      const all = await db.getUsers();
      const fresh = all.find((u: User) => u.id === userId);
      if (!fresh) return;
      setCurrentUser(prev => {
        if (!prev) return prev;
        // Conservar la password local (el servidor la devuelve igual, pero por si acaso)
        const merged = { ...prev, ...fresh, password: prev.password };
        // Solo persistir/actualizar si algún campo realmente cambió
        const changed = JSON.stringify(prev) !== JSON.stringify(merged);
        if (changed) {
          localStorage.setItem('mod_tracker_session', JSON.stringify(merged));
          return merged;
        }
        return prev;
      });
    } catch (_) {
      // Silencioso: si falla el refresh seguimos con el currentUser actual
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      const [userProjects, userLogs] = await Promise.all([
        db.getProjects(userId),
        db.getLogs(userId)
      ]);

      const nowMillis = Date.now();
      // Solo puede haber un temporizador en marcha: normalizar por si el servidor devolvió varios con running_since
      let foundRunning = false;
      const runningIds = userProjects.filter((p: LocalProject) => p.runningSince).map((p: LocalProject) => p.id);
      const withSeconds = userProjects.map((p: LocalProject) => {
        let displaySeconds = p.currentDaySeconds || 0;
        let runningSince = p.runningSince;
        if (p.runningSince) {
          if (foundRunning) {
            runningSince = null;
          } else {
            foundRunning = true;
            const startMillis = parseInt(p.runningSince);
            if (!isNaN(startMillis)) {
              displaySeconds += Math.floor((nowMillis - startMillis) / 1000);
              displaySeconds = Math.max(0, displaySeconds);
            }
          }
        }
        return { ...p, currentDaySeconds: displaySeconds, runningSince: runningSince ?? null, status: runningSince ? 'Running' as const : 'Active' as const };
      });

      setProjects(withSeconds);
      // Si había más de uno en marcha, persistir el parado en el servidor
      if (runningIds.length > 1) {
        for (let i = 1; i < runningIds.length; i++) {
          const proj = withSeconds.find((p: LocalProject) => p.id === runningIds[i]);
          if (proj) {
            try {
              await db.saveProject({ ...proj, userId, runningSince: null });
            } catch (_) {}
          }
        }
      }
      setHistoricalLogs(userLogs);
    } catch (e) {
      console.error("Fallo al cargar datos", e);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    if (user.role === Role.ADMIN) setCurrentView(View.ADMIN_DASHBOARD);
    else setCurrentView(View.REPORTS);
    localStorage.setItem('mod_tracker_session', JSON.stringify(user));
  };

  const commitDailyLogs = useCallback(async () => {
    if (!currentUser) return;
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;

    try {
      const today = new Date().toDateString();

      const projectsToCommit = projectsRef.current.filter(p => p.currentDaySeconds > 0);
      if (projectsToCommit.length === 0) return;

      const committedIds = new Set<string>();

      for (const project of projectsToCommit) {
        const finalLog: DailyLog & { comment?: string } = {
          id: `LOG-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          userId: currentUser.id,
          date: today,
          projectId: project.id,
          projectName: project.name,
          durationSeconds: Math.floor(project.currentDaySeconds),
          status: 'NORMAL',
          comment: (project as LocalProject).sessionComment ?? undefined
        };

        try {
          await db.saveLog(finalLog);
        } catch (err) {
          console.error('Error guardando log, se omite el reset para no perder datos:', err);
          continue;
        }

        await db.saveProject({
          ...project,
          userId: currentUser.id,
          runningSince: null,
          currentDaySeconds: 0,
          sessionComment: undefined
        });

        committedIds.add(project.id);
      }

      if (committedIds.size > 0) {
        setProjects(prev => prev.map(p =>
          committedIds.has(p.id)
            ? { ...p, status: 'Active' as const, runningSince: null, currentDaySeconds: 0, sessionComment: undefined }
            : p
        ));
      }

      loadUserData(currentUser.id);
    } finally {
      isCommittingRef.current = false;
    }
  }, [currentUser]);

  const handleLogout = async () => {
    handleWakeLock(false);
    setCurrentUser(null);
    localStorage.removeItem('mod_tracker_session');
    setProjects([]);
    setHistoricalLogs([]);
    setCurrentView(View.DASHBOARD);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const today = now.toDateString();

      // Cambio de día: reseteamos el marcador para permitir el auto-guardado del nuevo día
      if (today !== lastSaveDate) {
        setLastSaveDate(today);
      }

      // Guardado automático a las 23:59: persiste el tiempo del día ACTUAL antes de
      // cruzar medianoche, de modo que quede registrado en la fecha correcta aunque
      // el usuario no haya pulsado "Sincronizar". Solo una vez por día.
      if (now.getHours() === 23 && now.getMinutes() === 59 && autoSaveDoneRef.current !== today) {
        autoSaveDoneRef.current = today;
        commitDailyLogs();
      }

      const isAnyRunning = projectsRef.current.some(p => p.status === 'Running');
      handleWakeLock(isAnyRunning);

      setProjects(prev => prev.map(p =>
        p.status === 'Running' ? { ...p, currentDaySeconds: p.currentDaySeconds + 1 } : p
      ));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSaveDate, commitDailyLogs]);

  const handleToggleTimer = async (projectId: string) => {
    if (!currentUser) return;
    const target = projects.find(p => p.id === projectId);
    if (!target) return;

    const isRunning = target.status === 'Running';
    const startTimeStamp = Date.now().toString();

    const applyToggle = (p: LocalProject): LocalProject => {
      if (p.id === projectId) {
        return { ...p, status: (isRunning ? 'Active' : 'Running') as any, runningSince: isRunning ? null : startTimeStamp };
      }
      if (p.status === 'Running') {
        return { ...p, status: 'Active' as any, runningSince: null };
      }
      return p;
    };

    // Forma funcional para no sobreescribir updates pendientes (ej: sessionComment de handleCommentChange)
    setProjects(prev => prev.map(applyToggle));

    // Para el guardado en BD usamos projects del closure; el COALESCE de SQL preserva session_comment si no se envía
    const updatedForDb = projects.map(applyToggle);
    try {
      for (const p of updatedForDb) {
         await db.saveProject({ ...p, userId: currentUser.id });
      }
    } catch (e) {
      console.error("Error al persistir cronómetro", e);
    }
  };

  const handleStartWithPreset = async (projectId: string, initialSeconds: number) => {
    if (!currentUser) return;
    const startTimeStamp = Date.now().toString();
    const applyPreset = (p: LocalProject): LocalProject => {
      if (p.id === projectId) return { ...p, status: 'Running' as any, currentDaySeconds: initialSeconds, runningSince: startTimeStamp };
      if (p.status === 'Running') return { ...p, status: 'Active' as any, runningSince: null };
      return p;
    };
    setProjects(prev => prev.map(applyPreset));
    const updated = projects.map(applyPreset);
    try {
      for (const p of updated) {
        await db.saveProject({
          ...p,
          userId: currentUser.id
        });
      }
      setIsStartWithTimeModalOpen(false);
    } catch (e) {
      alert("Error al iniciar con tiempo. Revisa la conexión con api.php");
    }
  };

  const handleToggleHideProject = async (projectId: string) => {
    if (!currentUser) return;
    const target = projects.find(p => p.id === projectId);
    if (!target) return;
    
    const newHiddenStatus = !target.isHiddenForUser;
    const isRunning = target.status === 'Running' || !!target.runningSince;
    const rebasedSince = isRunning ? Date.now().toString() : (target.runningSince ?? null);

    const updated = { ...target, userId: currentUser.id, isHiddenForUser: newHiddenStatus, runningSince: rebasedSince };
    try {
      await db.saveProject(updated);
      loadUserData(currentUser.id);
    } catch (e) {
      alert("Error al ocultar proyecto.");
    }
  };

  const handleManualTimeEntry = async (projectId: string, totalSeconds: number, dateStr: string) => {
    if (!currentUser) return;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const normalizedDate = new Date(dateStr + 'T12:00:00').toDateString();
    
    const finalLog: DailyLog = { 
      id: `MAN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 
      userId: currentUser.id, 
      date: normalizedDate, 
      projectId: projectId, 
      projectName: project.name, 
      durationSeconds: totalSeconds, 
      status: 'MANUAL' 
    };
    try {
      await db.saveLog(finalLog);
      loadUserData(currentUser.id);
      setIsManualModalOpen(false);
      setPendingNewProjectId(null);
    } catch (e) {
      alert("Error al inyectar datos manuales.");
    }
  };

  const handleDeleteLog = async (logId: string) => {
    if (!currentUser) return;
    if (confirm('¿ELIMINAR ESTE MOVIMIENTO EN EL SERVIDOR?')) {
      try {
        await db.deleteLog(logId, currentUser.id);
        loadUserData(currentUser.id);
      } catch (e: any) {
        alert(`No se pudo eliminar: ${e?.message ?? 'error desconocido'}`);
      }
    }
  };

  const handleEditLog = async (payload: { id: string; durationSeconds: number; date: string; comment?: string | null }) => {
    if (!currentUser) return;
    // Normalizar fecha a formato toDateString (ej. "Tue Mar 03 2026") para que las gráficas la reconozcan
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? new Date(payload.date + 'T12:00:00').toDateString()
      : payload.date;
    try {
      await db.updateLog({ ...payload, date: dateStr, modifiedByUserId: currentUser.id });
      loadUserData(currentUser.id);
    } catch (e) {
      alert('Error al guardar el movimiento.');
    }
  };

  const handleCommentChange = async (projectId: string, sessionComment: string) => {
    if (!currentUser) return;
    const target = projectsRef.current.find(p => p.id === projectId);
    if (!target) return;
    const isRunning = target.status === 'Running' || !!target.runningSince;
    // Rebasar el arranque al persistir un timer en marcha para no duplicar tiempo.
    const rebasedSince = isRunning ? Date.now().toString() : (target.runningSince ?? null);
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, sessionComment, runningSince: rebasedSince }
      : p));
    try {
      await db.saveProject({ ...target, userId: currentUser.id, sessionComment, runningSince: rebasedSince });
    } catch (e) { console.error(e); }
  };

  const handleResetProject = async (projectId: string) => {
    if (!currentUser) return;
    if (!confirm('¿Poner el contador a cero? Se perderá el tiempo acumulado del día para este proyecto.')) return;
    const updated = projects.map(p => p.id === projectId ? { ...p, currentDaySeconds: 0, runningSince: null, status: 'Active' as const } : p);
    setProjects(updated as LocalProject[]);
    try {
      const p = updated.find(x => x.id === projectId);
      if (p) await db.saveProject({ ...p, userId: currentUser.id, currentDaySeconds: 0, runningSince: null });
      loadUserData(currentUser.id);
    } catch (e) { alert('Error al resetear.'); }
  };

  const handleAdjustTimer = async (projectId: string, deltaSeconds: number) => {
    if (!currentUser) return;
    const target = projectsRef.current.find(p => p.id === projectId);
    if (!target) return;
    const isRunning = target.status === 'Running' || !!target.runningSince;
    // Si está en marcha, rebasar el arranque a "ahora" para que el servidor no
    // vuelva a sumar el tiempo ya transcurrido (evita horas fantasma).
    const rebasedSince = isRunning ? Date.now().toString() : (target.runningSince ?? null);
    const newSeconds = Math.max(0, Math.floor((target.currentDaySeconds || 0) + deltaSeconds));
    setProjects(prev => prev.map(p => p.id === projectId
      ? { ...p, currentDaySeconds: newSeconds, runningSince: rebasedSince }
      : p));
    try {
      await db.saveProject({ ...target, userId: currentUser.id, currentDaySeconds: newSeconds, runningSince: rebasedSince });
    } catch (e) { console.error(e); }
  };

  const handleReorderProjects = async (newOrder: string[]) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, projectOrder: newOrder };
    setCurrentUser(updatedUser);
    localStorage.setItem('mod_tracker_session', JSON.stringify(updatedUser));
    try {
      await db.saveUser(updatedUser);
    } catch (e) {}
  };

  const handleUpdateProject = async (data: any) => {
    if (!editingProject || !currentUser) return;
    const updatedProject: LocalProject = { 
      ...editingProject, 
      userId: currentUser.id,
      name: data.name || editingProject.name, 
      category: data.category || editingProject.category, 
      color: data.color || editingProject.color
    };
    try {
      await db.saveProject(updatedProject);
      setEditingProject(null);
      loadUserData(currentUser.id);
    } catch (e) {
      alert("Error al actualizar el proyecto. Verifica que el servidor MySQL acepte conexiones.");
    }
  };

  const handleCreateProject = async (data: any) => {
    if (!currentUser) return;
    const newProject: LocalProject = { 
      id: `PJ-${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 
      userId: currentUser.id,
      creatorId: currentUser.id,
      name: data.name || 'UNNAMED', 
      category: data.category || 'General', 
      color: data.color, 
      lastTracked: 'Now', 
      usageLevel: 0, 
      totalHours: '0h', 
      status: 'Active', 
      department: data.isGlobal ? 'GLOBAL' : 'PRIVATE', 
      currentDaySeconds: 0,
      isGlobal: data.isGlobal ?? false,
      isHiddenForUser: false,
      runningSince: null,
      hiddenBy: [],
      isActive: true
    };
    
    try {
      await db.saveProject(newProject);
      setPendingNewProjectId(newProject.id);
      setIsModalOpen(false);
      loadUserData(currentUser.id);
    } catch (e) {
      console.error(e);
      alert("ERROR AL CREAR PROYECTO: Es posible que api.php no tenga los campos necesarios en la base de datos. Se ha intentado corregir automáticamente, por favor inténtalo de nuevo.");
    }
  };

  const handleSearchResultClick = (type: 'USER' | 'PROJECT', item: any) => {
    if (type === 'USER') {
      setSelectedAdminUser(item);
      setCurrentView(View.ADMIN_USERS);
    } else {
      setSelectedProjectId(item.id);
      setCurrentView(View.ADMIN_PROJECTS);
    }
  };

  const formatTimerShort = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  if (!currentUser) return <LoginView onLogin={handleLogin} />;

  const getHeaderProps = () => {
    const timerSeconds = projects.reduce((acc, p) => acc + p.currentDaySeconds, 0);
    const todayStr = new Date().toDateString();
    const manualSeconds = historicalLogs
      .filter(log => log.status === 'MANUAL' && log.date === todayStr)
      .reduce((acc, log) => acc + log.durationSeconds, 0);
    const timerStr = formatTimerShort(timerSeconds);
    const manualStr = manualSeconds > 0 ? ` \u00A0+${formatTimerShort(manualSeconds)}` : '';
    const sessionLabel = timerStr + manualStr;
    switch (currentView) {
      case View.DASHBOARD: return { title: 'Terminal', activeTime: sessionLabel, actionLabel: 'Sincronizar' };
      case View.MOVEMENTS: return { title: 'Movimientos', actionLabel: 'Sincronizar' };
      case View.REPORTS: return { title: 'Reportes', actionLabel: 'Sincronizar' };
      case View.ADMIN_DASHBOARD: return { title: 'Panel Global', actionLabel: 'Acción' };
      default: return { title: 'MOD Tracker', actionLabel: 'Acción' };
    }
  };

  const renderView = () => {
    if (selectedAdminUser && currentView === View.ADMIN_USERS) {
      return (
        <AdminUserDetailView
          user={selectedAdminUser}
          onBack={() => setSelectedAdminUser(null)}
          onProjectClick={(id) => { setSelectedProjectId(id); setCurrentView(View.ADMIN_PROJECTS); }}
        />
      );
    }
    if (selectedProjectId && currentView === View.ADMIN_PROJECTS) {
      return (
        <AdminProjectDetailView
          projectId={selectedProjectId}
          onBack={() => setSelectedProjectId(null)}
          onUserSelect={(u) => { setSelectedAdminUser(u); setCurrentView(View.ADMIN_USERS); }}
        />
      );
    }
    switch (currentView) {
      case View.DASHBOARD: {
        const todayStr = new Date().toDateString();
        const manualTodayByProject: Record<string, number> = {};
        historicalLogs.forEach(log => {
          if (log.status === 'MANUAL' && log.date === todayStr) {
            manualTodayByProject[log.projectId] = (manualTodayByProject[log.projectId] || 0) + log.durationSeconds;
          }
        });
        return (
        <DashboardGrid 
          projects={projects}
          manualTodayByProject={manualTodayByProject}
          currentUser={currentUser}
          showHidden={showHidden}
          onToggleTimer={handleToggleTimer} 
          onStartWithTime={(id) => { setSelectedProjectId(id); setIsStartWithTimeModalOpen(true); }}
          onToggleHide={handleToggleHideProject}
          onToggleShowHidden={() => setShowHidden(!showHidden)}
          onNewProject={() => setIsModalOpen(true)} 
          onReorderProjects={handleReorderProjects}
          onCommentChange={handleCommentChange}
          onResetProject={handleResetProject}
          onAdjustTimer={handleAdjustTimer}
        />
      );
      }
      case View.MOVEMENTS: return <MovementsView currentUser={currentUser} onDeleteLog={handleDeleteLog} onEditLog={handleEditLog} />;
      case View.PROJECT_LIST: return <ProjectList projects={projects} onEditProject={(p) => setEditingProject(p as LocalProject)} />;
      case View.REPORTS: return <Reports projects={projects} historicalLogs={historicalLogs} onManualCommit={() => commitDailyLogs()} />;
      case View.WEEKLY_HISTORY: return <WeeklyHistoryView currentUser={currentUser} />;
      case View.ADMIN_DASHBOARD: return <AdminDashboardView onUserSelect={(u) => { setSelectedAdminUser(u); setCurrentView(View.ADMIN_USERS); }} />;
      case View.ADMIN_STATS: return <AdminStatsView onUserSelect={(u) => { setSelectedAdminUser(u); setCurrentView(View.ADMIN_USERS); }} />;
      case View.ADMIN_USERS: return <AdminView type="USERS" onUserSelect={(user) => setSelectedAdminUser(user)} />;
      case View.ADMIN_PROJECTS: return <AdminView type="PROJECTS" onUserSelect={(u) => setSelectedAdminUser(u)} onProjectSelect={(p) => { setSelectedProjectId(p.id); }} />;
      case View.PROFILE: return <ProfileView user={currentUser} />;
      default: return null;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-mod-dark relative">
      <Sidebar 
        currentView={currentView} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onViewChange={(v) => { 
          setCurrentView(v); 
          setSelectedAdminUser(null); 
          setSelectedProjectId(null); 
          setIsSidebarOpen(false);
        }} 
        onNewProject={() => { setIsModalOpen(true); setIsSidebarOpen(false); }} 
        user={currentUser} 
        onLogout={handleLogout} 
      />
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header 
          {...getHeaderProps()} 
          user={currentUser}
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onSearch={setSearchQuery} 
          onResultClick={handleSearchResultClick}
          onManualEntry={() => setIsManualModalOpen(true)}
          onActionButton={() => {
            if (currentView === View.DASHBOARD || currentView === View.MOVEMENTS || currentView === View.REPORTS) {
              commitDailyLogs();
            } else {
              setIsModalOpen(true);
            }
          }} 
        />
        <div className="flex-1 overflow-y-auto bg-background-dark">
          {renderView()}
        </div>
      </main>

      {(isModalOpen || editingProject) && (
        <ProjectModal 
          project={editingProject} 
          onClose={() => { setIsModalOpen(false); setEditingProject(null); }}
          onSave={(data) => editingProject ? handleUpdateProject(data) : handleCreateProject(data)}
        />
      )}

      {isManualModalOpen && (
        <ManualTimeModal 
          key={`${pendingNewProjectId || ''}-${projects.length}`}
          projects={projects}
          onClose={() => { setIsManualModalOpen(false); setPendingNewProjectId(null); }}
          onSave={(id, secs, date) => handleManualTimeEntry(id, secs, date || new Date().toISOString().split('T')[0])}
          onNewProject={() => setIsModalOpen(true)}
          defaultProjectId={pendingNewProjectId || undefined}
          showDatePicker
        />
      )}

      {isStartWithTimeModalOpen && selectedProjectId && (
        <ManualTimeModal 
          projects={projects.filter(p => p.id === selectedProjectId)}
          onClose={() => setIsStartWithTimeModalOpen(false)}
          onSave={(id, secs) => handleStartWithPreset(id, secs)}
          title="Arrancar con Tiempo"
        />
      )}
    </div>
  );
};

const ManualTimeModal: React.FC<{ projects: Project[]; onClose: () => void; onSave: (id: string, secs: number, date?: string) => void; title?: string; showDatePicker?: boolean; onNewProject?: () => void; defaultProjectId?: string }> = ({ projects, onClose, onSave, title = "Inyección de Datos Manual", showDatePicker = false, onNewProject, defaultProjectId }) => {
  const [selId, setSelId] = useState(defaultProjectId || projects[0]?.id || '');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const minInputRef = useRef<HTMLInputElement>(null);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHours(val);
    if (val.length === 2) minInputRef.current?.focus();
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (parseInt(val) > 59) val = '59';
    setMinutes(val);
  };

  const handleSave = () => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    if (h === 0 && m === 0) return;
    onSave(selId, (h * 3600) + (m * 60), date);
  };

  return (
    <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-mod-card border border-mod-fg/20 w-full max-w-md p-8 shadow-[0_0_50px_rgba(0,163,224,0.1)]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-mod-fg font-black uppercase tracking-[0.3em] text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-mod-blue">history_edu</span>
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-mod-fg transition-colors">
             <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="space-y-8">
          <div>
            <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Nodo del Sistema</label>
            <div className="flex items-end gap-2">
              <select value={selId} tabIndex={1} onChange={e=>setSelId(e.target.value)} className="flex-1 bg-mod-dark border border-mod-border text-mod-fg p-4 font-mono text-sm outline-none focus:border-mod-blue">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {onNewProject && (
                <button onClick={onNewProject} className="h-[60px] w-[60px] border border-mod-border bg-mod-dark text-mod-blue hover:bg-mod-blue hover:text-mod-fg transition-colors flex items-center justify-center flex-shrink-0" title="Nuevo Proyecto">
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Unidades Temporales (HH:MM)</label>
              <div className="flex items-center gap-3">
                <input autoFocus type="text" tabIndex={2} value={hours} onChange={handleHoursChange} placeholder="00" className="w-full bg-mod-dark border border-mod-border text-mod-fg text-center p-4 text-3xl font-mono focus:border-mod-blue outline-none" />
                <span className="text-2xl font-mono text-mod-blue">:</span>
                <input ref={minInputRef} type="text" tabIndex={3} value={minutes} onChange={handleMinutesChange} placeholder="00" className="w-full bg-mod-dark border border-mod-border text-mod-fg text-center p-4 text-3xl font-mono focus:border-mod-blue outline-none" />
              </div>
            </div>

            {showDatePicker && (
              <div>
                <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Fecha del Registro</label>
                <input 
                  type="date" 
                  value={date} 
                  tabIndex={4}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setDate(e.target.value)} 
                  className="w-full h-[68px] bg-mod-dark border border-mod-border text-mod-fg text-center px-2 font-mono text-xs focus:border-mod-blue outline-none uppercase" 
                />
              </div>
            )}
          </div>

          <button tabIndex={5} onClick={handleSave} className="w-full bg-mod-fg text-mod-dark py-5 font-black uppercase text-[10px] tracking-[0.4em] hover:bg-mod-blue hover:text-mod-fg transition-all shadow-xl active:scale-95">Inyectar en Base de Datos</button>
        </div>
      </div>
    </div>
  );
};

const ProjectModal: React.FC<{ project: Project | null; onClose: () => void; onSave: (data: any) => void; }> = ({ project, onClose, onSave }) => {
  const [formData, setFormData] = useState({ name: project?.name || '', category: project?.category || '', color: project?.color || VIBRANT_COLORS[0], isGlobal: project?.isGlobal ?? false });
  return (
    <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-md z-[250] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-mod-card border border-mod-fg/20 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-mod-fg font-black uppercase tracking-widest text-xs mb-6">{project ? 'Modificar' : 'Crear'} Unidad</h3>
        <div className="space-y-4">
          <input autoFocus value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value.toUpperCase()})} className="w-full bg-mod-dark border border-mod-border text-mod-fg p-3 font-mono" placeholder="ID_UNIDAD" />
          <input value={formData.category} onChange={e=>setFormData({...formData, category: e.target.value})} className="w-full bg-mod-dark border border-mod-border text-mod-fg p-3" placeholder="CATEGORÍA" />
          {!project && (
            <div>
              <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Alcance</label>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-black uppercase tracking-widest ${!formData.isGlobal ? 'text-mod-blue' : 'text-slate-500'}`}>Personal</span>
                <button role="switch" aria-checked={formData.isGlobal}
                  onClick={() => setFormData({...formData, isGlobal: !formData.isGlobal})}
                  className={`relative h-6 w-12 border transition-colors ${formData.isGlobal ? 'bg-mod-blue border-mod-blue' : 'bg-mod-dark border-mod-border'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 bg-mod-fg transition-all ${formData.isGlobal ? 'left-[26px]' : 'left-0.5'}`} />
                </button>
                <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isGlobal ? 'text-mod-blue' : 'text-slate-500'}`}>Global</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-5 gap-2">
            {VIBRANT_COLORS.map(c => (
              <button key={c} onClick={()=>setFormData({...formData, color: c})} className={`h-8 ${c} border ${formData.color === c ? 'border-mod-fg scale-110' : 'border-transparent opacity-50'} transition-all`} />
            ))}
          </div>
          <button onClick={() => onSave(formData)} className="w-full bg-mod-fg text-mod-dark py-4 font-black uppercase text-[10px] tracking-widest">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

export default App;