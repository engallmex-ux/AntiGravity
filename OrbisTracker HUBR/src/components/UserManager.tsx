import React, { useState, useEffect } from 'react';
import { 
  UserPlus, Shield, UserX, Key, Mail, Edit3, Trash2, UserCheck, X, RefreshCw, ShieldAlert 
} from 'lucide-react';

interface UserManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { name: string; email: string; role: 'admin' | 'user'; re?: string } | null;
}

interface DBUser {
  name: string;
  email: string;
  passwordHash?: string;
  recoveryEmail: string;
  role: 'admin' | 'user';
  re?: string;
}

export default function UserManager({ isOpen, onClose, currentUser }: UserManagerProps) {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null); // if null, we are creating a new user
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [re, setRe] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) {
        throw new Error('Não foi possível obter a lista de usuários do servidor.');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de rede ao carregar técnicos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateForm = () => {
    setEditingEmail(null);
    setName('');
    setEmail('');
    setPassword('');
    setRecoveryEmail('');
    setRole('user');
    setRe('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (user: DBUser) => {
    setEditingEmail(user.email);
    setName(user.name);
    setEmail(user.email);
    setPassword(''); // leave blank if password should not be changed
    setRecoveryEmail(user.recoveryEmail || '');
    setRole(user.role || 'user');
    setRe(user.re || '');
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !name.trim()) {
      setErrorMsg('Os campos Nome e E-mail são obrigatórios.');
      return;
    }

    if (!editingEmail && !password.trim()) {
      setErrorMsg('A senha é obrigatória para novos cadastros.');
      return;
    }

    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        recoveryEmail: recoveryEmail.trim().toLowerCase(),
        role: role,
        re: re.trim()
      };

      if (password.trim()) {
        payload.password = password;
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar alterações do usuário.');
      }

      setSuccessMsg(
        editingEmail 
          ? `Técnico "${name}" atualizado com sucesso!` 
          : `Novo técnico "${name}" cadastrado e ativado!`
      );
      setIsFormOpen(false);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao processar operação.');
    }
  };

  const handleDeleteUser = async (targetEmail: string, targetName: string) => {
    if (targetEmail.toLowerCase() === currentUser?.email.toLowerCase()) {
      alert('Você não pode remover sua própria conta de administrador ativa.');
      return;
    }

    if (!window.confirm(`Deseja realmente REMOVER o acesso do técnico "${targetName}" (${targetEmail})? Ele perderá acesso ao sistema imediatamente.`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(targetEmail)}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover usuário.');
      }

      setSuccessMsg(`Usuário "${targetName}" removido com sucesso.`);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao excluir técnico do servidor.');
    }
  };

  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="user-manager-overlay">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" id="user-manager-card">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Painel de Usuários & Técnicos</h2>
              <p className="text-xs text-slate-400">Controle central de credenciais, senhas e perfis de campo do HU-Brasil</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {!isAdmin ? (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-rose-400">Acesso Restrito</h3>
                <p className="text-xs text-slate-300 mt-1">Apenas administradores de Engenharia Clínica podem visualizar ou gerenciar os perfis de técnicos do sistema central.</p>
              </div>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  {successMsg}
                </div>
              )}

              {/* Form Section */}
              {isFormOpen && (
                <form onSubmit={handleSubmit} className="bg-slate-950/65 border border-slate-800 p-5 rounded-2xl space-y-4 animate-slide-up">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    {editingEmail ? <Edit3 className="w-4 h-4 text-emerald-400" /> : <UserPlus className="w-4 h-4 text-emerald-400" />}
                    {editingEmail ? 'Alterar Credenciais de Técnico' : 'Cadastrar Novo Técnico de Campo'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">Nome do Profissional</label>
                      <input 
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Dr. Juliano Silva"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">Usuário / E-mail</label>
                      <input 
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!!editingEmail}
                        placeholder="Ex: juliano.silva@orbis.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">
                        {editingEmail ? 'Nova Senha (deixe em branco para manter)' : 'Senha de Acesso'}
                      </label>
                      <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingEmail ? 'Manter senha atual' : 'Mínimo 6 caracteres'}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    {/* Recovery Email */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">E-mail de Recuperação</label>
                      <input 
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="Ex: pessoal@gmail.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    {/* RE (Registro do Engenheiro) */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400">RE (Registro do Engenheiro)</label>
                      <input 
                        type="text"
                        value={re}
                        onChange={(e) => setRe(e.target.value)}
                        placeholder="Ex: 3700"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 font-bold"
                      />
                    </div>

                    {/* Role selector */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[11px] font-bold text-slate-400">Perfil de Acesso (Privilégios)</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setRole('user')}
                          className={`p-3 rounded-xl border text-xs text-left transition-all ${
                            role === 'user' 
                              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            Técnico de Campo
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">Inspeções, lookup de inventário e emissão de laudos.</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRole('admin')}
                          className={`p-3 rounded-xl border text-xs text-left transition-all ${
                            role === 'admin' 
                              ? 'bg-rose-950/40 border-rose-500 text-rose-300' 
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-rose-500" />
                            Administrador Geral
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1">Acesso irrestrito, limpeza de dados e gestão de técnicos.</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-850 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/10 hover:shadow-emerald-500/20 transition-all cursor-pointer"
                    >
                      {editingEmail ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                    </button>
                  </div>
                </form>
              )}

              {/* Action bar */}
              <div className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <span className="text-xs text-slate-400">Total de {users.length} usuários registrados na central</span>
                <div className="flex gap-2">
                  <button
                    onClick={loadUsers}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-all cursor-pointer flex items-center justify-center"
                    title="Sincronizar Lista"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleOpenCreateForm}
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Adicionar Técnico
                  </button>
                </div>
              </div>

              {/* Table / Grid */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-bold">
                      <th className="p-4">Técnico / Profissional</th>
                      <th className="p-4">Email / Login</th>
                      <th className="p-4">Perfil</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-slate-200">
                    {users.map((u) => (
                      <tr key={u.email} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-100 flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {u.re && (
                              <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 font-mono text-[9px] rounded font-bold shrink-0">
                                RE: {u.re}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block">Recup: {u.recoveryEmail || 'Não definido'}</span>
                        </td>
                        <td className="p-4 font-mono text-slate-300">{u.email}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded-full text-[10px] font-bold uppercase ${
                            u.role === 'admin' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {u.role === 'admin' ? 'Administrador' : 'Técnico'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => handleOpenEditForm(u)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                              title="Alterar credenciais / senha"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.email, u.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
                              title="Remover Técnico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">
                          Nenhum técnico carregado ou registrado na central.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-850 bg-slate-950 text-center text-[10px] text-slate-500">
          Orbis Tracker Central Database &copy; {new Date().getFullYear()} - Sistema de Gestão de Acesso Exclusivo para Engenharia Clínica.
        </div>

      </div>
    </div>
  );
}
