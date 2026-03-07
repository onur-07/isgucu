import crypto from "crypto";

export type PaytrConfig = {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
  okUrl: string;
  failUrl: string;
  testMode: "0" | "1";
  debugOn: "0" | "1";
  timeoutLimit: string;
};

export function getPaytrConfig(): PaytrConfig | null {
  const merchantId = String(process.env.PAYTR_MERCHANT_ID || "").trim();
  const merchantKey = String(process.env.PAYTR_MERCHANT_KEY || "").trim();
  const merchantSalt = String(process.env.PAYTR_MERCHANT_SALT || "").trim();
  const okUrl = String(process.env.PAYTR_OK_URL || "").trim();
  const failUrl = String(process.env.PAYTR_FAIL_URL || "").trim();
  const testMode = String(process.env.PAYTR_TEST_MODE || "1").trim() === "1" ? "1" : "0";
  const debugOn = String(process.env.PAYTR_DEBUG_ON || "1").trim() === "1" ? "1" : "0";
  const timeoutLimit = String(process.env.PAYTR_TIMEOUT_LIMIT || "30").trim();

  if (!merchantId || !merchantKey || !merchantSalt || !okUrl || !failUrl) return null;
  return { merchantId, merchantKey, merchantSalt, okUrl, failUrl, testMode, debugOn, timeoutLimit };
}

function hmacBase64(input: string, key: string) {
  return crypto.createHmac("sha256", key).update(input).digest("base64");
}

export function buildPaytrToken(args: {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmountMinor: number;
  userBasketBase64: string;
  noInstallment: "0" | "1";
  maxInstallment: string;
  currency: "TL";
  testMode: "0" | "1";
  merchantSalt: string;
  merchantKey: string;
}) {
  const hashStr =
    args.merchantId +
    args.userIp +
    args.merchantOid +
    args.email +
    String(args.paymentAmountMinor) +
    args.userBasketBase64 +
    args.noInstallment +
    args.maxInstallment +
    args.currency +
    args.testMode;

  return hmacBase64(hashStr + args.merchantSalt, args.merchantKey);
}

export function verifyPaytrCallbackHash(args: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  receivedHash: string;
  merchantSalt: string;
  merchantKey: string;
}) {
  const expected = hmacBase64(
    String(args.merchantOid || "") + String(args.merchantSalt || "") + String(args.status || "") + String(args.totalAmount || ""),
    String(args.merchantKey || "")
  );
  return expected === String(args.receivedHash || "");
}

export function paytrIframeUrl(token: string) {
  return `https://www.paytr.com/odeme/guvenli/${encodeURIComponent(String(token || ""))}`;
}
