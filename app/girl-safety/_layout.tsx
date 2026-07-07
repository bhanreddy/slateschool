import { Stack } from 'expo-router';
import React from 'react';
export { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { useRequireRole } from '../../src/hooks/useRequireRole';
import { useRouteFeatureGuard } from '../../src/hooks/useFeatures';
import { GIRL_SAFETY_FEATURE } from '../../src/config/screenFeatureMap';

export default function GirlSafetyLayout() {
    useRequireRole('admin', 'staff', 'student', 'parent', 'principal');
    useRouteFeatureGuard({ '/girl-safety': GIRL_SAFETY_FEATURE }, { prefix: '/girl-safety' });

    return (
        <Stack screenOptions={{ contentStyle: { backgroundColor: 'transparent'}, headerShown: true }}>
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="raise"
                options={{
                    title: 'Raise a Complaint',
                    headerStyle: { backgroundColor: '#F3E8FF' },
                    headerTintColor: '#4C1D95',
                    headerShadowVisible: false,
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    title: 'Complaint Details',
                    headerStyle: { backgroundColor: '#F8FAFC' },
                    headerTintColor: '#334155',
                    headerShadowVisible: false,
                }}
            />
        </Stack>
    );
}
