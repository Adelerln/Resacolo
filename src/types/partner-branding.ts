export type PublicSitePartnerBranding = {
  collectivityId: string;
  partnerName: string;
  partnerLogoUrl: string | null;
  partnerLogoScale: number;
  partnerLogoOffsetX: number;
  partnerLogoOffsetY: number;
  primaryColor: string | null;
  heroEnabled: boolean;
  heroTitle: string | null;
  heroBody: string | null;
  heroCtaLabel: string | null;
  heroCtaUrl: string | null;
} | null;
