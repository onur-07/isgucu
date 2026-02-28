import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function usernameFold(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/\u0307/g, "")
    .normalize("NFC");
}

export function usernameKey(value: string | null | undefined): string {
  const raw = usernameFold(value);
  return raw
    .replace(/Ã§/g, "c")
    .replace(/ÄŸ/g, "g")
    .replace(/Ä±/g, "i")
    .replace(/iÌ‡/g, "i")
    .replace(/Ã¶/g, "o")
    .replace(/ÅŸ/g, "s")
    .replace(/Ã¼/g, "u");
}

/**
 * Masks the last name of a person. 
 * Example: "Onur Åubat" -> "Onur Å."
 */
export function maskFullName(name: string | null | undefined): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;

  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();

  return `${firstName} ${lastInitial}.`;
}

export function displayUsername(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // If username contains whitespace, treat it as a full name for display purposes.
  if (/\s/.test(raw)) return maskFullName(raw);
  return raw;
}

/**
 * Sanitizes message content: blocks IBAN, Phone numbers, Emails and Profanity.
 */
export const PROFANITY_WORDS = ["kÃ¼fÃ¼r1", "kÃ¼fÃ¼r2", "hakaret1"]; // Can be expanded

export function friendlySupabaseError(err: unknown, fallback: string): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message || "")
      : String(err || "");

  const msg = raw || fallback;
  const lowered = msg.toLowerCase();

  if (lowered.includes("pii_blocked")) {
    if (lowered.includes("phone")) return "GÃ¼venlik nedeniyle telefon numarasÄ± paylaÅŸÄ±mÄ± yasaktÄ±r.";
    if (lowered.includes("iban")) return "GÃ¼venlik nedeniyle IBAN paylaÅŸÄ±mÄ± yasaktÄ±r.";
    if (lowered.includes("email")) return "GÃ¼venlik nedeniyle e-posta/iletiÅŸim bilgisi paylaÅŸÄ±mÄ± yasaktÄ±r.";
    return "GÃ¼venlik nedeniyle iletiÅŸim bilgisi paylaÅŸÄ±mÄ± yasaktÄ±r.";
  }

  // Some clients surface postgres exceptions as JSON string
  if (lowered.includes("\"code\":\"p0001\"") && lowered.includes("pii_blocked")) {
    if (lowered.includes("phone")) return "GÃ¼venlik nedeniyle telefon numarasÄ± paylaÅŸÄ±mÄ± yasaktÄ±r.";
    if (lowered.includes("iban")) return "GÃ¼venlik nedeniyle IBAN paylaÅŸÄ±mÄ± yasaktÄ±r.";
    if (lowered.includes("email")) return "GÃ¼venlik nedeniyle e-posta/iletiÅŸim bilgisi paylaÅŸÄ±mÄ± yasaktÄ±r.";
    return "GÃ¼venlik nedeniyle iletiÅŸim bilgisi paylaÅŸÄ±mÄ± yasaktÄ±r.";
  }

  return msg;
}

export function sanitizeMessage(text: string): { allowed: boolean; reason?: string; cleanedText?: string } {
  const cleaned = text;
  const lower = text.toLowerCase();

  // Normalize for robust detection (spaces / dots / dashes / emojis / etc.)
  const digitsOnly = text.replace(/\D/g, "");
  const alnumOnly = text.replace(/[^a-zA-Z0-9]/g, "");

  // 1. Check for Phone Numbers (10 or more digits)
  // Only block common TR mobile formats to avoid blocking prices like "100000".
  // Matches:
  // - 05xxxxxxxxx (11 digits)
  // - 5xxxxxxxxx  (10 digits)
  // - 905xxxxxxxxx (12 digits)
  // - 00905xxxxxxxxx (14 digits)
  const looksLikeTrMobile =
    /^05\d{9}$/.test(digitsOnly) ||
    /^5\d{9}$/.test(digitsOnly) ||
    /^905\d{9}$/.test(digitsOnly) ||
    /^00905\d{9}$/.test(digitsOnly);

  if (looksLikeTrMobile) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle telefon numarasÄ± paylaÅŸÄ±mÄ± yasaktÄ±r." };
  }

  // 2. Check for IBAN
  // Accept formats like "TR12 0006 1005 ..." (spaces) by removing non-alnum.
  if (/TR\d{24}/i.test(alnumOnly)) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle IBAN paylaÅŸÄ±mÄ± yasaktÄ±r." };
  }

  // 3. Check for Emails
  const normalizedForEmail = text.replace(/\s+/g, "");
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(normalizedForEmail)) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle iletiÅŸim bilgisi paylaÅŸÄ±mÄ± yasaktÄ±r." };
  }

  // 4. Name/surname check:
  // Only block clear personal identity patterns. Do not mask generic phrases (e.g. "Tahmini Fiyat").
  const firstNameLike = new Set([
    "ahmet", "mehmet", "ali", "veli", "hasan", "huseyin", "mustafa", "emre", "onur",
    "mert", "kaan", "berk", "furkan", "yusuf", "ibrahim", "abdullah", "enes", "omer",
    "ayse", "fatma", "zeynep", "elif", "hatice", "esra", "buse", "eda", "sena", "melis",
  ]);
  const identityHints = /\b(benim|adim|ismim|isimim|ad\s*soyad|ad-soyad|soyadim)\b/i;
  const nameMatch = cleaned.match(/\b([\p{Lu}][\p{Ll}]{2,})\s+([\p{Lu}][\p{Ll}]{2,})\b/u);
  if (nameMatch) {
    const first = String(nameMatch[1] || "").toLocaleLowerCase("tr-TR");
    const hasIdentityHint = identityHints.test(cleaned);
    const looksLikeRealName = firstNameLike.has(first);
    if (hasIdentityHint || looksLikeRealName) {
      return { allowed: false, reason: "Guvenlik nedeniyle ad/soyad veya kisisel bilgi yazilamaz." };
    }
  }

  // 3.1 Social / contact hints
  const contactHints = [
    "whatsapp",
    "wp",
    "wapp",
    "telegram",
    "tg",
    "instagram",
    "insta",
    "dm",
    "direct",
    "iban",
    "Ä±ban",
    "telefon",
    "tel",
    "gsm",
    "numara",
    "mail",
    "gmail",
    "hotmail",
    "outlook",
    "@",
    "t.me",
    "wa.me",
  ];
  if (contactHints.some((h) => lower.includes(h))) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle iletiÅŸim bilgisi paylaÅŸÄ±mÄ± yasaktÄ±r." };
  }

  // 4. Check for Profanity
  const normalizedForProfanity = lower;
  const expanded = [
    ...PROFANITY_WORDS,
    "amk",
    "aq",
    "siktir",
    "orospu",
    "piÃ§",
    "yavÅŸak",
    "ibne",
  ];
  for (const word of expanded) {
    if (normalizedForProfanity.includes(word)) {
      return { allowed: false, reason: "KullandÄ±ÄŸÄ±nÄ±z mesajda kurallara aykÄ±rÄ± ifadeler bulunmaktadÄ±r." };
    }
  }

  return { allowed: true, cleanedText: cleaned };
}

export function sanitizeListingText(text: string): { allowed: boolean; reason?: string; cleanedText?: string } {
  const raw = String(text || "");
  const cleaned = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { allowed: false, reason: "Bu alan boÅŸ bÄ±rakÄ±lamaz." };

  const lower = cleaned.toLowerCase();
  const digitsOnly = cleaned.replace(/\D/g, "");
  const alnumOnly = cleaned.replace(/[^a-zA-Z0-9]/g, "");

  const looksLikeTrMobile =
    /^05\d{9}$/.test(digitsOnly) ||
    /^5\d{9}$/.test(digitsOnly) ||
    /^905\d{9}$/.test(digitsOnly) ||
    /^00905\d{9}$/.test(digitsOnly);
  if (looksLikeTrMobile) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle telefon numarasÄ±/iletiÅŸim bilgisi yazÄ±lamaz." };
  }

  if (/TR\d{24}/i.test(alnumOnly)) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle IBAN yazÄ±lamaz." };
  }

  const normalizedForEmail = cleaned.replace(/\s+/g, "");
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleaned) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(normalizedForEmail)) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle e-posta/iletiÅŸim bilgisi yazÄ±lamaz." };
  }

  const contactHints = [
    "whatsapp",
    "wp",
    "wapp",
    "telegram",
    "tg",
    "instagram",
    "insta",
    "dm",
    "direct",
    "iban",
    "Ä±ban",
    "telefon",
    "tel",
    "gsm",
    "numara",
    "mail",
    "gmail",
    "hotmail",
    "outlook",
    "t.me",
    "wa.me",
  ];
  if (contactHints.some((h) => lower.includes(h)) || lower.includes("@")) {
    return { allowed: false, reason: "GÃ¼venlik nedeniyle iletiÅŸim bilgisi paylaÅŸÄ±lamaz." };
  }

  const expanded = [
    ...PROFANITY_WORDS,
    "amk",
    "aq",
    "siktir",
    "orospu",
    "piÃ§",
    "yavÅŸak",
    "ibne",
  ];
  for (const word of expanded) {
    if (lower.includes(word)) {
      return { allowed: false, reason: "KullandÄ±ÄŸÄ±nÄ±z iÃ§erikte kurallara aykÄ±rÄ± ifadeler bulunmaktadÄ±r." };
    }
  }

  // Name/surname check:
  // Avoid false positives like "Logo Yaptirmak". Block only clear personal identity patterns.
  const firstNameLike = new Set([
    "ahmet", "mehmet", "ali", "veli", "hasan", "huseyin", "mustafa", "emre", "onur",
    "mert", "kaan", "berk", "furkan", "yusuf", "ibrahim", "abdullah", "enes", "omer",
    "ayse", "fatma", "zeynep", "elif", "hatice", "esra", "buse", "eda", "sena", "melis",
  ]);
  const identityHints = /\b(benim|adim|ismim|isimim|ad\s*soyad|ad-soyad|soyadim)\b/i;
  const nameMatch = cleaned.match(/\b([\p{Lu}][\p{Ll}]{2,})\s+([\p{Lu}][\p{Ll}]{2,})\b/u);
  if (nameMatch) {
    const first = String(nameMatch[1] || "").toLocaleLowerCase("tr-TR");
    const hasIdentityHint = identityHints.test(cleaned);
    const looksLikeRealName = firstNameLike.has(first);
    if (hasIdentityHint || looksLikeRealName) {
      return { allowed: false, reason: "Guvenlik nedeniyle ad/soyad veya kisisel bilgi yazilamaz." };
    }
  }
  return { allowed: true, cleanedText: cleaned };
}
