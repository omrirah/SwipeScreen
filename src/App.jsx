import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HomeScreen from './components/HomeScreen';
import ProjectSetup from './components/ProjectSetup';
import ScreeningView from './components/ScreeningView';
import ResultsSummary from './components/ResultsSummary';
import SynthesisUpload from './components/SynthesisUpload';
import ConflictResolution from './components/ConflictResolution';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('swipescreen_darkMode') === 'true';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('swipescreen_darkMode', darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-dvh">
      <Routes>
        <Route path="/" element={<HomeScreen darkMode={darkMode} setDarkMode={setDarkMode} />} />
        <Route path="/project/new" element={<ProjectSetup />} />
        <Route path="/project/:id/screen" element={<ScreeningView />} />
        <Route path="/project/:id/results" element={<ResultsSummary />} />
        <Route path="/synthesis" element={<SynthesisUpload />} />
        <Route path="/synthesis/:id/resolve" element={<ConflictResolution />} />
      </Routes>
    </div>
  );
}
