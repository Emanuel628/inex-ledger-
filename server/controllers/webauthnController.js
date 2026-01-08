import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";

const RP_NAME = process.env.RP_NAME || "Luna Intelligence";
const RP_ID = process.env.RP_ID || "localhost";
const ORIGIN_URL = process.env.ORIGIN_URL || "http://localhost:3000";

const userWebauthnStore = new Map();

const ensureUserState = (userId) => {
  if (!userWebauthnStore.has(userId)) {
    userWebauthnStore.set(userId, {
      authenticators: [],
      currentRegistrationChallenge: null,
      currentAuthenticationChallenge: null,
    });
  }
  return userWebauthnStore.get(userId);
};

const getCredentialIdBuffer = (credentialId) => {
  if (!credentialId) return null;
  try {
    return Buffer.from(credentialId, "base64url");
  } catch {
    return Buffer.from(credentialId, "base64");
  }
};

export const getRegistrationOptions = (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }

  const userEmail = req.user?.email || `user-${userId}`;
  const state = ensureUserState(userId);
  const options = generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: userId,
    userName: userEmail,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    timeout: 60000,
    excludeCredentials: state.authenticators.map((auth) => ({
      id: auth.credentialID,
      type: "public-key",
      transports: auth.transports,
    })),
  });

  state.currentRegistrationChallenge = options.challenge;
  return res.json(options);
};

export const verifyRegistration = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }

  const state = ensureUserState(userId);
  const expectedChallenge = state.currentRegistrationChallenge;
  const { body } = req;

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: ORIGIN_URL,
    expectedRPID: RP_ID,
  });

  if (verification.verified && verification.registrationInfo) {
    const { registrationInfo } = verification;
    const hasExisting = state.authenticators.some((auth) =>
      auth.credentialID.equals(registrationInfo.credentialID)
    );
    if (!hasExisting) {
      state.authenticators.push({
        credentialID: registrationInfo.credentialID,
        credentialPublicKey: registrationInfo.credentialPublicKey,
        counter: registrationInfo.counter,
        transports: registrationInfo.transports,
      });
    }
  }

  state.currentRegistrationChallenge = null;
  return res.json({ verified: verification.verified });
};

export const getAuthenticationOptions = (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }

  const state = ensureUserState(userId);
  if (state.authenticators.length === 0) {
    return res.status(400).json({ error: "No registered authenticators" });
  }

  const options = generateAuthenticationOptions({
    timeout: 60000,
    allowCredentials: state.authenticators.map((auth) => ({
      id: auth.credentialID,
      type: "public-key",
      transports: auth.transports,
    })),
    userVerification: "required",
    rpID: RP_ID,
  });

  state.currentAuthenticationChallenge = options.challenge;
  return res.json(options);
};

export const verifyAuthentication = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }

  const state = ensureUserState(userId);
  const { body } = req;
  const credentialIdBuffer = getCredentialIdBuffer(body.id);
  const authenticator = state.authenticators.find((auth) =>
    credentialIdBuffer ? auth.credentialID.equals(credentialIdBuffer) : false
  );

  if (!authenticator) {
    return res.status(404).json({ error: "Authenticator not found" });
  }

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: state.currentAuthenticationChallenge,
    expectedOrigin: ORIGIN_URL,
    expectedRPID: RP_ID,
    authenticator,
  });

  if (verification.verified && verification.authenticationInfo) {
    authenticator.counter = verification.authenticationInfo.newCounter;
  }

  state.currentAuthenticationChallenge = null;
  return res.json({ verified: verification.verified });
};
