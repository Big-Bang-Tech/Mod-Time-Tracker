
import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../services/db';

interface ProfileViewProps {
  user: User;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user }) => {
  const [pass, setPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });

  const handleChangePass = async () => {
    if (!pass || pass !== confirmPass) {
      setMsg({ text: 'LAS CONTRASEÑAS NO COINCIDEN O ESTÁN VACÍAS.', type: 'error' });
      return;
    }
    const updated = { ...user, password: pass };
    await db.saveUser(updated);
    setMsg({ text: 'CLAVE DE ACCESO ACTUALIZADA CORRECTAMENTE.', type: 'success' });
    setPass('');
    setConfirmPass('');
  };

  return (
    <div className="p-10 max-w-md mx-auto">
      <div className="mb-10">
        <h2 className="text-4xl font-light tracking-tighter text-mod-fg">SEGURIDAD <span className="font-bold">TERMINAL</span></h2>
        <div className="h-1 w-20 bg-mod-blue mt-2"></div>
      </div>

      <div className="bg-mod-card border border-mod-border p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-4 border-b border-mod-border pb-6">
           <img src={`https://picsum.photos/seed/${user.avatarSeed}/60`} className="w-16 h-16 grayscale border border-mod-border" />
           <div>
              <p className="text-mod-fg font-black uppercase text-xl">{user.username}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{user.role}</p>
           </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nueva Clave</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-3 text-sm font-mono focus:border-mod-fg outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Confirmar Clave</label>
            <input type="password" value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} className="w-full bg-mod-dark border border-mod-border text-mod-fg px-4 py-3 text-sm font-mono focus:border-mod-fg outline-none" />
          </div>
        </div>

        {msg.text && (
          <div className={`p-4 border text-[10px] font-bold uppercase tracking-widest ${msg.type === 'error' ? 'bg-red-900/10 border-red-500 text-red-500' : 'bg-emerald-900/10 border-emerald-500 text-emerald-500'}`}>
            {msg.text}
          </div>
        )}

        <button onClick={handleChangePass} className="w-full bg-mod-fg text-mod-dark font-bold py-4 text-[10px] uppercase tracking-widest hover:bg-mod-blue hover:text-mod-fg transition-all">RESETEAR CREDENCIALES</button>
      </div>
    </div>
  );
};

export default ProfileView;
