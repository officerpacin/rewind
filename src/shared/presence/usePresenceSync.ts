import { useEffect } from "react";
import { presenceClient } from "./presenceClient";
import { MUSIC_ONLY_MODE } from "@/shared/api/baseUrl";

// React hook to keep desktop presence active across app lifecycle
export function usePresenceSync(): void {
  useEffect(() => {
    if (MUSIC_ONLY_MODE) return;
    presenceClient.start();
    return () => {
      presenceClient.stop();
    };
  }, []);
}
