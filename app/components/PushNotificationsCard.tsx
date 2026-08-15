"use client";

import { useEffect, useState } from "react";

type PushState = "loading" | "unsupported" | "unconfigured" | "denied" | "disabled" | "enabled";

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PushNotificationsCard() {
  const [state, setState] = useState<PushState>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (active) setState("unsupported");
        return;
      }
      const response = await fetch("/api/portal?action=pushConfig");
      if (!response.ok) return;
      const config = await response.json() as { configured?: boolean; publicKey?: string | null };
      if (!config.configured || !config.publicKey) {
        if (active) setState("unconfigured");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!active) return;
      setPublicKey(config.publicKey);
      setState(Notification.permission === "denied" ? "denied" : subscription ? "enabled" : "disabled");
    }
    void inspect().catch(() => active && setState("unsupported"));
    return () => { active = false; };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true); setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        setMessage("A permissão não foi concedida. Você continua recebendo os avisos dentro do portal.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribePush", ...subscription.toJSON() }) });
      const result = await response.json() as { message?: string };
      if (!response.ok) { await subscription.unsubscribe(); throw new Error(result.message ?? "Não foi possível ativar os alertas."); }
      setState("enabled"); setMessage(result.message ?? "Alertas ativados neste aparelho.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível ativar os alertas."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsubscribePush", endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("disabled"); setMessage("Alertas desativados neste aparelho. Os avisos continuam disponíveis no portal.");
    } catch { setMessage("Não foi possível desativar agora. Tente novamente."); }
    finally { setBusy(false); }
  }

  if (state === "loading" || state === "unconfigured") return null;
  return <section className={`push-card ${state === "enabled" ? "push-card-enabled" : ""}`} aria-labelledby="push-title">
    <div className="push-icon" aria-hidden="true">●</div>
    <div className="push-copy">
      <div className="push-title-row"><h2 id="push-title">Alertas importantes no celular</h2>{state === "enabled" && <span className="status status-approved">Ativados</span>}</div>
      {state === "unsupported" ? <p>Este navegador não oferece alertas em segundo plano. Seus avisos continuam disponíveis na área Mensagens.</p> : state === "denied" ? <p>Os alertas estão bloqueados no navegador. Para ativá-los, abra as configurações deste site e permita notificações.</p> : <p>Receba avisos sobre solicitações, chegada de estoque, consultas e mensagens. Na tela bloqueada mostramos apenas um texto discreto; os detalhes ficam protegidos no portal.</p>}
      {message && <small role="status" className="push-message">{message}</small>}
    </div>
    {state === "disabled" && <button className="btn btn-primary" disabled={busy} onClick={enable}>{busy ? "Ativando..." : "Ativar alertas"}</button>}
    {state === "enabled" && <button className="btn btn-ghost btn-small" disabled={busy} onClick={disable}>{busy ? "Aguarde..." : "Desativar neste aparelho"}</button>}
  </section>;
}
