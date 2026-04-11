# Open Banking Chile — Reporte de Investigación

Fecha: 2026-04-11
Fuente: https://github.com/kaihv/open-banking-chile

## 1. Resumen

`open-banking-chile` **NO es una API oficial de Open Banking** (Chile no tiene regulación de Open Banking aún). Es una **librería open-source de web scraping** que automatiza Chrome/Chromium para entrar a los portales bancarios, navegar el DOM y extraer balances, transacciones y datos de tarjetas de crédito como JSON estructurado.

- **Stack**: TypeScript, Puppeteer-core (mayoría de bancos) + Playwright-core (Falabella)
- **Licencia**: MIT
- **Telemetría**: Ninguna (compatible con política zero phone-home)
- **Repo**: 154 stars, 44 forks. Último commit: 9 abril 2026. Desarrollo activo.

## 2. Bancos Soportados

| Banco | ID | Estado | Notas |
|---|---|---|---|
| Banco Falabella (+ CMR TC) | `falabella` | Funcional | Playwright, más completo |
| Banco BICE | `bice` | Funcional | Soporta meses históricos |
| Banco Santander | `santander` | Funcional | Intercepción de API |
| Banco Edwards | `edwards` | Funcional | Mismo portal que Santander |
| Scotiabank | `scotiabank` | **Roto** | Issue #53, falla después del login |
| Banco de Chile | `bchile` | Funcional | TC internacionales pierden moneda (issue #56) |
| BCI | `bci` | Funcional | 2FA con BCI Pass |
| Itaú | `itau` | Funcional | 2FA con Itaú Key |
| BancoEstado (CuentaRUT) | `bestado` | Funcional | **Requiere Chrome con ventana** (no headless) |
| Banco Security | `bancosecurity` | Funcional | Soporta meses históricos |

## 3. Datos Disponibles

### Cuentas Corrientes/Vista

```typescript
{
  label?: string;        // "Cuenta Corriente ****2706"
  balance?: number;      // Balance actual en CLP (entero)
  movements: BankMovement[];
}
```

### Tarjetas de Crédito

```typescript
{
  label: string;              // "CMR Mastercard ****1234"
  national?: { used, available, total };
  international?: { used, available, total, currency };
  billingPeriod?: string;
  nextBillingDate?: string;   // DD-MM-YYYY
  nextDueDate?: string;
  periodExpenses?: number;
  lastStatement?: { billingDate, billedAmount, dueDate, minimumPayment? };
  movements?: BankMovement[];
}
```

### Transacción (BankMovement)

```typescript
{
  date: string;          // "DD-MM-YYYY"
  description: string;   // "COMPRA SUPERMERCADO LIDER" (mayúsculas típicamente)
  amount: number;        // Positivo = ingreso, negativo = gasto. CLP entero.
  balance: number;       // Balance corriente después de esta transacción
  source: "account" | "credit_card_unbilled" | "credit_card_billed";
  owner?: "titular" | "adicional";
  card?: string;         // "****8335"
  installments?: string; // "01/03" = cuota 1 de 3
  totalAmount?: number;  // Monto total de la compra en cuotas
}
```

**Importante**: NO hay campo de categoría. Toda categorización debe hacerla nuestra app.

## 4. Flujo de Autenticación

No es OAuth. Requiere **credenciales reales del banco** (RUT + clave internet):

1. Usuario provee RUT + contraseña de banca en línea
2. Librería lanza Chrome real via Puppeteer/Playwright
3. Login automatizado en el portal del banco
4. Si hay 2FA (SuperClave, BCI Pass, etc.), pausa y espera aprobación manual (timeout configurable, default 180s, max 600s)
5. Extracción de datos navegando las páginas
6. Logout + cierre del browser

## 5. Mapeo a Nuestro Modelo de Datos

| Nuestro Campo | Fuente | Notas |
|---|---|---|
| `date` | `movement.date` | Convertir DD-MM-YYYY a Date |
| `description` | `movement.description` | Descripción cruda del banco, mayúsculas |
| `amount` | `movement.amount` | Ya viene con signo, entero CLP |
| `category` | N/A | **No viene del banco** — inferir con reglas/keywords |
| `account` | `account.label` / `creditCard.label` | Identifica cuenta/tarjeta |

Campos adicionales útiles: `source`, `balance`, `installments`, `totalAmount`, hash para deduplicación.

## 6. Arquitectura de Integración Recomendada

Como la app corre local en el PC del usuario, Chrome ya está disponible:

```
Frontend → POST /api/sync/[bankId] → scrape() → parse → Prisma upsert → respond
```

- Cada scraping toma 15-60 segundos por banco
- Deduplicación por hash compuesto (fecha + descripción + monto + source)
- Máximo 1 sync por banco por hora
- Para 2FA: mostrar mensaje pidiendo aprobación en el teléfono, polling de estado

## 7. Limitaciones y Riesgos

### Técnicos
- **Fragilidad**: scrapers se rompen cuando bancos actualizan sus sitios
- **Chrome necesario**: ~200-500MB RAM por sesión de scraping
- **Velocidad**: 15-60 segundos por banco
- **2FA**: requiere intervención manual del usuario
- **BancoEstado**: requiere Chrome visible (no headless)
- **Sin categorías**: toda categorización es nuestra responsabilidad
- **Sin moneda**: transacciones internacionales pueden venir sin indicar moneda
- **Historial limitado**: mayoría de bancos solo muestra últimos 1-3 meses

### Seguridad
- Almacenamiento de credenciales bancarias reales → deben cifrarse
- Chrome corre sin sandbox (issue #33)
- No es una API oficial — zona gris legal (bajo riesgo para uso personal)

## 8. Plan de Implementación (Fases)

### Fase 0: Validar
- Probar con bancos reales del usuario
- Verificar 2FA y tiempos

### Fase 1: Schema de BD
- `BankConnection` (bankId, credenciales cifradas, última sincronización)
- `BankAccount` (connectionId, label, tipo, balance)
- `Transaction` (accountId, fecha, descripción, monto, balance, source, hash)

### Fase 2: Sync Manual
- API route `POST /api/sync/[bankId]`
- UI: formulario "Agregar Banco" + botón "Sincronizar"
- Manejo de 2FA en UI

### Fase 3: Categorización
- Reglas por keywords ("SUPERMERCADO" → Alimentación, "UBER" → Transporte)
- Override manual
- Reglas persistentes para transacciones futuras

### Fase 4: Sync Automático (opcional)
- Cron diario para bancos sin 2FA

## 9. Dependencias

- Google Chrome o Chromium instalado
- Node.js >= 18
- `npm install github:kaihv/open-banking-chile`
- puppeteer-core + playwright-core (transitivas)
- Para BancoEstado en Linux: Xvfb

## 10. Conclusión

Es la opción más viable para datos bancarios chilenos sin pagar un agregador fintech (Fintoc cobra por conexión). Para uso personal y local, los trade-offs son razonables. El mayor desafío de UX será el manejo de 2FA y el tiempo de scraping.
