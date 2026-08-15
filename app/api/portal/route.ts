import { env } from "cloudflare:workers";
import {
  audit,
  clearSessionCookie,
  cpfHash,
  createSession,
  ensureDatabase,
  getD1,
  getSession,
  json,
  normalizeCpf,
  passwordHash,
  sessionCookie,
  sha256,
  verifyPassword,
} from "../../../db/runtime";
import { pushConfiguration, sendPushToCitizen } from "../../../db/push";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

async function all<T extends Row>(sql: string, ...bindings: unknown[]) {
  const result = await getD1().prepare(sql).bind(...bindings).all<T>();
  return result.results ?? [];
}

async function first<T extends Row>(sql: string, ...bindings: unknown[]) {
  return (await getD1().prepare(sql).bind(...bindings).first<T>()) ?? null;
}

function failure(message: string, status = 400) {
  return json({ ok: false, message }, { status });
}

function now() {
  return new Date().toISOString();
}

const managerActions = new Set(["addProduct", "importXml", "importInventory", "importCitizens", "updateSlot", "addSchedule", "updateScheduleStatus", "addLocation", "toggleLocation", "privacyStatus"]);
const allowedUploadTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

async function requireAdminRole(actor: string, action: string) {
  const user = await first<{ role: string }>("SELECT role FROM admin_users WHERE id=? AND active=1", actor);
  if (!user) return false;
  if (action === "createAdmin") return user.role === "superadmin";
  if (managerActions.has(action)) return user.role === "manager" || user.role === "superadmin";
  return ["operator", "manager", "superadmin"].includes(user.role);
}

async function loginGuard(identity: string) {
  const key = await sha256(`login:${identity.trim().toLowerCase()}`);
  const attempt = await first<{ attempts: number; blocked_until: string | null }>("SELECT attempts, blocked_until FROM login_attempts WHERE identity_hash=?", key);
  if (attempt?.blocked_until && attempt.blocked_until > now()) return { key, blocked: true };
  return { key, blocked: false };
}

async function loginFailed(key: string) {
  const timestamp = now();
  await getD1().prepare(`INSERT INTO login_attempts (identity_hash, attempts, blocked_until, updated_at) VALUES (?,1,NULL,?)
    ON CONFLICT(identity_hash) DO UPDATE SET attempts=CASE WHEN blocked_until IS NOT NULL AND blocked_until<=? THEN 1 ELSE attempts+1 END,
    blocked_until=CASE WHEN (CASE WHEN blocked_until IS NOT NULL AND blocked_until<=? THEN 1 ELSE attempts+1 END)>=5 THEN ? ELSE blocked_until END, updated_at=?`)
    .bind(key, timestamp, timestamp, timestamp, new Date(Date.now() + 15 * 60000).toISOString(), timestamp).run();
}

async function clearLoginFailures(key: string) {
  await getD1().prepare("DELETE FROM login_attempts WHERE identity_hash=?").bind(key).run();
}

function decodeUpload(base64: string, contentType: string) {
  if (!allowedUploadTypes.has(contentType)) throw new Error("Envie somente PDF, JPG ou PNG.");
  let bytes: Uint8Array;
  try { bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)); }
  catch { throw new Error("Arquivo inválido."); }
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("O documento deve ter no máximo 5 MB.");
  const pdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if ((contentType === "application/pdf" && !pdf) || (contentType === "image/jpeg" && !jpg) || (contentType === "image/png" && !png)) throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  return bytes;
}

function protocol() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SAU-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function publicProducts() {
  return all(`SELECT p.id, p.code, p.name, p.active_ingredient, p.presentation, p.unit,
    p.requires_prescription, p.delivery_allowed, p.minimum_stock,
    COALESCE(SUM(CASE WHEN l.status = 'released' THEN l.balance - l.reserved ELSE 0 END), 0) AS available,
    MIN(CASE WHEN l.status = 'released' AND l.balance > l.reserved THEN l.expires_on END) AS nearest_expiry
    FROM products p LEFT JOIN lots l ON l.product_id = p.id
    WHERE p.public_visible = 1 GROUP BY p.id ORDER BY p.name`);
}

async function sessionPayload(request: Request) {
  const session = await getSession(request);
  if (!session) return { role: null };
  if (session.role === "citizen") {
    const user = await first("SELECT id, full_name, cpf_masked, validation_status, first_pickup_required, address, district FROM citizens WHERE id = ?", session.principal_id);
    return { role: "citizen", user };
  }
  const user = await first("SELECT id, name, login, role FROM admin_users WHERE id = ? AND active = 1", session.principal_id);
  return { role: "admin", user };
}

export async function GET(request: Request) {
  await ensureDatabase();
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "public";
  if (action === "public") {
    const update = await first<{ updated_at: string }>("SELECT MAX(updated_at) AS updated_at FROM lots");
    return json({ ok: true, products: await publicProducts(), updatedAt: update?.updated_at ?? now(), scope: "Estoque consolidado da Farmácia Municipal", legalBasis: "Lei nº 14.654/2023" });
  }
  if (action === "session") return json({ ok: true, ...(await sessionPayload(request)) });

  const session = await getSession(request);
  if (!session) return failure("Sua sessão expirou. Entre novamente.", 401);

  if (action === "pushConfig") {
    if (session.role !== "citizen") return failure("Acesso exclusivo do cidadão.", 403);
    const configuration = pushConfiguration();
    const subscriptions = await first<{ total: number }>("SELECT COUNT(*) AS total FROM push_subscriptions WHERE citizen_id=? AND active=1", session.principal_id);
    return json({ ok: true, ...configuration, activeDevices: Number(subscriptions?.total ?? 0) });
  }

  if (action === "citizen") {
    if (session.role !== "citizen") return failure("Acesso exclusivo do cidadão.", 403);
    const citizenId = session.principal_id;
    const [profile, products, requests, needs, specialties, schedules, interests, notifications, messages, slots, privacyRequests] = await Promise.all([
      first("SELECT id, full_name, cpf_masked, validation_status, first_pickup_required, address, district FROM citizens WHERE id = ?", citizenId),
      publicProducts(),
      all(`SELECT r.*, p.name AS product_name, s.starts_at, s.ends_at FROM requests r
        JOIN products p ON p.id = r.product_id LEFT JOIN schedule_slots s ON s.id = r.slot_id
        WHERE r.citizen_id = ? ORDER BY r.created_at DESC`, citizenId),
      all("SELECT n.*, p.name AS product_name FROM stock_needs n JOIN products p ON p.id = n.product_id WHERE n.citizen_id = ? AND n.status = 'active'", citizenId),
      all(`SELECT e.*, COUNT(i.id) AS demand FROM specialties e LEFT JOIN specialty_interests i ON i.specialty_id=e.id AND i.status IN ('active','notified','confirmed') WHERE e.active=1 GROUP BY e.id ORDER BY e.name`),
      all(`SELECT a.*, e.name AS specialty_name, COALESCE(l.name, a.location) AS location_name, l.address AS location_address, l.reference AS location_reference FROM specialty_schedules a JOIN specialties e ON e.id=a.specialty_id LEFT JOIN health_locations l ON l.id=a.location_id WHERE a.starts_at > ? AND a.status!='cancelled' ORDER BY a.starts_at`, now()),
      all(`SELECT i.*, e.name AS specialty_name, a.starts_at, a.status AS schedule_status, a.capacity,
        COALESCE(l.name, a.location) AS location_name, l.address AS location_address, l.reference AS location_reference
        FROM specialty_interests i JOIN specialties e ON e.id=i.specialty_id
        LEFT JOIN specialty_schedules a ON a.id=i.schedule_id LEFT JOIN health_locations l ON l.id=a.location_id
        WHERE i.citizen_id = ? ORDER BY i.created_at DESC`, citizenId),
      all("SELECT * FROM notifications WHERE citizen_id = ? ORDER BY created_at DESC LIMIT 30", citizenId),
      all("SELECT * FROM messages WHERE citizen_id = ? ORDER BY created_at ASC LIMIT 60", citizenId),
      all("SELECT * FROM schedule_slots WHERE active=1 AND starts_at > ? AND reserved_count < capacity ORDER BY starts_at LIMIT 120", now()),
      all("SELECT * FROM privacy_requests WHERE citizen_id=? ORDER BY created_at DESC", citizenId),
    ]);
    return json({ ok: true, profile, products, requests, needs, specialties, schedules, interests, notifications, messages, slots, privacyRequests });
  }

  if (action === "admin") {
    if (session.role !== "admin") return failure("Acesso exclusivo da farmácia.", 403);
    const [me, products, lots, requests, slots, specialties, specialtySchedules, locations, citizens, chats, adminMessages, auditEvents, adminUsers] = await Promise.all([
      first("SELECT id, name, login, role FROM admin_users WHERE id = ?", session.principal_id),
      publicProducts(),
      all(`SELECT l.*, p.name AS product_name, p.code FROM lots l JOIN products p ON p.id=l.product_id ORDER BY l.expires_on`),
      all(`SELECT r.*, p.name AS product_name, c.full_name AS citizen_name, c.validation_status, s.starts_at, s.ends_at, l.lot_number AS reserved_lot_number
        FROM requests r JOIN products p ON p.id=r.product_id JOIN citizens c ON c.id=r.citizen_id
        LEFT JOIN schedule_slots s ON s.id=r.slot_id LEFT JOIN lots l ON l.id=r.reserved_lot_id
        ORDER BY CASE r.status WHEN 'received' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.created_at DESC`),
      all("SELECT * FROM schedule_slots WHERE starts_at > ? ORDER BY starts_at LIMIT 180", now()),
      all(`SELECT e.*, COUNT(i.id) AS demand, MIN(a.starts_at) AS next_date
        FROM specialties e LEFT JOIN specialty_interests i ON i.specialty_id=e.id AND i.status IN ('active','notified','confirmed')
        LEFT JOIN specialty_schedules a ON a.specialty_id=e.id AND a.starts_at > ? GROUP BY e.id ORDER BY demand DESC, e.name`, now()),
      all(`SELECT a.id, a.specialty_id, e.name AS specialty_name, a.location_id, COALESCE(l.name, a.location) AS location, l.address AS location_address, a.starts_at, a.status, a.capacity,
        COUNT(DISTINCT CASE WHEN i.status IN ('notified','confirmed') THEN i.id END) AS citizens_notified,
        COUNT(DISTINCT CASE WHEN i.status='confirmed' THEN i.id END) AS citizens_confirmed
        FROM specialty_schedules a JOIN specialties e ON e.id=a.specialty_id
        LEFT JOIN health_locations l ON l.id=a.location_id LEFT JOIN specialty_interests i ON i.schedule_id=a.id
        WHERE a.starts_at > ? GROUP BY a.id ORDER BY a.starts_at`, now()),
      all("SELECT * FROM health_locations ORDER BY active DESC, name"),
      all(`SELECT c.id, c.full_name, c.cpf_masked, c.validation_status, c.first_pickup_required, c.district, c.created_at,
        COUNT(DISTINCT r.id) AS request_count, COUNT(DISTINCT d.id) AS document_count FROM citizens c LEFT JOIN requests r ON r.citizen_id=c.id LEFT JOIN citizen_documents d ON d.citizen_id=c.id GROUP BY c.id ORDER BY c.full_name`),
      all(`SELECT c.id AS citizen_id, c.full_name, MAX(m.created_at) AS last_message,
        SUM(CASE WHEN m.sender='citizen' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread
        FROM citizens c JOIN messages m ON m.citizen_id=c.id GROUP BY c.id ORDER BY last_message DESC`),
      all("SELECT * FROM messages ORDER BY created_at ASC LIMIT 200"),
      all("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 30"),
      all("SELECT id, name, login, role, active, created_at FROM admin_users ORDER BY name"),
    ]);
    const pending = requests.filter((item: Row) => item.status === "received").length;
    const lowStock = products.filter((item: Row) => Number(item.available) <= Number(item.minimum_stock)).length;
    const today = new Date().toISOString().slice(0, 10);
    const todayAppointments = slots.filter((item: Row) => String(item.starts_at).slice(0, 10) === today).reduce((sum: number, item: Row) => sum + Number(item.reserved_count), 0);
    const role = String(me?.role ?? "operator");
    const privacyRequests = role === "operator" ? [] : await all(`SELECT p.*, c.full_name, c.cpf_masked FROM privacy_requests p JOIN citizens c ON c.id=p.citizen_id ORDER BY CASE p.status WHEN 'open' THEN 0 ELSE 1 END, p.created_at`);
    return json({ ok: true, me, products, lots, requests, slots, specialties, specialtySchedules, locations, citizens, chats, adminMessages,
      auditEvents: role === "operator" ? [] : auditEvents, adminUsers: role === "superadmin" ? adminUsers : [], privacyRequests,
      kpis: { pending, lowStock, todayAppointments, citizens: citizens.length } });
  }

  return failure("Consulta desconhecida.", 404);
}

export async function POST(request: Request) {
  await ensureDatabase();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return failure("Dados inválidos."); }
  const action = String(body.action ?? "");
  const db = getD1();

  if (action === "activate") {
    const cpf = normalizeCpf(String(body.cpf ?? ""));
    const birthDate = String(body.birthDate ?? "");
    const code = String(body.code ?? "").trim().toUpperCase();
    const password = String(body.password ?? "");
    if (cpf.length !== 11 || !birthDate || !code || password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return failure("Confira os dados. A senha deve ter 10 caracteres ou mais, com letras e números.");
    const citizen = await first<{ id: string; full_name: string }>("SELECT id, full_name FROM citizens WHERE cpf_hash=? AND birth_date=?", await cpfHash(cpf), birthDate);
    if (!citizen) return failure("Não encontramos esse cadastro. Procure a unidade de saúde.", 404);
    if (await first("SELECT citizen_id FROM credentials WHERE citizen_id=?", citizen.id)) return failure("Este acesso já foi ativado. Volte e use a opção Entrar.");
    const activation = await first<{ id: string; code_hash: string }>("SELECT id, code_hash FROM activation_codes WHERE citizen_id=? AND status='active' AND expires_at>?", citizen.id, now());
    if (!activation || activation.code_hash !== await sha256(code)) return failure("Código inválido ou vencido.");
    const timestamp = now();
    await db.batch([
      db.prepare("INSERT INTO credentials VALUES (?, ?, ?)").bind(citizen.id, await passwordHash(password), timestamp),
      db.prepare("UPDATE activation_codes SET status='used' WHERE id=?").bind(activation.id),
      db.prepare("INSERT INTO audit_events VALUES (?, ?, 'activate', 'citizen', ?, NULL, ?)").bind(crypto.randomUUID(), citizen.id, citizen.id, timestamp),
    ]);
    const token = await createSession("citizen", citizen.id);
    return json({ ok: true, role: "citizen", name: citizen.full_name }, { headers: { "Set-Cookie": sessionCookie(token) } });
  }

  if (action === "login") {
    const mode = String(body.mode ?? "citizen");
    const password = String(body.password ?? "");
    const identity = mode === "admin" ? String(body.login ?? "") : normalizeCpf(String(body.cpf ?? ""));
    const guard = await loginGuard(`${mode}:${identity}`);
    if (guard.blocked) return failure("Muitas tentativas. Aguarde 15 minutos e tente novamente.", 429);
    if (mode === "admin") {
      const user = await first<{ id: string; name: string; password_hash: string }>("SELECT id, name, password_hash FROM admin_users WHERE lower(login)=lower(?) AND active=1", String(body.login ?? ""));
      if (!user || !await verifyPassword(password, user.password_hash)) { await loginFailed(guard.key); return failure("E-mail ou senha incorretos.", 401); }
      await clearLoginFailures(guard.key);
      const token = await createSession("admin", user.id);
      await audit(user.id, "login", "admin_user", user.id);
      return json({ ok: true, role: "admin", name: user.name }, { headers: { "Set-Cookie": sessionCookie(token) } });
    }
    const citizen = await first<{ id: string; full_name: string; password_hash: string }>(`SELECT c.id, c.full_name, x.password_hash FROM citizens c JOIN credentials x ON x.citizen_id=c.id WHERE c.cpf_hash=?`, await cpfHash(String(body.cpf ?? "")));
    if (!citizen || !await verifyPassword(password, citizen.password_hash)) { await loginFailed(guard.key); return failure("CPF ou senha incorretos.", 401); }
    await clearLoginFailures(guard.key);
    const token = await createSession("citizen", citizen.id);
    await audit(citizen.id, "login", "citizen", citizen.id);
    return json({ ok: true, role: "citizen", name: citizen.full_name }, { headers: { "Set-Cookie": sessionCookie(token) } });
  }

  if (action === "logout") {
    return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  }

  const session = await getSession(request);
  if (!session) return failure("Sua sessão expirou. Entre novamente.", 401);

  if (session.role === "citizen") {
    const citizenId = session.principal_id;
    if (action === "subscribePush") {
      const endpoint = String(body.endpoint ?? "").trim();
      const keys = (body.keys ?? {}) as Record<string, unknown>;
      const p256dh = String(keys.p256dh ?? "").trim();
      const auth = String(keys.auth ?? "").trim();
      if (!pushConfiguration().configured) return failure("Os alertas ainda não foram configurados pelo município.", 503);
      if (!endpoint.startsWith("https://") || endpoint.length > 2048 || p256dh.length < 40 || p256dh.length > 256 || auth.length < 8 || auth.length > 128) return failure("Não foi possível validar este aparelho.");
      const timestamp = now();
      await db.prepare(`INSERT INTO push_subscriptions (id,citizen_id,endpoint,p256dh,auth,user_agent,active,failure_count,last_success_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,1,0,NULL,?,?) ON CONFLICT(endpoint) DO UPDATE SET citizen_id=excluded.citizen_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,active=1,failure_count=0,updated_at=excluded.updated_at`)
        .bind(crypto.randomUUID(), citizenId, endpoint, p256dh, auth, request.headers.get("user-agent")?.slice(0, 300) ?? null, timestamp, timestamp).run();
      await audit(citizenId, "subscribe", "push_subscription", undefined, "aparelho ativado");
      await sendPushToCitizen(citizenId, { title: "Alertas ativados", body: "Este aparelho receberá avisos importantes da saúde municipal.", url: "/cidadao", tag: "push-enabled" });
      return json({ ok: true, message: "Alertas ativados neste aparelho." });
    }
    if (action === "unsubscribePush") {
      const endpoint = String(body.endpoint ?? "").trim();
      await db.prepare("UPDATE push_subscriptions SET active=0, updated_at=? WHERE citizen_id=? AND endpoint=?").bind(now(), citizenId, endpoint).run();
      await audit(citizenId, "unsubscribe", "push_subscription", undefined, "aparelho desativado");
      return json({ ok: true, message: "Alertas desativados neste aparelho." });
    }
    if (action === "requestMedication") {
      const productId = String(body.productId ?? "");
      const quantity = Math.max(1, Number(body.quantity ?? 1));
      const method = String(body.method ?? "pickup");
      const slotId = String(body.slotId ?? "");
      if (!Number.isFinite(quantity) || quantity <= 0 || !["pickup", "delivery"].includes(method)) return failure("Confira a quantidade e a forma de atendimento.");
      const profile = await first<{ validation_status: string; first_pickup_required: number }>("SELECT validation_status, first_pickup_required FROM citizens WHERE id=?", citizenId);
      if (method === "delivery" && (profile?.validation_status !== "validated" || Number(profile.first_pickup_required) === 1)) return failure("A entrega em casa será liberada somente após validar os documentos e concluir a primeira retirada presencial.");
      const product = await first<{ available: number; delivery_allowed: number; requires_prescription: number; name: string }>(`SELECT p.name, p.delivery_allowed, p.requires_prescription, COALESCE(SUM(l.balance-l.reserved),0) AS available FROM products p LEFT JOIN lots l ON l.product_id=p.id AND l.status='released' WHERE p.id=? GROUP BY p.id`, productId);
      if (!product || Number(product.available) < quantity) return failure("Saldo insuficiente. Avise que precisa deste medicamento para receber uma notificação.");
      if (method === "delivery" && !product.delivery_allowed) return failure("Este medicamento exige retirada presencial.");
      const slot = await first<{ starts_at: string; capacity: number; reserved_count: number; method: string }>("SELECT starts_at, capacity, reserved_count, method FROM schedule_slots WHERE id=? AND active=1 AND starts_at>?", slotId, now());
      if (!slot || slot.method !== method || slot.reserved_count >= slot.capacity) return failure("Este horário não está mais disponível. Escolha outro.");
      if (method === "delivery" && new Date(slot.starts_at).getTime() < Date.now() + 24 * 3600000) return failure("A entrega deve ser agendada com pelo menos 24 horas de antecedência.");
      let prescriptionStorageKey: string | null = null;
      const prescriptionName = body.prescriptionName ? String(body.prescriptionName).replace(/[^a-zA-Z0-9._-]/g, "_") : null;
      if (product.requires_prescription) {
        if (!prescriptionName || !body.prescriptionBase64 || !body.prescriptionType) return failure("Envie uma receita em PDF, JPG ou PNG para solicitar este medicamento.");
        let bytes: Uint8Array;
        try { bytes = decodeUpload(String(body.prescriptionBase64), String(body.prescriptionType)); } catch (error) { return failure(error instanceof Error ? error.message : "Receita inválida."); }
        const files = (env as unknown as { FILES?: R2Bucket }).FILES;
        if (!files) return failure("Armazenamento protegido indisponível.", 503);
        prescriptionStorageKey = `prescriptions/${citizenId}/${Date.now()}-${prescriptionName}`;
        await files.put(prescriptionStorageKey, bytes, { httpMetadata: { contentType: String(body.prescriptionType) } });
      }
      const id = crypto.randomUUID(); const requestProtocol = protocol(); const timestamp = now();
      try {
        await db.batch([
          db.prepare("INSERT INTO requests (id,protocol,citizen_id,product_id,quantity,method,status,slot_id,prescription_name,prescription_storage_key,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, 'received', ?, ?, ?, ?, ?)").bind(id, requestProtocol, citizenId, productId, quantity, method, slotId, prescriptionName, prescriptionStorageKey, timestamp, timestamp),
          db.prepare("INSERT INTO notifications VALUES (?, ?, 'Solicitação recebida', ?, NULL, ?)").bind(crypto.randomUUID(), citizenId, `Protocolo ${requestProtocol}. A solicitação depende da conferência da receita, do cadastro e do estoque pela farmácia.`, timestamp),
        ]);
      } catch { return failure("Este horário acabou de ser preenchido. Escolha outro.", 409); }
      await audit(citizenId, "create", "request", id, requestProtocol);
      await sendPushToCitizen(citizenId, { title: "Solicitação recebida", body: "A farmácia recebeu sua solicitação. Acompanhe a análise no portal.", url: "/cidadao", tag: `request-${id}` });
      return json({ ok: true, message: `Solicitação enviada. Protocolo ${requestProtocol}.` });
    }
    if (action === "needStock") {
      const productId = String(body.productId ?? "");
      try {
        await db.prepare("INSERT INTO stock_needs VALUES (?, ?, ?, 'active', ?)").bind(crypto.randomUUID(), citizenId, productId, now()).run();
      } catch { return json({ ok: true, message: "Você já está na lista de aviso deste medicamento." }); }
      return json({ ok: true, message: "Tudo certo. Avisaremos quando houver estoque." });
    }
    if (action === "specialtyInterest") {
      try {
        await db.prepare("INSERT INTO specialty_interests (id, citizen_id, specialty_id, preferred_location, preferred_period, status, created_at, schedule_id) VALUES (?, ?, ?, ?, ?, 'active', ?, NULL)").bind(crypto.randomUUID(), citizenId, String(body.specialtyId), String(body.location ?? "Município"), String(body.period ?? "qualquer"), now()).run();
      } catch { return json({ ok: true, message: "Sua necessidade para esta especialidade já está registrada." }); }
      return json({ ok: true, message: "Necessidade registrada para planejamento. Isso não é agendamento nem encaminhamento médico; você receberá um aviso se houver uma data disponível." });
    }
    if (action === "sendMessage") {
      const message = String(body.message ?? "").trim().slice(0, 1000);
      if (!message) return failure("Escreva uma mensagem.");
      await db.prepare("INSERT INTO messages VALUES (?, ?, 'citizen', ?, NULL, ?)").bind(crypto.randomUUID(), citizenId, message, now()).run();
      return json({ ok: true, message: "Mensagem enviada à farmácia." });
    }
    if (action === "confirmConsultation") {
      const interestId = String(body.interestId ?? "");
      const interest = await first<{ schedule_id: string }>("SELECT schedule_id FROM specialty_interests WHERE id=? AND citizen_id=? AND status='notified'", interestId, citizenId);
      if (!interest?.schedule_id) return failure("Esta consulta não está disponível para confirmação.");
      const availability=await first<{capacity:number;confirmed:number;status:string;starts_at:string}>(`SELECT a.capacity,a.status,a.starts_at,COUNT(i.id) AS confirmed FROM specialty_schedules a LEFT JOIN specialty_interests i ON i.schedule_id=a.id AND i.status='confirmed' WHERE a.id=? GROUP BY a.id`,interest.schedule_id);
      if(!availability||availability.status!=="confirmed"||new Date(availability.starts_at).getTime()<=Date.now())return failure("Esta agenda ainda não está confirmada ou não está mais disponível.");
      if(Number(availability.confirmed)>=Number(availability.capacity))return failure("As vagas desta agenda foram preenchidas. Sua demanda continuará registrada para uma próxima data.");
      await db.prepare("UPDATE specialty_interests SET status='confirmed' WHERE id=? AND status='notified'").bind(interestId).run();
      await audit(citizenId, "confirm", "specialty_interest", interestId, interest.schedule_id);
      return json({ ok: true, message: "Presença confirmada. A consulta está no seu painel." });
    }
    if (action === "readNotifications") {
      await db.prepare("UPDATE notifications SET read_at=? WHERE citizen_id=? AND read_at IS NULL").bind(now(), citizenId).run();
      return json({ ok: true });
    }
    if (action === "uploadDocument") {
      const fileName = String(body.fileName ?? "documento").replace(/[^a-zA-Z0-9._-]/g, "_");
      const contentType = String(body.contentType ?? "application/octet-stream");
      const base64 = String(body.base64 ?? "");
      let bytes: Uint8Array;
      try { bytes = decodeUpload(base64, contentType); } catch (error) { return failure(error instanceof Error ? error.message : "Documento inválido."); }
      const key = `citizens/${citizenId}/${Date.now()}-${fileName}`;
      const files = (env as unknown as { FILES?: R2Bucket }).FILES;
      if (!files) return failure("Armazenamento de documentos indisponível.", 503);
      await files.put(key, bytes, { httpMetadata: { contentType } });
      await db.prepare("INSERT INTO citizen_documents VALUES (?, ?, ?, ?, ?, 'pending_review', ?)").bind(crypto.randomUUID(), citizenId, fileName, key, contentType, now()).run();
      await audit(citizenId, "upload", "citizen_document", undefined, fileName);
      return json({ ok: true, message: "Documento enviado para conferência." });
    }
    if (action === "privacyRequest") {
      const requestType = String(body.requestType ?? "");
      if (!["access", "correction", "information", "review"].includes(requestType)) return failure("Selecione um tipo de solicitação válido.");
      const details = String(body.details ?? "").trim().slice(0, 1500);
      const timestamp = now();
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO privacy_requests VALUES (?, ?, ?, ?, 'open', ?, ?)").bind(id, citizenId, requestType, details || null, timestamp, timestamp).run();
      await audit(citizenId, "create", "privacy_request", id, requestType);
      return json({ ok: true, message: "Solicitação de privacidade registrada. A prefeitura fará a análise pelo canal oficial." });
    }
    return failure("Ação não permitida.", 403);
  }

  if (session.role !== "admin") return failure("Acesso negado.", 403);
  const actor = session.principal_id;
  if (!await requireAdminRole(actor, action)) return failure("Seu perfil não permite esta operação.", 403);

  if (action === "requestStatus") {
    const requestId = String(body.requestId ?? "");
    const status = String(body.status ?? "");
    const item = await first<{ citizen_id: string; product_id: string; quantity: number; method: string; status: string; protocol: string; slot_id: string | null; reserved_lot_id: string | null }>("SELECT citizen_id, product_id, quantity, method, status, protocol, slot_id, reserved_lot_id FROM requests WHERE id=?", requestId);
    if (!item) return failure("Solicitação não encontrada.", 404);
    if (status === "approved") {
      if (item.status !== "received") return failure("Somente solicitações recebidas podem ser aprovadas.", 409);
      const lot = await first<{ id: string; lot_number: string }>("SELECT id, lot_number FROM lots WHERE product_id=? AND status='released' AND expires_on>=date('now') AND balance-reserved>=? ORDER BY expires_on LIMIT 1", item.product_id, item.quantity);
      if (!lot) return failure("Não há lote com saldo suficiente para aprovar.");
      const reserved = await first<{ id: string }>("UPDATE lots SET reserved=reserved+?, updated_at=? WHERE id=? AND balance-reserved>=? RETURNING id", item.quantity, now(), lot.id, item.quantity);
      if (!reserved) return failure("O saldo deste lote acabou de mudar. Atualize a fila e tente novamente.", 409);
      await db.batch([
        db.prepare("UPDATE requests SET status='approved', reserved_lot_id=?, decision_reason=NULL, updated_at=? WHERE id=? AND status='received'").bind(lot.id, now(), requestId),
        db.prepare("INSERT INTO stock_movements VALUES (?, ?, 'reservation', 0, ?, ?, ?, ?)").bind(crypto.randomUUID(), lot.id, item.quantity, actor, requestId, now()),
        db.prepare("INSERT INTO notifications VALUES (?, ?, 'Medicamento aprovado', ?, NULL, ?)").bind(crypto.randomUUID(), item.citizen_id, `O pedido ${item.protocol} foi aprovado e reservado no lote ${lot.lot_number}.`, now()),
      ]);
    } else if (status === "ready") {
      if (item.status !== "approved") return failure("A solicitação precisa estar aprovada antes da separação.", 409);
      const next = item.method === "delivery" ? "delivery_scheduled" : "ready_for_pickup";
      await db.batch([
        db.prepare("UPDATE requests SET status=?, updated_at=? WHERE id=?").bind(next, now(), requestId),
        db.prepare("INSERT INTO notifications VALUES (?, ?, 'Pedido pronto', ?, NULL, ?)").bind(crypto.randomUUID(), item.citizen_id, item.method === "delivery" ? `A entrega do pedido ${item.protocol} está programada.` : `O pedido ${item.protocol} está pronto para retirada.`, now()),
      ]);
    } else if (status === "completed") {
      if (!["ready_for_pickup", "delivery_scheduled"].includes(item.status)) return failure("O pedido precisa estar pronto ou com entrega programada antes da conclusão.", 409);
      if (!item.reserved_lot_id) return failure("Reserva de lote não localizada. Reabra a análise antes de concluir.");
      const lot = await first<{ id: string }>("SELECT id FROM lots WHERE id=? AND reserved>=? AND balance>=?", item.reserved_lot_id, item.quantity, item.quantity);
      if (!lot) return failure("O lote reservado não possui saldo consistente para a dispensação.");
      await db.batch([
        db.prepare("UPDATE lots SET balance=balance-?, reserved=reserved-?, updated_at=? WHERE id=?").bind(item.quantity, item.quantity, now(), lot.id),
        db.prepare("UPDATE requests SET status='completed', updated_at=? WHERE id=?").bind(now(), requestId),
        db.prepare("INSERT INTO stock_movements VALUES (?, ?, 'dispense', ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), lot.id, -item.quantity, -item.quantity, actor, requestId, now()),
        db.prepare("UPDATE citizens SET first_pickup_required=0, updated_at=? WHERE id=? AND ?='pickup' AND validation_status='validated'").bind(now(), item.citizen_id, item.method),
        db.prepare("INSERT INTO notifications VALUES (?, ?, 'Atendimento concluído', ?, NULL, ?)").bind(crypto.randomUUID(), item.citizen_id, `O pedido ${item.protocol} foi concluído.`, now()),
      ]);
    } else if (status === "rejected") {
      if (!["received", "approved", "ready_for_pickup", "delivery_scheduled"].includes(item.status)) return failure("Esta solicitação não pode mais ser recusada.", 409);
      const reason = String(body.reason ?? "").trim().slice(0, 500);
      if (reason.length < 5) return failure("Informe o motivo da não aprovação para orientar o cidadão.");
      const statements = [
        db.prepare("UPDATE requests SET status='rejected', decision_reason=?, updated_at=? WHERE id=?").bind(reason, now(), requestId),
        db.prepare("UPDATE schedule_slots SET reserved_count=MAX(0,reserved_count-1) WHERE id=? AND starts_at>?").bind(item.slot_id, now()),
        db.prepare("INSERT INTO notifications VALUES (?, ?, 'Solicitação não aprovada', ?, NULL, ?)").bind(crypto.randomUUID(), item.citizen_id, `O pedido ${item.protocol} não foi aprovado. Motivo: ${reason}`, now()),
      ];
      if (item.reserved_lot_id) {
        statements.push(db.prepare("UPDATE lots SET reserved=MAX(0,reserved-?), updated_at=? WHERE id=?").bind(item.quantity, now(), item.reserved_lot_id));
        statements.push(db.prepare("INSERT INTO stock_movements VALUES (?, ?, 'reservation_release', 0, ?, ?, ?, ?)").bind(crypto.randomUUID(), item.reserved_lot_id, -item.quantity, actor, requestId, now()));
      }
      await db.batch(statements);
    } else return failure("Situação inválida.");
    await audit(actor, status, "request", requestId);
    const pushByStatus: Record<string, { title: string; body: string }> = {
      approved: { title: "Solicitação atualizada", body: "Sua solicitação de medicamento foi aprovada. Abra o portal para conferir." },
      ready: { title: "Atendimento preparado", body: item.method === "delivery" ? "Sua entrega foi programada. Confira os detalhes no portal." : "Seu atendimento está pronto para retirada. Confira os detalhes no portal." },
      completed: { title: "Atendimento concluído", body: "Seu atendimento foi concluído e o histórico está disponível no portal." },
      rejected: { title: "Solicitação atualizada", body: "A farmácia atualizou sua solicitação. Abra o portal para ver os detalhes." },
    };
    await sendPushToCitizen(item.citizen_id, { ...pushByStatus[status], url: "/cidadao", tag: `request-${requestId}` });
    return json({ ok: true, message: "Solicitação atualizada." });
  }

  if (action === "validateCitizen") {
    const citizenId = String(body.citizenId ?? "");
    const citizen = await first<{ id: string }>("SELECT id FROM citizens WHERE id=?", citizenId);
    if (!citizen) return failure("Cidadão não encontrado.", 404);
    await db.prepare("UPDATE citizens SET validation_status='validated', updated_at=? WHERE id=?").bind(now(), citizenId).run();
    await audit(actor, "validate", "citizen", citizenId);
    return json({ ok: true, message: "Documentação validada. A entrega será liberada após a primeira retirada presencial concluída." });
  }

  if (action === "addProduct") {
    const code = String(body.code ?? "").trim(); const name = String(body.name ?? "").trim();
    if (!code || !name) return failure("Informe código e nome.");
    const id = crypto.randomUUID(); const timestamp = now();
    await db.prepare("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(id, code, name, String(body.activeIngredient ?? name), String(body.presentation ?? "Unidade"), String(body.unit ?? "unidade"), Number(body.minimumStock ?? 0), body.requiresPrescription ? 1 : 0, body.deliveryAllowed === false ? 0 : 1, timestamp, timestamp).run();
    await audit(actor, "create", "product", id);
    return json({ ok: true, message: "Produto cadastrado." });
  }

  if (action === "importXml") {
    const xml = String(body.xml ?? "");
    if (!xml.includes("<") || xml.length > 5_000_000) return failure("Selecione um XML válido com até 5 MB.");
    const pick = (block: string, tag: string) => block.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, "i"))?.[1]?.trim();
    const details = xml.match(/<det\b[\s\S]*?<\/det>/gi) ?? [xml];
    let imported = 0; const timestamp = now();
    for (const detail of details) {
      const code = pick(detail, "cProd"); const name = pick(detail, "xProd");
      if (!code || !name) continue;
      let product = await first<{ id: string }>("SELECT id FROM products WHERE code=?", code);
      if (!product) {
        product = { id: crypto.randomUUID() };
        await db.prepare("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, 1, ?, ?)").bind(product.id, code, name, name, pick(detail, "uCom") ?? "Unidade", (pick(detail, "uCom") ?? "unidade").toLowerCase(), timestamp, timestamp).run();
      }
      const lotNumber = pick(detail, "nLote") ?? `XML-${Date.now()}-${imported}`;
      const expiry = pick(detail, "dVal") ?? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      const balance = Number((pick(detail, "qLote") ?? pick(detail, "qCom") ?? "0").replace(",", "."));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) || !Number.isFinite(balance) || balance < 0) continue;
      await db.prepare("INSERT INTO lots VALUES (?, ?, ?, ?, ?, 0, 'released', ?, ?)").bind(crypto.randomUUID(), product.id, lotNumber, expiry, balance, timestamp, timestamp).run();
      imported += 1;
      const needs = await all<{ citizen_id: string }>("SELECT citizen_id FROM stock_needs WHERE product_id=? AND status='active'", product.id);
      for (const need of needs) {
        await db.prepare("INSERT INTO notifications VALUES (?, ?, 'Medicamento disponível', ?, NULL, ?)").bind(crypto.randomUUID(), need.citizen_id, `${name} voltou ao estoque. Consulte e faça sua solicitação.`, timestamp).run();
        await sendPushToCitizen(need.citizen_id, { title: "Medicamento disponível", body: "Um medicamento que você acompanha voltou ao estoque. Abra o portal para consultar.", url: "/cidadao", tag: `stock-${product.id}` });
      }
      await db.prepare("UPDATE stock_needs SET status='notified' WHERE product_id=? AND status='active'").bind(product.id).run();
    }
    if (!imported) return failure("Não encontramos itens com cProd e xProd nesse XML.");
    const files = (env as unknown as { FILES?: R2Bucket }).FILES;
    if (files) await files.put(`imports/${Date.now()}-${String(body.fileName ?? "estoque.xml")}`, xml, { httpMetadata: { contentType: "application/xml" } });
    await audit(actor, "import", "xml", undefined, `${imported} itens`);
    return json({ ok: true, message: `${imported} item(ns) importado(s) com lote e validade.` });
  }

  if (action === "importInventory") {
    const csv = String(body.csv ?? "").trim(); const rows = csv.split(/\r?\n/).filter(Boolean);
    if (csv.length > 5_000_000 || rows.length < 2 || rows.length > 10_001) return failure("O inventário deve ter cabeçalho, até 10 mil linhas e no máximo 5 MB.");
    const headers = rows[0].split(/[;,]/).map((value) => value.trim().toLowerCase());
    const index = (names: string[]) => names.map((name) => headers.indexOf(name)).find((position) => position >= 0) ?? -1;
    const p = { code:index(["codigo","código","code"]), name:index(["nome","produto","name"]), lot:index(["lote","lot"]), expiry:index(["validade","expiry"]), balance:index(["saldo","balance","quantidade"]) };
    if (Object.values(p).some((position) => position < 0)) return failure("Use as colunas: codigo, nome, lote, validade e saldo.");
    let imported=0; const timestamp=now();
    for (const row of rows.slice(1)) { const values=row.split(/[;,]/).map((value)=>value.trim()); const code=values[p.code]; const name=values[p.name]; if(!code||!name)continue;
      const balance=Number(values[p.balance].replace(",",".")); if(!/^\d{4}-\d{2}-\d{2}$/.test(values[p.expiry])||!Number.isFinite(balance)||balance<0||!values[p.lot])continue;
      let product=await first<{id:string}>("SELECT id FROM products WHERE code=?",code); if(!product){product={id:crypto.randomUUID()};await db.prepare("INSERT INTO products VALUES (?, ?, ?, ?, 'Unidade', 'unidade', 0, 0, 1, 1, ?, ?)").bind(product.id,code,name,name,timestamp,timestamp).run();}
      await db.prepare("INSERT INTO lots VALUES (?, ?, ?, ?, ?, 0, 'released', ?, ?)").bind(crypto.randomUUID(),product.id,values[p.lot],values[p.expiry],balance,timestamp,timestamp).run(); imported+=1;
      if(balance>0){const needs=await all<{citizen_id:string}>("SELECT citizen_id FROM stock_needs WHERE product_id=? AND status='active'",product.id);for(const need of needs){await db.prepare("INSERT INTO notifications VALUES (?, ?, 'Medicamento disponível', ?, NULL, ?)").bind(crypto.randomUUID(),need.citizen_id,`${name} voltou ao estoque. Consulte e faça sua solicitação.`,timestamp).run();await sendPushToCitizen(need.citizen_id,{title:"Medicamento disponível",body:"Um medicamento que você acompanha voltou ao estoque. Abra o portal para consultar.",url:"/cidadao",tag:`stock-${product.id}`});}await db.prepare("UPDATE stock_needs SET status='notified' WHERE product_id=? AND status='active'").bind(product.id).run();}}
    await audit(actor,"import","inventory",undefined,`${imported} linhas`); return json({ok:true,message:`${imported} item(ns) do inventário importado(s).`});
  }

  if (action === "importCitizens") {
    const csv=String(body.csv??"").trim(); const rows=csv.split(/\r?\n/).filter(Boolean); if(csv.length>5_000_000||rows.length<2||rows.length>10_001)return failure("A planilha deve ter cabeçalho, até 10 mil linhas e no máximo 5 MB.");
    const headers=rows[0].split(/[;,]/).map((value)=>value.trim().toLowerCase()); const index=(names:string[])=>names.map((name)=>headers.indexOf(name)).find((value)=>value>=0)??-1;
    const p={cpf:index(["cpf"]),name:index(["nome","name"]),birth:index(["nascimento","data_nascimento","birth_date"]),address:index(["endereco","endereço","address"]),district:index(["bairro","distrito","district"]),code:index(["codigo_ativacao","código_ativação","code"])};
    if(p.cpf<0||p.name<0||p.birth<0||p.code<0)return failure("Use as colunas: cpf, nome, nascimento e codigo_ativacao.");
    let imported=0; const timestamp=now();
    for(const row of rows.slice(1)){const values=row.split(/[;,]/).map((value)=>value.trim());const cpf=normalizeCpf(values[p.cpf]??"");if(cpf.length!==11||!/^\d{4}-\d{2}-\d{2}$/.test(values[p.birth])||!values[p.name]||String(values[p.code]??"").length<6)continue;const hash=await cpfHash(cpf);let citizen=await first<{id:string}>("SELECT id FROM citizens WHERE cpf_hash=?",hash);
      if(!citizen){citizen={id:crypto.randomUUID()};const masked=`${cpf.slice(0,3)}.***.***-${cpf.slice(-2)}`;await db.prepare("INSERT INTO citizens VALUES (?, ?, ?, ?, ?, 'pre_registered', 1, ?, ?, ?, ?)").bind(citizen.id,hash,masked,values[p.name],values[p.birth],p.address>=0?values[p.address]:null,p.district>=0?values[p.district]:null,timestamp,timestamp).run();}
      await db.prepare("UPDATE activation_codes SET status='revoked' WHERE citizen_id=? AND status='active'").bind(citizen.id).run();await db.prepare("INSERT INTO activation_codes VALUES (?, ?, ?, 'active', ?, ?)").bind(crypto.randomUUID(),citizen.id,await sha256(String(values[p.code]).toUpperCase()),new Date(Date.now()+180*86400000).toISOString(),timestamp).run();imported+=1;}
    await audit(actor,"import","citizens",undefined,`${imported} cidadãos`);return json({ok:true,message:`${imported} cidadão(ãos) importado(s) com código de ativação.`});
  }

  if (action === "updateSlot") {
    const slotId = String(body.slotId ?? ""); const capacity = Math.max(1, Number(body.capacity ?? 1));
    if (!Number.isInteger(capacity) || capacity > 500) return failure("Informe uma capacidade inteira entre 1 e 500.");
    const result = await db.prepare("UPDATE schedule_slots SET capacity=? WHERE id=? AND reserved_count<=?").bind(capacity, slotId, capacity).run();
    if (!result.meta.changes) return failure("A capacidade não pode ser menor que o número já agendado.");
    await audit(actor, "update_capacity", "schedule_slot", slotId, String(capacity));
    return json({ ok: true, message: "Capacidade do horário atualizada." });
  }

  if (action === "addSchedule") {
    const specialtyId = String(body.specialtyId ?? ""); const parsedStart = new Date(String(body.startsAt ?? "")); const locationId=String(body.locationId??"");
    if(Number.isNaN(parsedStart.getTime())||parsedStart.getTime()<=Date.now())return failure("Informe uma data futura válida.");
    const startsAt=parsedStart.toISOString(); const capacity=Number(body.capacity??20); if(!Number.isInteger(capacity)||capacity<1||capacity>500)return failure("A capacidade deve ser um número inteiro entre 1 e 500.");
    const location=await first<{name:string;address:string}>("SELECT name, address FROM health_locations WHERE id=? AND active=1",locationId);
    if(!location)return failure("Selecione um local cadastrado e ativo.");
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO specialty_schedules (id, specialty_id, location, starts_at, status, capacity, location_id) VALUES (?, ?, ?, ?, 'confirmed', ?, ?)").bind(id, specialtyId, location.name, startsAt, capacity, locationId).run();
    const specialty = await first<{ name: string }>("SELECT name FROM specialties WHERE id=?", specialtyId);
    const interested = await all<{ citizen_id: string }>("SELECT citizen_id FROM specialty_interests WHERE specialty_id=? AND status='active'", specialtyId);
    const when=new Date(startsAt).toLocaleString("pt-BR",{dateStyle:"full",timeStyle:"short",timeZone:"America/Sao_Paulo"});
    for (const interest of interested) {
      await db.prepare("INSERT INTO notifications VALUES (?, ?, 'Consulta disponível para confirmação', ?, NULL, ?)").bind(crypto.randomUUID(), interest.citizen_id, `${specialty?.name ?? "Especialidade"} em ${when}, no local ${location.name} — ${location.address}. Abra o portal para confirmar sua presença.`, now()).run();
      await sendPushToCitizen(interest.citizen_id, { title: "Consulta disponível", body: "Uma agenda de especialista está disponível para sua confirmação.", url: "/cidadao", tag: `schedule-${id}` });
    }
    await db.prepare("UPDATE specialty_interests SET status='notified', schedule_id=? WHERE specialty_id=? AND status='active'").bind(id,specialtyId).run();
    await audit(actor, "create", "specialty_schedule", id);
    return json({ ok: true, message: `Agenda criada e ${interested.length} cidadão(ãos) avisado(s).` });
  }

  if (action === "updateScheduleStatus") {
    const scheduleId=String(body.scheduleId??""); const status=String(body.status??"");
    if(!["planned","confirmed","cancelled","completed"].includes(status))return failure("Situação inválida.");
    const schedule=await first<{specialty_name:string;starts_at:string;location:string;status:string}>(`SELECT e.name AS specialty_name,a.starts_at,COALESCE(l.name,a.location) AS location,a.status FROM specialty_schedules a JOIN specialties e ON e.id=a.specialty_id LEFT JOIN health_locations l ON l.id=a.location_id WHERE a.id=?`,scheduleId);
    if(!schedule)return failure("Agenda não encontrada.");
    const transitions:Record<string,string[]>={planned:["confirmed","cancelled"],confirmed:["cancelled","completed"],cancelled:[],completed:[]};
    if(status!==schedule.status&&!transitions[schedule.status]?.includes(status))return failure("Esta mudança de situação não é permitida.",409);
    await db.prepare("UPDATE specialty_schedules SET status=? WHERE id=?").bind(status,scheduleId).run();
    const linked=await all<{citizen_id:string}>("SELECT citizen_id FROM specialty_interests WHERE schedule_id=?",scheduleId);
    const statusText:{[key:string]:string}={planned:"passou para prevista",confirmed:"foi confirmada",cancelled:"foi cancelada",completed:"foi concluída"};
    for(const item of linked){
      await db.prepare("INSERT INTO notifications VALUES (?, ?, 'Atualização da consulta', ?, NULL, ?)").bind(crypto.randomUUID(),item.citizen_id,`${schedule.specialty_name} em ${new Date(schedule.starts_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"})}, ${schedule.location}: ${statusText[status]}.`,now()).run();
      await sendPushToCitizen(item.citizen_id,{title:"Consulta atualizada",body:"Houve uma atualização em sua agenda de saúde. Abra o portal para conferir.",url:"/cidadao",tag:`schedule-${scheduleId}`});
    }
    if(status==="cancelled")await db.prepare("UPDATE specialty_interests SET status='active', schedule_id=NULL WHERE schedule_id=?").bind(scheduleId).run();
    if(status==="completed")await db.prepare("UPDATE specialty_interests SET status='completed' WHERE schedule_id=?").bind(scheduleId).run();
    await audit(actor,"update_status","specialty_schedule",scheduleId,status); return json({ok:true,message:`Situação atualizada e ${linked.length} cidadão(ãos) avisado(s).`});
  }

  if (action === "addLocation") {
    const name=String(body.name??"").trim(); const address=String(body.address??"").trim(); const district=String(body.district??"").trim(); if(!name||!address||!district)return failure("Informe nome, endereço e bairro/distrito.");
    const id=crypto.randomUUID();const timestamp=now();await db.prepare("INSERT INTO health_locations VALUES (?, ?, ?, ?, ?, 1, ?, ?)").bind(id,name,address,district,String(body.reference??"").trim()||null,timestamp,timestamp).run();await audit(actor,"create","health_location",id);return json({ok:true,message:"Local cadastrado e disponível nas agendas."});
  }

  if (action === "toggleLocation") {
    const locationId=String(body.locationId??"");const active=body.active?1:0;await db.prepare("UPDATE health_locations SET active=?, updated_at=? WHERE id=?").bind(active,now(),locationId).run();await audit(actor,active?"activate":"deactivate","health_location",locationId);return json({ok:true,message:active?"Local reativado.":"Local inativado para novas agendas."});
  }

  if (action === "privacyStatus") {
    const privacyId=String(body.privacyId??""); const status=String(body.status??"");
    if(!["in_review","answered","closed"].includes(status))return failure("Situação de privacidade inválida.");
    const result=await db.prepare("UPDATE privacy_requests SET status=?, updated_at=? WHERE id=? AND status!='closed'").bind(status,now(),privacyId).run();
    if(!result.meta.changes)return failure("Solicitação não encontrada ou já encerrada.",404);
    await audit(actor,"update_status","privacy_request",privacyId,status);return json({ok:true,message:"Solicitação de privacidade atualizada."});
  }

  if (action === "replyMessage") {
    const citizenId = String(body.citizenId ?? ""); const message = String(body.message ?? "").trim().slice(0, 1000);
    if (!message) return failure("Escreva uma resposta.");
    await db.batch([
      db.prepare("INSERT INTO messages VALUES (?, ?, 'pharmacy', ?, NULL, ?)").bind(crypto.randomUUID(), citizenId, message, now()),
      db.prepare("UPDATE messages SET read_at=? WHERE citizen_id=? AND sender='citizen' AND read_at IS NULL").bind(now(), citizenId),
      db.prepare("INSERT INTO notifications VALUES (?, ?, 'Nova mensagem da farmácia', ?, NULL, ?)").bind(crypto.randomUUID(), citizenId, message.slice(0, 120), now()),
    ]);
    await sendPushToCitizen(citizenId, { title: "Nova mensagem", body: "Você recebeu uma nova mensagem da farmácia.", url: "/cidadao", tag: "pharmacy-message" });
    return json({ ok: true, message: "Resposta enviada." });
  }

  if (action === "createAdmin") {
    if ((await first<{ role: string }>("SELECT role FROM admin_users WHERE id=?", actor))?.role !== "superadmin") return failure("Apenas o administrador geral pode criar acessos.", 403);
    const name=String(body.name??"").trim();const login=String(body.login??"").trim().toLowerCase();const password=String(body.password??"");const role=String(body.role??"operator");
    if(!name||!/^\S+@\S+\.\S+$/.test(login)||password.length<10||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||!["operator","manager","superadmin"].includes(role))return failure("Informe dados válidos e uma senha com 10 caracteres, maiúscula, minúscula e número.");
    const id = crypto.randomUUID(); const timestamp = now();
    await db.prepare("INSERT INTO admin_users VALUES (?, ?, ?, ?, ?, 1, ?, ?)").bind(id, name, login, await passwordHash(password), role, timestamp, timestamp).run();
    await audit(actor, "create", "admin_user", id);
    return json({ ok: true, message: "Usuário administrativo criado." });
  }

  return failure("Ação não encontrada.", 404);
}
