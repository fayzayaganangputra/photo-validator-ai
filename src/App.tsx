import React from 'react';
import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import {
  CategorySelectionPage,
  CameraCapturePage,
  DocumentScanPage,
  ValidationResultPage,
  SavedPhotosPage,
} from './pages';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route
          path="/"
          element={
            <CategorySelectionPage />
          }
        />

        <Route
          path="/capture/:categoryId"
          element={
            <CameraCapturePage />
          }
        />

        <Route
          path="/scan/:categoryId"
          element={
            <DocumentScanPage />
          }
        />

        <Route
          path="/result/:categoryId"
          element={
            <ValidationResultPage />
          }
        />

        <Route
          path="/gallery"
          element={
            <SavedPhotosPage />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />
      </Routes>
    </div>
  );
};

export default App;