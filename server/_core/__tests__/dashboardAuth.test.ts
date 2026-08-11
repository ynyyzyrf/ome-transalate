/**
 * Dashboard auth token isolation tests.
 * Guards the privilege-escalation fix: a learner access token (signed with the same
 * shared JWT secret) must NEVER pass as a dashboard session.
 */
import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { ENV } from "../env";
import { signDashboardToken, verifyDashboardToken } from "../dashboardAuth";

function sharedSecret(): Uint8Array {
  return new TextEncoder().encode(ENV.JWT_SECRET);
}

/** Mimics the attacker: sign a token with the learner access-token shape using the shared secret. */
function signLikeAccessToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("multilingual-training-platform")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(sharedSecret());
}

describe("dashboard auth token isolation", () => {
  it("verifies tokens signed by signDashboardToken", async () => {
    const token = await signDashboardToken({ adminId: 1, username: "admin", displayName: "Admin" });
    const session = await verifyDashboardToken(token);
    expect(session?.adminId).toBe(1);
    expect(session?.username).toBe("admin");
    expect(session?.displayName).toBe("Admin");
  });

  it("rejects a learner access token (same shared secret, type=access)", async () => {
    const accessToken = await signLikeAccessToken({
      userId: 7,
      email: "attacker@example.com",
      role: "learner",
    });
    const session = await verifyDashboardToken(accessToken);
    expect(session).toBeNull();
  });

  it("rejects legacy dashboard tokens that lack a type claim", async () => {
    const legacy = await new SignJWT({ adminId: 1, username: "admin", displayName: "Admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(sharedSecret());
    expect(await verifyDashboardToken(legacy)).toBeNull();
  });

  it("rejects tokens claiming type=dashboard without a numeric adminId", async () => {
    const forged = await new SignJWT({ type: "dashboard", username: "admin", displayName: "Admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(sharedSecret());
    expect(await verifyDashboardToken(forged)).toBeNull();
  });
});
