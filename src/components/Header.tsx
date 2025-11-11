import { Settings } from 'lucide-react';
import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { SettingsPopup } from './SettingsPopup';

export function Header() {
  const { theme } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <header className="w-full border-b bg-white/70 dark:bg-gray-900/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 dark:supports-[backdrop-filter]:bg-gray-900/50">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Vibe Coder</h1>
        <button
          aria-label="Open Settings"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
      {open && <SettingsPopup onClose={() => setOpen(false)} />}
    </header>
  );
}
