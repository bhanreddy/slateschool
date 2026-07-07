/**
 * useAnalytics.ts
 * Feature-complete hook that drives the AdminReports screen.
 * Manages loading, error, caching, range switching, and refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  AnalyticsService,
  AnalyticsData,
  FeeCollectionSummary,
  AttendanceSummary,
  AcademicSummary,
  StaffSummary,
  Insight,
  TimeRange,
} from '../services/analyticsService';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type { TimeRange };

export interface UseAnalyticsReturn {
  // Data
  financials:  FeeCollectionSummary | null;
  attendance:  AttendanceSummary    | null;
  academics:   AcademicSummary      | null;
  staff:       StaffSummary         | null;
  insights:    Insight[];
  generatedAt: string | null;

  // UI state
  loading:        boolean;
  refreshing:     boolean;
  error:          string | null;
  range:          TimeRange;
  activeSection:  Section;

  // Actions
  setRange:        (r: TimeRange)  => void;
  setActiveSection:(s: Section)    => void;
  refreshData:     ()              => Promise<void>;
  dismissInsight:  (id: string)    => Promise<void>;
  exportReport:    ()              => Promise<string | null>;
}

export type Section = 'overview' | 'finance' | 'attendance' | 'academic' | 'staff';

// ─── Simple in-memory cache ─────────────────────────────────────────────────
interface CacheEntry {
  data: AnalyticsData;
  fetchedAt: number; // ms timestamp
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache: Record<TimeRange, CacheEntry | null> = {
  month:   null,
  quarter: null,
  year:    null,
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useAnalytics(): UseAnalyticsReturn {
  const [range, setRangeState]         = useState<TimeRange>('month');
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const [financials,  setFinancials]  = useState<FeeCollectionSummary | null>(null);
  const [attendance,  setAttendance]  = useState<AttendanceSummary    | null>(null);
  const [academics,   setAcademics]   = useState<AcademicSummary      | null>(null);
  const [staff,       setStaff]       = useState<StaffSummary          | null>(null);
  const [insights,    setInsights]    = useState<Insight[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [loading,   setLoading]   = useState(false);
  const [refreshing,setRefreshing]= useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Abort controller to cancel in-flight requests on unmount/range change
  const abortRef = useRef<AbortController | null>(null);

  const isFocused = useIsFocused();

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(
    async (selectedRange: TimeRange, isRefresh = false) => {
      // Cancel any previous request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      // Check cache
      const cached = cache[selectedRange];
      const now = Date.now();
      if (!isRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
        applyData(cached.data);
        return;
      }

      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);

      try {
        const data = await AnalyticsService.getAnalytics(selectedRange);

        // Store in cache
        cache[selectedRange] = { data, fetchedAt: now };

        applyData(data);
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError') return;
        const msg = err?.response?.data?.message || err?.message || 'Failed to load analytics';
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  function applyData(data: AnalyticsData) {
    setFinancials(data.financials);
    setAttendance(data.attendance);
    setAcademics(data.academics);
    setStaff(data.staff);
    setInsights(data.insights ?? []);
    setGeneratedAt(data.generated_at);
  }

  // ── Range change ───────────────────────────────────────────────────────────
  const setRange = useCallback((r: TimeRange) => {
    setRangeState(r);
  }, []);

  // ── Effect: fetch on range change ──────────────────────────────────────────
  useEffect(() => {
    fetchData(range);
    return () => { abortRef.current?.abort(); };
  }, [range]);

  // ── Effect: revalidate stale data whenever the screen regains focus ──────────
  // Without this, the module-level cache freezes values for CACHE_TTL_MS and
  // never refreshes while the app stays open — so two admins (or a returning
  // user) see divergent, stale numbers. fetchData respects the cache, so this
  // only hits the network when the cached snapshot is actually stale.
  useEffect(() => {
    if (!isFocused) return;
    fetchData(range);
  }, [isFocused, range, fetchData]);

  // ── Pull-to-refresh ────────────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    await fetchData(range, true);
  }, [range, fetchData]);

  // ── Dismiss an insight optimistically ─────────────────────────────────────
  const dismissInsight = useCallback(async (id: string) => {
    // Optimistic update
    setInsights(prev => prev.filter(i => i.id !== id));
    try {
      await AnalyticsService.dismissInsight(id);
      // Invalidate cache for current range
      cache[range] = null;
    } catch {
      // Revert by re-fetching silently
      fetchData(range, true);
    }
  }, [range, fetchData]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportReport = useCallback(async (): Promise<string | null> => {
    try {
      const { download_url } = await AnalyticsService.exportReport(range);
      return download_url;
    } catch {
      return null;
    }
  }, [range]);

  return {
    financials,
    attendance,
    academics,
    staff,
    insights,
    generatedAt,
    loading,
    refreshing,
    error,
    range,
    activeSection,
    setRange,
    setActiveSection,
    refreshData,
    dismissInsight,
    exportReport,
  };
}
