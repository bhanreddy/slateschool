import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from './usePermissions';
import { buildAdminNavActions } from '../constants/adminNav';
import type { WebSidebarActionItem } from '../components/DashboardWebSidebar';

export interface AdminNavBadges {
  /** Diary entries logged today → badge on the Academics entry. */
  diaryToday?: number;
  /** Pending access requests → badge on the Access Requests entry. */
  pendingRequests?: number;
}

/**
 * Builds the persistent web-sidebar entries for the admin portal from the
 * canonical nav list, filtered by RBAC and decorated with live badges. Shared
 * by the admin layout shell (see `app/admin/_layout.tsx`).
 */
export function useAdminSidebarItems(badges?: AdminNavBadges): WebSidebarActionItem[] {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  return useMemo<WebSidebarActionItem[]>(
    () =>
      buildAdminNavActions(t)
        .filter((item) => !item.permission || hasPermission(item.permission))
        .map((item) => ({
          title: item.title,
          icon: item.icon,
          route: item.route,
          gradient: item.gradient,
          category: item.category,
          badge:
            item.route === '/admin/academics'
              ? badges?.diaryToday
              : item.route === '/admin/access-requests'
                ? badges?.pendingRequests
                : undefined,
        })),
    [t, hasPermission, badges?.diaryToday, badges?.pendingRequests],
  );
}
