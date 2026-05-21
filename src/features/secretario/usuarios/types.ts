export type PerfilUsuario = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
};

export type DocenteOut = {
  id: number;
  user: PerfilUsuario;
  activo: boolean;
};

export type SecretarioOut = {
  id: number;
  user: PerfilUsuario;
  activo: boolean;
};

export type MensajeOut = {
  success?: boolean;
  mensaje: string;
};

export function getBackendMessage(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'mensaje' in data) {
    const mensaje = (data as MensajeOut).mensaje;
    if (typeof mensaje === 'string' && mensaje.trim()) {
      return mensaje;
    }
  }

  return fallback;
}

export function formatNombreCompleto(user: PerfilUsuario) {
  const apellido = user.last_name.trim();
  const nombre = user.first_name.trim();
  return [apellido, nombre].filter(Boolean).join(', ') || user.username;
}
