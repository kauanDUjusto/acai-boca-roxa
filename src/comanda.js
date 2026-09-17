/* ============================================================
  GERAÇÃO DA COMANDA IMPRESSA (80mm) — Açaí Boca Roxa
  Módulo puro/determinístico: só monta o HTML da comanda.
  Nenhuma lógica de pedido, carrinho, checkout, preço ou banco
  é alterada aqui — apenas a apresentação da comanda.
  ============================================================ */

const LAYER_LABELS = ["1ª camada", "2ª camada", "3ª camada"];
const MONTAGEM_LAYER_ORDER = [2, 1, 0];
const CUP_CATEGORIES = ["acai", "cupuacu", "casadinho"];
const CATEGORY_LABEL = {
  acai: "Açaí",
  cupuacu: "Cupuaçu",
  casadinho: "Casadinho",
  tigela: "Tigela",
  barca: "Barca",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatBRL(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function categoryLabel(category) {
  return CATEGORY_LABEL[category] || String(category || "");
}

export function itemSizeText(category, size) {
  if (category === "barca") {
    return size === "grande" ? "Grande" : size === "pequena" ? "Pequena" : String(size || "");
  }
  if (size === undefined || size === null || size === "") return "";
  return `${size} ml`;
}

export function itemTitle(item) {
  return `${item.qty}x ${categoryLabel(item.category)}`.toUpperCase();
}

function ingredientDisplayList(item) {
  const limit = item.calculation?.rule?.ingredientLimit;
  return (item.ingredients || []).map((ing, index) =>
    typeof limit === "number" && index >= limit ? `Ingrediente extra: ${ing.name}` : ing.name
  );
}

function fruitDisplayList(item) {
  const limit = item.calculation?.rule?.fruitLimit;
  return (item.fruits || []).map((fruit, index) =>
    typeof limit === "number" && index >= limit ? `Fruta extra: ${fruit.name}` : fruit.name
  );
}

function isCupCategory(category) {
  return CUP_CATEGORIES.includes(category);
}

function bulletList(labels) {
  return labels.map((label) => `<div class="bullet">• ${escapeHtml(label)}</div>`).join("");
}

/* Cobertura / ausência de cobertura — informação crítica de montagem.
   A cobertura é armazenada no campo `topping` de cada item.
   - Com cobertura: `topping = { id, name, ... }`
   - Sem cobertura: `topping = null` (ou ausente), ou ainda um objeto/string
     com nome equivalente a "Sem cobertura" (defensivo para dados legados). */
const SEM_COBERTURA_NAMES = new Set([
  "sem cobertura",
  "sem topping",
  "sem",
  "nenhuma",
  "nenhum",
  "não quer cobertura",
  "nao quer cobertura",
  "não quer",
  "nao quer",
  "no topping",
  "without topping",
  "none",
  "n/a",
]);

export function coberturaName(item) {
  const topping = item?.topping;
  const name =
    typeof topping === "string"
      ? topping
      : topping && typeof topping === "object" && typeof topping.name === "string"
        ? topping.name
        : "";
  const trimmed = name.trim();
  if (!trimmed) return null;
  const key = trimmed
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (SEM_COBERTURA_NAMES.has(key) || SEM_COBERTURA_NAMES.has(trimmed.toLowerCase())) {
    return null;
  }
  return trimmed;
}

export function coberturaHtml(item) {
  const name = coberturaName(item);
  if (name) {
    return `<div class="cobertura">COBERTURA: ${escapeHtml(name.toUpperCase())}</div>`;
  }
  return `<div class="no-cobertura">🚫 SEM COBERTURA</div>`;
}

/* Montagem do copo 700ml (camadas) */
function layersHtml(item) {
  let html = `<div class="sec-label">MONTAGEM EM CAMADAS:</div>`;
  MONTAGEM_LAYER_ORDER.forEach((i) => {
    const layer = item.layers[i];
    const ingredients =
      layer && Array.isArray(layer.ingredients) && layer.ingredients.length
        ? layer.ingredients
        : [];
    html += `<div class="layer-label">${LAYER_LABELS[i]}:</div>`;
    html += ingredients.length
      ? bulletList(ingredients.map((ing) => ing.name))
      : `<div class="bullet">• —</div>`;
  });
  if (item.extras && item.extras.length) {
    html += `<div class="sec-label">COPO 100 ML — INGREDIENTES EXTRAS:</div>`;
    html += bulletList(item.extras.map((extra) => extra.name));
  }
  if (item.fruits && item.fruits.length) {
    html += `<div class="sec-label">COPO 100 ML — FRUTAS:</div>`;
    html += bulletList(fruitDisplayList(item).map((label) => `${label} (copinho)`));
  }
  return html;
}

/* Lista de adicionais (ingredientes + frutas) exibida na comanda */
export function adicionaisLabels(item) {
  const bullets = [];
  ingredientDisplayList(item).forEach((label) => bullets.push(label));
  fruitDisplayList(item).forEach((label) => {
    bullets.push(isCupCategory(item.category) ? `${label} (copinho)` : label);
  });
  return bullets;
}

/* Adicionais de produtos sem camadas */
function simpleAdicionaisHtml(item) {
  const bullets = adicionaisLabels(item);

  let html = "";
  if (bullets.length) {
    html += `<div class="adicionais"><div class="adicionais-label">ADICIONAIS</div>${bulletList(bullets)}</div>`;
  }
  if (item.extras && item.extras.length) {
    html += `<div class="sec-label">COPO 100 ML — INGREDIENTES EXTRAS:</div>`;
    html += bulletList(item.extras.map((extra) => extra.name));
  }
  return html;
}

function priceNotesHtml(item) {
  let html = "";
  if (item.calculation?.ingredientExcessPrice > 0) {
    html += `<div class="price-note">Ingrediente(s) extra(s): ${formatBRL(item.calculation.ingredientExcessPrice)}</div>`;
  }
  if (item.calculation?.fruitExcessPrice > 0) {
    html += `<div class="price-note">Fruta(s) extra(s): ${formatBRL(item.calculation.fruitExcessPrice)}</div>`;
  }
  return html;
}

/* Bloco de um item da comanda */
export function buildItemHtml(item) {
  const qty = Number(item.qty) || 1;
  const totalPrice = Number(
    (item.finalPrice ?? item.calculation?.total ?? 0) * qty || 0
  );
  const size = itemSizeText(item.category, item.size);
  return `
        <div class="item">
          <div class="item-head">
            <span class="qty">${qty}x</span>
            <span class="product-name">${escapeHtml(categoryLabel(item.category))}</span>
          </div>
          ${size ? `<div class="item-size">${escapeHtml(size)}</div>` : ""}
          ${coberturaHtml(item)}
          ${item.layers?.length === 3 ? layersHtml(item) : simpleAdicionaisHtml(item)}
          ${priceNotesHtml(item)}
          <div class="price">Preço: ${formatBRL(totalPrice)}</div>
        </div>`;
}

/* ============================================================
  Tipo/Origem do pedido (mesma regra já usada no site)
  ============================================================ */
export function orderSource(order) {
  const source = String(
    order?.orderSource || (order?.deliveryRegion === "Balcão" ? "balcão" : "") || ""
  ).toLowerCase();
  if (!source && order?.customer?.address) {
    const addr = String(order.customer.address).toLowerCase();
    if (addr.includes("comer no local") || addr.includes("para levar") || addr === "delivery" || addr === "balcão") {
      return "balcão";
    }
    if (addr.includes("retirada")) return "retirada";
  }
  return source || "delivery";
}

export function orderTypeLabel(order) {
  const source = orderSource(order);
  if (source === "balcão" || source === "balcao") {
    const addr = String(order?.customer?.address || "").toLowerCase();
    if (addr === "delivery" || addr.includes("delivery")) return "Delivery";
    return "Pedido no balcão";
  }
  if (source === "retirada") return "Retirada";
  return "Delivery";
}

/* Classificação de fluxo dos pedidos — usada pelo painel para separar
   o fluxo de balcão (comer no local / para viagem) do fluxo de delivery.
   Reutiliza apenas campos já existentes no pedido. */
export function isBalcaoOrder(order) {
  const source = String(order?.orderSource || "").toLowerCase();
  const region = String(order?.deliveryRegion || "").toLowerCase();
  const address = String(order?.customer?.address || "").toLowerCase();
  if (source === "balcão" || source === "balcao" || region === "balcão" || region === "balcao") return true;
  return address === "comer no local" || address === "para levar" || address === "para viagem";
}

export function isLocalTakeawayOrder(order) {
  if (!isBalcaoOrder(order)) return false;
  const address = String(order?.customer?.address || "").toLowerCase();
  return address === "comer no local" || address === "para levar" || address === "para viagem";
}

function metaHtml(order) {
  const customer = order.customer || {};
  const rows = [];

  rows.push(`<div>Tipo: ${escapeHtml(orderTypeLabel(order))}</div>`);
  rows.push(`<div>Cliente: ${escapeHtml(customer.name || "Não informado")}</div>`);
  rows.push(`<div>Telefone: ${escapeHtml(customer.phone || "Não informado")}</div>`);
  if (customer.address) rows.push(`<div>Endereço: ${escapeHtml(customer.address)}</div>`);
  if (order.deliveryRegion) rows.push(`<div>Região: ${escapeHtml(order.deliveryRegion)}</div>`);
  if (order.deliveryFee !== undefined && order.deliveryFee !== null) {
    rows.push(`<div>Taxa de entrega: ${formatBRL(order.deliveryFee)}</div>`);
  }
  rows.push(`<div>Pagamento: ${escapeHtml(order.paymentMethod || "Não informado")}</div>`);

  return `<div class="meta section">${rows.join("")}</div>`;
}

function observationHtml(order) {
  const note = String(order.customer?.note || "").trim();
  if (!note) return "";
  return `
        <div class="obs">
          <div class="obs-label">📝 OBSERVAÇÃO DO PEDIDO</div>
          <div class="obs-text">${escapeHtml(note)}</div>
        </div>`;
}

function totalsHtml(order) {
  const deliveryFee = Number(order.deliveryFee ?? 0) || 0;
  return `
        <div class="section totals">
          <div class="row"><span>Subtotal</span><span>${formatBRL(order.subtotal ?? 0)}</span></div>
          <div class="row"><span>Taxa de entrega</span><span>${formatBRL(deliveryFee)}</span></div>
          <div class="row total"><span>TOTAL</span><span>${formatBRL(order.total ?? 0)}</span></div>
        </div>`;
}

/* Comanda completa (documento HTML isolado para a janela de impressão) */
export function buildComandaHtml(order) {
  const dateText = order.createdAt
    ? new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "Não informada";

  const itemsHtml = (order.items || []).map(buildItemHtml).join("\n");

  return `<!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Pedido ${escapeHtml(order.id)}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 80mm;
            background: #fff;
          }

          body {
            font-family: "Courier New", monospace;
            font-size: 10pt;
            line-height: 1.28;
            color: #000;
            overflow-wrap: break-word;
          }

          .receipt {
            width: 80mm;
            padding: 3mm 3.5mm;
          }

          .roboto {
            font-family: Arial, "Helvetica Neue", sans-serif;
          }

          .brand {
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 15pt;
            font-weight: bold;
            text-align: center;
          }

          .order-code {
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 12pt;
            font-weight: bold;
            text-align: center;
            margin-top: 1.5mm;
          }

          .order-date {
            font-size: 8.5pt;
            text-align: center;
            margin-top: 0.5mm;
          }

          .section {
            border-top: 1px dashed #000;
            margin-top: 2.5mm;
            padding-top: 2.5mm;
          }

          .meta {
            font-size: 9pt;
          }

          .meta div {
            margin: 0.4mm 0;
          }

          .products-title {
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 11pt;
            font-weight: bold;
            text-align: center;
          }

          .item {
            border: 1px solid #000;
            padding: 2mm 2mm;
            margin-top: 3mm;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .item-head {
            display: flex;
            align-items: center;
            gap: 2mm;
          }

          .qty {
            background: #000;
            color: #fff;
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 12pt;
            font-weight: bold;
            line-height: 1.15;
            padding: 0.8mm 2mm;
          }

          .product-name {
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .item-size {
            font-size: 11pt;
            font-weight: bold;
            margin-top: 1mm;
            text-transform: uppercase;
          }

          .cobertura {
            background: #000;
            color: #fff;
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            letter-spacing: 0.5px;
            padding: 1.3mm;
            margin: 1.8mm 0 1.2mm;
          }

          .no-cobertura {
            background: #000;
            color: #fff;
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 13pt;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            letter-spacing: 1px;
            padding: 1.8mm;
            margin: 1.8mm 0 1.2mm;
          }

          .adicionais {
            border: 1px solid #000;
            margin-top: 1.8mm;
            padding: 1.2mm 1.5mm 1.4mm;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .adicionais-label {
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 10.5pt;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            letter-spacing: 1px;
            border-bottom: 1px solid #000;
            padding-bottom: 0.5mm;
            margin-bottom: 0.8mm;
          }

          .adicionais .bullet {
            font-weight: bold;
            font-size: 10pt;
          }

          .sec-label {
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-weight: bold;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #000;
            padding-bottom: 0.3mm;
            margin-top: 1.8mm;
          }

          .layer-label {
            font-weight: bold;
            margin-top: 1mm;
          }

          .bullet {
            font-weight: bold;
            text-transform: uppercase;
            padding-left: 4mm;
            text-indent: -4mm;
            margin-top: 0.3mm;
          }

          .price-note {
            font-size: 8.5pt;
            margin-top: 0.6mm;
          }

          .price {
            font-size: 8.5pt;
            text-align: right;
            margin-top: 1mm;
          }

          .obs {
            border: 2px solid #000;
            margin-top: 3mm;
            font-size: 10pt;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .obs .obs-label {
            background: #000;
            color: #fff;
            text-align: center;
            font-family: Arial, "Helvetica Neue", sans-serif;
            font-size: 10.5pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 1mm;
          }

          .obs .obs-text {
            font-size: 10.5pt;
            font-weight: bold;
            padding: 1.5mm 2mm;
          }

          .totals {
            font-size: 9.5pt;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 3mm;
          }

          .total {
            font-size: 12.5pt;
            font-weight: bold;
            margin-top: 1.5mm;
            border-top: 2px solid #000;
            padding-top: 1mm;
          }

          .footer-note {
            font-size: 8.5pt;
            text-align: center;
            margin-top: 2.5mm;
          }
        </style>
      </head>
      <body>
        <div class="receipt">

          <div class="brand">Açaí Boca Roxa</div>
          <div class="order-code roboto">PEDIDO #${escapeHtml(order.id)}</div>
          <div class="order-date">Data: ${escapeHtml(dateText)}</div>

          ${metaHtml(order)}

          <div class="section">
            <div class="products-title">PRODUTOS</div>
            ${itemsHtml}
          </div>

          ${observationHtml(order)}

          ${totalsHtml(order)}

          <div class="footer-note">Confira a montagem antes de liberar o pedido.</div>

        </div>

        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>`;
}