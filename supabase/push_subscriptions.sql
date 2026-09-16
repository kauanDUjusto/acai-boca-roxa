-- ============================================================================
-- Notificações push de novos pedidos — configuração no Supabase
-- ============================================================================
-- Este arquivo NÃO altera nenhuma tabela existente e NÃO apaga dados.
-- Ele apenas cria uma tabela NOVA (`push_subscriptions`) usada para guardar
-- os dispositivos do painel que aceitaram receber as notificações.
--
-- Rode este SQL no Supabase > SQL Editor (uma única vez).
-- ============================================================================

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Somente o painel autenticado (usuário admin logado) gerencia as inscrições.
-- A Edge Function usa a service role e ignora RLS.
drop policy if exists "push_subscriptions_select_auth" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_auth" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_auth" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_auth" on public.push_subscriptions;

create policy "push_subscriptions_select_auth"
  on public.push_subscriptions for select to authenticated using (true);

create policy "push_subscriptions_insert_auth"
  on public.push_subscriptions for insert to authenticated with check (true);

create policy "push_subscriptions_update_auth"
  on public.push_subscriptions for update to authenticated using (true) with check (true);

create policy "push_subscriptions_delete_auth"
  on public.push_subscriptions for delete to authenticated using (true);

-- ============================================================================
-- GATILHO (Database Webhook)
-- ============================================================================
-- Depois de publicar a Edge Function `send-order-push`, crie o webhook:
--
--   Supabase > Database > Webhooks > Create a new hook
--     Name:        new_order_push
--     Table:       public.site_orders
--     Events:      Insert
--     Type:        Supabase Edge Function
--     Function:    send-order-push
--     HTTP header: x-webhook-secret = <mesmo valor de PUSH_WEBHOOK_SECRET>
--
-- Assim, sempre que um pedido novo for inserido em `site_orders`
-- (site ou balcão), a função envia o push para os dispositivos inscritos.
-- ============================================================================
