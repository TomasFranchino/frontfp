import { useState, useEffect } from 'react';

export type GeoLocation = {
  lat: number;
  lng: number;
};

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('La geolocalización no está soportada por tu navegador.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLoading(false);
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Permiso denegado. Debes habilitar la ubicación para registrar tu asistencia.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('La información de tu ubicación no está disponible en este momento.');
            break;
          case err.TIMEOUT:
            setError('Se agotó el tiempo de espera para obtener tu ubicación.');
            break;
          default:
            setError('Ocurrió un error desconocido al obtener tu ubicación.');
            break;
        }
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true, // Importante para la precisión del GPS
        timeout: 15000,
        maximumAge: 0, // No queremos posiciones oxidadas en caché
      }
    );
  }, []);

  return { location, error, isLoading };
}
