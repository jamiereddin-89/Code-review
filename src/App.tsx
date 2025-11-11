import { Header } from './components/Header';
import { SettingsProvider } from './contexts/SettingsContext';

function App() {
  return (
    <SettingsProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-800 p-8 text-center">
            <p className="mb-2">Start prompting (or editing) to see magic happen :)</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Open Settings to configure theme, devices, and AI provider.</p>
          </div>
        </main>
      </div>
    </SettingsProvider>
  );
}

export default App;
