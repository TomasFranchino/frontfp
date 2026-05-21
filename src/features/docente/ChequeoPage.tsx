import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export function ChequeoPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Chequeo</CardTitle>
            <CardDescription>
              {user ? `${user.first_name} ${user.last_name}` : 'Usuario autenticado'} puede usar esta vista como acceso rápido.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Ruta protegida para docentes</p>
            <Button variant="outline" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
