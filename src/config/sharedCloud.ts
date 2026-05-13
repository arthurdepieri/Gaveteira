import { AppSettings } from "../types";

export const sharedCloudSettings: NonNullable<AppSettings["cloud"]> = {
  supabaseUrl: "https://wazxnksbbqtqagxqsipj.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indhenhua3NiYnF0cWFneHFzaXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MzYzOTEsImV4cCI6MjA5NDIxMjM5MX0.6ExQ-7fZyjJTd4q3JAkE5rgZaOomIHcSC0_fFOGwS8E",
};

export function withSharedCloudSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    cloud: mergeFallback(sharedCloudSettings, settings.cloud ?? {}),
  };
}

function mergeFallback<T extends object>(fallback: T, override: Partial<T>): T {
  const merged = { ...fallback };

  Object.entries(override).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      Object.assign(merged, { [key]: value });
    }
  });

  return merged;
}
