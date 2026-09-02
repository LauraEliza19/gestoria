import { apiFetch } from "../models/api.js";
import { getAccessToken } from "../models/session.js";
import { escapeHtml } from "../views/format.js";
import { showToast } from "../views/toast.js";

// ---- Modo escuro (mesma lógica do dashboard) ----
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

// ---- Avatar (só exibe as iniciais de quem está logado) ----
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

// ---- Toast ----
// (showToast já vem pronto de views/toast.js, só precisa do container no HTML)

// ---- Formulário: elementos ----
const form = document.getElementById('customerForm');
const submitBtn = document.getElementById('customerFormSubmitBtn');
const pageTitle = document.getElementById('pageTitle');
const formTitle = document.getElementById('formTitle');
const formSub = document.getElementById('formSub');

const personTypeSelect = document.getElementById('cf-person-type');
const tradeNameField = document.getElementById('cf-trade-name-field');
const stateRegistrationField = document.getElementById('cf-state-registration-field');
const documentLabel = document.getElementById('cf-document-label');
const nameLabelSuffix = document.getElementById('cf-name-label-suffix');

const fields = {
  person_type: document.getElementById('cf-person-type'),
  name: document.getElementById('cf-name'),
  trade_name: document.getElementById('cf-trade-name'),
  document: document.getElementById('cf-document'),
  state_registration: document.getElementById('cf-state-registration'),
  phone: document.getElementById('cf-phone'),
  whatsapp: document.getElementById('cf-whatsapp'),
  email: document.getElementById('cf-email'),
  category: document.getElementById('cf-category'),
  birth_date: document.getElementById('cf-birth-date'),
  default_discount_percent: document.getElementById('cf-discount'),
  notes: document.getElementById('cf-notes'),
  postal_code: document.getElementById('cf-postal-code'),
  street: document.getElementById('cf-street'),
  number: document.getElementById('cf-number'),
  complement: document.getElementById('cf-complement'),
  neighborhood: document.getElementById('cf-neighborhood'),
  city: document.getElementById('cf-city'),
  state: document.getElementById('cf-state'),
};

// ---- Mostrar/ocultar campos de acordo com o tipo de pessoa ----
function updatePersonTypeUI(){
  const isCompany = personTypeSelect.value === 'company';
  tradeNameField.style.display = isCompany ? 'block' : 'none';
  stateRegistrationField.style.display = isCompany ? 'block' : 'none';
  documentLabel.textContent = isCompany ? 'CNPJ' : 'CPF';
  fields.document.placeholder = isCompany ? 'Ex: 00.000.000/0000-00' : 'Ex: 000.000.000-00';
  nameLabelSuffix.textContent = isCompany ? '(Razão social)' : '';
}

personTypeSelect.addEventListener('change', updatePersonTypeUI);
updatePersonTypeUI();

// ---- Detectar modo edição (?id=xxx na URL) ----
const urlParams = new URLSearchParams(window.location.search);
const editingId = urlParams.get('id');

function setEditMode(){
  pageTitle.textContent = 'Editar cliente';
  formTitle.textContent = 'Editar cliente';
  formSub.textContent = 'Atualize os dados abaixo.';
  submitBtn.textContent = 'Salvar alterações';
}

function fillForm(customer){
  fields.person_type.value = customer.person_type || 'individual';
  updatePersonTypeUI();
  fields.name.value = customer.name || '';
  fields.trade_name.value = customer.trade_name || '';
  fields.document.value = customer.document || '';
  fields.state_registration.value = customer.state_registration || '';
  fields.phone.value = customer.phone || '';
  fields.whatsapp.value = customer.whatsapp || '';
  fields.email.value = customer.email || '';
  fields.category.value = customer.category || 'final_consumer';
  fields.birth_date.value = customer.birth_date || '';
  fields.default_discount_percent.value = customer.default_discount_percent ?? '';
  fields.notes.value = customer.notes || '';
  fields.postal_code.value = customer.postal_code || '';
  fields.street.value = customer.street || '';
  fields.number.value = customer.number || '';
  fields.complement.value = customer.complement || '';
  fields.neighborhood.value = customer.neighborhood || '';
  fields.city.value = customer.city || '';
  fields.state.value = customer.state || '';
}

async function loadCustomerForEdit(){
  try {
    const customers = await apiFetch('/api/customers');
    const customer = customers.find(c => c.id === editingId);
    if(!customer){
      showToast('Cliente não encontrado.', 'error');
      window.location.href = '/dashboard';
      return;
    }
    fillForm(customer);
  } catch(error) {
    showToast(error.message, 'error');
  }
}

if(editingId){
  setEditMode();
  loadCustomerForEdit();
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
    phone: fields.phone.value.trim(),
    person_type: fields.person_type.value,
    category: fields.category.value,
  };

  const optionalText = ['trade_name', 'document', 'state_registration', 'whatsapp', 'email',
    'notes', 'postal_code', 'street', 'number', 'complement', 'neighborhood', 'city', 'state'];
  optionalText.forEach(key => {
    const value = fields[key].value.trim();
    payload[key] = value.length > 0 ? value : null;
  });

  payload.birth_date = fields.birth_date.value || null;

  const discountRaw = fields.default_discount_percent.value.trim();
  payload.default_discount_percent = discountRaw.length > 0 ? discountRaw.replace(',', '.') : null;

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
  if(fields.phone.value.trim().length === 0){
    setFieldError('phone');
    valid = false;
  }

  const discountRaw = fields.default_discount_percent.value.trim().replace(',', '.');
  if(discountRaw.length > 0){
    const discountNum = Number(discountRaw);
    if(Number.isNaN(discountNum) || discountNum < 0 || discountNum > 100){
      setFieldError('default_discount_percent');
      valid = false;
    }
  }

  if(!valid) return;

  const payload = buildPayload();

  submitBtn.disabled = true;
  try {
    if(editingId){
      await apiFetch(`/api/customers/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      showToast(`Cliente "${payload.name}" atualizado.`);
    } else {
      await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast(`Cliente "${payload.name}" cadastrado com sucesso.`);
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
    resolveConfirmCard(bubble, 'executed', '✓ Formulário preenchido — revise e clique em "Salvar cliente".');
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

  if(lower.includes('cadastr') && lower.includes('cliente')){
    const nameMatch = text.match(/cadastr\w*\s+(?:a|o)?\s*([a-zà-úA-ZÀ-Ú\s]+?)\s+como\s+cliente/i);
    const phoneMatch = text.match(/(\(?\d{2}\)?\s?\d{4,5}-?\d{4})/);

    const nome = nameMatch ? nameMatch[1].trim() : '';
    const telefone = phoneMatch ? phoneMatch[1].trim() : '';

    let confidence = 55;
    if(nome) confidence += 22;
    if(telefone) confidence += 22;
    confidence = Math.min(confidence, 98);

    return {
      needsConfirmation: true,
      chatReply: 'Entendi! Vou preencher o nome e o telefone no formulário — confirma os dados antes:',
      confirmConfig: {
        intentLabel: 'Preencher cliente',
        confidence,
        fields: [
          { key:'nome', label:'Nome', value: nome || 'Não identificado — preencha' },
          { key:'telefone', label:'Telefone', value: telefone || 'Não identificado — preencha' },
        ],
        onConfirm: (values) => {
          fields.name.value = values.nome;
          fields.phone.value = values.telefone;
          clearFieldError('name');
          clearFieldError('phone');
        }
      }
    };
  }

  return {
    chatReply: 'Nesta página eu só ajudo a preencher o formulário de cliente — tenta algo como "cadastre a Maria como cliente, telefone 99999-9999".'
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