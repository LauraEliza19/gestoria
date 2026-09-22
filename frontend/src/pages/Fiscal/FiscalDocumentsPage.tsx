import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../services/api";

type Item = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  unit_of_measure?: string;
};
type FiscalDocument = {
  id: string;
  document_type: "saida" | "entrada";
  number: string;
  series: string;
  model: string;
  participant_name: string;
  participant_document: string | null;
  issue_date: string;
  value: string;
  status: string;
  order_id: string | null;
  supplier_id: string | null;
  created_by_id: string | null;
  created_at: string;
  authorized_at: string | null;
  cancelled_at: string | null;
  authorization_protocol: string | null;
  cancellation_protocol: string | null;
  cancellation_reason: string | null;
  access_key: string | null;
  is_legacy: boolean;
  snapshot_source: string;
  reconciled_at: string | null;
  stock_received_at: string | null;
  items: Item[];
  allowed_statuses: string[];
  events: {
    id: string;
    action: string;
    actor_id: string;
    created_at: string;
    detail: Record<string, string | null>;
  }[];
};
type Order = {
  id: string;
  customer_name: string;
  status: string;
  total_amount: string;
  items: Item[];
};
type Product = { id: string; name: string; is_active: boolean };
type Supplier = {
  id: string;
  name: string;
  document: string;
  is_active: boolean;
};
const statuses = [
  "Autorizada",
  "Em processamento",
  "Cancelada",
  "Rejeitada",
  "Inutilizada",
  "Denegada",
];
const active = (status: string) =>
  ["Autorizada", "Em processamento"].includes(status);
const money = (value: string) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "Não registrado";
const emptyForm = () => ({
  document_type: "saida" as "saida" | "entrada",
  order_id: "",
  supplier_id: "",
  number: "",
  series: "1",
  model: "55",
  issue_date: new Date().toISOString().slice(0, 10),
  cfop: "",
  operation_nature: "",
  access_key: "",
});
const emptyItem = () => ({ product_id: "", quantity: "1", unit_price: "0.00" });
const actionNames: Record<string, string> = {
  created: "Registro criado",
  status_changed: "Situação atualizada",
  stock_received: "Estoque recebido",
  legacy_order_linked: "Pedido conciliado",
};

function Items({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={`${item.product_id}-${i}`}>
          {item.product_name} · {item.quantity} {item.unit_of_measure || ""} ×{" "}
          {money(item.unit_price)}
        </li>
      ))}
    </ul>
  );
}

export function FiscalDocumentsPage() {
  const [params] = useSearchParams();
  const orderFilter = params.get("order_id") || "";
  const fromProduction =
    params.get("from") === "production";
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState<"saida" | "entrada">("saida");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [draftItems, setDraftItems] = useState([emptyItem()]);
  const [supplierForm, setSupplierForm] = useState({ name: "", document: "" });
  const [selected, setSelected] = useState<FiscalDocument | null>(null);
  const [eventForm, setEventForm] = useState({
    status: "",
    occurred_at: "",
    protocol: "",
    reason: "",
  });
  const [linkForm, setLinkForm] = useState({ order_id: "", reason: "" });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch<FiscalDocument[]>("/api/fiscal-documents"),
      apiFetch<Order[]>("/api/orders"),
      apiFetch<Product[]>("/api/products"),
      apiFetch<Supplier[]>("/api/fiscal-suppliers"),
      apiFetch<{ role: string }>("/api/auth/me"),
    ])
      .then(([docs, orderList, productList, supplierList, user]) => {
        if (cancelled) return;
        setDocuments(docs);
        setOrders(orderList);
        setProducts(productList);
        setSuppliers(supplierList);
        setCanEdit(["owner", "admin"].includes(user.role));
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Falha ao carregar os dados.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const visible = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.document_type === type &&
          (!statusFilter || d.status === statusFilter) &&
          (!orderFilter || d.order_id === orderFilter) &&
          `${d.number} ${d.participant_name} ${d.access_key || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [documents, type, statusFilter, orderFilter, search],
  );
  const contextOrder = orders.find(
    (order) => order.id === orderFilter,
  );
  const chosenOrder = orders.find((o) => o.id === form.order_id);
  const isOccupied = (id: string) =>
    documents.some(
      (d) =>
        d.document_type === "saida" && d.order_id === id && active(d.status),
    );
  function selectDocument(document: FiscalDocument) {
    setSelected(document);
    setEventForm({ status: "", occurred_at: "", protocol: "", reason: "" });
    setLinkForm({ order_id: document.order_id || "", reason: "" });
  }
  function remember(document: FiscalDocument) {
    setDocuments((list) => [
      document,
      ...list.filter((d) => d.id !== document.id),
    ]);
    selectDocument(document);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível concluir a operação.",
      );
    } finally {
      setBusy(false);
    }
  }
  function start(orderId = orderFilter) {
    setForm({ ...emptyForm(), order_id: orderId });
    setDraftItems([emptyItem()]);
    setShowForm(true);
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const { order_id, supplier_id, ...metadata } = form;
      const payload = {
        ...metadata,
        cfop: form.cfop || null,
        operation_nature: form.operation_nature || null,
        access_key: form.access_key || null,
        ...(form.document_type === "saida"
          ? { order_id }
          : { supplier_id, items: draftItems }),
      };
      const saved = await apiFetch<FiscalDocument>("/api/fiscal-documents", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      remember(saved);
      setType(saved.document_type);
      setShowForm(false);
      setNotice(
        "Documento registrado. Nenhuma autorização externa ou movimentação adicional de estoque foi realizada.",
      );
    });
  }
  async function statusEvent(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await run(async () => {
      const payload = {
        status: eventForm.status,
        occurred_at: eventForm.occurred_at
          ? new Date(eventForm.occurred_at).toISOString()
          : null,
        protocol: eventForm.protocol || null,
        reason: eventForm.reason || null,
      };
      remember(
        await apiFetch<FiscalDocument>(`/api/fiscal-documents/${selected.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      );
      setNotice("Evento registrado no histórico fiscal.");
    });
  }
  const datedEvent = ["Autorizada", "Cancelada"].includes(eventForm.status);
  const needsProtocol =
    eventForm.status === "Autorizada" ||
    (eventForm.status === "Cancelada" && selected?.status === "Autorizada");
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">Fiscal</p>
          <h1>Notas fiscais</h1>
          <p>Pedidos, documentos e histórico da operação.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {orderFilter && (
            <Link
              className="secondary-button"
              to={`/pedidos?order_id=${orderFilter}${
                fromProduction
                  ? "&from=production"
                  : ""
              }`}
            >
              Voltar ao pedido
            </Link>
          )}

          {canEdit &&
            (!orderFilter || !isOccupied(orderFilter)) && (
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => start()}
              >
                {orderFilter
                  ? '+ Nota deste pedido'
                  : '+ Nova nota'}
              </button>
            )}
        </div>
      </header>
      <p className="info-note">
        Este módulo registra documentos e eventos informados pelo responsável. A
        emissão e a autorização fiscal dependem de um serviço externo.
      </p>
      {error && (
        <p role="alert" className="table-status">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="info-note">
          {notice}
        </p>
      )}
      <div className="metric-grid fiscal-summary">
        {[
          [
            "Saídas",
            documents.filter((d) => d.document_type === "saida").length,
          ],
          [
            "Entradas",
            documents.filter((d) => d.document_type === "entrada").length,
          ],
          [
            "Autorizadas",
            documents.filter((d) => d.status === "Autorizada").length,
          ],
          [
            "A conciliar",
            documents.filter((d) => d.snapshot_source === "legacy_unverified")
              .length,
          ],
        ].map(([label, count]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
            <small>Todos os registros da empresa</small>
          </article>
        ))}
      </div>
      {showForm && canEdit && (
        <section className="page-card space-y-4">
          <form className="fiscal-form space-y-4" onSubmit={create}>
            <h2>Novo registro fiscal</h2>
            <div className="fiscal-form-grid">
              <label>
                Tipo
                <select
                  value={form.document_type}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      document_type: e.target.value as "saida" | "entrada",
                    })
                  }
                >
                  <option value="saida">Saída — pedido de venda</option>
                  <option value="entrada">Entrada — fornecedor</option>
                </select>
              </label>
              {form.document_type === "saida" ? (
                <label>
                  Pedido obrigatório
                  <select
                    required
                    value={form.order_id}
                    onChange={(e) =>
                      setForm({ ...form, order_id: e.target.value })
                    }
                  >
                    <option value="">Selecione o pedido</option>
                    {orders
                      .filter((o) => o.status !== "cancelled")
                      .map((o) => (
                        <option
                          key={o.id}
                          value={o.id}
                          disabled={isOccupied(o.id)}
                        >
                          {o.id.slice(0, 8)} · {o.customer_name} ·{" "}
                          {money(o.total_amount)}
                          {isOccupied(o.id) ? " · já possui nota ativa" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label>
                  Fornecedor obrigatório
                  <select
                    required
                    value={form.supplier_id}
                    onChange={(e) =>
                      setForm({ ...form, supplier_id: e.target.value })
                    }
                  >
                    <option value="">Selecione o fornecedor</option>
                    {suppliers
                      .filter((s) => s.is_active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.document}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <label>
                Modelo
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                >
                  <option value="55">55 — NF-e</option>
                  <option value="65">65 — NFC-e</option>
                  <option value="NFS-e">NFS-e</option>
                </select>
              </label>
              {(
                [
                  "number",
                  "series",
                  "issue_date",
                  "cfop",
                  "operation_nature",
                  "access_key",
                ] as const
              ).map((field) => (
                <label key={field}>
                  {
                    {
                      number: "Número",
                      series: "Série",
                      issue_date: "Data de emissão informada",
                      cfop: "CFOP",
                      operation_nature: "Natureza da operação",
                      access_key: "Chave de acesso (44 dígitos)",
                    }[field]
                  }
                  <input
                    type={field === "issue_date" ? "date" : "text"}
                    value={form[field]}
                    required={["number", "series", "issue_date"].includes(
                      field,
                    )}
                    maxLength={
                      field === "access_key"
                        ? 44
                        : field === "number"
                          ? 30
                          : field === "series"
                            ? 20
                            : field === "cfop"
                              ? 10
                              : 160
                    }
                    pattern={field === "access_key" ? "[0-9]{44}" : undefined}
                    onChange={(e) =>
                      setForm({ ...form, [field]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            {form.document_type === "saida" && chosenOrder && (
              <div className="info-note">
                <p>
                  Destinatário: <strong>{chosenOrder.customer_name}</strong> ·
                  Total do pedido:{" "}
                  <strong>{money(chosenOrder.total_amount)}</strong>
                </p>
                <Items items={chosenOrder.items} />
                <p>
                  Os valores e itens serão conferidos e copiados do pedido pelo
                  servidor.
                </p>
              </div>
            )}
            {form.document_type === "entrada" && (
              <div className="space-y-3">
                <p>
                  Produtos recebidos — cadastrar a nota ainda não altera o
                  estoque.
                </p>
                {draftItems.map((item, index) => (
                  <div className="fiscal-form-grid" key={index}>
                    <label>
                      Produto
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) =>
                          setDraftItems((list) =>
                            list.map((row, i) =>
                              i === index
                                ? { ...row, product_id: e.target.value }
                                : row,
                            ),
                          )
                        }
                      >
                        <option value="">Selecione</option>
                        {products
                          .filter((p) => p.is_active)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    {(["quantity", "unit_price"] as const).map((field) => (
                      <label key={field}>
                        {field === "quantity" ? "Quantidade" : "Valor unitário"}
                        <input
                          required
                          type="number"
                          min={field === "quantity" ? "0.001" : "0"}
                          step={field === "quantity" ? "0.001" : "0.01"}
                          value={item[field]}
                          onChange={(e) =>
                            setDraftItems((list) =>
                              list.map((row, i) =>
                                i === index
                                  ? { ...row, [field]: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={draftItems.length === 1}
                      onClick={() =>
                        setDraftItems((list) =>
                          list.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remover item
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary-button"
                  disabled={draftItems.length >= 100}
                  onClick={() =>
                    setDraftItems((list) => [...list, emptyItem()])
                  }
                >
                  Adicionar produto
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <button className="primary-button" disabled={busy || loading}>
                Registrar documento
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowForm(false)}
              >
                Fechar formulário
              </button>
            </div>
          </form>
          {form.document_type === "entrada" && (
            <details>
              <summary>Cadastrar fornecedor</summary>
              <form
                className="fiscal-form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    const supplier = await apiFetch<Supplier>(
                      "/api/fiscal-suppliers",
                      { method: "POST", body: JSON.stringify(supplierForm) },
                    );
                    setSuppliers((list) => [...list, supplier]);
                    setForm((f) => ({ ...f, supplier_id: supplier.id }));
                    setSupplierForm({ name: "", document: "" });
                    setNotice("Fornecedor cadastrado.");
                  });
                }}
              >
                <label>
                  Nome
                  <input
                    required
                    maxLength={160}
                    value={supplierForm.name}
                    onChange={(e) =>
                      setSupplierForm({ ...supplierForm, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  CPF/CNPJ (somente números)
                  <input
                    required
                    pattern="[0-9]{11}|[0-9]{14}"
                    maxLength={14}
                    value={supplierForm.document}
                    onChange={(e) =>
                      setSupplierForm({
                        ...supplierForm,
                        document: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </label>
                <button className="secondary-button" disabled={busy}>
                  Salvar fornecedor
                </button>
              </form>
            </details>
          )}
        </section>
      )}
      <section className="page-card fiscal-panel">
        {orderFilter && (
          <div className="info-note flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">
                Documentos do pedido{' '}
                {orderFilter.slice(0, 8)}
              </p>

              {contextOrder && (
                <p className="mt-1 text-sm">
                  Cliente: {contextOrder.customer_name} · Total:{' '}
                  {money(contextOrder.total_amount)}
                </p>
              )}
            </div>

            <Link
              className="shrink-0 font-semibold"
              to="/notas-fiscais"
            >
              Ver todas as notas
            </Link>
          </div>
        )}
        <div className="fiscal-tabs">
          <button
            className={type === "saida" ? "active" : ""}
            onClick={() => setType("saida")}
          >
            Saídas
          </button>
          <button
            className={type === "entrada" ? "active" : ""}
            onClick={() => setType("entrada")}
          >
            Entradas
          </button>
        </div>
        <div className="fiscal-filters">
          <input
            aria-label="Buscar notas"
            placeholder="Participante, número ou chave"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filtrar status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos os status</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setDocuments(
                  await apiFetch<FiscalDocument[]>("/api/fiscal-documents"),
                );
                setOrders(await apiFetch<Order[]>("/api/orders"));
                setNotice("Lista atualizada.");
              })
            }
          >
            Atualizar
          </button>
        </div>
        {loading ? (
          <p className="table-status">Carregando...</p>
        ) : visible.length > 0 ? (
          <div className="data-table fiscal-table">
            <div className="data-table-row data-table-head">
              <span>Nota</span>
              <span>Participante</span>
              <span>Modelo</span>
              <span>Emissão</span>
              <span>Valor</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            {visible.map((document) => (
              <div
                className="data-table-row"
                key={document.id}
              >
                <span>
                  <strong>NF {document.number}</strong>
                  <small>
                    Série {document.series}
                    {document.is_legacy
                      ? " · histórica"
                      : ""}
                  </small>
                </span>

                <span>{document.participant_name}</span>
                <span>{document.model}</span>
                <span>
                  {document.issue_date
                    .split("-")
                    .reverse()
                    .join("/")}
                </span>
                <span>{money(document.value)}</span>
                <span>{document.status}</span>

                <span className="row-actions">
                  <button
                    onClick={() =>
                      selectDocument(document)
                    }
                  >
                    Detalhes
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
            {orderFilter &&
            type === "saida" &&
            !search &&
            !statusFilter ? (
              <>
                <p className="font-semibold text-ink">
                  Este pedido ainda não possui nota fiscal.
                </p>
                <p className="mt-2 text-sm text-muted">
                  Inicie o registro fiscal com o pedido,
                  cliente, itens e valores já vinculados.
                </p>

                {canEdit &&
                  !isOccupied(orderFilter) && (
                    <button
                      className="primary-button mt-4"
                      disabled={busy}
                      onClick={() =>
                        start(orderFilter)
                      }
                    >
                      Criar nota deste pedido
                    </button>
                  )}
              </>
            ) : (
              <>
                <p className="font-semibold text-ink">
                  Nenhum documento encontrado.
                </p>
                <p className="mt-2 text-sm text-muted">
                  {search || statusFilter
                    ? "Tente ajustar a busca ou os filtros."
                    : type === "saida"
                      ? "As notas de saída aparecerão aqui."
                      : "As notas de entrada aparecerão aqui."}
                </p>
              </>
            )}
          </div>
        )}
      </section>
      {selected && (
        <section className="fiscal-detail page-card space-y-4">
          <button className="detail-close" onClick={() => setSelected(null)}>
            Fechar
          </button>
          <h2>
            NF {selected.number} · {selected.status}
          </h2>
          <div className="detail-grid">
            <span>
              Destinatário / fornecedor
              <strong>{selected.participant_name}</strong>
            </span>
            <span>
              CPF/CNPJ
              <strong>
                {selected.participant_document || "Não informado"}
              </strong>
            </span>
            <span>
              Pedido
              <strong>{selected.order_id || "Sem pedido de venda"}</strong>
            </span>
            <span>
              Total<strong>{money(selected.value)}</strong>
            </span>
            <span>
              Responsável original
              <strong>
                {selected.created_by_id || "Não registrado no histórico antigo"}
              </strong>
            </span>
            <span>
              Cadastro<strong>{dateTime(selected.created_at)}</strong>
            </span>
            <span>
              Autorização
              <strong>
                {dateTime(selected.authorized_at)} ·{" "}
                {selected.authorization_protocol || "Sem protocolo"}
              </strong>
            </span>
            <span>
              Cancelamento
              <strong>
                {dateTime(selected.cancelled_at)} ·{" "}
                {selected.cancellation_protocol || "Sem protocolo"}
              </strong>
            </span>
            <span>
              Chave de acesso
              <strong>{selected.access_key || "Não informada"}</strong>
            </span>
          </div>
          {selected.order_id && <Link to="/pedidos">Consultar pedidos</Link>}
          {selected.cancellation_reason && (
            <p>Motivo do cancelamento: {selected.cancellation_reason}</p>
          )}
          <Items items={selected.items} />
          {selected.snapshot_source === "reconciled_order" && (
            <p className="info-note">
              Itens recuperados do pedido na conciliação de{" "}
              {dateTime(selected.reconciled_at)}. Não representam uma captura
              feita na emissão original.
            </p>
          )}
          {selected.snapshot_source === "legacy_unverified" && (
            <p className="info-note">
              Registro histórico pendente de conciliação. Datas e responsáveis
              desconhecidos foram preservados como não informados. Entradas
              históricas não geram estoque automaticamente.
            </p>
          )}
          {canEdit &&
            selected.document_type === "saida" &&
            selected.snapshot_source === "legacy_unverified" && (
              <form
                className="fiscal-form-grid"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    remember(
                      await apiFetch<FiscalDocument>(
                        `/api/fiscal-documents/${selected.id}/link-order`,
                        { method: "POST", body: JSON.stringify(linkForm) },
                      ),
                    );
                    setNotice("Vínculo conciliado e registrado no histórico.");
                  });
                }}
              >
                <label>
                  Pedido para conciliação
                  <select
                    required
                    value={linkForm.order_id}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, order_id: e.target.value })
                    }
                  >
                    <option value="">Selecione</option>
                    {orders
                      .filter(
                        (o) => !selected.order_id || selected.order_id === o.id,
                      )
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.id.slice(0, 8)} · {o.customer_name} ·{" "}
                          {money(o.total_amount)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Justificativa
                  <input
                    required
                    minLength={10}
                    maxLength={500}
                    value={linkForm.reason}
                    onChange={(e) =>
                      setLinkForm({ ...linkForm, reason: e.target.value })
                    }
                  />
                </label>
                <button className="secondary-button" disabled={busy}>
                  Confirmar vínculo
                </button>
              </form>
            )}
          {canEdit && selected.allowed_statuses.length > 0 && (
            <form className="fiscal-form-grid" onSubmit={statusEvent}>
              <label>
                Registrar evento
                <select
                  required
                  value={eventForm.status}
                  onChange={(e) =>
                    setEventForm({
                      status: e.target.value,
                      occurred_at: "",
                      protocol: "",
                      reason: "",
                    })
                  }
                >
                  <option value="">Selecione uma transição</option>
                  {selected.allowed_statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              {datedEvent && (
                <label>
                  Data e hora do evento externo
                  <input
                    required
                    type="datetime-local"
                    value={eventForm.occurred_at}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        occurred_at: e.target.value,
                      })
                    }
                  />
                </label>
              )}
              {datedEvent && (
                <label>
                  Protocolo externo{needsProtocol ? " (obrigatório)" : ""}
                  <input
                    required={needsProtocol}
                    maxLength={120}
                    value={eventForm.protocol}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, protocol: e.target.value })
                    }
                  />
                </label>
              )}
              {eventForm.status === "Cancelada" && (
                <label>
                  Motivo
                  <input
                    required
                    minLength={3}
                    maxLength={500}
                    value={eventForm.reason}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, reason: e.target.value })
                    }
                  />
                </label>
              )}
              <button className="primary-button" disabled={busy}>
                Registrar evento
              </button>
            </form>
          )}
          {canEdit &&
            selected.document_type === "saida" &&
            selected.order_id &&
            !active(selected.status) && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => start(selected.order_id!)}
              >
                Reemitir em novo registro
              </button>
            )}
          {selected.stock_received_at && (
            <p className="info-note">
              Recebimento registrado em {dateTime(selected.stock_received_at)}.
              {selected.status === "Cancelada"
                ? " O cancelamento estornou esse recebimento."
                : ""}
            </p>
          )}
          {canEdit &&
            selected.document_type === "entrada" &&
            selected.status === "Autorizada" &&
            !selected.is_legacy &&
            !selected.stock_received_at && (
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "Confirma o recebimento físico dos produtos? Esta ação adiciona as quantidades ao estoque uma única vez.",
                    )
                  )
                    void run(async () => {
                      remember(
                        await apiFetch<FiscalDocument>(
                          `/api/fiscal-documents/${selected.id}/receive`,
                          { method: "POST" },
                        ),
                      );
                      setNotice("Estoque recebido e registrado.");
                    });
                }}
              >
                Confirmar recebimento no estoque
              </button>
            )}
          <h3>Histórico de ações</h3>
          <ul className="space-y-2">
            {selected.events.map((event) => (
              <li key={event.id}>
                {dateTime(event.created_at)} ·{" "}
                {actionNames[event.action] || event.action} · usuário{" "}
                {event.actor_id}
                {event.detail.status ? ` · ${event.detail.status}` : ""}
                {event.detail.reason ? ` · ${event.detail.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
