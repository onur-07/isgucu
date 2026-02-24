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

/**
 * Sanitizes message content: blocks IBAN, Phone numbers, Emails and Profanity.
 */
export const PROFANITY_WORDS = ["küfür1", "küfür2", "hakaret1"]; // Can be expanded

export function sanitizeMessage(text: string): { allowed: boolean; reason?: string; cleanedText?: string } {
  let cleaned = text;
  const lower = text.toLowerCase();

  // 1. Check for Phone Numbers (10 or more digits)
  const normalizedForPhone = text.replace(/[\s\.\-\(\)\_\*]/g, "");
  if (/\d{10,}/.test(normalizedForPhone)) {
    return { allowed: false, reason: "Güvenlik nedeniyle telefon numarası paylaşımı yasaktır." };
  }

  // 2. Check for IBAN
  if (/TR\d{24}/i.test(normalizedForPhone)) {
    return { allowed: false, reason: "Güvenlik nedeniyle IBAN paylaşımı yasaktır." };
  }

  // 3. Check for Emails
  const normalizedForEmail = text.replace(/\s+/g, "");
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(normalizedForEmail)) {
    return { allowed: false, reason: "Güvenlik nedeniyle iletişim bilgisi paylaşımı yasaktır." };
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

  // 5. Automatic Name Masking (REMOVED: Destroying normal chat context)
  // It was incorrectly masking "Selam Beyefendi" as "Selam B."

  return { allowed: true, cleanedText: cleaned };
}
