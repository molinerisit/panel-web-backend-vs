// backend/mercadopago.js
import mercadopago from "mercadopago";

/**
 * MP SDK v2.x
 * - Config por access token
 * - Suscripciones con preapproval (auto_recurring)
 */

let _isConfigured = false;
let _accessToken = null;

function ensureHttps(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function initializeMercadoPago(accessToken) {
  if (!accessToken) throw new Error("MP_ACCESS_TOKEN requerido");
  _accessToken = accessToken;
  if (!mercadopago?.configurations?.setAccessToken) {
    throw new Error("SDK de MercadoPago incompatible: falta configurations.setAccessToken");
  }
  mercadopago.configurations.setAccessToken(_accessToken);
  _isConfigured = true;
  console.log("[MP] SDK configurado");
}

function ensureConfigured() {
  if (!_isConfigured) throw new Error("Mercado Pago no fue inicializado");
  const token = mercadopago.configurations.getAccessToken?.();
  if (!token && _accessToken) mercadopago.configurations.setAccessToken(_accessToken);
}

/**
 * Crea una suscripción (preapproval) directa para un usuario.
 * @param {Object} p
 *  - userId (number | string)
 *  - plan: "single" | "multi"
 *  - payerEmail: string (email del pagador)
 *  - backUrl: string (HTTPS público)
 *  - currency: string (ej. "ARS")
 *  - amount: number (precio mensual)
 */
export async function createSubscriptionDirect(p) {
  ensureConfigured();

  const {
    userId,
    plan,
    payerEmail,
    backUrl,
    currency = "ARS",
    amount = 0
  } = p || {};

  if (!userId) throw new Error("userId requerido");
  if (!["single", "multi"].includes(plan)) throw new Error("plan inválido");
  if (!payerEmail) throw new Error("payerEmail requerido");
  if (!amount || amount <= 0) throw new Error("amount inválido");
  if (!currency) throw new Error("currency requerido");

  // back_url DEBE SER HTTPS público para evitar errores en MP
  const httpsBack = ensureHttps(backUrl);
  if (!httpsBack) {
    const e = new Error("back_url is required");
    e.status = 400;
    throw e;
  }

  // notification_url (opcional, pero recomendado) -> tu /webhook público
  const webhookBase = process.env.WEBHOOK_PUBLIC_URL || process.env.PUBLIC_RETURN_URL_BASE;
  const notificationUrl = webhookBase ? ensureHttps(webhookBase + "/webhook") : null;

  const payload = {
    reason: `Licencia ${plan}`,
    external_reference: String(userId), // para recuperar al usuario en /return y /webhook
    back_url: httpsBack,
    payer_email: payerEmail,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: Number(amount),
      currency_id: String(currency).toUpperCase()
    }
  };
  if (notificationUrl) payload.notification_url = notificationUrl;

  console.log("[MP] create preapproval", {
    reason: payload.reason,
    payer_email: payload.payer_email,
    amount: payload.auto_recurring.transaction_amount,
    currency: payload.auto_recurring.currency_id,
    back_url: payload.back_url
  });

  try {
    const resp = await mercadopago.preapproval.create(payload);
    const body = resp?.response || resp; // SDK a veces expone en .response
    const id = body?.id;
    const init_point = body?.init_point;

    if (!id || !init_point) {
      console.error("[MP] Respuesta inesperada al crear preapproval:", body);
      const e = new Error("No se pudo crear la preaprobación");
      e.status = 502;
      throw e;
    }

    console.log("[MP] preapproval created", { id, init_point });
    return { init_point, mpPreapprovalId: id };
  } catch (err) {
    // El SDK suele incluir info útil en err.cause
    console.error("[MP] Error create preapproval:", err?.status || "", err?.message || err);
    if (err?.cause) console.error("[MP] cause:", JSON.stringify(err.cause, null, 2));
    throw err;
  }
}

/** Obtiene una preaprobación por ID */
export async function getPreapprovalById(id) {
  ensureConfigured();
  if (!id) throw new Error("preapproval id requerido");
  try {
    // El SDK v2 no siempre expone findById. Usamos fetch nativo de Node 18/20.
    const resp = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${_accessToken}` }
    });
    const json = await resp.json();
    if (!resp.ok) {
      const e = new Error(json?.message || "Error al obtener preapproval");
      e.status = resp.status;
      throw e;
    }
    return json;
  } catch (err) {
    console.error("[MP] getPreapprovalById error:", err?.status || "", err?.message || err);
    throw err;
  }
}

/** Cambiar estado a cancelled */
export async function cancelPreapproval(id) {
  ensureConfigured();
  if (!id) throw new Error("preapproval id requerido");
  try {
    const resp = await mercadopago.preapproval.update({ id, status: "cancelled" });
    return resp?.response || resp;
  } catch (err) {
    console.error("[MP] cancel error:", err?.status || "", err?.message || err);
    throw err;
  }
}

/** Cambiar estado a paused */
export async function pausePreapproval(id) {
  ensureConfigured();
  if (!id) throw new Error("preapproval id requerido");
  try {
    const resp = await mercadopago.preapproval.update({ id, status: "paused" });
    return resp?.response || resp;
  } catch (err) {
    console.error("[MP] pause error:", err?.status || "", err?.message || err);
    throw err;
  }
}

/** Cambiar estado a authorized (reanudar) */
export async function resumePreapproval(id) {
  ensureConfigured();
  if (!id) throw new Error("preapproval id requerido");
  try {
    const resp = await mercadopago.preapproval.update({ id, status: "authorized" });
    return resp?.response || resp;
  } catch (err) {
    console.error("[MP] resume error:", err?.status || "", err?.message || err);
    throw err;
  }
}
