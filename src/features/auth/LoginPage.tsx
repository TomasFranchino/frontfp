import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AxiosError } from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

import logo from '@/assets/ices-superior.svg';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getDefaultDashboard(role: 'docente' | 'secretario') {
  return role === 'docente' ? '/docente/dashboard' : '/secretario/dashboard';
}

export function LoginPage() {
  const { login, user, rol, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    if (user && rol) {
      navigate(from ?? getDefaultDashboard(rol), { replace: true });
    }
  }, [from, navigate, rol, user]);

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const currentUser = await login(values);
      const nextPath = from ?? getDefaultDashboard(currentUser.rol);

      navigate(nextPath, { replace: true });
    } catch (error) {
      const responseMessage = (error as AxiosError<{ mensaje?: string }>).response?.data?.mensaje;

      setError('root', {
        type: 'manual',
        message: responseMessage ?? 'No se pudo iniciar sesión. Verificá tus credenciales.',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-start overflow-y-auto md:overflow-hidden bg-[#2C3E50] px-4 py-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] font-sans antialiased text-[#181C1C] select-none md:items-center md:justify-center md:py-6">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-[#162839]/30 to-transparent pointer-events-none z-0" />
      <div className="absolute w-64 h-64 bg-[#0060ac]/10 rounded-full blur-3xl pointer-events-none z-0" />

      {/* Main Container */}
      <div className="relative z-10 flex w-full max-w-[400px] flex-col gap-6 px-2 sm:px-4 md:px-6 md:pt-2">

        <header className="flex w-full flex-col items-center gap-4 pt-2 text-center md:pt-0">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-[#c4c6cd]/20 bg-[#F7FAF9] p-3 shadow-md">
            <img src={logo} alt="ICES Logo" className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-[28px] font-bold leading-[1.2] tracking-tight text-white sm:text-[32px]">
              ICES Inicio de Sesión
            </h1>
            <p className="max-w-[85%] text-[15px] font-medium leading-[1.6] text-[#b5c8df] sm:text-[16px]">
              Control de Asistencia Docente
            </p>
          </div>
        </header>

        {/* Login Card */}
        <div className="w-full rounded-xl border border-[#e0e3e2] bg-[#F7FAF9] p-5 shadow-[0px_10px_30px_rgba(0,0,0,0.15)] sm:p-6">
          <h2 className="text-[20px] leading-[1.4] font-semibold text-[#162839] text-center mb-2">
            Ingresá con tu usuario
          </h2>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            {/* Username Input */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-[12px] leading-none font-medium text-[#43474C] ml-1">
                Usuario
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-5 h-5 text-[#74777D]" />
                <input
                  id="username"
                  autoComplete="username"
                  {...register('username')}
                  className="w-full h-12 pl-10 pr-4 rounded-lg border border-[#C4C6CD] bg-[#F7FAF9] text-[#181C1C] text-[14px] leading-[1.5] focus:border-[#0060AC] focus:ring-2 focus:ring-[#0060AC]/20 transition-all outline-none"
                  placeholder="usuario.docente"
                  type="text"
                />
              </div>
              {errors.username ? (
                <p className="text-[12px] text-[#ba1a1a] ml-1 mt-0.5">{errors.username.message}</p>
              ) : null}
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-[12px] leading-none font-medium text-[#43474C] ml-1">
                Contraseña
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-5 h-5 text-[#74777D]" />
                <input
                  id="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full h-12 pl-10 pr-10 rounded-lg border border-[#C4C6CD] bg-[#F7FAF9] text-[#181C1C] text-[14px] leading-[1.5] focus:border-[#0060AC] focus:ring-2 focus:ring-[#0060AC]/20 transition-all outline-none"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 flex items-center justify-center text-[#74777D] hover:text-[#43474C] transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password ? (
                <p className="text-[12px] text-[#ba1a1a] ml-1 mt-0.5">{errors.password.message}</p>
              ) : null}
            </div>

            {/* Root / General Error */}
            {errors.root ? (
              <p className="rounded-md border border-[#ba1a1a]/20 bg-[#ffdad6] px-3 py-2 text-[13px] text-[#93000A] leading-normal font-medium animate-in fade-in zoom-in-95 duration-150">
                {errors.root.message}
              </p>
            ) : null}

            {/* Submit Button */}
            <button
              className="w-full h-[52px] mt-2 bg-[#0060AC] text-white rounded-lg font-semibold text-[14px] uppercase tracking-wider flex items-center justify-center hover:bg-[#0060AC]/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              type="submit"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <footer className="w-full pb-2 text-center">
          <p className="text-[12px] font-medium leading-none text-[#b5c8df]">
            ¿Problemas para acceder? Avisá a Secretaría
          </p>
        </footer>

      </div>
    </div>
  );
}

