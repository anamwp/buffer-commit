export const SERVICE_LABEL: Record<string, string> = {
  twitter: "X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  bluesky: "Bluesky",
  mastodon: "Mastodon",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  youtube: "YouTube",
  googlebusiness: "Google Business",
  substack: "Substack",
  startPage: "Start Page",
  whatsapp: "WhatsApp",
};

export function serviceLabel(service: string) {
  return SERVICE_LABEL[service] ?? service;
}
