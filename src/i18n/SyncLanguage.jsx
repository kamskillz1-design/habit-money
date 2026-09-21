import { useEffect } from "react";
import { useI18n, isSupportedLanguage, readStoredLanguage } from "@/i18n";
import { useUserProfile } from "@/app/services/profile";

/** Stored picker language always wins over a Spanish/English profile default. */
export default function SyncLanguage() {
  const { language, setLanguage } = useI18n();
  const { data: profile } = useUserProfile();

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

  return null;
}
