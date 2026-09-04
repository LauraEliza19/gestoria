import { apiFetch } from '../models/api.js';

const state = { orders: [], products: [], filter: 'in_preparation', query: '', loading: false };
const byId = id => document.getElementById(id);
const el = { grid:byId('orderGrid'), empty:byId('factoryEmpty'), title:byId('emptyTitle'), description:byId('emptyDescription'), feedback:byId('factoryFeedback'), status:byId('connectionStatus'), production:byId('productionCount'), items:byId('itemCount'), completed:byId('completedCount'), oldest:byId('oldestTime'), activeBadge:byId('activeBadge'), completedBadge:byId('completedBadge'), search:byId('orderSearch'), refresh:byId('refreshButton'), theme:byId('themeToggle'), clock:byId('factoryClock'), toast:byId('factoryToast') };
const icons = {
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m5 12 4 4L19 6"/></svg>',
  moon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>',
  sun:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2"/></svg>'
};
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[char]);
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const itemTotal = order => order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
const isToday = value => new Date(value).toDateString() === new Date().toDateString();

function elapsed(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ${minutes % 60}min` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
const hour = value => new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));

function visibleOrders() {
  const query = normalize(state.query);
  return state.orders.filter(order => order.status === state.filter).filter(order => !query || normalize([order.id.slice(0,8), order.customer_name, ...order.items.map(item => item.product_name)].join(' ')).includes(query));
}

function renderSummary() {
  const active = state.orders.filter(order => order.status === 'in_preparation');
  const done = state.orders.filter(order => order.status === 'completed');
  el.production.textContent = active.length;
  el.items.textContent = active.reduce((sum, order) => sum + itemTotal(order), 0);
  el.completed.textContent = done.filter(order => isToday(order.updated_at)).length;
  el.oldest.textContent = active.length ? elapsed(active.reduce((a,b) => new Date(a.created_at) < new Date(b.created_at) ? a : b).created_at) : '—';
  el.activeBadge.textContent = active.length; el.completedBadge.textContent = done.length;
}

function card(order) {
  const done = order.status === 'completed';
  const items = order.items.map(item => `<li class="order-item"><span class="item-quantity">${escapeHtml(item.quantity)}×</span><span class="item-name">${escapeHtml(item.product_name)}</span></li>`).join('');
  return `<article class="order-card"><header class="order-card-head"><div><div class="order-number">#${escapeHtml(order.id.slice(0,8).toUpperCase())}</div><div class="order-customer">${escapeHtml(order.customer_name)}</div></div><span class="order-age ${done?'done':''}">${done?icons.check:icons.clock}${done?'Concluído':elapsed(order.created_at)}</span></header><ul class="order-items">${items}</ul><footer class="order-card-foot"><span class="order-created">Recebido às ${hour(order.created_at)} · ${itemTotal(order)} ${itemTotal(order)===1?'item':'itens'}</span>${done?'':`<button class="complete-button" data-complete="${escapeHtml(order.id)}">${icons.check} Concluir</button>`}</footer></article>`;
}

function render() {
  renderSummary();
  const orders = visibleOrders();
  el.grid.innerHTML = orders.map(card).join(''); el.grid.hidden = !orders.length; el.empty.hidden = Boolean(orders.length);
  if (!orders.length) {
    const searching = state.query.trim();
    el.title.textContent = searching ? 'Nenhum pedido encontrado' : state.filter === 'completed' ? 'Nenhum pedido concluído' : 'Produção em dia';
    el.description.textContent = searching ? 'Tente buscar por outro número, cliente ou produto.' : state.filter === 'completed' ? 'Os pedidos finalizados aparecerão aqui.' : 'Não há pedidos aguardando preparo neste momento.';
  }
}

function toast(message, error=false) { el.toast.textContent=message; el.toast.className=`factory-toast show${error?' error':''}`; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.toast.className='factory-toast',2800); }
const unitLabel = unit => ({unit:'un.',g:'g',kg:'kg'}[unit] || unit);
function renderIngredients() {
  const grid=byId('ingredientGrid'), empty=byId('ingredientEmpty');
  grid.innerHTML=state.products.map(product=>`<article class="ingredient-card"><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(Number(product.stock_quantity).toLocaleString('pt-BR',{maximumFractionDigits:3}))} ${unitLabel(product.unit_of_measure)}</span></article>`).join('');
  empty.hidden=Boolean(state.products.length);
  const options=state.products.map(product=>`<option value="${escapeHtml(product.id)}">${escapeHtml(product.name)} (${unitLabel(product.unit_of_measure)})</option>`).join('');
  const selectA=byId('recipeIngredientA'), selectB=byId('recipeIngredientB'), oldA=selectA.value, oldB=selectB.value;
  selectA.innerHTML=options; selectB.innerHTML=options;
  if(state.products.some(product=>product.id===oldA)) selectA.value=oldA;
  else { const bread=state.products.find(product=>normalize(product.name).includes('pao')); if(bread) selectA.value=bread.id; }
  if(state.products.some(product=>product.id===oldB)) selectB.value=oldB;
  else { const ham=state.products.find(product=>normalize(product.name).includes('presunto')); if(ham) selectB.value=ham.id; else if(state.products[1]) selectB.value=state.products[1].id; }
}
async function loadProducts() {
  try { state.products=await apiFetch('/api/products'); renderIngredients(); }
  catch(error) { toast(`Estoque: ${error.message}`,true); }
}
async function loadOrders(quiet=false) {
  if(state.loading) return; state.loading=true; el.refresh.disabled=true; el.status.className='connection-status loading'; el.status.innerHTML='<span></span> Atualizando';
  if(!quiet && !state.orders.length) el.feedback.textContent='Carregando pedidos…';
  try { state.orders=await apiFetch('/api/orders'); el.status.className='connection-status'; el.status.innerHTML='<span></span> Ao vivo'; el.feedback.textContent=''; render(); }
  catch(error) { el.status.className='connection-status error'; el.status.innerHTML='<span></span> Sem conexão'; el.feedback.textContent=error.message; if(!quiet) toast(error.message,true); }
  finally { state.loading=false; el.refresh.disabled=false; }
}
async function complete(id, button) {
  button.disabled=true; button.textContent='Concluindo…';
  try { const updated=await apiFetch(`/api/orders/${id}`,{method:'PATCH',body:JSON.stringify({status:'completed'})}); const index=state.orders.findIndex(order=>order.id===id); if(index>=0) state.orders[index]=updated; render(); toast(`Pedido #${id.slice(0,8).toUpperCase()} concluído.`); }
  catch(error) { button.disabled=false; button.innerHTML=`${icons.check} Concluir`; toast(error.message,true); }
}

document.querySelector('.view-tabs').addEventListener('click',event=>{ const tab=event.target.closest('[data-filter]'); if(!tab)return; state.filter=tab.dataset.filter; document.querySelectorAll('.view-tab').forEach(item=>{const active=item===tab;item.classList.toggle('active',active);item.setAttribute('aria-selected',active)}); render(); });
el.search.addEventListener('input',event=>{state.query=event.target.value;render()}); el.refresh.addEventListener('click',()=>{loadOrders();loadProducts()}); el.grid.addEventListener('click',event=>{const button=event.target.closest('[data-complete]');if(button)complete(button.dataset.complete,button)});
byId('stockFormToggle').addEventListener('click',()=>{const form=byId('stockForm');form.hidden=!form.hidden;if(!form.hidden)byId('ingredientName').focus()});
byId('stockForm').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.submitter, name=byId('ingredientName').value.trim(), quantity=Number(byId('ingredientQuantity').value), unit=byId('ingredientUnit').value;
  const existing=state.products.find(product=>normalize(product.name)===normalize(name));
  if(existing && existing.unit_of_measure!==unit){toast(`${existing.name} já usa a unidade ${unitLabel(existing.unit_of_measure)}.`,true);return}
  button.disabled=true;
  try {
    if(existing) await apiFetch(`/api/products/${existing.id}`,{method:'PATCH',body:JSON.stringify({stock_quantity:Number(existing.stock_quantity)+quantity})});
    else await apiFetch('/api/products',{method:'POST',body:JSON.stringify({name,price:0,stock_quantity:quantity,unit_of_measure:unit,category:'outros',product_type:'resale',min_stock_quantity:0})});
    event.target.reset(); byId('stockForm').hidden=true; await loadProducts(); toast(`${name}: estoque atualizado.`);
  } catch(error){toast(error.message,true)} finally{button.disabled=false}
});
byId('recipeForm').addEventListener('submit',event=>{
  event.preventDefault(); const a=state.products.find(product=>product.id===byId('recipeIngredientA').value), b=state.products.find(product=>product.id===byId('recipeIngredientB').value), qa=Number(byId('recipeQuantityA').value), qb=Number(byId('recipeQuantityB').value), result=byId('recipeResult');
  result.hidden=false;
  if(!a||!b||a.id===b.id){result.className='recipe-result error';result.textContent='Selecione dois ingredientes diferentes.';return}
  const capacity=Math.max(0,Math.floor(Math.min(Number(a.stock_quantity)/qa,Number(b.stock_quantity)/qb))), limiting=Number(a.stock_quantity)/qa<=Number(b.stock_quantity)/qb?a:b, recipe=byId('recipeName').value.trim();
  result.className=`recipe-result${capacity?'':' error'}`; result.innerHTML=`Você consegue produzir <strong>${capacity} ${escapeHtml(recipe)}${capacity===1?'':'s'}</strong>${capacity?`O ingrediente limitante é ${escapeHtml(limiting.name)}.`:'Estoque insuficiente para completar uma unidade.'}`;
});
function themeIcon(){el.theme.innerHTML=document.documentElement.getAttribute('data-theme')==='dark'?icons.sun:icons.moon} el.theme.addEventListener('click',()=>{const dark=document.documentElement.getAttribute('data-theme')==='dark';document.documentElement.toggleAttribute('data-theme',!dark);try{localStorage.setItem('gestoria_theme',dark?'light':'dark')}catch(error){}themeIcon()});
function updateClock(){el.clock.textContent=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date())}
themeIcon();updateClock();loadOrders();loadProducts();setInterval(updateClock,1000);setInterval(()=>{render();loadOrders(true);loadProducts()},30000);
