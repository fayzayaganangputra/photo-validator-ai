import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  CategorySelectionPage,
  CameraCapturePage,
  ValidationResultPage,
  SavedPhotosPage
} from './pages';

const RegisterSW: React.FC = () => {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    }
  }, []);

  return null;
};

const App: React.FC = () => {
  return (
    <>
      <RegisterSW />
      <BrowserRouter>
        <div className="min-h-screen bg-slate-50">
          <Routes>
            <Route path="/" element={<CategorySelectionPage />} />
            <Route path="/capture/:categoryId" element={<CameraCapturePage />} />
            <Route path="/result/:categoryId" element={<ValidationResultPage />} />
            <Route path="/gallery" element={<SavedPhotosPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </>
  );
};

export default App;
