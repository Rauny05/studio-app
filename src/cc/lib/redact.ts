/** Strip obvious secrets / personal identifiers before text is sent to a third-party model. */
const RULES: [RegExp, string][] = [
  [/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b(?=\D|$)/g, "[ID]"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[CARD]"],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN]"],
  [/\b\d{4}\s\d{4}\s\d{4}\b/g, "[AADHAAR]"],
  [/\b[A-Z]{4}0[A-Z0-9]{6}\b/g, "[IFSC]"],
  [/\b(?:sk|pk|AIza|ghp|xox[abp])[-_A-Za-z0-9]{16,}\b/g, "[KEY]"],
  [/\b(?:password|passcode|otp|pin|secret|token)\s*[:=]\s*\S+/gi, "[SECRET]"],
  [/(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)\d{3}[\s-]?\d{3,4}\b/g, "[PHONE]"],
];

export function redact(text: string, opts: { emails?: boolean } = {}): string {
  let out = text;
  for (const [re, label] of RULES) out = out.replace(re, label);
  if (opts.emails) out = out.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]");
  return out;
}
