import { describe, it, expect, vi } from "vitest";
import { requireVerifiedEmail } from "../middleware/requireVerifiedEmail.js";

describe("requireVerifiedEmail", () => {
  const makeResponse = () => {
    const res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res),
    };
    return res;
  };

  it("blocks requests without verified email", () => {
    const req = { user: { emailVerified: false } };
    const res = makeResponse();
    const next = vi.fn();
    requireVerifiedEmail(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email to unlock vault access.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows verified accounts", () => {
    const req = { user: { emailVerified: true } };
    const res = makeResponse();
    const next = vi.fn();
    requireVerifiedEmail(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
