# License Backend (Node + Express + Sequelize + Mercado Pago v2)

## Requisitos
- Node 18+
- Docker (opcional) o Postgres instalado
- Access Token de Mercado Pago (sandbox o producción)

## Levantar Postgres local
### Opción A: Docker Compose
```bash
docker compose up -d
# DB disponible en postgres://postgres:postgres@localhost:5432/licenses
```

### Opción B: Postgres instalado
```bash
psql -U postgres -c "CREATE DATABASE licenses;"
# o con usuario propio; ajustá DATABASE_URL en .env
```

## Configuración
1. Copiá `.env.example` a `.env` y editá valores si hace falta.
2. Instalá dependencias:
```bash
npm i
```
3. Ejecutá en desarrollo:
```bash
npm run dev
```
4. Endpoints:
- POST /register  { email, password }
- POST /login     { email, password }
- GET  /license   (Auth Bearer)
- POST /subscribe { plan: "single"|"multi" } (Auth Bearer) -> devuelve { init_point }
- POST /license/devices/attach { deviceId } (Auth Bearer)
- POST /license/devices/detach { deviceId } (Auth Bearer)
- POST /webhook   (Mercado Pago)

## Notas
- En dev, `sequelize.sync()` crea tablas automáticamente.
- Precios y moneda configurables por env (`PRICE_SINGLE`, `PRICE_MULTI`, `MP_CURRENCY`).
- Webhook: si probás con túnel (ngrok, cloudflared), configurá esa URL en Mercado Pago para recibir notificaciones.
