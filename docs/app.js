'use strict';
/* Family Recipe Book: a home-screen web app ported from the Claude artifact.
   Recipes live in this device's localStorage. Export/import JSON for backup and sync. */

const STORE_KEY = 'familyRecipes.v1';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const FILTERS = [
  ['all','All'], ['regular','Regulars'], ['to-try','To try'],
  ['quick','30 min or less'], ['harper','Harper eats it'], ['ahead','Make-ahead'], ['card','Needs a card'], ['missing','No recipe saved']
];
const MEALS = ['Breakfast','Lunch','Dinner','Snack'];
const PROTEINS = ['Chicken','Pork','Beef','Seafood','Tofu or egg','Vegetarian','None'];
const ALTS = PROTEINS.slice(0,5);
const KIND_MAP = {'Dinner main':'Main dish','Lunch or snack':'Main dish','Breakfast':'Main dish'};

let recipes = [], status = 'all', toggles = new Set(), open = null, editing = null, confirmDel = null;

/* ----- storage ----- */
function load(){
  try { const v = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch(e){ return []; }
}
function persist(){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(recipes)); return true; }
  catch(e){ alert('Could not save: this phone is out of storage space for the app.'); return false; }
}
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* ----- helpers (same rules as the artifact) ----- */
const hasRecipe = r => !!((r.ingredients || '').trim() || (r.steps || '').trim());
const kindLabel = r => KIND_MAP[r.kind] || r.kind || 'Main dish';
function mealsOf(r){
  if (Array.isArray(r.meals)) return r.meals;
  const k = r.kind || '';
  if (k === 'Breakfast') return ['Breakfast'];
  if (k === 'Lunch or snack') return ['Lunch','Snack'];
  if (k === 'Veg or side') return ['Lunch','Dinner'];
  if (k === 'Sauce or staple') return [];
  return ['Dinner'];
}
const proteinsOf = r => [r.protein].concat(r.altProteins || []).filter(Boolean);
function buildOpts(id, list){
  $(id).innerHTML = list.map(v => '<label class="opt"><input type="checkbox" value="'+esc(v)+'"><span>'+esc(v)+'</span></label>').join('');
}
const getChecks = id => Array.from($(id).querySelectorAll('input:checked')).map(i => i.value);
const setChecks = (id, vals) => $(id).querySelectorAll('input').forEach(i => { i.checked = vals.includes(i.value); });

function matches(r){
  if (status === 'regular' && r.status !== 'regular') return false;
  if (status === 'to-try' && r.status !== 'to-try') return false;
  if (toggles.has('quick') && !(r.cookMins > 0 && r.cookMins <= 30)) return false;
  if (toggles.has('harper') && r.harper !== 'yes') return false;
  if (toggles.has('ahead') && !r.makeAhead) return false;
  if (toggles.has('card') && r.helper !== 'card') return false;
  if (toggles.has('missing') && hasRecipe(r)) return false;
  const fm = $('fMeal').value, fp = $('fProt').value;
  if (fm && !mealsOf(r).includes(fm)) return false;
  if (fp && !proteinsOf(r).includes(fp)) return false;
  const q = $('q').value.trim().toLowerCase();
  if (q) {
    const hay = [r.name, r.cuisine, proteinsOf(r).join(' '), mealsOf(r).join(' '), r.method, r.ingredients, r.notes].join(' ').toLowerCase();
    // every word must appear somewhere, so "chicken air" finds air-fryer chicken
    if (!q.split(/\s+/).every(w => hay.includes(w))) return false;
  }
  return true;
}

/* ----- rendering ----- */
function drawChips(){
  $('chips').innerHTML = FILTERS.map(([k,l]) => {
    const on = ['all','regular','to-try'].includes(k) ? status === k : toggles.has(k);
    return '<button class="chip" data-k="'+k+'" aria-pressed="'+on+'">'+l+'</button>';
  }).join('');
}
function linkify(src){
  if (/^https?:\/\//i.test(src)) return '<a href="'+esc(src)+'" target="_blank" rel="noopener noreferrer">'+esc(src)+'</a>';
  return esc(src);
}
function draw(){
  const reg = recipes.filter(r => r.status === 'regular').length, tr = recipes.length - reg;
  $('count').textContent = recipes.length + ' recipes · ' + reg + ' regulars · ' + tr + ' to try';
  const rows = recipes.filter(matches).sort((a,b) => (a.name||'').localeCompare(b.name||''));
  if (!rows.length){
    $('list').innerHTML = '<div class="empty">' + (recipes.length ? 'No recipes match these filters.' : 'No recipes yet. Tap + to add one, or open ••• to import your recipe file.') + '</div>';
    return;
  }
  $('list').innerHTML = rows.map(r => {
    const isOpen = open === r.id;
    const tags = mealsOf(r).map(m => '<span class="tag">'+esc(m)+'</span>');
    if (r.status === 'to-try') tags.push('<span class="tag try">To try</span>');
    if (r.harper === 'yes') tags.push('<span class="tag ok">Harper eats it</span>');
    if (r.harper === 'adapt') tags.push('<span class="tag">Harper: adapt</span>');
    if (r.makeAhead) tags.push('<span class="tag">Make-ahead</span>');
    if (r.helper === 'card') tags.push('<span class="tag warn">Needs a card</span>');
    if (!hasRecipe(r)) tags.push('<span class="tag warn">No recipe saved</span>');
    const alts = (r.altProteins || []).filter(p => p !== r.protein);
    const prot = r.protein ? esc(r.protein) + (alts.length ? ' (or ' + alts.map(esc).join(', ') + ')' : '') : '';
    const kl = kindLabel(r);
    const meta = [esc(r.cuisine || ''), prot, kl !== 'Main dish' ? esc(kl) : '', esc(r.method || ''), esc(r.cost || '')].filter(Boolean).join(' · ');
    let det = '';
    if (isOpen){
      det = '<div class="detail">' +
        (r.ingredients ? '<div><h3>Ingredients</h3><pre>'+esc(r.ingredients)+'</pre></div>' : '') +
        (r.steps ? '<div><h3>Steps</h3><pre>'+esc(r.steps)+'</pre></div>' : '') +
        (!hasRecipe(r) ? '<p class="sub">Nothing saved yet. Tap Edit to type it in.</p>' : '') +
        (r.notes ? '<div><h3>Notes</h3><pre>'+esc(r.notes)+'</pre></div>' : '') +
        (r.source ? '<div><h3>Source</h3><p>'+linkify(r.source)+'</p></div>' : '') +
        '<div class="acts"><button class="btn quiet" data-edit="'+esc(r.id)+'">Edit</button>' +
          (confirmDel === r.id ? '<button class="btn danger" data-del="'+esc(r.id)+'">Confirm delete</button><button class="btn quiet" data-nodel="1">Keep</button>' : '<button class="btn quiet" data-askdel="'+esc(r.id)+'">Delete</button>') + '</div>' +
        '</div>';
    }
    return '<div class="item"><button class="row-main" data-open="'+esc(r.id)+'" aria-expanded="'+isOpen+'"><div class="row-top"><span class="name">'+esc(r.name)+'</span><span class="mins">'+(r.cookMins ? '~'+r.cookMins+' min' : '')+'</span></div>' +
      '<div class="meta">'+meta+'</div>' + (tags.length ? '<div class="tags">'+tags.join('')+'</div>' : '') + '</button>' + det + '</div>';
  }).join('');
}

/* ----- add / edit form ----- */
const F = {name:'f-name',status:'f-status',kind:'f-kind',cuisine:'f-cuisine',protein:'f-protein',cookMins:'f-mins',method:'f-method',helper:'f-helper',harper:'f-harper',cost:'f-cost',source:'f-source',ingredients:'f-ing',steps:'f-steps',notes:'f-notes'};
function openForm(r){
  editing = r ? r.id : null;
  $('menu').hidden = true;
  $('formTitle').textContent = r ? 'Edit recipe' : 'Add recipe';
  Object.entries(F).forEach(([k,id]) => { const el = $(id); el.value = r && r[k] != null ? r[k] : (el.tagName === 'SELECT' ? el.options[0].value : ''); });
  $('f-kind').value = r ? kindLabel(r) : 'Main dish';
  setChecks('f-meals', r ? mealsOf(r) : ['Dinner']);
  setChecks('f-alts', r ? (r.altProteins || []) : []);
  $('f-ahead').checked = !!(r && r.makeAhead);
  $('formErr').textContent = '';
  $('form').hidden = false;
  $('addBtn').hidden = true;
  window.scrollTo({top: $('form').offsetTop - 12, behavior: 'smooth'});
  if (!r) $('f-name').focus();
}
function closeForm(){ $('form').hidden = true; $('addBtn').hidden = false; editing = null; }
function save(){
  const name = $('f-name').value.trim();
  if (!name){ $('formErr').textContent = 'Give the recipe a name first.'; return; }
  const d = {};
  Object.entries(F).forEach(([k,id]) => { d[k] = $(id).value.trim(); });
  d.meals = getChecks('f-meals');
  d.altProteins = getChecks('f-alts').filter(p => p !== d.protein);
  if (!d.meals.length && d.kind !== 'Sauce or staple'){ $('formErr').textContent = 'Pick at least one meal this works for.'; return; }
  d.cookMins = d.cookMins === '' ? null : Math.max(0, Math.min(240, Number(d.cookMins)));
  d.makeAhead = $('f-ahead').checked;
  d.updatedAt = Date.now();
  if (editing){
    const i = recipes.findIndex(r => r.id === editing);
    if (i >= 0) recipes[i] = Object.assign({}, recipes[i], d);
    open = editing;
  } else {
    d.id = newId(); d.createdAt = d.updatedAt;
    recipes.push(d); open = d.id;
  }
  if (!persist()) return;
  closeForm(); draw();
  const row = document.querySelector('[data-open="'+CSS.escape(open)+'"]');
  if (row) row.scrollIntoView({block:'start', behavior:'smooth'});
}

/* ----- backup: export / import ----- */
async function exportBackup(){
  const stamp = new Date().toISOString().slice(0,10);
  const body = JSON.stringify({app:'family-recipe-book', version:1, exportedAt:new Date().toISOString(), recipes}, null, 2);
  const file = new File([body], 'family-recipes-' + stamp + '.json', {type:'application/json'});
  // On iPhone the share sheet is the reliable way to save a file (Save to Files, AirDrop, Messages).
  if (navigator.canShare && navigator.canShare({files:[file]})){
    try { await navigator.share({files:[file], title:'Family recipes backup'}); $('menuMsg').textContent = 'Backup shared.'; return; }
    catch(e){ if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  $('menuMsg').textContent = 'Backup downloaded.';
}
/* Accepts this app's export, a bare array of recipes, or the artifact database's {id, data} rows. */
function normalise(raw){
  let list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.recipes) ? raw.recipes : null);
  if (!list) throw new Error('not a recipe file');
  return list.map(x => (x && x.data && typeof x.data === 'object') ? Object.assign({id: x.id}, x.data) : x)
    .filter(x => x && typeof x.name === 'string' && x.name.trim())
    .map(x => Object.assign({}, x, {id: String(x.id || newId())}));
}
async function importFile(file){
  let incoming;
  try { incoming = normalise(JSON.parse(await file.text())); }
  catch(e){ $('menuMsg').textContent = 'That file isn\'t a recipe backup, so nothing was imported.'; return; }
  let added = 0, updated = 0, kept = 0, same = 0;
  const byId = new Map(recipes.map((r,i) => [r.id, i]));
  incoming.forEach(r => {
    if (!byId.has(r.id)){ recipes.push(r); byId.set(r.id, recipes.length - 1); added++; return; }
    const i = byId.get(r.id), cur = recipes[i];
    if (JSON.stringify(r) === JSON.stringify(cur)){ same++; return; }
    // keep whichever copy was edited last; files without timestamps win, since they were picked on purpose
    if ((r.updatedAt || Infinity) >= (cur.updatedAt || 0)){ recipes[i] = r; updated++; } else kept++;
  });
  if (!persist()) return;
  draw();
  $('menuMsg').textContent = 'Imported: ' + added + ' new, ' + updated + ' updated' + (same ? ', ' + same + ' already up to date' : '') + (kept ? ', ' + kept + ' skipped because your copy is newer' : '') + '.';
}

/* ----- events ----- */
$('chips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const k = b.dataset.k;
  if (['all','regular','to-try'].includes(k)) status = k; else (toggles.has(k) ? toggles.delete(k) : toggles.add(k));
  drawChips(); draw();
});
$('q').addEventListener('input', draw);
$('list').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.open){ open = open === t.dataset.open ? null : t.dataset.open; confirmDel = null; draw(); }
  else if (t.dataset.edit){ openForm(recipes.find(r => r.id === t.dataset.edit)); }
  else if (t.dataset.askdel){ confirmDel = t.dataset.askdel; draw(); }
  else if (t.dataset.nodel){ confirmDel = null; draw(); }
  else if (t.dataset.del){ recipes = recipes.filter(r => r.id !== t.dataset.del); persist(); open = null; confirmDel = null; draw(); }
});
$('addBtn').onclick = () => openForm(null);
$('cancelBtn').onclick = closeForm;
$('saveBtn').onclick = save;
$('menuBtn').onclick = () => { $('menu').hidden = !$('menu').hidden; $('menuMsg').textContent = ''; };
$('exportBtn').onclick = exportBackup;
$('importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importFile(f); e.target.value = ''; });

/* ----- start ----- */
buildOpts('f-meals', MEALS); buildOpts('f-alts', ALTS);
$('fMeal').innerHTML = '<option value="">Any meal</option>' + MEALS.map(m => '<option>'+m+'</option>').join('');
$('fProt').innerHTML = '<option value="">Any protein</option>' + PROTEINS.slice(0,6).map(p => '<option>'+p+'</option>').join('');
$('fMeal').addEventListener('change', draw); $('fProt').addEventListener('change', draw);
recipes = load();
drawChips(); draw();

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
