import { useState, useEffect, useCallback } from 'react';

export type GeoLocation = {
  lat: number;
  lng: number;
};

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('La geolocalización no está soportada por tu navegador.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
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
            setError('Permiso denegado. Debés habilitar la ubicación para registrar tu asistencia.');
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
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, []);

  useEffect(() => {
    void (() => fetchLocation())();
  }, [fetchLocation]);

  return { location, error, isLoading, refetch: fetchLocation };
}
