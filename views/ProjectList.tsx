
import React from 'react';
import { Project } from '../types';

interface ProjectListProps {
  projects: Project[];
  onEditProject: (project: Project) => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ projects, onEditProject }) => {
  const formatTimeStrFull = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleExportCurrentProjects = () => {
    const escapeCSV = (str: any) => {
      const stringified = String(str ?? '');
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const headers = ['ID', 'Nombre', 'Categoría', 'Departamento', 'Tiempo Hoy', 'Horas Totales', 'Estado'];
    const rows = projects.map(p => [
      p.id, p.name, p.category, p.department,
      formatTimeStrFull(p.currentDaySeconds),
      p.totalHours, p.status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `exportacion_registro_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case 'Running': return 'EJECUTANDO';
      case 'Active': return 'ACTIVO';
      case 'On Hold': return 'EN ESPERA';
      default: return status.toUpperCase();
    }
  };

  return (
    <div className="p-10 max-w-[1400px] mx-auto">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h2 className="text-4xl font-light tracking-tighter text-mod-fg">REGISTRO DE <span className="font-bold">PROYECTOS</span></h2>
          <div className="h-1 w-20 bg-mod-blue mt-2"></div>
        </div>
        <button 
          onClick={handleExportCurrentProjects}
          className="flex items-center gap-2 h-10 px-6 border border-mod-border bg-transparent text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-mod-fg hover:text-mod-dark transition-all"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          <span>Generar CSV</span>
        </button>
      </div>

      <div className="overflow-hidden border border-mod-border bg-mod-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-mod-dark text-slate-500 uppercase font-bold tracking-[0.2em] border-b border-mod-border">
              <th className="px-8 py-5">Ident. Sistema</th>
              <th className="px-8 py-5">Etiqueta Proyecto</th>
              <th className="px-8 py-5">Estado</th>
              <th className="px-8 py-5">Uptime Hoy</th>
              <th className="px-8 py-5 text-right">Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mod-border">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-mod-fg/5 transition-colors group">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 ${project.color}`}></div>
                    <span className="font-mono font-bold uppercase tracking-tight text-slate-300">MOD.{project.id.toUpperCase()}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="text-mod-fg font-black uppercase tracking-tight text-sm">{project.name}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{project.category}</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                   <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${project.status === 'Running' ? 'text-mod-blue' : 'text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 ${project.status === 'Running' ? 'bg-mod-blue animate-pulse' : 'bg-slate-700'}`}></span>
                      {translateStatus(project.status)}
                   </span>
                </td>
                <td className="px-8 py-5 font-mono text-slate-300">
                  {formatTimeStrFull(project.currentDaySeconds)}
                </td>
                <td className="px-8 py-5 text-right">
                  <button 
                    onClick={() => onEditProject(project)}
                    className="text-mod-blue hover:text-mod-fg font-bold uppercase text-[10px] tracking-widest transition-all"
                  >
                    CONFIG
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectList;
