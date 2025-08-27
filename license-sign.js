// backend/license-sign.js
import jwt from "jsonwebtoken";

const PRIV_B64 = process.env.LICENSE_PRIVATE_KEY_B64; // RSA PRIVATE KEY en base64
const PUB_B64  = process.env.LICENSE_PUBLIC_KEY_B64;  // RSA PUBLIC KEY en base64
const DEFAULT_TTL_SEC = Number(process.env.LICENSE_OFFLINE_TTL_SEC || 72 * 3600); // 72h

if (!PRIV_B64 || !PUB_B64) {
  console.warn("[license-sign] Falta LICENSE_PRIVATE_KEY_B64 o LICENSE_PUBLIC_KEY_B64 en .env");
}

function b64ToPem(b64) {
  try { return Buffer.from(b64, "base64").toString("utf8"); }
  catch { return ""; }
}

const PRIVATE_PEM = b64ToPem(PRIV_B64 || "");
const PUBLIC_PEM  = b64ToPem(PUB_B64  || "");

export function getPublicKeyPem() {
  return PUBLIC_PEM;
}

/**
 * Firma un comprobante de licencia (JWS) para validación offline.
 * @param {Object} p - payload
 *  p = { userId, licenseId, token, plan, status, deviceId, maxDevices, features }
 * @param {number} ttlSec - segundos de validez offline (default 72h)
 */
export function signLicenseJWS(p, ttlSec = DEFAULT_TTL_SEC) {
  if (!PRIVATE_PEM) throw new Error("No hay PRIVATE PEM para firmar licencia");
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: `license:${p.licenseId}`,
    uid: p.userId,
    plan: p.plan,
    sta: p.status,
    dev: p.deviceId,
    max: p.maxDevices,
    fea: p.features || { sync: true, whatsapp_bot: false, ai_cameras: false },
    tok: p.token,
    lic: p.licenseId,
    ver: 1,
    iat: now,
    exp: now + ttlSec,
  };
  return jwt.sign(payload, PRIVATE_PEM, { algorithm: "RS256" });
}

/** (Opcional) Verificación del lado servidor (para pruebas) */
export function verifyLicenseJWS(jws) {
  if (!PUBLIC_PEM) throw new Error("No hay PUBLIC PEM para verificar");
  return jwt.verify(jws, PUBLIC_PEM, { algorithms: ["RS256"] });
}
