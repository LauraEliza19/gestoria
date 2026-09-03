import { apiFetch } from "../models/api.js";
import { getAccessToken } from "../models/session.js";
import { escapeHtml, parsePriceBR } from "../views/format.js";
import { showToast } from "../views/toast.js";

// ---- Modo escuro (mesma lógica das outras páginas) ----
const themeToggleBtn = document.getElementById('themeToggleBtn');
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';

function applyTheme(theme){
  if(theme === 'dark'){
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { localStorage.setItem('gestoria_theme', theme); } catch(e) {}
  themeToggleBtn.innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
}

themeToggleBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

// ---- Avatar ----
const avatarBtn = document.getElementById('avatarBtn');

async function loadSession(){
  try {
    const session = await apiFetch('/api/auth/me');
    const initials = session.full_name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
    avatarBtn.textContent = initials;
  } catch(error) {
    if(getAccessToken()) showToast(error.message, 'error');
  }
}

// ---- Formulário: elementos ----
const form = document.getElementById('productForm');
const submitBtn = document.getElementById('productFormSubmitBtn');
const pageTitle = document.getElementById('pageTitle');
const formTitle = document.getElementById('formTitle');
const formSub = document.getElementById('formSub');

const perishableCheckbox = document.getElementById('pf-perishable');
const shelfLifeField = document.getElementById('pf-shelf-life-field');

const fields = {
  name: document.getElementById('pf-name'),
  description: document.getElementById('pf-description'),
  category: document.getElementById('pf-category'),
  product_type: document.getElementById('pf-product-type'),
  barcode: document.getElementById('pf-barcode'),
  price: document.getElementById('pf-price'),
  cost_price: document.getElementById('pf-cost-price'),
  unit_of_measure: document.getElementById('pf-unit'),
  stock_quantity: document.getElementById('pf-stock'),
  min_stock_quantity: document.getElementById('pf-min-stock'),
  perishable: perishableCheckbox,
  shelf_life_days: document.getElementById('pf-shelf-life'),
  ncm_code: document.getElementById('pf-ncm'),
  cest_code: document.getElementById('pf-cest'),
  fiscal_origin: document.getElementById('pf-fiscal-origin'),
};

// ---- Mostrar/ocultar validade de acordo com "é perecível?" ----
function updatePerishableUI(){
  shelfLifeField.style.display = perishableCheckbox.checked ? 'block' : 'none';
}
perishableCheckbox.addEventListener('change', updatePerishableUI);
updatePerishableUI();

// ---- Detectar modo edição (?id=xxx na URL) ----
const urlParams = new URLSearchParams(window.location.search);
const editingId = urlParams.get('id');

function setEditMode(){
  pageTitle.textContent = 'Editar produto';
  formTitle.textContent = 'Editar produto';
  formSub.textContent = 'Atualize os dados abaixo.';
  submitBtn.textContent = 'Salvar alterações';
}

function fillForm(product){
  fields.name.value = product.name || '';
  fields.description.value = product.description || '';
  fields.category.value = product.category || 'outros';
  fields.product_type.value = product.product_type || 'resale';
  fields.barcode.value = product.barcode || '';
  fields.price.value = product.price != null ? String(product.price).replace('.', ',') : '';
  fields.cost_price.value = product.cost_price != null ? String(product.cost_price).replace('.', ',') : '';
  fields.unit_of_measure.value = product.unit_of_measure || 'unit';
  fields.stock_quantity.value = product.stock_quantity != null ? String(product.stock_quantity).replace('.', ',') : '';
  fields.min_stock_quantity.value = product.min_stock_quantity != null ? String(product.min_stock_quantity).replace('.', ',') : '';
  perishableCheckbox.checked = !!product.perishable;
  fields.shelf_life_days.value = product.shelf_life_days || '';
  fields.ncm_code.value = product.ncm_code || '';
  fields.cest_code.value = product.cest_code || '';
  fields.fiscal_origin.value = product.fiscal_origin ?? '';
  updatePerishableUI();
}

async function loadProductForEdit(){
  try {
    const products = await apiFetch('/api/products');
    const product = products.find(p => p.id === editingId);
    if(!product){
      showToast('Produto não encontrado.', 'error');
      window.location.href = '/dashboard';
      return;
    }
    fillForm(product);
  } catch(error) {
    showToast(error.message, 'error');
  }
}

if(editingId){
  setEditMode();
  loadProductForEdit();
}

// ---- Validação e envio ----
function clearFieldError(fieldName){
  const el = form.querySelector(`[data-field="${fieldName}"]`);
  if(el) el.classList.remove('error');
}

function setFieldError(fieldName){
  const el = form.querySelector(`[data-field="${fieldName}"]`);
  if(el) el.classList.add('error');
}

function buildPayload(){
  const payload = {
    name: fields.name.value.trim(),
    price: parsePriceBR(fields.price.value).toString(),
    category: fields.category.value,
    product_type: fields.product_type.value,
    unit_of_measure: fields.unit_of_measure.value,
    perishable: perishableCheckbox.checked,
  };

  payload.description = fields.description.value.trim() || null;
  payload.barcode = fields.barcode.value.trim() || null;
  payload.ncm_code = fields.ncm_code.value.trim() || null;
  payload.cest_code = fields.cest_code.value.trim() || null;

  const stockRaw = fields.stock_quantity.value.trim();
  payload.stock_quantity = stockRaw.length > 0 ? parsePriceBR(stockRaw).toString() : '0';

  const costRaw = fields.cost_price.value.trim();
  payload.cost_price = costRaw.length > 0 ? parsePriceBR(costRaw).toString() : null;

  const minStockRaw = fields.min_stock_quantity.value.trim();
  payload.min_stock_quantity = minStockRaw.length > 0 ? parsePriceBR(minStockRaw).toString() : '5';

  const shelfLifeRaw = fields.shelf_life_days.value.trim();
  payload.shelf_life_days = payload.perishable && shelfLifeRaw.length > 0
    ? parseInt(shelfLifeRaw, 10)
    : null;

  const fiscalOriginRaw = fields.fiscal_origin.value.trim();
  payload.fiscal_origin = fiscalOriginRaw.length > 0 ? parseInt(fiscalOriginRaw, 10) : null;

  return payload;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  Object.keys(fields).forEach(clearFieldError);
  let valid = true;

  if(fields.name.value.trim().length === 0){
    setFieldError('name');
    valid = false;
  }

  const priceNum = parsePriceBR(fields.price.value);
  if(fields.price.value.trim().length === 0 || priceNum <= 0){
    setFieldError('price');
    valid = false;
  }

  const stockRaw = fields.stock_quantity.value.trim();
  if(stockRaw.length > 0 && parsePriceBR(stockRaw) < 0){
    setFieldError('stock_quantity');
    valid = false;
  }

  if(perishableCheckbox.checked && fields.shelf_life_days.value.trim().length === 0){
    setFieldError('shelf_life_days');
    valid = false;
  }

  if(!valid) return;

  const payload = buildPayload();

  submitBtn.disabled = true;
  try {
    if(editingId){
      await apiFetch(`/api/products/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showToast(`Produto "${payload.name}" atualizado.`);
    } else {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`Produto "${payload.name}" cadastrado com sucesso.`);
    }
    window.location.href = '/dashboard';
  } catch(error) {
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Chat: assistente pra preencher o formulário ----
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');

function nowLabel(){
  return new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}

function addBubble(text, sender){
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ' + sender;
  bubble.textContent = text;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = nowLabel();
  bubble.appendChild(meta);
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function addThinkingBubble(){
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai thinking';
  bubble.textContent = 'interpretando...';
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function addConfirmCard(config){
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble ai confirm-card';

  let confidenceClass = 'low';
  let confidenceLabel = 'Confiança baixa';
  if(config.confidence >= 90){ confidenceClass = 'high'; confidenceLabel = 'Alta confiança'; }
  else if(config.confidence >= 70){ confidenceClass = 'medium'; confidenceLabel = 'Confiança média'; }

  const fieldsHtml = config.fields.map(f => `
    <div class="confirm-field-row">
      <label>${f.label}</label>
      <input type="text" data-key="${escapeHtml(f.key)}" value="${escapeHtml(f.value)}">
    </div>
  `).join('');

  bubble.innerHTML = `
    <div class="confirm-card-title">Confirmar ação: ${config.intentLabel}</div>
    <div class="confidence-pill ${confidenceClass}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/></svg>
      ${confidenceLabel} (${config.confidence}%)
    </div>
    <div class="confirm-fields">${fieldsHtml}</div>
    <div class="confirm-actions">
      <button type="button" class="btn-secondary btn-sm" data-action="cancel">Cancelar</button>
      <button type="button" class="btn-primary btn-inline btn-sm" data-action="confirm">Preencher formulário</button>
    </div>
  `;

  bubble.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    const values = {};
    bubble.querySelectorAll('.confirm-field-row input').forEach(input => {
      values[input.dataset.key] = input.value.trim();
    });
    config.onConfirm(values);
    resolveConfirmCard(bubble, 'executed', '✓ Formulário preenchido — revise e clique em "Salvar produto".');
  });

  bubble.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    resolveConfirmCard(bubble, 'cancelled', '✕ Cancelado — nada foi preenchido.');
  });

  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function resolveConfirmCard(bubble, state, message){
  bubble.querySelector('.confirm-fields').remove();
  bubble.querySelector('.confirm-actions').remove();
  const note = document.createElement('div');
  note.className = 'confirm-resolved ' + state;
  note.textContent = message;
  bubble.appendChild(note);
}

function interpretAndRespond(text){
  const lower = text.toLowerCase();

  if(lower.includes('cadastr') && lower.includes('produto')){
    const nameMatch = text.match(/produto\s+([a-zà-úA-ZÀ-Ú0-9\s]+?)\s+(?:a|por)\s+r?\$?\s*\d/i);
    const priceMatch = text.match(/r?\$?\s*(\d+[,.]?\d*)/i);

    const nome = nameMatch ? nameMatch[1].trim() : '';
    const preco = priceMatch ? priceMatch[1].trim() : '';

    let confidence = 55;
    if(nome) confidence += 22;
    if(preco) confidence += 22;
    confidence = Math.min(confidence, 98);

    return {
      needsConfirmation: true,
      chatReply: 'Entendi! Vou preencher o nome e o preço no formulário — confirma os dados antes:',
      confirmConfig: {
        intentLabel: 'Preencher produto',
        confidence,
        fields: [
          { key:'nome', label:'Nome', value: nome || 'Não identificado — preencha' },
          { key:'preco', label:'Preço', value: preco || 'Não identificado — preencha' },
        ],
        onConfirm: (values) => {
          fields.name.value = values.nome;
          fields.price.value = values.preco;
          clearFieldError('name');
          clearFieldError('price');
        }
      }
    };
  }

  return {
    chatReply: 'Nesta página eu só ajudo a preencher o formulário de produto — tenta algo como "cadastre o produto Croissant a R$ 8,50".'
  };
}

function handleSend(){
  const text = chatInput.value.trim();
  if(!text) return;

  addBubble(text, 'user');
  chatInput.value = '';

  const thinkingBubble = addThinkingBubble();

  setTimeout(() => {
    thinkingBubble.remove();
    const response = interpretAndRespond(text);
    addBubble(response.chatReply, 'ai');
    if(response.needsConfirmation){
      addConfirmCard(response.confirmConfig);
    }
  }, 650);
}

sendBtn.addEventListener('click', handleSend);
chatInput.addEventListener('keydown', (e) => {
  if(e.key === 'Enter') handleSend();
});

newChatBtn.addEventListener('click', () => {
  chatMessages.innerHTML = '';
  addBubble('Nova conversa iniciada. Pode me pedir pra preencher o formulário.', 'ai');
});

loadSession();