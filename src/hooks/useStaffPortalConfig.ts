import { useCallback, useEffect, useState } from 'react';
import { StaffService } from '../services/staffService';

export interface StaffPortalConfig {
  payslips_enabled: boolean;
}

const DEFAULT_CONFIG: StaffPortalConfig = { payslips_enabled: true };

/**
 * Reads staff-portal feature flags (e.g. payslips visibility set by admin).
 * Defaults to enabled while loading to avoid UI flicker.
 */
export function useStaffPortalConfig() {
  const [config, setConfig] = useState<StaffPortalConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await StaffService.getPortalConfig();
      setConfig({
        payslips_enabled: res?.payslips_enabled !== false,
      });
    } catch {
      setConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    config,
    loading,
    refresh,
    payslipsEnabled: config.payslips_enabled,
  };
}
