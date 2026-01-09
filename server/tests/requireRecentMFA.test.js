import { describe, it, expect, vi } from "vitest";
import { requireRecentMFA } from "../middleware/requireRecentMFA.js";

const makeResponse = () => {
  const res = {
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res;
};

describe("requireRecentMFA middleware", () => {
  let consoleInfoSpy;
  const middleware = requireRecentMFA({ windowMinutes: 5 });

  beforeEach(() => {
    consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it("returns 401 when MFA enabled but no recent verification", () => {
    const req = { user: { id: "user-1", mfaEnabled: true, mfa_verified_at: null }, originalUrl: "/sensitive" };
    const res = makeResponse();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      code: "MFA_REQUIRED",
      message: "Recent MFA required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows request when MFA was verified recently", () => {
    const req = {
      user: {
        id: "user-2",
        mfaEnabled: true,
        mfa_verified_at: new Date().toISOString(),
      },
    };
    const res = makeResponse();
    const next = vi.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects request when verification is stale", () => {
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const req = {
      user: {
        id: "user-3",
        mfaEnabled: true,
        mfa_verified_at: staleTime,
      },
      originalUrl: "/sensitive",
    };
    const res = makeResponse();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      code: "MFA_REQUIRED",
      message: "Recent MFA required.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when MFA is disabled", () => {
    const req = {
      user: {
        id: "user-4",
        mfaEnabled: false,
        mfa_verified_at: null,
      },
      originalUrl: "/sensitive",
    };
    const res = makeResponse();
    const next = vi.fn();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: "MFA_NOT_ENABLED",
      message: "Enable MFA to perform this action.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
