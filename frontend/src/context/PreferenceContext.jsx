import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const PreferenceContext = createContext();
const API_URL = 'http://localhost:8080/api';

export const hasActiveSavedPreferences = (prefs) => {
  if (!prefs) return false;
  return Boolean(
    prefs.highProtein ||
    prefs.lowSugar ||
    prefs.lowCalories ||
    prefs.lowSaturatedFat ||
    prefs.lowSodium ||
    prefs.highFiber ||
    prefs.lowFat ||
    prefs.vegetarian ||
    prefs.vegan ||
    (Array.isArray(prefs.avoidAllergens) && prefs.avoidAllergens.length > 0) ||
    (Array.isArray(prefs.excludedIngredients) && prefs.excludedIngredients.length > 0) ||
    (Array.isArray(prefs.avoidIngredients) && prefs.avoidIngredients.length > 0)
  );
};

export const usePreferences = () => {
  const context = useContext(PreferenceContext);
  if (!context) {
    return {
      preferences: {},
      savedPreferences: {},
      savePreferences: () => {},
      updatePreferences: () => {},
      clearPreferences: () => {},
      hasSavedPreferences: false,
      isNewlySaved: false,
      markRecommendationsSeen: () => {},
      loading: false
    };
  }
  return context;
};

export const PreferenceProvider = ({ children }) => {
  const [preferences, setPreferences] = useState({});
  const [isNewlySaved, setIsNewlySaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize from persisted storage
  useEffect(() => {
    let savedPrefs = null;
    try {
      const local = localStorage.getItem('smartchoice_saved_preferences') || sessionStorage.getItem('smartchoice_preferences');
      if (local) {
        savedPrefs = JSON.parse(local);
      }
    } catch (e) {
      console.warn("Storage parse warning:", e);
    }

    const unseen = localStorage.getItem('smartchoice_recommendations_unseen');
    if (unseen !== null) {
      setIsNewlySaved(unseen === 'true');
    }

    if (savedPrefs) {
      setPreferences(savedPrefs);
      setLoading(false);
    } else {
      axios.get(`${API_URL}/preferences/default`)
        .then(res => {
          if (res.data?.success && res.data?.data) {
            setPreferences(res.data.data);
            try {
              localStorage.setItem('smartchoice_saved_preferences', JSON.stringify(res.data.data));
              sessionStorage.setItem('smartchoice_preferences', JSON.stringify(res.data.data));
            } catch (e) {}
          }
        })
        .catch(err => console.warn('Default preferences notice:', err.message))
        .finally(() => setLoading(false));
    }
  }, []);

  const savePreferences = useCallback((newPrefs) => {
    const updated = { ...newPrefs };
    const hasActive = hasActiveSavedPreferences(updated);

    setPreferences(updated);
    setIsNewlySaved(hasActive);

    try {
      localStorage.setItem('smartchoice_saved_preferences', JSON.stringify(updated));
      sessionStorage.setItem('smartchoice_preferences', JSON.stringify(updated));
      localStorage.setItem('smartchoice_recommendations_unseen', hasActive ? 'true' : 'false');
    } catch (e) {
      console.warn("Storage write warning:", e);
    }

    // Optionally notify backend persistence
    axios.post(`${API_URL}/preferences`, updated).catch(() => {});
  }, []);

  const updatePreferences = useCallback((updates) => {
    savePreferences({ ...preferences, ...updates });
  }, [preferences, savePreferences]);

  const clearPreferences = useCallback(() => {
    const cleared = {
      highProtein: false,
      lowSugar: false,
      lowCalories: false,
      lowSaturatedFat: false,
      lowSodium: false,
      highFiber: false,
      lowFat: false,
      vegetarian: false,
      vegan: false,
      avoidAllergens: [],
      excludedIngredients: [],
      avoidIngredients: []
    };
    setPreferences(cleared);
    setIsNewlySaved(false);

    try {
      localStorage.setItem('smartchoice_saved_preferences', JSON.stringify(cleared));
      sessionStorage.setItem('smartchoice_preferences', JSON.stringify(cleared));
      localStorage.setItem('smartchoice_recommendations_unseen', 'false');
    } catch (e) {}

    axios.post(`${API_URL}/preferences`, cleared).catch(() => {});
  }, []);

  const markRecommendationsSeen = useCallback(() => {
    setIsNewlySaved(false);
    try {
      localStorage.setItem('smartchoice_recommendations_unseen', 'false');
    } catch (e) {}
  }, []);

  const hasSavedPreferences = useMemo(() => {
    return hasActiveSavedPreferences(preferences);
  }, [preferences]);

  return (
    <PreferenceContext.Provider value={{
      preferences,
      savedPreferences: preferences,
      savePreferences,
      updatePreferences,
      clearPreferences,
      hasSavedPreferences,
      isNewlySaved: hasSavedPreferences && isNewlySaved,
      markRecommendationsSeen,
      loading
    }}>
      {children}
    </PreferenceContext.Provider>
  );
};

