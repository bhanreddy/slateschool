import React, { createContext, useContext } from 'react';

export type AdminWebChromeContextValue = {
  /** When true, the admin layout renders a persistent sidebar (wide web); the
   * dashboard should omit its own in-page sidebar to avoid duplication. */
  shellActive: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
};

const AdminWebChromeContext = createContext<AdminWebChromeContextValue>({
  shellActive: false,
  sidebarCollapsed: false,
  setSidebarCollapsed: () => {},
});

export function AdminWebChromeProvider({
  value,
  children,
}: {
  value: AdminWebChromeContextValue;
  children: React.ReactNode;
}) {
  return (
    <AdminWebChromeContext.Provider value={value}>
      {children}
    </AdminWebChromeContext.Provider>
  );
}

export function useAdminWebChrome() {
  return useContext(AdminWebChromeContext);
}
