/**
 * @file useOnlineStatus.ts
 * @description Hook de detección de conectividad a internet en tiempo real para PWA.
 * Notifica al usuario cuando se encuentra 100% desconectado (0% internet / sin datos)
 * para garantizarle que todo su trabajo se guarda de forma segura en la base de datos
 * local SQLite Wasm sobre OPFS sin riesgo de pérdida.
 */

import { useState, useEffect } from 'react';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
