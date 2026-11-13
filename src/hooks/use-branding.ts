import { useEffect, useState } from "react";
import { BrandingSettings } from "@/lib/types";
import { db } from "@/lib/db";
import { DEFAULT_BRANDING_SETTINGS, mergeBrandingSettings } from "@/lib/branding";

export function useBranding(): BrandingSettings {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);

  useEffect(() => {
    setBranding(db.getBranding());

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<BrandingSettings>;
      if (custom.detail) {
        setBranding(mergeBrandingSettings(custom.detail));
      } else {
        setBranding(db.getBranding());
      }
    };

    const unsub = db.subscribe(() => {
      setBranding(db.getBranding());
    });

    window.addEventListener("onnesha-branding-updated", handleUpdate);
    return () => {
      unsub();
      window.removeEventListener("onnesha-branding-updated", handleUpdate);
    };
  }, []);

  return branding;
}
