import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BackendStatusContextType {
  isOffline: boolean;
  setOffline: (v: boolean) => void;
  retry: () => void;
}

const BackendStatusContext = createContext<BackendStatusContextType | null>(null);

export function BackendStatusProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const handler = () => setIsOffline(true);
    window.addEventListener('backend-offline', handler);
    return () => window.removeEventListener('backend-offline', handler);
  }, []);

  const retry = () => {
    setIsOffline(false);
    window.location.reload();
  };

  return (
    <BackendStatusContext.Provider value={{ isOffline, setOffline: setIsOffline, retry }}>
      {children}
    </BackendStatusContext.Provider>
  );
}

export function useBackendStatus() {
  const ctx = useContext(BackendStatusContext);
  if (!ctx) throw new Error('useBackendStatus must be used within BackendStatusProvider');
  return ctx;
}
