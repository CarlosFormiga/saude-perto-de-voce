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
  await access(new URL("../dist/server/index.js", import.meta.url));
});
