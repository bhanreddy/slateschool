import React, { useMemo, useState } from 'react';
import { View, Platform, StyleSheet, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { useRequireRole } from '../../src/hooks/useRequireRole';
export { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { useTheme } from '../../src/hooks/useTheme';
import { AdminWebChromeProvider } from '../../src/contexts/AdminWebChromeContext';
import { useAdminSidebarItems } from '../../src/hooks/useAdminSidebarItems';
import DashboardWebSidebar from '../../src/components/DashboardWebSidebar';

export default function AdminLayout() {
    useRequireRole('admin', 'principal');

    const { theme } = useTheme();
    const { width: windowWidth } = useWindowDimensions();
    const isWideWeb = Platform.OS === 'web' && windowWidth >= 768;
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const sidebarItems = useAdminSidebarItems();

    const chromeValue = useMemo(
        () => ({ shellActive: isWideWeb, sidebarCollapsed, setSidebarCollapsed }),
        [isWideWeb, sidebarCollapsed],
    );

    const stack = (
        <Stack
            screenOptions={{
                contentStyle: { backgroundColor: 'transparent' },
                headerShown: false,
                animation: 'slide_from_right',
            }}
        />
    );

    return (
        <AdminWebChromeProvider value={chromeValue}>
            {isWideWeb ? (
                <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
                    <View style={styles.bodyRow}>
                        <DashboardWebSidebar collapsed={sidebarCollapsed} items={sidebarItems} />
                        <View style={styles.stackCell}>{stack}</View>
                    </View>
                </View>
            ) : (
                stack
            )}
        </AdminWebChromeProvider>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    bodyRow: { flex: 1, flexDirection: 'row' },
    stackCell: { flex: 1, minWidth: 0, minHeight: 0 },
});
