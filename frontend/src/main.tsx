import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';

// apply the stored theme before first paint to avoid a flash; the SettingsProvider
// keeps it in sync afterward. defaults to dark.
try {
	const raw = localStorage.getItem('pzy-settings');
	const theme = raw ? JSON.parse(raw).theme : 'dark';
	document.documentElement.classList.toggle('dark', theme !== 'light');
} catch {
	document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
);
