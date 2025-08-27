// backend/auth.js
import jwt from "jsonwebtoken";

// Carga .env si este archivo se ejecuta por separado (tests/scripts)
if (!process.env.JWT_SECRET) {
  await import("dotenv/config");
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Extrae el bearer token del header Authorization.
 */
function getTokenFromHeader(req) {
  const auth = req.headers?.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim();
}

/**
 * Middleware de autenticación.
 * - Verifica el JWT (HS256) emitido por el backend.
 * - Adjunta req.user con { id, email, role }.
 * - Si pasás requiredRole, valida que el usuario tenga ese rol.
 *
 * Uso:
 *   const auth = authMiddleware();
 *   app.get("/ruta", auth, handler);
 *
 *   const authAdmin = authMiddleware("admin");
 *   app.post("/solo-admin", authAdmin, handler);
 */
export function authMiddleware(requiredRole = null) {
  if (!JWT_SECRET) {
    console.error("[auth] Falta JWT_SECRET en variables de entorno");
    throw new Error("JWT_SECRET requerido");
  }

  return (req, res, next) => {
    try {
      const token = getTokenFromHeader(req);
      if (!token) {
        return res.status(401).json({ error: "No autorizado: token faltante" });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      // decoded: { id, email, role, iat, exp }
      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: "Prohibido: rol insuficiente" });
      }

      req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
      next();
    } catch (err) {
      // Posibles errores: TokenExpiredError, JsonWebTokenError, NotBeforeError
      const code = err?.name === "TokenExpiredError" ? 401 : 401;
      return res.status(code).json({ error: "Token inválido o expirado" });
    }
  };
}

/**
 * (Opcional) Si alguna vez querés emitir tokens desde otro módulo.
 * En `server.js` ya usás su propia función, esto queda disponible por si lo necesitás en otra parte.
 */
export function issueToken(payload, expiresIn = "7d") {
  if (!JWT_SECRET) throw new Error("JWT_SECRET requerido");
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
