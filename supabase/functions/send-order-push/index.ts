// Supabase Edge Function: send-order-push
//
// Disparada por um Database Webhook (evento INSERT na tabela `site_orders`).
// Lê as inscrições salvas em `push_subscriptions` e envia a notificação
// Web Push para todos os dispositivos inscritos (painel administrativo).
//
// Segredos necessários (Supabase > Project Settings > Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET
// Variáveis fornecidas automaticamente pelo Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy: supabase functions deploy send-order-push --no-verify-jwt
// (Veja os comentários de configuração em supabase/push_subscriptions.sql.)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@acaibocaroxa.com";
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";

const TITLE = "Novo pedido no Açaí Boca Roxa";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== WEBHOOK_SECRET) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return jsonResponse({ error: "VAPID keys not configured" }, 500);
  }

  let payload: { type?: string; record?: { id?: string } };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const record = payload?.record;
  if (!record?.id) {
    return jsonResponse({ skipped: true, reason: "no record id" });
  }

  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (error) {
    console.error("Erro ao buscar inscrições:", error);
    return jsonResponse({ error: error.message }, 500);
  }

  const notification = JSON.stringify({
    title: TITLE,
    body: "Toque para abrir o painel.",
    url: "/painelbocaroxa",
    tag: `order-${record.id}`,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
  });

  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notification
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          removed += 1;
        } else {
          failed += 1;
          console.error("Falha ao enviar push:", statusCode, (err as Error)?.message);
        }
      }
    })
  );

  return jsonResponse({ sent, removed, failed });
});
