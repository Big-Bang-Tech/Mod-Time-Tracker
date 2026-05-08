
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const check = async () => {
      const isOnline = await db.checkConnection();
      setServerStatus(isOnline ? 'online' : 'offline');
    };
    check();
  }, []);

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canEnterOffline = isLocal; // En local se puede entrar con usuarios mock (Admin / Grobas) sin BD

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const allUsers = await db.getUsers();
      const user = allUsers.find(u =>
        u.username.toLowerCase() === username.toLowerCase() &&
        u.password === password
      );

      if (user) {
        user.lastLogin = new Date().toISOString();
        await db.saveUser(user);
        onLogin(user);
      } else {
        setError('CREDENCIALES INCORRECTAS O USUARIO INEXISTENTE.');
      }
    } catch (e: any) {
      console.error(e);
      if (e.message.includes('404')) {
        setError('ERROR 404: El archivo api.php no se encuentra en el servidor Plesk.');
      } else {
        setError(`FALLO DE CONEXIÓN: ${e.message || 'El servidor MySQL no responde'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-mod-dark flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-1/2 h-1/2 bg-mod-blue blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-1/2 h-1/2 bg-red-600 blur-[150px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-12 text-center">
          <div className="inline-block p-4 border-2 border-mod-blue mb-4">
            <span className="material-symbols-outlined text-mod-blue text-5xl">security</span>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-mod-fg uppercase italic">MOD <span className="text-slate-500 font-light not-italic">TRACKER</span></h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.4em] mt-2">Acceso Centralizado MySQL</p>
        </div>

        <div className="bg-mod-card border border-mod-border p-8 shadow-2xl relative">
          <div className={`absolute top-0 right-0 p-2 text-[8px] font-bold uppercase flex items-center gap-1 ${serverStatus === 'online' ? 'text-emerald-500' : 'text-red-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${serverStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            Server: {serverStatus.toUpperCase()}
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Usuario (p. ej. Admin)</label>
              <input
                autoFocus
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ID_OPERADOR"
                className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-3 text-sm font-mono focus:border-mod-blue outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Clave de Acceso</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-3 text-sm font-mono focus:border-mod-blue outline-none transition-all"
                required
              />
            </div>
            
            {error && (
              <div className="bg-red-900/20 border border-red-500 p-3 text-red-500 text-[9px] font-bold uppercase tracking-widest leading-relaxed">
                {error}
                {error.includes('404') && (
                  <p className="mt-2 text-mod-fg/70 normal-case">Nota: Si estás en desarrollo local, api.php no funcionará hasta que lo subas a Plesk.</p>
                )}
              </div>
            )}

            <button 
              disabled={loading || (serverStatus === 'offline' && !canEnterOffline)}
              className="w-full bg-mod-fg text-mod-dark py-4 font-bold text-[10px] uppercase tracking-[0.3em] hover:bg-mod-blue hover:text-mod-fg transition-all disabled:opacity-30"
            >
              {loading ? 'AUTENTICANDO...' : 'ENTRAR AL SISTEMA'}
            </button>
          </form>
        </div>

        <div className="mt-8 flex justify-between items-center px-4">
          <p className="text-[9px] text-slate-700 font-bold uppercase tracking-widest">v4.2 Persistent Build</p>
          <div className="text-[9px] text-slate-700 font-bold uppercase tracking-widest flex items-center gap-2">
            <span>MySQL DB:</span>
            <span className={serverStatus === 'online' ? 'text-emerald-900' : 'text-red-900'}>{serverStatus === 'online' ? 'Sincronizada' : 'Desconectada'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
