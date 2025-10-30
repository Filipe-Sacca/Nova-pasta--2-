import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden p-6">
      {/* 🎨 Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

      {/* 🎨 Elementos Decorativos de Fundo - Gradientes Animados */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] bg-amber-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* 🎨 Formas Geométricas Decorativas */}
      <div className="absolute top-20 left-20 w-32 h-32 border border-indigo-500/20 rounded-2xl rotate-12 animate-spin" style={{ animationDuration: '20s' }}></div>
      <div className="absolute bottom-20 right-20 w-40 h-40 border border-purple-500/20 rounded-full animate-spin" style={{ animationDuration: '25s', animationDirection: 'reverse' }}></div>
      <div className="absolute top-1/3 right-10 w-24 h-24 border border-amber-500/20 rounded-lg rotate-45 animate-pulse"></div>

      {/* 🎨 Dots Pattern */}
      <div className="absolute top-10 right-1/4 flex gap-2 opacity-20">
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>

      <div className="absolute bottom-10 left-1/4 flex gap-2 opacity-20">
        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>

      {/* 🎨 Glow Effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-r from-transparent via-indigo-900/5 to-transparent"></div>

      {/* 🎯 Card de Login */}
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Glow effect behind card */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-amber-500/20 rounded-3xl blur-xl"></div>

        <div className="relative bg-slate-800/70 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 p-8 space-y-6 hover:border-indigo-500/30 transition-all duration-500">

          {/* Logo centralizada - Especificações exatas */}
          <div className="flex justify-center mb-6">
            <div
              className="flex items-center relative overflow-hidden group"
              style={{
                width: '240px',
                height: '70px',
                background: '#1a2332',
                borderRadius: '14px',
                padding: '0px',
                paddingRight: '35px',
                gap: '8px',
                boxShadow: '0 0 20px rgba(99, 102, 241, 0.1)',
                justifyContent: 'flex-end'
              }}
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <img
                src="/logo-plano-certo.png"
                alt="Plano Certo"
                className="object-contain relative z-10"
                style={{
                  width: '75px',
                  height: '75px',
                  marginTop: '8px',
                  filter: 'brightness(0) saturate(100%) invert(57%) sepia(82%) saturate(1500%) hue-rotate(360deg) brightness(102%) contrast(101%)'
                }}
              />
              <span
                className="font-bold relative z-10"
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#ffffff',
                  marginLeft: '-20px'
                }}
              >
                Plano Certo
              </span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Bem-vindo de volta
            </h1>
            <p className="text-gray-400 text-sm">Entre com suas credenciais para acessar sua conta</p>
          </div>

          {/* Formulário */}
          <form className="space-y-6" onSubmit={handleLogin}>
            {/* Campo Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/80 transition-all duration-300 text-sm shadow-lg outline-none"
              />
            </div>

            {/* Campo Senha */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Senha</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 rounded-lg bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500/50 focus:bg-slate-800/80 transition-all duration-300 text-sm shadow-lg outline-none"
              />
            </div>

            {/* Erro */}
            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Lembrar-me & Esqueceu senha */}
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 bg-slate-700/50"
                />
                <span className="text-gray-300">Lembrar-me</span>
              </label>
              <button
                type="button"
                onClick={() => navigate('/auth/recuperar')}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-all hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-indigo-600/50 disabled:to-purple-600/50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-lg transition-all transform hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/50 disabled:transform-none text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Entrando...</span>
                </>
              ) : (
                'ENTRAR'
              )}
            </button>
          </form>

          {/* Footer - Criar conta */}
          <div className="text-center pt-4">
            <p className="text-gray-400 text-sm">
              Não tem uma conta?{' '}
              <button
                onClick={() => navigate('/auth/cadastro')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition-all hover:underline"
              >
                CRIAR CONTA
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 