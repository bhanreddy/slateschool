import { useCallback, useState } from 'react';
import AccountSwitcherSheet from './AccountSwitcherSheet';

/** Shared copy + icon styling for Settings → Switch account rows */
export const SWITCH_ACCOUNT_SETTINGS = {
  label: 'Switch account',
  icon: 'people-circle' as const,
  iconColor: '#2563EB',
  iconBg: '#EFF6FF',
};

/** Manages AccountSwitcherSheet visibility from settings screens */
export function useSettingsAccountSwitcher() {
  const [open, setOpen] = useState(false);
  return {
    switcherOpen: open,
    openSwitcher: useCallback(() => setOpen(true), []),
    closeSwitcher: useCallback(() => setOpen(false), []),
  };
}

export function SettingsAccountSwitcherSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return <AccountSwitcherSheet visible={visible} onClose={onClose} />;
}
