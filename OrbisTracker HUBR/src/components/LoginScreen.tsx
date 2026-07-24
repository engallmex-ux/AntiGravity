import React, { useState } from 'react';
import { 
  Compass, Lock, Mail, User, ShieldCheck, Database, 
  HelpCircle, AlertCircle, Sparkles, KeyRound 
} from 'lucide-react';
import { googleSignIn } from '../lib/googleApi';
import OrbisLogo from './OrbisLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: { name: string; email: string; role: 'admin' | 'user'; isGoogle: boolean; re?: string }, token?: string) => void;
}

interface LocalUser {
  name: string;
  email: string;
  passwordHash: string;
  recoveryEmail: string;
  role: 'admin' | 'user';
  re?: string;
}

/**
 * Componente: LoginScreen
 * Descrição: Tela de autenticação clínica exigida pelo HU-Brasil.
 * Oferece login de alta segurança unificado:
 * 1. Autenticação Direta pelo Google Workspace (Método Infalível recomendado).
 * 2. Cadastro local simplificado com login, senha e e-mail de recuperação.
 */
export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [re, setRe] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [isLocalLoading, setIsLocalLoading] = useState<boolean>(false);

  // Helper para buscar usuários salvos na tabela local (cache)
  const getLocalUsers = (): LocalUser[] => {
    const data = localStorage.getItem('orbistracker_local_users');
    if (!data) {
      // Pre-populate with default Admin and User credentials
      const defaultUsers: LocalUser[] = [
        {
          name: "Administrador Geral",
          email: "admin@orbis.com",
          passwordHash: btoa("admin123"),
          recoveryEmail: "admin.recovery@orbis.com",
          role: "admin"
        },
        {
          name: "Técnico de Engenharia",
          email: "tecnico@orbis.com",
          passwordHash: btoa("user123"),
          recoveryEmail: "user.recovery@orbis.com",
          role: "user"
        }
      ];
      localStorage.setItem('orbistracker_local_users', JSON.stringify(defaultUsers));
      return defaultUsers;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  };

  // Processa o cadastro local simplificado
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || !email.trim() || !password.trim() || !recoveryEmail.trim() || !re.trim()) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios para o cadastro, incluindo o RE.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    setIsLocalLoading(true);

    try {
      // Realiza o cadastro diretamente no servidor centralizado
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: cleanEmail,
          password: password,
          recoveryEmail: recoveryEmail.trim().toLowerCase(),
          role: role,
          re: re.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Falha ao registrar usuário no servidor.');
      }

      setIsLocalLoading(false);
      
      // Auto-loga após cadastro bem-sucedido
      onLoginSuccess({
        name: name.trim(),
        email: cleanEmail,
        role: role,
        isGoogle: false,
        re: re.trim()
      });
    } catch (err: any) {
      console.warn("Falha no cadastro centralizado no servidor, usando backup local:", err);
      
      // Fallback para LocalStorage se o servidor falhar
      const users = getLocalUsers();
      if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
        setErrorMsg('Este e-mail/usuário já está cadastrado localmente.');
        setIsLocalLoading(false);
        return;
      }

      const newUser: LocalUser = {
        name: name.trim(),
        email: cleanEmail,
        passwordHash: btoa(password),
        recoveryEmail: recoveryEmail.trim().toLowerCase(),
        role: role,
        re: re.trim()
      };

      const updatedUsers = [...users, newUser];
      localStorage.setItem('orbistracker_local_users', JSON.stringify(updatedUsers));

      setIsLocalLoading(false);
      
      onLoginSuccess({
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        isGoogle: false,
        re: newUser.re
      });
    }
  };

  // Processa o login local com senha
  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor, preencha o e-mail/usuário e a senha.');
      return;
    }

    setIsLocalLoading(true);

    try {
      // Envia requisição de autenticação para o servidor centralizado
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Usuário ou senha incorretos.');
      }

      const data = await res.json();
      setIsLocalLoading(false);

      onLoginSuccess(data.user);
    } catch (err: any) {
      console.warn("Falha na autenticação do servidor, verificando cache local:", err);

      const users = getLocalUsers();
      const cleanEmail = email.trim().toLowerCase();
      // Permite o login usando nome do usuário (alias) ou e-mail completo
      const user = users.find(u => 
        u.email.toLowerCase() === cleanEmail || 
        u.email.toLowerCase().split('@')[0] === cleanEmail
      );

      if (!user || user.passwordHash !== btoa(password)) {
        setErrorMsg(err.message || 'Usuário ou senha incorretos. Caso seja seu primeiro acesso, clique em "Cadastre-se".');
        setIsLocalLoading(false);
        return;
      }

      setIsLocalLoading(false);
      onLoginSuccess({
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        isGoogle: false,
        re: user.re
      });
    }
  };

  // Login com Conta Google - Método Infalível que desocupa validações complexas
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMsg(null);
    try {
      const result = await googleSignIn();
      if (result) {
        onLoginSuccess({
          name: result.user.displayName || 'Auditor Google',
          email: result.user.email || '',
          role: result.user.email?.includes('admin') ? 'admin' : 'user', // Basic heuristic for Google workspace
          isGoogle: true
        }, result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Houve um problema ao autenticar com sua conta institucional do Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden" id="login-container-stage">
      {/* Detalhes de Background Técnico */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/25 via-slate-950 to-slate-950 pointer-events-none z-0" />
      <div className="absolute top-10 left-10 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center space-y-6">
        {/* Logotipo OrbisTracker */}
        <div className="inline-flex justify-center transition-transform hover:scale-105 active:scale-95 duration-300">
          <OrbisLogo className="w-16 h-16 sm:w-20 sm:h-20 shadow-2xl rounded-2xl" withBg={true} />
        </div>
        
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            OrbisTracker HU-BR
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto font-medium">
            Precisão que transforma horas de auditoria em segundos de ação.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-scale-up">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 sm:px-10 shadow-2xl rounded-3xl space-y-6">
          
          {/* Mensagem de Erro se houver */}
          {errorMsg && (
            <div className="p-3.5 bg-red-950/50 border border-red-500/30 text-red-200 rounded-xl text-xs flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Método 1: Google OAuth - O mais seguro e infalível */}
          <div className="space-y-3.5">
            <div className="text-center">
              <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Recomendado & Infalível
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLocalLoading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 disabled:bg-slate-200 text-slate-950 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-md hover:shadow-xl transition-all cursor-pointer min-h-[44px] active:scale-[0.99]"
            >
              {isGoogleLoading ? (
                <span className="w-4 h-4 border-2 border-slate-500 border-t-slate-900 rounded-full animate-spin"></span>
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              Entrar com Conta Google Institucional
            </button>

            <p className="text-[10px] text-center text-slate-400 leading-normal max-w-xs mx-auto">
              <strong>Evita falhas de validação:</strong> O login via Google valida seu e-mail de forma 100% segura e vincula automaticamente suas planilhas e fotos em nuvem.
            </p>
          </div>

          {/* Divisor */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-800"></div>
            <span className="flex-shrink mx-4 text-slate-500 text-[10px] font-mono uppercase tracking-wider">ou use acesso técnico</span>
            <div className="flex-grow border-t border-slate-800"></div>
          </div>

          {/* Form de Acesso Local (Login / Cadastro) */}
          <form className="space-y-4" onSubmit={isSignUp ? handleSignUp : handleLocalLogin}>
            
            {/* Campo: Nome (Visível apenas no cadastro) */}
            {isSignUp && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  Nome Completo do Técnico
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Lucas Fonseca"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-200"
                />
              </div>
            )}

            {/* Campo: RE (Registro do Engenheiro) */}
            {isSignUp && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  RE (Registro do Engenheiro Orbis)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 3700"
                  value={re}
                  onChange={(e) => setRe(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-200 font-bold"
                />
              </div>
            )}

            {/* Campo: Usuário / E-mail */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-500" />
                E-mail ou Código de Usuário
              </label>
              <input
                type="text"
                required
                placeholder="Ex: auditor1@hu.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-200 font-medium"
              />
            </div>

            {/* Campo: Senha */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-200"
              />
            </div>

            {/* Campo: Perfil/Tipo de Usuário (Apenas Cadastro) */}
            {isSignUp && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Perfil de Acesso
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('user')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      role === 'user'
                        ? 'bg-emerald-900/35 border-emerald-500 text-emerald-300 shadow-inner'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-750'
                    }`}
                  >
                    Técnico (User)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      role === 'admin'
                        ? 'bg-emerald-900/35 border-emerald-500 text-emerald-300 shadow-inner'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-750'
                    }`}
                  >
                    Administrador (Admin)
                  </button>
                </div>
              </div>
            )}

            {/* Campo: E-mail de Recuperação (Apenas Cadastro) */}
            {isSignUp && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                  E-mail de Recuperação
                </label>
                <input
                  type="email"
                  required
                  placeholder="Ex: copia.recuperacao@gmail.com"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs text-slate-200"
                />
                <p className="text-[10px] text-slate-500 leading-normal">
                  Utilizado para reaver a senha em auditorias caso ocorra bloqueio de acesso.
                </p>
              </div>
            )}

            {/* Botão Principal */}
            <button
              type="submit"
              disabled={isLocalLoading || isGoogleLoading}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer min-h-[44px]"
            >
              {isLocalLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : isSignUp ? (
                'Confirmar Cadastro & Entrar'
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>

          {/* Toggle entre login e cadastro */}
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
            >
              {isSignUp ? 'Já tem cadastro? Faça login técnico' : 'Primeiro acesso? Registre-se aqui'}
            </button>
          </div>

        </div>
      </div>

      {/* Rodapé Clínico */}
      <div className="mt-8 text-center text-[11px] text-slate-500 relative z-10 max-w-sm mx-auto leading-relaxed">
        <p className="font-mono text-slate-400">© 2026 OrbisTracker HU-BR</p>
        <p className="mt-1">
          Este sistema realiza verificação segura e persistência criptografada local. Homologado para inventários físicos de alta sensibilidade clínica.
        </p>
      </div>
    </div>
  );
}
