const BLOCKED_NAMES = ["test", "testing", "demo", "sample", "asdf", "qwer", "sdf", "sdfsdfsd"];

const sanitizeName = (value) => {
  const raw = (value || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const looksRepeated = /(.)\1{3,}/.test(raw);
  const hasVowel = /[aeiou]/i.test(raw);
  const hasLettersOnly = /^[A-Za-z][A-Za-z\s.'-]+$/.test(raw);
  if (BLOCKED_NAMES.includes(lower) || looksRepeated || (!hasVowel && raw.length >= 6) || !hasLettersOnly) {
    return "";
  }
  return raw.split(/\s+/)[0];
};

export const getDisplayName = (primary = "", fallback = "") => {
  const name = sanitizeName(primary) || sanitizeName(fallback);
  return name;
};
