// backend/models.js
import { Sequelize, DataTypes } from "sequelize";

// Cargar .env si hace falta (scripts/migraciones)
if (!process.env.DATABASE_URL) {
  await import("dotenv/config");
}

// SSL opcional (Railway suele requerirlo; local = false)
const PGSSL = (process.env.PGSSL || "false").toLowerCase() === "true";

/**
 * Guardamos todo en UTC para evitar problemas de zona horaria.
 * Si quisieras forzar otra cosa, cambiá timezone/useUTC.
 */
export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  timezone: "+00:00",
  dialectOptions: {
    useUTC: true,
    ...(PGSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {})
  }
});

// -------- User --------
export const User = sequelize.define("User", {
  email: {
    type: DataTypes.STRING(190),
    unique: true,
    allowNull: false,
    validate: { isEmail: true }
  },
  passwordHash: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM("admin", "client"),
    defaultValue: "client",
    allowNull: false
  }
}, {
  timestamps: true,
  indexes: [
    { unique: true, fields: ["email"] }
  ],
  hooks: {
    beforeValidate(user) {
      if (user.email) user.email = String(user.email).trim().toLowerCase();
    }
  }
});

// -------- License --------
export const License = sequelize.define("License", {
  token: {
    type: DataTypes.STRING(120),
    unique: true,
    allowNull: true // se genera al activar
  },
  plan: {
    type: DataTypes.ENUM("single", "multi"),
    defaultValue: "single",
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM("inactive","active","paused","cancelled"),
    defaultValue: "inactive",
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,  // guardamos UTC
    allowNull: false
  },
  devices: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  mpPreapprovalId: {
    type: DataTypes.STRING(120),
    unique: true,
    allowNull: true
  },
  // flags/params de features del plan/cliente
  features: {
    type: DataTypes.JSONB,
    defaultValue: {} // ej: { whatsapp_bot: false, ai_cameras: false }
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ["userId"] },
    { fields: ["status"] },
    { fields: ["expiresAt"] },
    { unique: true, fields: ["token"] },
    { unique: true, fields: ["mpPreapprovalId"] },
    { fields: ["userId", "status"] } // consultas rápidas por usuario+estado
  ]
});

// Relaciones
User.hasMany(License, { foreignKey: "userId", as: "licenses", onDelete: "CASCADE" });
License.belongsTo(User, { foreignKey: "userId", as: "user" });
