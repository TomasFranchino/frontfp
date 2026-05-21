import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AxiosError } from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(74,144,226,0.18),transparent_35%),linear-gradient(180deg,#f8fbff_0%,#eef3f8_100%)] px-4 py-10 text-foreground">
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-r from-primary/10 via-secondary/15 to-transparent blur-3xl" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="hidden max-w-xl space-y-6 lg:block">
            <div className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
              Control de asistencia docente ICES / UCSE
            </div>
            <h1 className="text-5xl font-semibold tracking-tight text-primary">
              Acceso seguro para gestionar la asistencia con sesiones de backend.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-muted-foreground">
              Ingresá con tu usuario institucional para continuar al panel correspondiente según tu rol.
            </p>
          </section>

          <Card className="mx-auto w-full max-w-md border-border/80 bg-card/95 shadow-2xl backdrop-blur">
            <CardHeader>
              <CardTitle>Iniciar sesión</CardTitle>
              <CardDescription>Usá tus credenciales para entrar al sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input id="username" autoComplete="username" {...register('username')} />
                  {errors.username ? <p className="text-sm text-destructive">{errors.username.message}</p> : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
                  {errors.password ? <p className="text-sm text-destructive">{errors.password.message}</p> : null}
                </div>

                {errors.root ? <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{errors.root.message}</p> : null}

                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
