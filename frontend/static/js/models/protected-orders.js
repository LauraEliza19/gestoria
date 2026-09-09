import { apiFetch } from "./api.js";

const PENDING_KEY = "gestoria_pending_order_operation";
const RECEIPT_KEY = "gestoria_last_order_receipt";
const money = value => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function pending() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null"); }
  catch { return null; }
}

function remember(value) {
  if (value) sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(PENDING_KEY);
}

export async function downloadLastOrderReceipt() {
  const id = sessionStorage.getItem(RECEIPT_KEY);
  if (!id) throw new Error("Crie um pedido para obter o comprovante nesta sessão.");
  const receipt = await apiFetch(`/api/orders/proposals/${id}/receipt`);
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `gestoria-comprovante-${id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function createProtectedOrder(payload) {
  let saved = pending();
  let proposal;
  if (saved?.operation_id) {
    try {
      proposal = await apiFetch(`/api/orders/proposals/${saved.operation_id}`);
      proposal.recovered = true;
      if (proposal.status === "cancelled") { proposal = null; saved = null; remember(null); }
    } catch (error) {
      if (error.status !== 404) throw error;
      saved = null;
      remember(null);
    }
  }
  if (!proposal) {
    // Retry a lost preparation response with the same key and exact request.
    const serialized = JSON.stringify(payload);
    if (!saved || saved.request !== serialized) {
      saved = { key: crypto.randomUUID(), request: serialized };
      remember(saved);
    }
    proposal = await apiFetch("/api/orders/proposals", {
      method: "POST", headers: { "Idempotency-Key": saved.key }, body: serialized,
    });
    remember({ ...saved, operation_id: proposal.operation_id });
  }
  return review(proposal);
}

function review(proposal) {
  const envelope = proposal.envelope;
  const plan = envelope.payload;
  const dialog = document.createElement("dialog");
  dialog.className = "protected-order-dialog";
  dialog.setAttribute("aria-labelledby", "protectedOrderTitle");
  dialog.innerHTML = `
    <h2 id="protectedOrderTitle">Revisar pedido</h2>
    <p class="protected-order-note"></p>
    <p><strong>Cliente: </strong><span data-customer></span></p>
    <div class="protected-order-table-wrap"><table>
      <thead><tr><th>Produto</th><th>Quantidade</th><th>Preço unitário</th></tr></thead>
      <tbody></tbody>
    </table></div>
    <p class="protected-order-total">Total confirmado pelo servidor <strong data-total></strong></p>
    <p data-expiration></p>
    <p class="protected-order-error" role="alert" hidden></p>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" data-discard>Descartar revisão</button>
      <button type="button" class="btn-primary btn-inline" data-confirm>Confirmar pedido</button>
    </div>`;
  dialog.querySelector(".protected-order-note").textContent = proposal.status === "executed"
    ? "Este pedido já foi registrado. Recupere o resultado sem criar outro pedido."
    : proposal.recovered
      ? "Retomamos a revisão pendente. Confira os dados antes de continuar. O estoque será atualizado ao confirmar."
      : "Revise os dados desta proposta. O estoque será atualizado ao confirmar.";
  dialog.querySelector("[data-customer]").textContent = plan.customer_name;
  for (const item of plan.items) {
    const row = document.createElement("tr");
    for (const text of [item.product_name, `${Number(item.quantity).toLocaleString("pt-BR")} ${item.unit_of_measure === "unit" ? "un." : item.unit_of_measure}`, money(item.unit_price)]) {
      const cell = document.createElement("td"); cell.textContent = text; row.appendChild(cell);
    }
    dialog.querySelector("tbody").appendChild(row);
  }
  dialog.querySelector("[data-total]").textContent = money(plan.total_amount);
  dialog.querySelector("[data-expiration]").textContent = `Válida até ${new Date(envelope.expires_at).toLocaleTimeString("pt-BR")}.`;
  const confirm = dialog.querySelector("[data-confirm]");
  const discard = dialog.querySelector("[data-discard]");
  const errorBox = dialog.querySelector(".protected-order-error");
  if (proposal.status === "executed") { confirm.textContent = "Recuperar pedido"; discard.hidden = true; }
  document.body.appendChild(dialog);
  let busy = false;
  const setBusy = value => { busy = value; confirm.disabled = value; discard.disabled = value; };
  const showError = error => { errorBox.textContent = error.message; errorBox.hidden = false; };
  return new Promise(resolve => {
    function finish(value) { dialog.close(); dialog.remove(); resolve(value); }
    // Escape preserves the operation for recovery; it never claims cancellation.
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      if (!busy) finish(null);
    });
    discard.addEventListener("click", async () => {
      setBusy(true);
      try {
        await apiFetch(`/api/orders/proposals/${proposal.operation_id}/cancel`, { method: "POST" });
        remember(null); finish(null);
      } catch (error) { showError(error); }
      finally { setBusy(false); }
    });
    confirm.addEventListener("click", async () => {
      setBusy(true); errorBox.hidden = true;
      try {
        // Return the original server envelope verbatim; never reconstruct it from DOM.
        const order = await apiFetch(`/api/orders/proposals/${proposal.operation_id}/confirm`, {
          method: "POST", body: JSON.stringify({ envelope }),
        });
        sessionStorage.setItem(RECEIPT_KEY, proposal.operation_id);
        remember(null);
        finish(order);
      } catch (error) {
        showError(error);
        // Network errors keep this same proposal for retry and page-reload recovery.
      } finally { setBusy(false); }
    });
    dialog.showModal();
    confirm.focus();
  });
}
