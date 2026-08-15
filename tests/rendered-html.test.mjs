import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("portal público expõe identidade e transparência legal", async () => {
  const [page, component, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /PublicPortal/);
  assert.match(component, /Lei nº 14\.654\/2023/);
  assert.match(component, /Consulta pública/);
  assert.match(layout, /lang="pt-BR"/);
  assert.doesNotMatch(page + component + layout, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("MVP contém as três superfícies e o núcleo de regras", async () => {
  const [citizen, admin, api] = await Promise.all([
    readFile(new URL("../app/components/CitizenPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/portal/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(citizen, /Receber em casa/);
  assert.match(citizen, /Tenho interesse nesta consulta/);
  assert.match(admin, /Importar XML de entrada/);
  assert.match(admin, /Demanda por especialidade/);
  assert.match(admin, /Locais de atendimento/);
  assert.match(admin, /updateScheduleStatus/);
  assert.match(api, /24 \* 3600000/);
  assert.match(api, /first_pickup_required/);
  assert.match(api, /reserved_lot_id/);
  assert.match(api, /Somente solicitações recebidas podem ser aprovadas/);
  assert.match(api, /motivo da não aprovação/);
  assert.match(api, /login_attempts/);
  assert.match(api, /privacyRequest/);
  await access(new URL("../dist/server/index.js", import.meta.url));
});

test("revisão de compliance cobre segurança, privacidade e comunicação clara", async () => {
  const [runtime, citizen, admin, publicPortal, packageJson] = await Promise.all([
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CitizenPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AdminPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicPortal.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(runtime, /trg_request_slot_guard/);
  assert.match(citizen, /Isso não é agendamento nem encaminhamento médico|Registrar interesse não é encaminhamento/);
  assert.match(citizen, /Privacidade e seus dados/);
  assert.match(admin, /Trilha de auditoria/);
  assert.match(admin, /Solicitações de privacidade/);
  assert.match(publicPortal, /apoia o atendimento à Lei nº 14\.654\/2023/);
  assert.match(publicPortal, /O saldo pode mudar durante a análise/);
  assert.match(packageJson, /"next": "\^?16\.3\.1"/);
});

test("Web Push cobre adesão, privacidade e eventos essenciais", async () => {
  const [api, push, card, worker, runtime] = await Promise.all([
    readFile(new URL("../app/api/portal/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/push.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PushNotificationsCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../db/runtime.ts", import.meta.url), "utf8"),
  ]);
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS push_subscriptions/);
  assert.match(api, /subscribePush/);
  assert.match(api, /unsubscribePush/);
  assert.match(api, /Medicamento disponível/);
  assert.match(api, /Consulta disponível/);
  assert.match(api, /Nova mensagem/);
  assert.match(push, /buildPushPayload/);
  assert.match(push, /status === 404 \|\| status === 410/);
  assert.match(card, /Notification\.requestPermission/);
  assert.match(card, /Na tela bloqueada mostramos apenas um texto discreto/);
  assert.match(worker, /addEventListener\("push"/);
  assert.match(worker, /notificationclick/);
});
