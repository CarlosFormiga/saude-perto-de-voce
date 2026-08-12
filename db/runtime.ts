import { env } from "cloudflare:workers";

type D1Result<T = Record<string, unknown>> = { results?: T[]; success?: boolean };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS citizens (id TEXT PRIMARY KEY, cpf_hash TEXT NOT NULL UNIQUE, cpf_masked TEXT NOT NULL, full_name TEXT NOT NULL, birth_date TEXT NOT NULL, validation_status TEXT NOT NULL, first_pickup_required INTEGER NOT NULL DEFAULT 1, address TEXT, district TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS credentials (citizen_id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, activated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS citizen_documents (id TEXT PRIMARY KEY, citizen_id TEXT NOT NULL, file_name TEXT NOT NULL, storage_key TEXT NOT NULL, content_type TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS activation_codes (id TEXT PRIMARY KEY, citizen_id TEXT NOT NULL, code_hash TEXT NOT NULL, status TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_activation_active ON activation_codes(citizen_id) WHERE status = 'active'`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, role TEXT NOT NULL, principal_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash, expires_at)`,
  `CREATE TABLE IF NOT EXISTS admin_users (id TEXT PRIMARY KEY, name TEXT NOT NULL, login TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, active_ingredient TEXT NOT NULL, presentation TEXT NOT NULL, unit TEXT NOT NULL, minimum_stock REAL NOT NULL DEFAULT 0, requires_prescription INTEGER NOT NULL DEFAULT 0, delivery_allowed INTEGER NOT NULL DEFAULT 1, public_visible INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lots (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, lot_number TEXT NOT NULL, expires_on TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, reserved REAL NOT NULL DEFAULT 0, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_lots_product_fefo ON lots(product_id, status, expires_on)`,
  `CREATE TABLE IF NOT EXISTS stock_movements (id TEXT PRIMARY KEY, lot_id TEXT NOT NULL, movement_type TEXT NOT NULL, physical_delta REAL NOT NULL DEFAULT 0, reserved_delta REAL NOT NULL DEFAULT 0, actor TEXT NOT NULL, reference_id TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS schedule_slots (id TEXT PRIMARY KEY, method TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, capacity INTEGER NOT NULL, reserved_count INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE INDEX IF NOT EXISTS idx_slots_available ON schedule_slots(method, starts_at, active)`,
  `CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, protocol TEXT NOT NULL UNIQUE, citizen_id TEXT NOT NULL, product_id TEXT NOT NULL, quantity REAL NOT NULL, method TEXT NOT NULL, status TEXT NOT NULL, slot_id TEXT, prescription_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_requests_citizen ON requests(citizen_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_requests_queue ON requests(status, created_at)`,
  `CREATE TABLE IF NOT EXISTS stock_needs (id TEXT PRIMARY KEY, citizen_id TEXT NOT NULL, product_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_need_active ON stock_needs(citizen_id, product_id) WHERE status = 'active'`,
  `CREATE TABLE IF NOT EXISTS specialties (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS health_locations (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, address TEXT NOT NULL, district TEXT NOT NULL, reference TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS specialty_schedules (id TEXT PRIMARY KEY, specialty_id TEXT NOT NULL, location TEXT NOT NULL, starts_at TEXT NOT NULL, status TEXT NOT NULL, capacity INTEGER NOT NULL, location_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS specialty_interests (id TEXT PRIMARY KEY, citizen_id TEXT NOT NULL, specialty_id TEXT NOT NULL, preferred_location TEXT NOT NULL, preferred_period TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, schedule_id TEXT)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_interest_active ON specialty_interests(citizen_id, specialty_id) WHERE status IN ('active','notified','confirmed')`,
  `CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, citizen_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_citizen ON notifications(citizen_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, citizen_id TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_citizen ON messages(citizen_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, details TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

const encoder = new TextEncoder();

export function getD1() {
  const bindings = env as unknown as { DB?: D1Database };
  if (!bindings.DB) throw new Error("Banco local indisponível");
  return bindings.DB;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

export async function cpfHash(value: string) {
  return sha256(`portal-saude-cpf:${normalizeCpf(value)}`);
}

export async function passwordHash(value: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  const hex = (data: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(data instanceof Uint8Array ? data.buffer : data), (b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$210000$${hex(salt)}$${hex(bits)}`;
}

export async function verifyPassword(value: string, stored: string) {
  const [kind, iterationsRaw, saltHex, expected] = stored.split("$");
  if (kind !== "pbkdf2" || !iterationsRaw || !saltHex || !expected) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((h) => Number.parseInt(h, 16)) ?? []);
  const key = await crypto.subtle.importKey("raw", encoder.encode(value), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: Number(iterationsRaw) }, key, 256);
  const actual = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, "0")).join("");
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

async function queryFirst<T>(sql: string, ...bindings: unknown[]): Promise<T | null> {
  return (await getD1().prepare(sql).bind(...bindings).first<T>()) ?? null;
}

async function seed() {
  const db = getD1();
  const seeded = await queryFirst<{ value: string }>("SELECT value FROM app_settings WHERE key = 'seeded'");
  if (seeded) return;
  const now = new Date().toISOString();
  const citizenId = "citizen-maria";
  const adminId = "admin-gabriela";
  const citizenCpfHash = await cpfHash("12345678909");
  const activationHash = await sha256("ALTA-2026");
  const adminPassword = await passwordHash("Admin@2026");
  const products = [
    ["prod-losartana", "MED-001", "Losartana potássica 50 mg", "Losartana potássica", "Comprimido", "comprimido", 60, 1, 1],
    ["prod-metformina", "MED-002", "Metformina 850 mg", "Cloridrato de metformina", "Comprimido", "comprimido", 80, 1, 1],
    ["prod-dipirona", "MED-003", "Dipirona 500 mg", "Dipirona sódica", "Comprimido", "comprimido", 40, 0, 1],
    ["prod-omeprazol", "MED-004", "Omeprazol 20 mg", "Omeprazol", "Cápsula", "cápsula", 50, 1, 1],
    ["prod-sinvastatina", "MED-005", "Sinvastatina 20 mg", "Sinvastatina", "Comprimido", "comprimido", 40, 1, 1],
    ["prod-insulina", "MED-006", "Insulina humana NPH 100 UI/mL", "Insulina humana", "Frasco 10 mL", "frasco", 12, 1, 0],
  ];
  const lots = [
    ["lot-001", "prod-losartana", "LT260701", "2027-07-31", 240, 24],
    ["lot-002", "prod-metformina", "MT260502", "2027-05-31", 18, 0],
    ["lot-003", "prod-dipirona", "DP260801", "2028-01-31", 0, 0],
    ["lot-004", "prod-omeprazol", "OM260611", "2027-06-30", 96, 0],
    ["lot-005", "prod-sinvastatina", "SV260422", "2026-10-20", 14, 0],
    ["lot-006", "prod-insulina", "IN260301", "2026-09-15", 22, 0],
  ];
  const specialties = [
    ["esp-cardio", "Cardiologia", "Cuida do coração e da circulação."],
    ["esp-orto", "Ortopedia", "Cuida de ossos, articulações e dores de movimento."],
    ["esp-oftalmo", "Oftalmologia", "Cuida da visão e da saúde dos olhos."],
    ["esp-dermato", "Dermatologia", "Cuida da pele, cabelos e unhas."],
  ];
  const slots: unknown[][] = [];
  for (let day = 1; day <= 5; day += 1) {
    const date = new Date(Date.now() + day * 86400000);
    for (const hour of [8, 9, 10, 14, 15, 16]) {
      for (const minute of [0, 15, 30, 45]) {
        const start = new Date(date); start.setHours(hour, minute, 0, 0);
        const end = new Date(start.getTime() + 15 * 60000);
        slots.push([`pickup-${day}-${hour}-${minute}`, "pickup", start.toISOString(), end.toISOString(), 3, day === 1 && hour === 9 && minute === 0 ? 2 : 0]);
      }
    }
    for (const hour of [14, 15, 16]) {
      const start = new Date(date); start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + 60 * 60000);
      slots.push([`delivery-${day}-${hour}`, "delivery", start.toISOString(), end.toISOString(), 8, day === 1 && hour === 15 ? 6 : 0]);
    }
  }
  await db.batch([
    db.prepare("INSERT INTO citizens VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(citizenId, citizenCpfHash, "123.***.***-09", "Maria Aparecida da Silva", "1948-04-12", "pre_registered", 1, "Rua das Palmeiras, 126", "Centro", now, now),
    db.prepare("INSERT INTO activation_codes VALUES (?, ?, ?, 'active', ?, ?)").bind("activation-maria", citizenId, activationHash, "2026-12-31T23:59:59.000Z", now),
    db.prepare("INSERT INTO admin_users VALUES (?, ?, ?, ?, ?, 1, ?, ?)").bind(adminId, "Gabriela Cruz", "admin@altair.sp.gov.br", adminPassword, "superadmin", now, now),
    ...products.map((p) => db.prepare("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(...p, now, now)),
    ...lots.map((l) => db.prepare("INSERT INTO lots VALUES (?, ?, ?, ?, ?, ?, 'released', ?, ?)").bind(...l, now, now)),
    ...specialties.map((s) => db.prepare("INSERT INTO specialties VALUES (?, ?, ?, 1)").bind(...s)),
    db.prepare("INSERT INTO specialty_schedules (id, specialty_id, location, starts_at, status, capacity, location_id) VALUES ('schedule-orto', 'esp-orto', 'Altair — Unidade Central', ?, 'confirmed', 24, 'location-central')").bind(new Date(Date.now() + 8 * 86400000).toISOString()),
    db.prepare("INSERT INTO specialty_schedules (id, specialty_id, location, starts_at, status, capacity, location_id) VALUES ('schedule-cardio', 'esp-cardio', 'Suinana — Unidade de Saúde', ?, 'planned', 18, 'location-suinana')").bind(new Date(Date.now() + 15 * 86400000).toISOString()),
    ...slots.map((s) => db.prepare("INSERT INTO schedule_slots VALUES (?, ?, ?, ?, ?, ?, 1)").bind(...s)),
    db.prepare("INSERT INTO app_settings VALUES ('seeded', ?)").bind(now),
    db.prepare("INSERT INTO app_settings VALUES ('pickup_capacity', '3')"),
    db.prepare("INSERT INTO app_settings VALUES ('delivery_capacity', '8')"),
    db.prepare("INSERT INTO app_settings VALUES ('delivery_min_hours', '24')"),
  ]);
}

async function ensureHealthWorkflow() {
  const db = getD1();
  const scheduleColumns = await db.prepare("PRAGMA table_info(specialty_schedules)").all<{ name: string }>();
  if (!(scheduleColumns.results ?? []).some((column) => column.name === "location_id")) await db.prepare("ALTER TABLE specialty_schedules ADD COLUMN location_id TEXT").run();
  const interestColumns = await db.prepare("PRAGMA table_info(specialty_interests)").all<{ name: string }>();
  if (!(interestColumns.results ?? []).some((column) => column.name === "schedule_id")) await db.prepare("ALTER TABLE specialty_interests ADD COLUMN schedule_id TEXT").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_interests_schedule ON specialty_interests(schedule_id, status)").run();
  const timestamp = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO health_locations VALUES ('location-central', 'Unidade Central de Saúde', 'Rua Principal, 100', 'Centro', 'Ao lado da Prefeitura', 1, ?, ?)").bind(timestamp, timestamp),
    db.prepare("INSERT OR IGNORE INTO health_locations VALUES ('location-suinana', 'Unidade de Saúde de Suinana', 'Praça do Distrito, 20', 'Suinana', 'Próximo à escola municipal', 1, ?, ?)").bind(timestamp, timestamp),
    db.prepare("UPDATE specialty_schedules SET location_id='location-central' WHERE location_id IS NULL AND location LIKE 'Altair%Unidade Central%'") ,
    db.prepare("UPDATE specialty_schedules SET location_id='location-suinana' WHERE location_id IS NULL AND location LIKE 'Suinana%'") ,
    db.prepare(`UPDATE specialty_interests SET schedule_id=(SELECT a.id FROM specialty_schedules a WHERE a.specialty_id=specialty_interests.specialty_id AND a.starts_at>? AND a.status!='cancelled' ORDER BY a.starts_at LIMIT 1) WHERE schedule_id IS NULL AND status IN ('notified','confirmed')`).bind(timestamp),
  ]);
}

async function ensureDemoDataset() {
  const db = getD1();
  const version = await queryFirst<{ value: string }>("SELECT value FROM app_settings WHERE key = 'demo_dataset_v2'");
  if (version) return;

  const now = new Date().toISOString();
  const products = [
    ["prod-amlodipino", "MED-007", "Amlodipino 5 mg", "Besilato de anlodipino", "Comprimido", "comprimido", 50, 1, 1, 180, 18, "AM260731", "2027-07-31"],
    ["prod-captopril", "MED-008", "Captopril 25 mg", "Captopril", "Comprimido", "comprimido", 70, 1, 1, 62, 10, "CP260630", "2027-06-30"],
    ["prod-hidroclorotiazida", "MED-009", "Hidroclorotiazida 25 mg", "Hidroclorotiazida", "Comprimido", "comprimido", 60, 1, 1, 210, 30, "HC260928", "2027-09-30"],
    ["prod-atenolol", "MED-010", "Atenolol 50 mg", "Atenolol", "Comprimido", "comprimido", 45, 1, 1, 35, 5, "AT260524", "2027-05-31"],
    ["prod-aas", "MED-011", "Ácido acetilsalicílico 100 mg", "Ácido acetilsalicílico", "Comprimido", "comprimido", 80, 1, 1, 320, 42, "AS260815", "2028-02-29"],
    ["prod-paracetamol", "MED-012", "Paracetamol 500 mg", "Paracetamol", "Comprimido", "comprimido", 80, 0, 1, 148, 20, "PA260802", "2028-01-31"],
    ["prod-ibuprofeno", "MED-013", "Ibuprofeno 600 mg", "Ibuprofeno", "Comprimido", "comprimido", 50, 1, 1, 27, 6, "IB260417", "2027-04-30"],
    ["prod-amoxicilina", "MED-014", "Amoxicilina 500 mg", "Amoxicilina", "Cápsula", "cápsula", 40, 1, 1, 92, 14, "AX260923", "2027-09-30"],
    ["prod-azitromicina", "MED-015", "Azitromicina 500 mg", "Azitromicina", "Comprimido", "comprimido", 30, 1, 1, 0, 0, "AZ260411", "2027-04-30"],
    ["prod-cefalexina", "MED-016", "Cefalexina 500 mg", "Cefalexina", "Cápsula", "cápsula", 35, 1, 1, 74, 8, "CF260710", "2027-07-31"],
    ["prod-salbutamol", "MED-017", "Salbutamol 100 mcg/dose", "Sulfato de salbutamol", "Aerossol 200 doses", "frasco", 15, 1, 1, 19, 3, "SB260619", "2027-12-31"],
    ["prod-beclometasona", "MED-018", "Beclometasona 250 mcg/dose", "Dipropionato de beclometasona", "Aerossol 200 doses", "frasco", 12, 1, 1, 8, 1, "BC260305", "2027-03-31"],
    ["prod-levotiroxina", "MED-019", "Levotiroxina sódica 50 mcg", "Levotiroxina sódica", "Comprimido", "comprimido", 55, 1, 1, 136, 18, "LV260825", "2027-08-31"],
    ["prod-fluoxetina", "MED-020", "Fluoxetina 20 mg", "Cloridrato de fluoxetina", "Cápsula", "cápsula", 45, 1, 0, 53, 7, "FL260529", "2027-05-31"],
    ["prod-carbamazepina", "MED-021", "Carbamazepina 200 mg", "Carbamazepina", "Comprimido", "comprimido", 40, 1, 0, 21, 4, "CB260328", "2027-03-31"],
    ["prod-prednisona", "MED-022", "Prednisona 20 mg", "Prednisona", "Comprimido", "comprimido", 25, 1, 1, 44, 4, "PR260912", "2027-09-30"],
    ["prod-loratadina", "MED-023", "Loratadina 10 mg", "Loratadina", "Comprimido", "comprimido", 35, 0, 1, 116, 9, "LO260804", "2028-02-29"],
    ["prod-soro", "MED-024", "Soro fisiológico 0,9%", "Cloreto de sódio", "Frasco 500 mL", "frasco", 30, 0, 1, 58, 5, "SF260722", "2027-07-31"],
  ] as const;

  const citizens = [
    ["citizen-joao", "98765432100", "987.***.***-00", "João Batista Pereira", "1956-11-03", "validated", 0, "Rua do Comércio, 45", "Centro"],
    ["citizen-ana", "11122233344", "111.***.***-44", "Ana Lúcia Souza", "1972-06-18", "pre_registered", 1, "Rua São José, 210", "Centro"],
    ["citizen-antonio", "22233344455", "222.***.***-55", "Antônio Carlos Rodrigues", "1963-02-27", "validated", 0, "Av. da Saudade, 18", "Centro"],
    ["citizen-francisca", "33344455566", "333.***.***-66", "Francisca das Chagas Lima", "1949-09-14", "pending_documents", 1, "Rua das Acácias, 72", "Jardim Primavera"],
    ["citizen-jose", "44455566677", "444.***.***-77", "José Roberto Alves", "1958-05-09", "validated", 0, "Rua Sete de Setembro, 301", "Centro"],
    ["citizen-marlene", "55566677788", "555.***.***-88", "Marlene Aparecida Santos", "1967-12-21", "validated", 0, "Rua do Campo, 19", "Suinana"],
    ["citizen-sebastiao", "66677788899", "666.***.***-99", "Sebastião Gomes Ferreira", "1951-08-30", "validated", 0, "Praça do Distrito, 88", "Suinana"],
    ["citizen-rosangela", "77788899900", "777.***.***-00", "Rosângela de Fátima Costa", "1978-03-12", "pre_registered", 1, "Rua das Flores, 144", "Jardim Primavera"],
    ["citizen-paulo", "88899900011", "888.***.***-11", "Paulo Sérgio Martins", "1981-07-06", "validated", 0, "Rua Minas Gerais, 55", "Centro"],
    ["citizen-neusa", "99900011122", "999.***.***-22", "Neusa Maria Oliveira", "1960-01-25", "validated", 0, "Rua Projetada, 17", "Suinana"],
    ["citizen-luiz", "10120230344", "101.***.***-44", "Luiz Fernando Barbosa", "1975-10-10", "validated", 0, "Av. Central, 602", "Centro"],
    ["citizen-elza", "20230340455", "202.***.***-55", "Elza Pereira Nascimento", "1947-04-02", "validated", 0, "Rua da Matriz, 12", "Centro"],
    ["citizen-claudia", "30340450566", "303.***.***-66", "Cláudia Regina Moraes", "1986-09-19", "pre_registered", 1, "Rua Bela Vista, 91", "Jardim Primavera"],
    ["citizen-geraldo", "40450560677", "404.***.***-77", "Geraldo José da Silva", "1954-06-07", "validated", 0, "Estrada Municipal, km 4", "Zona Rural"],
  ] as const;

  const citizenStatements = [];
  for (const citizen of citizens) {
    citizenStatements.push(db.prepare(`INSERT OR IGNORE INTO citizens
      (id, cpf_hash, cpf_masked, full_name, birth_date, validation_status, first_pickup_required, address, district, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(citizen[0], await cpfHash(citizen[1]), citizen[2], citizen[3], citizen[4], citizen[5], citizen[6], citizen[7], citizen[8], now, now));
  }

  await db.batch([
    ...products.map((p) => db.prepare(`INSERT OR IGNORE INTO products
      (id, code, name, active_ingredient, presentation, unit, minimum_stock, requires_prescription, delivery_allowed, public_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).bind(...p.slice(0, 9), now, now)),
    ...products.map((p) => db.prepare(`INSERT OR IGNORE INTO lots
      (id, product_id, lot_number, expires_on, balance, reserved, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'released', ?, ?)`).bind(`lot-${p[0]}`, p[0], p[11], p[12], p[9], p[10], now, now)),
    ...citizenStatements,
  ]);

  const mariaPassword = await passwordHash("Cidadao@2026");
  const joaoPassword = await passwordHash("Cidadao@2026");
  const anaActivation = await sha256("SAUDE-2026");
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO credentials VALUES ('citizen-maria', ?, ?)").bind(mariaPassword, now),
    db.prepare("UPDATE citizens SET validation_status='validated', first_pickup_required=0, updated_at=? WHERE id='citizen-maria'").bind(now),
    db.prepare("UPDATE activation_codes SET status='used' WHERE citizen_id='citizen-maria'"),
    db.prepare("INSERT OR IGNORE INTO credentials VALUES ('citizen-joao', ?, ?)").bind(joaoPassword, now),
    db.prepare("INSERT OR IGNORE INTO activation_codes VALUES ('activation-ana', 'citizen-ana', ?, 'active', '2027-12-31T23:59:59.000Z', ?)").bind(anaActivation, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-01', 'SAU-2026-0101', 'citizen-joao', 'prod-losartana', 30, 'pickup', 'received', 'pickup-2-9-0', 'receita-losartana.pdf', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-02', 'SAU-2026-0102', 'citizen-antonio', 'prod-metformina', 60, 'delivery', 'approved', 'delivery-2-15', 'receita-metformina.jpg', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-03', 'SAU-2026-0103', 'citizen-jose', 'prod-omeprazol', 28, 'pickup', 'ready', 'pickup-1-10-15', 'receita-omeprazol.pdf', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-04', 'SAU-2026-0104', 'citizen-marlene', 'prod-insulina', 2, 'pickup', 'received', 'pickup-3-8-30', 'receita-insulina.jpg', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-05', 'SAU-2026-0105', 'citizen-sebastiao', 'prod-amlodipino', 30, 'delivery', 'ready', 'delivery-1-16', 'receita-amlodipino.pdf', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-06', 'SAU-2026-0106', 'citizen-paulo', 'prod-amoxicilina', 21, 'pickup', 'approved', 'pickup-2-14-0', 'receita-amoxicilina.pdf', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-07', 'SAU-2026-0107', 'citizen-neusa', 'prod-levotiroxina', 30, 'delivery', 'received', 'delivery-3-14', 'receita-levotiroxina.jpg', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-08', 'SAU-2026-0108', 'citizen-elza', 'prod-aas', 30, 'pickup', 'completed', 'pickup-1-8-0', 'receita-aas.pdf', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO requests VALUES ('request-demo-09', 'SAU-2026-0109', 'citizen-geraldo', 'prod-salbutamol', 1, 'delivery', 'received', 'delivery-4-15', 'receita-salbutamol.jpg', ?, ?)").bind(now, now),
    db.prepare("INSERT OR IGNORE INTO stock_needs VALUES ('need-demo-01', 'citizen-rosangela', 'prod-azitromicina', 'active', ?)").bind(now),
  ]);

  const interests = [
    ["interest-01", "citizen-joao", "esp-cardio", "location-central", "manha", "active", null],
    ["interest-02", "citizen-ana", "esp-oftalmo", "location-central", "manha", "active", null],
    ["interest-03", "citizen-antonio", "esp-orto", "location-central", "tarde", "confirmed", "schedule-orto"],
    ["interest-04", "citizen-francisca", "esp-dermato", "location-central", "manha", "active", null],
    ["interest-05", "citizen-jose", "esp-cardio", "location-suinana", "tarde", "notified", "schedule-cardio"],
    ["interest-06", "citizen-marlene", "esp-oftalmo", "location-suinana", "manha", "active", null],
    ["interest-07", "citizen-sebastiao", "esp-orto", "location-central", "manha", "confirmed", "schedule-orto"],
    ["interest-08", "citizen-rosangela", "esp-dermato", "location-central", "tarde", "active", null],
    ["interest-09", "citizen-paulo", "esp-cardio", "location-central", "manha", "notified", "schedule-cardio"],
    ["interest-10", "citizen-neusa", "esp-oftalmo", "location-suinana", "tarde", "active", null],
    ["interest-11", "citizen-luiz", "esp-orto", "location-central", "tarde", "confirmed", "schedule-orto"],
    ["interest-12", "citizen-elza", "esp-cardio", "location-central", "manha", "active", null],
    ["interest-13", "citizen-claudia", "esp-dermato", "location-central", "manha", "active", null],
    ["interest-14", "citizen-geraldo", "esp-oftalmo", "location-suinana", "manha", "active", null],
  ] as const;
  await db.batch([
    ...interests.map((i) => db.prepare(`INSERT OR IGNORE INTO specialty_interests
      (id, citizen_id, specialty_id, preferred_location, preferred_period, status, created_at, schedule_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(i[0], i[1], i[2], i[3], i[4], i[5], now, i[6])),
    db.prepare("INSERT OR IGNORE INTO messages VALUES ('message-demo-01', 'citizen-maria', 'pharmacy', 'Bom dia, Maria! Sua consulta está confirmada. Leve documento com foto e cartão SUS.', NULL, ?)").bind(now),
    db.prepare("INSERT OR IGNORE INTO messages VALUES ('message-demo-02', 'citizen-joao', 'citizen', 'Preciso confirmar se posso retirar o medicamento amanhã.', NULL, ?)").bind(now),
    db.prepare("INSERT OR IGNORE INTO messages VALUES ('message-demo-03', 'citizen-joao', 'pharmacy', 'Pode sim, João. Seu horário está reservado e a equipe estará aguardando.', NULL, ?)").bind(now),
    db.prepare("INSERT OR IGNORE INTO notifications VALUES ('notification-demo-01', 'citizen-maria', 'Bem-vinda ao Saúde Perto de Você', 'Seu cadastro está validado. Agora você pode solicitar medicamentos, acompanhar consultas e falar com a farmácia.', NULL, ?)").bind(now),
    db.prepare("INSERT OR IGNORE INTO notifications VALUES ('notification-demo-02', 'citizen-joao', 'Solicitação em análise', 'O protocolo SAU-2026-0101 foi recebido pela farmácia e está em análise.', NULL, ?)").bind(now),
    db.prepare("INSERT OR IGNORE INTO app_settings VALUES ('demo_dataset_v2', ?)").bind(now),
  ]);
}

export async function ensureDatabase() {
  const db = getD1();
  for (const statement of schemaStatements) await db.prepare(statement).run();
  await seed();
  await ensureHealthWorkflow();
  await ensureDemoDataset();
}

export async function getSession(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("ps_session="))?.slice(11);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return queryFirst<{ id: string; role: string; principal_id: string }>("SELECT id, role, principal_id FROM sessions WHERE token_hash = ? AND expires_at > ?", tokenHash, new Date().toISOString());
}

export async function createSession(role: "citizen" | "admin", principalId: string) {
  const raw = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const hash = await sha256(raw);
  const now = new Date();
  await getD1().prepare("INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), role, principalId, hash, new Date(now.getTime() + 7 * 86400000).toISOString(), now.toISOString()).run();
  return raw;
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function sessionCookie(token: string) {
  return `ps_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export function clearSessionCookie() {
  return "ps_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export async function audit(actor: string, action: string, entity: string, entityId?: string, details?: string) {
  await getD1().prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), actor, action, entity, entityId ?? null, details ?? null, new Date().toISOString()).run();
}

export type { D1Result };
