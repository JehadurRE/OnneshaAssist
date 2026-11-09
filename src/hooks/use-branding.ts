import { useEffect, useState } from 'react';
import { BrandingSettings } from '@/lib/types';
import { db } from '@/lib/db';

const DEFAULT_BRANDING: BrandingSettings = {
  showPartnerLogo: false,
  partnerName: '',
  partnerLogoUrl: '',
  institutionTitle: 'Onnesha Assessment Arena',
};

export function useBranding(): BrandingSettings {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);

  useEffect(() => {
    setBranding(db.getBranding());

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<BrandingSettings>;
      if (custom.detail) {
        setBranding(custom.detail);
      } else {
        setBranding(db.getBranding());
      }
    };

    const unsub = db.subscribe(() => {
      setBranding(db.getBranding());
    });

    window.addEventListener('onnesha-branding-updated', handleUpdate);
    return () => {
      unsub();
      window.removeEventListener('onnesha-branding-updated', handleUpdate);
    };
  }, []);

  return branding;
}
