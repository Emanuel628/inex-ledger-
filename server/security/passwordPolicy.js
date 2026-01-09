import fs from "fs";
import crypto from "crypto";
import fetch from "node-fetch";
import { fileURLToPath } from "url";
import {
  PASSWORD_MIN_LEN,
  PASSWORD_COMPLEXITY_RULE,
  HIBP_RANGE_URL,
} from "../config/securityConstants.js";

const COMMON_PASSWORDS_PATH = fileURLToPath(
  new URL("../data/common-passwords.txt", import.meta.url)
);

const COMMON_PASSWORDS = new Set(
  fs
    .readFileSync(COMMON_PASSWORDS_PATH, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
);

const reasonMessage = {
  PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_MIN_LEN} characters.`,
  PASSWORD_TOO_SIMPLE: `Password must meet complexity rule: ${PASSWORD_COMPLEXITY_RULE}.`,
  PASSWORD_IN_COMMON_LIST: "Password is too common.",
  PASSWORD_BREACHED: "Password was found in a breach.",
  HIBP_UNAVAILABLE: "Unable to validate password safety right now.",
};

const shouldFailClosed = process.env.HIBP_FAIL_CLOSED
  ? String(process.env.HIBP_FAIL_CLOSED).toLowerCase() === "true"
  : process.env.NODE_ENV === "production";

const sha1 = (value) => crypto.createHash("sha1").update(value).digest("hex").toUpperCase();

const countCharacterClasses = (value) => {
  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);
  return [hasUpper, hasLower, hasDigit, hasSymbol].filter(Boolean).length;
};

const parseHibpResponse = (text, suffix) => {
  const lines = text.split("\n");
  for (const line of lines) {
    const [hashSuffix, count] = line.trim().split(":");
    if (!hashSuffix || !count) continue;
    if (hashSuffix.toUpperCase() === suffix) {
      return Number(count.replace(/\D/g, "")) || 0;
    }
  }
  return 0;
};

const queryHibp = async (password) => {
  const digest = sha1(password);
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const url = `${HIBP_RANGE_URL}${prefix}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LunaSecurity/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`HIBP returned ${response.status}`);
  }
  const body = await response.text();
  const count = parseHibpResponse(body, suffix);
  return count;
};

export const validatePassword = async (password) => {
  const reasons = [];
  const trimmed = typeof password === "string" ? password.trim() : "";
  if (trimmed.length < PASSWORD_MIN_LEN) {
    reasons.push({ code: "PASSWORD_TOO_SHORT", message: reasonMessage.PASSWORD_TOO_SHORT });
  }
  if (countCharacterClasses(trimmed) < 3) {
    reasons.push({ code: "PASSWORD_TOO_SIMPLE", message: reasonMessage.PASSWORD_TOO_SIMPLE });
  }
  if (COMMON_PASSWORDS.has(trimmed.toLowerCase())) {
    reasons.push({ code: "PASSWORD_IN_COMMON_LIST", message: reasonMessage.PASSWORD_IN_COMMON_LIST });
  }

  let hibp = { status: "skipped" };
  if (trimmed) {
    try {
      const matched = await queryHibp(trimmed);
      if (matched > 0) {
        reasons.push({
          code: "PASSWORD_BREACHED",
          message: `${reasonMessage.PASSWORD_BREACHED} (${matched} hits)`,
        });
        hibp = { status: "breached", count: matched };
      } else {
        hibp = { status: "ok" };
      }
    } catch (error) {
      const failClosed = shouldFailClosed;
      console.warn("HIBP password check unavailable:", String(error));
      hibp = {
        status: "unreachable",
        error: String(error),
        failClosed,
        flag: "hibp_unavailable",
      };
      if (failClosed) {
        reasons.push({ code: "HIBP_UNAVAILABLE", message: reasonMessage.HIBP_UNAVAILABLE });
      }
    }
  }

  const ok = reasons.length === 0;
  return {
    ok,
    reasons,
    hibp,
  };
};

export const formatPasswordErrors = (validatorResult) =>
  validatorResult.reasons.map((reason) => ({
    code: reason.code,
    message: reason.message,
  }));
