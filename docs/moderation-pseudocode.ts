// Framework bağımsız pseudo-code

const PROFANITY_WORDS = ["..."];

export function normalizeForDetection(text: string) {
  const lower = text.toLocaleLowerCase("tr-TR");
  const ascii = lower
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

  const compact = ascii.replace(/[^a-z0-9]/g, "");
  return { original: text, lower: ascii, compact };
}

export function detectPhone(compact: string) {
  // 0 ile başlayan 11 hane veya 10 haneli TR GSM formatı
  return /(?:0?5\d{9})/.test(compact);
}

export function detectIban(compact: string) {
  return /tr\d{24}/.test(compact);
}

export function detectEmail(text: string, compact: string) {
  const direct = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text);
  const obfuscated = /(gmailcom|hotmailcom|outlookcom|yahoocom)/.test(compact);
  return direct || obfuscated;
}

export function detectProfanity(lower: string) {
  return PROFANITY_WORDS.some((w) => lower.includes(w));
}

export function moderateMessage(text: string) {
  const { lower, compact } = normalizeForDetection(text);

  if (detectProfanity(lower)) return { allowed: false, reason: "profanity" };
  if (detectPhone(compact)) return { allowed: false, reason: "phone" };
  if (detectIban(compact)) return { allowed: false, reason: "iban" };
  if (detectEmail(lower, compact)) return { allowed: false, reason: "email" };

  return { allowed: true };
}
