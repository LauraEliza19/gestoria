import { apiFetch } from "../models/api.js";
import { getAccessToken } from "../models/session.js";
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

// ---- Formulário ----
const form = document.getElementById('companyForm');
const submitBtn = document.getElementById('companyFormSubmitBtn');

const fields = {
  name: document.getElementById('cf-name'),
  document: document.getElementById('cf-document'),
  state_registration: document.getElementById('cf-state-registration'),
  municipal_registration: document.getElementById('cf-municipal-registration'),
  phone: document.getElementById('cf-phone'),
  postal_code: document.getElementById('cf-postal-code'),
  street: document.getElementById('cf-street'),
  number: document.getElementById('cf-number'),
  complement: document.getElementById('cf-complement'),
  neighborhood: document.getElementById('cf-neighborhood'),
  city: document.getElementById('cf-city'),
  state: document.getElementById('cf-state'),
};

function fillForm(organization){
  Object.keys(fields).forEach(key => {
    fields[key].value = organization[key] || '';
  });
}

async function loadSessionAndCompany(){
  try {
    const session = await apiFetch('/api/auth/me');
    const initials = session.full_name
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase();
    avatarBtn.textContent = initials;
    fillForm(session.organization);
  } catch(error) {
    if(getAccessToken()) showToast(error.message, 'error');
  }
}

function clearFieldError(fieldName){
  const el = form.querySelector(`[data-field="${fieldName}"]`);
  if(el) el.classList.remove('error');
}

function setFieldError(fieldName){
  const el = form.querySelector(`[data-field="${fieldName}"]`);
  if(el) el.classList.add('error');
}

function buildPayload(){
  const payload = {};
  Object.keys(fields).forEach(key => {
    const value = fields[key].value.trim();
    payload[key] = value.length > 0 ? value : null;
  });
  return payload;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  Object.keys(fields).forEach(clearFieldError);

  if(fields.name.value.trim().length === 0){
    setFieldError('name');
    return;
  }

  const payload = buildPayload();

  submitBtn.disabled = true;
  try {
    await apiFetch('/api/organization', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    showToast('Dados da empresa atualizados.');
    window.location.href = '/dashboard';
  } catch(error) {
    showToast(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

loadSessionAndCompany();