import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { supabase } from "@/api/supabaseClient";
import { loadMergedUser } from "@/api/authUser";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const applySession = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
    const merged = await loadMergedUser(session.user);
    setUser(merged);
    setIsAuthenticated(!!merged);
    return merged;
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      await applySession(data.session);
      setAuthChecked(true);
    } catch (error) {
      console.error("User auth check failed:", error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError({
        type: "auth_required",
        message: error.message || "Authentication required",
      });
    } finally {
      setIsLoadingAuth(false);
    }
  }, [applySession]);

  const checkAppState = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);
      setAppPublicSettings({ id: "habit-money-coach", public_settings: {} });
      setIsLoadingPublicSettings(false);
      await checkUserAuth();
    } catch (error) {
      console.error("App state check failed:", error);
      setAuthError({
        type: "unknown",
        message: error.message || "Failed to load app",
      });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [checkUserAuth]);

  useEffect(() => {
    checkAppState();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    });
    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [checkAppState, applySession]);

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    supabase.auth.signOut().finally(() => {
      if (shouldRedirect && typeof window !== "undefined") {
        window.location.href = "/login";
      }
    });
  };

  const navigateToLogin = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
