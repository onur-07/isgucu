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
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

/**
 * Masks the last name of a person. 
 * Example: "Onur Şubat" -> "Onur Ş."
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
export const PROFANITY_WORDS = ["küfür1", "küfür2", "hakaret1"]; // Can be expanded

export function friendlySupabaseError(err: unknown, fallback: string): string {
  const raw =
    err && typeof err === "object" && "message" in err
      ? String((err as { message?: unknown }).message || "")
      : String(err || "");

  const msg = raw || fallback;
  const lowered = msg.toLowerCase();

  if (lowered.includes("pii_blocked")) {
    if (lowered.includes("phone")) return "Güvenlik nedeniyle telefon numarası paylaşımı yasaktır.";
    if (lowered.includes("iban")) return "Güvenlik nedeniyle IBAN paylaşımı yasaktır.";
    if (lowered.includes("email")) return "Güvenlik nedeniyle e-posta/iletişim bilgisi paylaşımı yasaktır.";
    return "Güvenlik nedeniyle iletişim bilgisi paylaşımı yasaktır.";
  }

  // Some clients surface postgres exceptions as JSON string
  if (lowered.includes("\"code\":\"p0001\"") && lowered.includes("pii_blocked")) {
    if (lowered.includes("phone")) return "Güvenlik nedeniyle telefon numarası paylaşımı yasaktır.";
    if (lowered.includes("iban")) return "Güvenlik nedeniyle IBAN paylaşımı yasaktır.";
    if (lowered.includes("email")) return "Güvenlik nedeniyle e-posta/iletişim bilgisi paylaşımı yasaktır.";
    return "Güvenlik nedeniyle iletişim bilgisi paylaşımı yasaktır.";
  }

  return msg;
}

export function sanitizeMessage(text: string): { allowed: boolean; reason?: string; cleanedText?: string } {
  let cleaned = text;
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
    return { allowed: false, reason: "Güvenlik nedeniyle telefon numarası paylaşımı yasaktır." };
  }

  // 2. Check for IBAN
  // Accept formats like "TR12 0006 1005 ..." (spaces) by removing non-alnum.
  if (/TR\d{24}/i.test(alnumOnly)) {
    return { allowed: false, reason: "Güvenlik nedeniyle IBAN paylaşımı yasaktır." };
  }

  // 3. Check for Emails
  const normalizedForEmail = text.replace(/\s+/g, "");
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(normalizedForEmail)) {
    return { allowed: false, reason: "Güvenlik nedeniyle iletişim bilgisi paylaşımı yasaktır." };
  }

  // 4. Mask Full Names inside the message (e.g. "Selam Ben Ahmet Yılmaz" -> "Selam Ben Ahmet Y.")
  // Heuristic: find two consecutive capitalized words that look like Name + Surname.
  // Avoid masking common non-name tokens.
  const nonNameTokens = new Set([
    "Selam",
    "Merhaba",
    "Ben",
    "Biz",
    "Sayın",
    "Sn",
    "Sn.",
    "İyi",
    "Iyi",
    "Nasılsın",
    "Nasilsin",
    "Teşekkür",
    "Tesekkur",
  ]);

  cleaned = cleaned.replace(
    /\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})\b/g,
    (m, a, b) => {
      const first = String(a);
      const last = String(b);
      if (nonNameTokens.has(first) || nonNameTokens.has(last)) return m;
      return `${first} ${last.charAt(0).toUpperCase()}.`;
    }
  );

  // 4.1 Mask spaced-letter full names (e.g. "A h m e t  Y ı l m a z" -> "Ahmet Y.")
  // Pattern: sequences of single-letter tokens separated by spaces, with 2+ spaces between name and surname groups.
  cleaned = cleaned.replace(
    /\b(?:[A-Za-zÇĞİÖŞÜçğıöşü]\s+){2,}[A-Za-zÇĞİÖŞÜçğıöşü](?:\s{2,}(?:[A-Za-zÇĞİÖŞÜçğıöşü]\s+){2,}[A-Za-zÇĞİÖŞÜçğıöşü])\b/g,
    (m) => {
      const groups = m.trim().split(/\s{2,}/).map((g) => g.replace(/\s+/g, "")).filter(Boolean);
      if (groups.length !== 2) return m;
      const [g1, g2] = groups;
      if (g1.length < 3 || g2.length < 3) return m;

      const cap = (s: string) => {
        const t = String(s);
        const first = t.charAt(0).toUpperCase();
        const rest = t.slice(1).toLowerCase();
        return `${first}${rest}`;
      };

      const first = cap(g1);
      const last = cap(g2);
      if (nonNameTokens.has(first) || nonNameTokens.has(last)) return m;
      return `${first} ${last.charAt(0).toUpperCase()}.`;
    }
  );

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
    "ıban",
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
    return { allowed: false, reason: "Güvenlik nedeniyle iletişim bilgisi paylaşımı yasaktır." };
  }

  // 4. Check for Profanity
  const normalizedForProfanity = lower;
  const expanded = [
    ...PROFANITY_WORDS,
    "amk",
    "aq",
    "siktir",
    "orospu",
    "piç",
    "yavşak",
    "ibne",
  ];
  for (const word of expanded) {
    if (normalizedForProfanity.includes(word)) {
      return { allowed: false, reason: "Kullandığınız mesajda kurallara aykırı ifadeler bulunmaktadır." };
    }
  }

  return { allowed: true, cleanedText: cleaned };
}

export function sanitizeListingText(text: string): { allowed: boolean; reason?: string; cleanedText?: string } {
  const raw = String(text || "");
  const cleaned = raw.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { allowed: false, reason: "Bu alan boş bırakılamaz." };

  const lower = cleaned.toLowerCase();
  const digitsOnly = cleaned.replace(/\D/g, "");
  const alnumOnly = cleaned.replace(/[^a-zA-Z0-9]/g, "");

  const looksLikeTrMobile =
    /^05\d{9}$/.test(digitsOnly) ||
    /^5\d{9}$/.test(digitsOnly) ||
    /^905\d{9}$/.test(digitsOnly) ||
    /^00905\d{9}$/.test(digitsOnly);
  if (looksLikeTrMobile) {
    return { allowed: false, reason: "Güvenlik nedeniyle telefon numarası/iletişim bilgisi yazılamaz." };
  }

  if (/TR\d{24}/i.test(alnumOnly)) {
    return { allowed: false, reason: "Güvenlik nedeniyle IBAN yazılamaz." };
  }

  const normalizedForEmail = cleaned.replace(/\s+/g, "");
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleaned) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(normalizedForEmail)) {
    return { allowed: false, reason: "Güvenlik nedeniyle e-posta/iletişim bilgisi yazılamaz." };
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
    "ıban",
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
    return { allowed: false, reason: "Güvenlik nedeniyle iletişim bilgisi paylaşılamaz." };
  }

  const expanded = [
    ...PROFANITY_WORDS,
    "amk",
    "aq",
    "siktir",
    "orospu",
    "piç",
    "yavşak",
    "ibne",
  ];
  for (const word of expanded) {
    if (lower.includes(word)) {
      return { allowed: false, reason: "Kullandığınız içerikte kurallara aykırı ifadeler bulunmaktadır." };
    }
  }

  const nonNameTokens = new Set([
    "selam",
    "merhaba",
    "ben",
    "biz",
    "sayın",
    "sn",
    "sn.",
    "iyi",
    "nasılsın",
    "nasılsin",
    "teşekkür",
    "tesekkur",
  ]);
  const nameMatch = cleaned.match(/\b([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})\s+([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2,})\b/);
  if (nameMatch) {
    const a = String(nameMatch[1] || "").toLocaleLowerCase("tr-TR");
    const b = String(nameMatch[2] || "").toLocaleLowerCase("tr-TR");
    if (!nonNameTokens.has(a) && !nonNameTokens.has(b)) {
      return { allowed: false, reason: "Güvenlik nedeniyle ad/soyad veya kişisel bilgi yazılamaz." };
    }
  }

  return { allowed: true, cleanedText: cleaned };
}
