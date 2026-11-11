import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, LogIn, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: { username: string; fullname: string }) => void;
  logoUrl?: string;
  schoolName?: string;
}

export function LoginView({
  onLoginSuccess,
  logoUrl = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQJaEC9lZWlZ-oCP8mZfecwDroVpB2O_hR9Vs8RGTRN0w&s=10',
  schoolName = 'Colegio Ricardo Bentín 64935'
}: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    setTimeout(() => {
      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();

      // Authorized credentials:
      // Usuario: admin | Contraseña: 63935 (also admin123 as secondary fallback)
      if (cleanUser === 'admin' && (cleanPass === '63935' || cleanPass === 'admin123')) {
        setIsLoading(false);
        onLoginSuccess({
          username: 'admin',
          fullname: 'Administrador General'
        });
      } else {
        setIsLoading(false);
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);

        if (cleanUser !== 'admin') {
          setErrorMsg('Usuario incorrecto. El usuario autorizado es "admin".');
        } else {
          setErrorMsg('Contraseña incorrecta. Verifique la clave ingresada.');
        }
      }
    }, 450);
  };

  const autofillAdmin = () => {
    setUsername('admin');
    setPassword('63935');
    setErrorMsg('');
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-950 font-sans">
      {/* Imagen de fondo con overlay elegante */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 scale-105"
        style={{
          backgroundImage: `url('/fondo_ricardo_bentin.jpg'), url('/imagen_login.jpg'), url('/assets/aistudio/imagen_login_ed8138ec.jpg')`,
          filter: 'brightness(0.38) saturate(1.2)'
        }}
      />

      {/* Degradados y viñeta sutil */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-slate-950/70 to-slate-900/60 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Tarjeta de Login Glassmorphism */}
      <div
        className={`relative z-10 w-full max-w-md mx-auto transition-transform duration-300 ${
          isShaking ? 'translate-x-[-8px]' : ''
        }`}
      >
        <div className="backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 rounded-3xl p-7 sm:p-9 shadow-2xl border border-white/40 dark:border-slate-700/60 transition-all">
          
          {/* Encabezado con Insignia Institucional */}
          <div className="text-center mb-7">
            <div className="relative inline-block mb-3">
              <div className="w-20 h-20 sm:w-22 sm:h-22 mx-auto rounded-2xl bg-white p-2 shadow-lg ring-4 ring-amber-500/30 flex items-center justify-center transform hover:scale-105 transition duration-300">
                <img
                  src={logoUrl}
                  alt="Insignia Institucional"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to shield icon
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <h1 className="font-cinzel text-xl sm:text-2xl font-black tracking-wide text-[#0b1c3d] dark:text-white uppercase drop-shadow-xs">
              {schoolName}
            </h1>
            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 tracking-wider uppercase mt-1">
              Sistema Oficial de Control de Asistencia y Carnets QR
            </p>
            <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto my-3" />
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Ingrese con sus credenciales autorizadas de dirección
            </p>
          </div>

          {/* Mensaje de Error */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Formulario de Login */}
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Campo Usuario */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Usuario del Sistema
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-xs"
                />
              </div>
            </div>

            {/* Campo Contraseña */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex justify-between">
                <span>Contraseña</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-11 py-2.5 sm:py-3 text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botón de Ingreso */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-cinzel font-bold text-sm tracking-wider uppercase text-white bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 shadow-lg shadow-amber-500/25 active:scale-[0.99] transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Acceso Rápido / Credenciales de demostración */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Credenciales oficiales de dirección:
            </p>
            <button
              type="button"
              onClick={autofillAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold transition cursor-pointer"
              title="Autocompletar usuario y contraseña"
            >
              <span className="font-mono font-bold">admin</span>
              <span className="text-amber-400">/</span>
              <span className="font-mono font-bold">63935</span>
              <span className="text-[10px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-100 font-bold ml-1">
                Llenar
              </span>
            </button>
          </div>

          <div className="mt-5 text-center">
            <span className="text-[10px] text-slate-600 dark:text-slate-400">
              © 2026 Colegio Ricardo Bentín • Turno Tarde
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
