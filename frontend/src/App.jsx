import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ErrorBoundary from './components/ErrorBoundary';
import {
  ProductDetail,
  Dashboard, History, Profile, Login, Register, About,
  RagAssistantPage
} from './pages/Pages';
import Storefront from './pages/Storefront';
import ComparePage from './pages/ComparePage';
import PreferencesPage from './pages/PreferencesPage';
import RecommendationsPage from './pages/RecommendationsPage';
import { ComparisonProvider } from './context/ComparisonContext';
import { PreferenceProvider } from './context/PreferenceContext';

function App() {
  return (
    <ErrorBoundary>
      <PreferenceProvider>
        <ComparisonProvider>
          <BrowserRouter>
            <Routes>
              {/* Storefront with replicated Catalog-500 navigation */}
              <Route path="/" element={<Storefront />} />
              <Route path="/search" element={<Storefront />} />

              {/* Dedicated Standalone Preferences Page */}
              <Route path="/preferences" element={<PreferencesPage />} />

              {/* Dedicated Standalone Comparison Page */}
              <Route path="/compare" element={<ComparePage />} />

              {/* Dedicated Standalone Recommendations Page */}
              <Route path="/recommendations" element={<RecommendationsPage />} />

              {/* Auxiliary Routes with Main Layout */}
              <Route element={<MainLayout />}>
                <Route path="assistant" element={<RagAssistantPage />} />
                <Route path="product/:id" element={<ProductDetail />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="history" element={<History />} />
                <Route path="profile" element={<Profile />} />
                <Route path="about" element={<About />} />
              </Route>

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Routes>
          </BrowserRouter>
        </ComparisonProvider>
      </PreferenceProvider>
    </ErrorBoundary>
  );
}

export default App;
