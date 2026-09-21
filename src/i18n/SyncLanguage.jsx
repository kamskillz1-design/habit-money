import { useEffect, useRef } from "react";
import { useI18n, isSupportedLanguage, readStoredLanguage } from "@/i18n";
import { useAuth } from "@/lib/AuthContext";
import { useUserProfile, useSaveUserProfile } from "@/app/services/profile";

/** Keep UI language = picker choice. Do not let a new profile default of `es` overwrite it. */
export default function SyncLanguage() {
  const { language, setLanguage } = useI18n();
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const saveProfile = useSaveUserProfile();
  const wrote = useRef(false);

  useEffect(() => {
    const stored = readStoredLanguage();
    if (stored) {
      if (stored !== language) setLanguage(stored);
      return;
    }
    const fromProfile = profile?.preferred_language;
    if (isSupportedLanguage(fromProfile) && fromProfile !== language) {
      setLanguage(fromProfile);
    }
  }, [profile?.preferred_language]);

  useEffect(() => {
    if (!user?.id || !language) return;
    if (profile && profile.preferred_language === language) return;
    if (wrote.current && profile?.preferred_language === language) return;
    wrote.current = true;
    saveProfile.mutate({ preferred_language: language });
  }, [user?.id, language]);

  return null;
}
