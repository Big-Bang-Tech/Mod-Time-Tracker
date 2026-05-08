
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { User, Project, Role, DailyLog } from '../types';

interface AdminViewProps {
  type: 'USERS' | 'PROJECTS';
  onUserSelect: (user: User) => void;
  onProjectSelect?: (project: Project) => void;
  externalSelectedId?: string | null;
}

const VIBRANT_COLORS = [
  'vibrant-red', 'vibrant-blue', 'vibrant-green', 'vibrant-orange', 
  'vibrant-purple', 'vibrant-pink', 'vibrant-cyan', 'vibrant-yellow', 
  'vibrant-indigo', 'vibrant-emerald', 'vibrant-crimson', 'vibrant-teal', 
  'vibrant-amber', 'vibrant-violet', 'vibrant-lime'
];

const AdminView: React.FC<AdminViewProps> = ({ type, onUserSelect, onProjectSelect, externalSelectedId }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    role: Role.USER
  });

  const [projectFormData, setProjectFormData] = useState({
    name: '',
    category: '',
    color: VIBRANT_COLORS[0]
  });

  useEffect(() => {
    loadData();
  }, [type]);

  useEffect(() => {
    if (externalSelectedId && type === 'PROJECTS') {
      setExpandedProjectId(externalSelectedId);
    }
  }, [externalSelectedId, type]);

  const loadData = async () => {
    const allUsers = await db.getUsers();
    const allProjects = await db.getProjects();
    const allLogs = await db.getLogs();
    setUsers(allUsers);
    setProjects(allProjects);
    setLogs(allLogs);
  };

  const handleSaveUser = async () => {
    if (!userFormData.username) return;
    
    const newUser: User = editingUser ? {
      ...editingUser,
      username: userFormData.username,
      password: userFormData.password || editingUser.password,
      role: userFormData.role
    } : {
      id: `OP-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      username: userFormData.username,
      password: userFormData.password || '123456789',
      role: userFormData.role,
      avatarSeed: userFormData.username.toLowerCase(),
      lastLogin: '-'
    };

    await db.saveUser(newUser);
    setShowUserModal(false);
    setEditingUser(null);
    loadData();
  };

  const handleSaveProject = async () => {
    if (!editingProject || !projectFormData.name) return;

    const updatedProject: Project = {
      ...editingProject,
      name: projectFormData.name.toUpperCase(),
      category: projectFormData.category,
      color: projectFormData.color
    };

    await db.saveProject(updatedProject);
    setShowProjectModal(false);
    setEditingProject(null);
    loadData();
  };

  const handleToggleProjectActive = async (project: Project) => {
    const updated = { ...project, isActive: !project.isActive };
    await db.saveProject(updated);
    loadData();
  };

  const handleDeleteProject = async (project: Project) => {
    const step1 = confirm('¿Estás absolutamente seguro de que quieres eliminar este proyecto?');
    if (!step1) return;
    
    const step2 = confirm('Esta acción ELIMINARÁ TODOS los registros de tiempo (logs) asociados y no se puede deshacer. ¿Continuar?');
    if (!step2) return;
    
    const confirmationText = prompt(`Por favor, escribe el nombre del proyecto "${project.name}" para confirmar la eliminación definitiva:`);
    if (confirmationText?.trim().toUpperCase() !== project.name.toUpperCase()) {
      alert('Confirmación incorrecta. El proyecto no ha sido eliminado.');
      return;
    }

    await db.deleteProject(project.id);
    setExpandedProjectId(null);
    loadData();
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('¿ELIMINAR ESTE OPERADOR? TODOS SUS DATOS SERÁN BORRADOS.')) {
      await db.deleteUser(id);
      loadData();
    }
  };

  const handleToggleCanModifyLogs = async (user: User) => {
    const next = !(user.canModifyLogs ?? true);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, canModifyLogs: next } : u));
    try {
      await db.saveUser({ ...user, canModifyLogs: next });
    } catch (e) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, canModifyLogs: !next } : u));
      alert('No se pudo guardar el permiso. Revisa la conexión.');
    }
  };

  const getUserStats = (userId: string) => {
    const userLogs = logs.filter(l => l.userId === userId);
    const userProjects = projects.filter(p => p.userId === userId);
    const totalSeconds = userLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
    return {
      hours: (totalSeconds / 3600).toFixed(1) + 'h',
      projectsCount: userProjects.length
    };
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (type === 'USERS') {
    return (
      <div className="p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        <div className="mb-10 flex items-end justify-between border-b border-mod-border pb-6">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-red-500 text-4xl">admin_panel_settings</span>
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">CONTROL <span className="text-slate-500 font-light not-italic">OPERADORES</span></h2>
              <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-[0.3em] mt-1">Directorio Activo de Personal Autorizado</p>
            </div>
          </div>
          <button 
            onClick={() => { setEditingUser(null); setUserFormData({username:'', password:'', role: Role.USER}); setShowUserModal(true); }}
            className="bg-mod-fg text-mod-dark px-6 h-12 flex items-center gap-3 font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-mod-fg transition-all shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            <span>Registrar Operador</span>
          </button>
        </div>

        <div className="bg-mod-card border border-mod-border shadow-2xl relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
          <table className="w-full text-left text-xs">
            <thead className="bg-mod-dark/50 text-slate-500 uppercase font-bold tracking-[0.2em] border-b border-mod-border">
              <tr>
                <th className="px-8 py-6">Estado</th>
                <th className="px-8 py-6">Operador / Identificador</th>
                <th className="px-8 py-6">Nivel Acceso</th>
                <th className="px-8 py-6">Carga Operativa</th>
                <th className="px-8 py-6">Editar Logs</th>
                <th className="px-8 py-6 text-right">Terminal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mod-border">
              {users.map(user => {
                const stats = getUserStats(user.id);
                return (
                  <tr key={user.id} className="hover:bg-mod-fg/[0.02] transition-colors group border-l border-transparent hover:border-red-600">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${user.lastLogin !== '-' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-800'}`}></div>
                        <span className={`text-[9px] font-black tracking-widest ${user.lastLogin !== '-' ? 'text-emerald-500' : 'text-slate-600'}`}>
                          {user.lastLogin !== '-' ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div 
                        className="flex items-center gap-4 cursor-pointer group/item" 
                        onClick={() => onUserSelect(user)}
                      >
                        <div className="relative">
                          <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.avatarSeed}`} className="w-10 h-10 grayscale group-hover:grayscale-0 border border-mod-border bg-mod-dark p-1" />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-mod-dark border border-mod-border flex items-center justify-center">
                            <span className="material-symbols-outlined text-[8px] text-slate-500">verified</span>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-mod-fg font-black uppercase text-sm group-hover/item:text-red-500 transition-colors">{user.username}</span>
                          <span className="text-[9px] text-slate-500 font-mono tracking-tighter">{user.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-lg ${user.role === Role.ADMIN ? 'text-red-500' : 'text-mod-blue'}`}>
                          {user.role === Role.ADMIN ? 'shield_person' : 'badge'}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${user.role === Role.ADMIN ? 'text-red-500' : 'text-mod-blue'}`}>
                          {user.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-mod-fg font-mono text-sm">{stats.hours} <span className="text-[9px] text-slate-500 font-sans">TOTAL</span></span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{stats.projectsCount} Proyectos asignados</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {user.role === Role.ADMIN ? (
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">— Admin —</span>
                      ) : (
                        (() => {
                          const enabled = user.canModifyLogs ?? true;
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleCanModifyLogs(user); }}
                              role="switch"
                              aria-checked={enabled}
                              className={`relative h-6 w-12 flex-shrink-0 border transition-colors ${enabled ? 'bg-mod-blue border-mod-blue' : 'bg-mod-dark border-mod-border'}`}
                              title={enabled ? 'Permiso activado · clic para desactivar' : 'Permiso desactivado · clic para activar'}
                            >
                              <span className={`absolute top-0.5 h-4 w-4 bg-mod-fg transition-all ${enabled ? 'left-[26px]' : 'left-0.5'}`} />
                            </button>
                          );
                        })()
                      )}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => onUserSelect(user)} 
                           className="w-10 h-10 flex items-center justify-center border border-mod-border hover:border-mod-fg hover:bg-mod-fg hover:text-mod-dark transition-all"
                           title="Ver detalles"
                         >
                           <span className="material-symbols-outlined text-lg">visibility</span>
                         </button>
                         <button 
                           onClick={() => { setEditingUser(user); setUserFormData({username: user.username, password: '', role: user.role}); setShowUserModal(true); }} 
                           className="w-10 h-10 flex items-center justify-center border border-mod-border hover:border-mod-blue hover:bg-mod-blue hover:text-mod-fg transition-all"
                           title="Editar credenciales"
                         >
                           <span className="material-symbols-outlined text-lg">edit</span>
                         </button>
                         {user.username !== 'Admin' && (
                           <button 
                            onClick={() => handleDeleteUser(user.id)} 
                            className="w-10 h-10 flex items-center justify-center border border-mod-border hover:border-red-600 hover:bg-red-600 hover:text-mod-fg transition-all"
                            title="Eliminar registro"
                           >
                             <span className="material-symbols-outlined text-lg">delete_forever</span>
                           </button>
                         )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showUserModal && (
          <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setShowUserModal(false)}>
            <div className="bg-mod-card border border-mod-fg/10 w-full max-w-md shadow-[0_0_50px_rgba(255,0,0,0.1)]" onClick={e => e.stopPropagation()}>
               <div className="p-8 border-b border-mod-border bg-mod-dark flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-red-500">emergency</span>
                    <h3 className="text-mod-fg font-black uppercase tracking-widest text-sm">{editingUser ? 'MODIFICAR REGISTRO' : 'NUEVO OPERADOR'}</h3>
                  </div>
                  <button onClick={() => setShowUserModal(false)} className="text-slate-500 hover:text-mod-fg transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
               </div>
               <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Identificador de Usuario</label>
                    <input 
                      value={userFormData.username} 
                      onChange={e=>setUserFormData({...userFormData, username: e.target.value.toUpperCase()})} 
                      className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-4 text-sm font-mono focus:border-red-600 outline-none transition-all placeholder:text-slate-800" 
                      placeholder="EJ: OPERADOR_X"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Clave de Acceso {editingUser && '(Dejar en blanco para mantener)'}</label>
                    <input 
                      type="password" 
                      value={userFormData.password} 
                      onChange={e=>setUserFormData({...userFormData, password: e.target.value})} 
                      className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-4 text-sm font-mono focus:border-red-600 outline-none transition-all placeholder:text-slate-800"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Protocolo de Acceso</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setUserFormData({...userFormData, role: Role.USER})}
                        className={`p-4 border text-[9px] font-bold uppercase tracking-widest transition-all ${userFormData.role === Role.USER ? 'bg-mod-blue text-mod-fg border-mod-blue' : 'bg-mod-dark text-slate-500 border-mod-border'}`}
                      >
                        OPERATOR
                      </button>
                      <button 
                        onClick={() => setUserFormData({...userFormData, role: Role.ADMIN})}
                        className={`p-4 border text-[9px] font-bold uppercase tracking-widest transition-all ${userFormData.role === Role.ADMIN ? 'bg-red-600 text-mod-fg border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'bg-mod-dark text-slate-500 border-mod-border'}`}
                      >
                        SUPERUSER
                      </button>
                    </div>
                  </div>
                  <button onClick={handleSaveUser} className="w-full bg-mod-fg text-mod-dark font-black py-5 text-[10px] uppercase tracking-[0.3em] hover:bg-red-600 hover:text-mod-fg transition-all shadow-xl">Sincronizar con Base de Datos</button>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (type === 'PROJECTS') {
    return (
      <div className="p-10 max-w-[1400px] mx-auto animate-in fade-in duration-500">
        <div className="mb-10 flex items-end justify-between border-b border-mod-border pb-6">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-mod-blue text-4xl">inventory_2</span>
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-mod-fg uppercase italic">SISTEMA <span className="text-slate-500 font-light not-italic">DE PROYECTOS</span></h2>
              <p className="text-[10px] text-mod-blue/70 font-bold uppercase tracking-[0.3em] mt-1">Listado de unidades · Clic para ver detalle</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-500">
          {projects.map(project => {
            const projectLogs = logs.filter(l => l.projectId === project.id);
            const totalSeconds = projectLogs.reduce((acc, l) => acc + l.durationSeconds, 0);
            const projectOwner = users.find(u => u.id === project.creatorId || u.id === project.userId);
            const userCount = new Set(projectLogs.map(l => l.userId)).size;

            return (
              <div
                key={project.id}
                onClick={() => onProjectSelect?.(project)}
                className={`bg-mod-card border border-mod-border hover:border-mod-blue cursor-pointer hover:bg-mod-fg/[0.02] transition-all duration-300 group ${!project.isActive ? 'grayscale opacity-70' : ''}`}
              >
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 flex-shrink-0 ${project.color} border border-mod-fg/20 flex items-center justify-center`}>
                      <span className="material-symbols-outlined text-mod-fg/50 text-xl">layers</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-lg font-black text-mod-fg uppercase tracking-tighter truncate ${!project.isActive ? 'line-through opacity-50' : ''}`}>{project.name}</h3>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">{project.category}</p>
                      {!project.isActive && <p className="text-[8px] text-red-500 font-black uppercase mt-1">INACTIVO</p>}
                    </div>
                    <span className="material-symbols-outlined text-slate-600 group-hover:text-mod-blue transition-colors">chevron_right</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-mod-border">
                    <div>
                      <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-0.5">Tiempo total</p>
                      <p className="text-mod-blue font-mono font-bold text-sm">{formatTime(totalSeconds)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-0.5">Operadores</p>
                      <p className="text-mod-fg font-mono font-bold text-sm">{userCount}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest mb-0.5">Propietario</p>
                      <p className="text-mod-fg font-bold text-[10px] uppercase truncate max-w-[80px]">{projectOwner?.username ?? '—'}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showProjectModal && (
          <div className="fixed inset-0 bg-mod-dark/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4" onClick={() => setShowProjectModal(false)}>
            <div className="bg-mod-card border border-mod-fg/10 w-full max-w-md shadow-[0_0_50px_rgba(0,163,224,0.1)]" onClick={e => e.stopPropagation()}>
               <div className="p-8 border-b border-mod-border bg-mod-dark flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-mod-blue">edit_note</span>
                    <h3 className="text-mod-fg font-black uppercase tracking-widest text-sm">Modificar Unidad de Trabajo</h3>
                  </div>
                  <button onClick={() => setShowProjectModal(false)} className="text-slate-500 hover:text-mod-fg transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
               </div>
               <div className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Etiqueta del Proyecto</label>
                    <input 
                      value={projectFormData.name} 
                      onChange={e=>setProjectFormData({...projectFormData, name: e.target.value.toUpperCase()})} 
                      className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-4 text-sm font-mono focus:border-mod-blue outline-none transition-all" 
                      placeholder="ID_PROYECTO"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Categorización</label>
                    <input 
                      value={projectFormData.category} 
                      onChange={e=>setProjectFormData({...projectFormData, category: e.target.value})} 
                      className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-4 text-sm focus:border-mod-blue outline-none transition-all"
                      placeholder="EJ: DESIGN SYSTEMS"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Firma Cromática</label>
                    <div className="grid grid-cols-5 gap-2">
                      {VIBRANT_COLORS.map(c => (
                        <button 
                          key={c} 
                          onClick={()=>setProjectFormData({...projectFormData, color: c})} 
                          className={`h-8 ${c} border ${projectFormData.color === c ? 'border-mod-fg scale-110' : 'border-transparent opacity-50'} transition-all`} 
                        />
                      ))}
                    </div>
                  </div>
                  <button onClick={handleSaveProject} className="w-full bg-mod-fg text-mod-dark font-black py-5 text-[10px] uppercase tracking-[0.3em] hover:bg-mod-blue hover:text-mod-fg transition-all shadow-xl">Actualizar Registro</button>
               </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
};

export default AdminView;
