import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import { env } from "cloudflare:workers";
import { getD1 } from "./runtime";

type PushBindings = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
};

export type CitizenPush = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function bindings() {
  return env as unknown as PushBindings;
}

export function pushConfiguration() {
  const values = bindings();
  return {
    configured: Boolean(values.VAPID_PUBLIC_KEY && values.VAPID_PRIVATE_KEY && values.VAPID_SUBJECT),
    publicKey: values.VAPID_PUBLIC_KEY ?? null,
  };
}

export async function sendPushToCitizen(citizenId: string, notification: CitizenPush) {
  const values = bindings();
  if (!values.VAPID_PUBLIC_KEY || !values.VAPID_PRIVATE_KEY || !values.VAPID_SUBJECT) return { sent: 0, unavailable: true };

  const result = await getD1().prepare(`SELECT id, endpoint, p256dh, auth, failure_count
    FROM push_subscriptions WHERE citizen_id=? AND active=1`).bind(citizenId).all<StoredSubscription>();
  const subscriptions = result.results ?? [];
  let sent = 0;

  await Promise.allSettled(subscriptions.map(async (stored) => {
    const subscription: PushSubscription = {
      endpoint: stored.endpoint,
      expirationTime: null,
      keys: { p256dh: stored.p256dh, auth: stored.auth },
    };
    try {
      const payload = await buildPushPayload({
        data: JSON.stringify({
          title: notification.title,
          body: notification.body,
          url: notification.url ?? "/cidadao",
          tag: notification.tag ?? "saude-municipal",
        }),
        options: { ttl: 86400, urgency: "high" },
      }, subscription, {
        subject: values.VAPID_SUBJECT,
        publicKey: values.VAPID_PUBLIC_KEY,
        privateKey: values.VAPID_PRIVATE_KEY,
      });
      const body = payload.body.buffer.slice(payload.body.byteOffset, payload.body.byteOffset + payload.body.byteLength) as ArrayBuffer;
      const response = await fetch(stored.endpoint, { ...payload, body });
      if (!response.ok) throw Object.assign(new Error(`Push recusado: ${response.status}`), { status: response.status });
      sent += 1;
      await getD1().prepare("UPDATE push_subscriptions SET failure_count=0, last_success_at=?, updated_at=? WHERE id=?")
        .bind(new Date().toISOString(), new Date().toISOString(), stored.id).run();
    } catch (error) {
      const status = Number((error as { status?: number }).status ?? 0);
      const deactivate = status === 404 || status === 410 || stored.failure_count + 1 >= 5;
      await getD1().prepare("UPDATE push_subscriptions SET active=?, failure_count=failure_count+1, updated_at=? WHERE id=?")
        .bind(deactivate ? 0 : 1, new Date().toISOString(), stored.id).run();
    }
  }));

  return { sent, unavailable: false };
}
