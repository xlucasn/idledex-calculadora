let DATA;

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));

async function init(){
  const res = await fetch('data/idledex-data.json');
  DATA = await res.json();
  fillLists();
  fillMapSelect();
  bindTabs();
  bindSearches();
  $('xpCalc').onclick = calcXP;
  $('silverCalc').onclick = calcSilver;
}

function fillLists(){
  const names = DATA.pokemon.map(p=>p.name).sort();
  for(const id of ['pokemonList','pokemonList2']) $(id).innerHTML = names.map(n=>`<option value="${escapeHtml(n)}">`).join('');
}

function fillMapSelect(){
  $('xpMap').innerHTML = `<option value="">Todos os mapas cadastrados</option>` + DATA.maps.map(m=>`<option>${escapeHtml(m.name)}</option>`).join('');
}

function bindTabs(){
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.tab,.panel').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  });
}

function findPokemon(value){
  return DATA.pokemon.find(p=>p.name.toLowerCase()===value.trim().toLowerCase());
}

function bindSearches(){
  $('captureSearch').addEventListener('input',()=>renderPokemon(findPokemon($('captureSearch').value),$('captureResult')));
  $('evolveSearch').addEventListener('input',()=>renderEvolution(findPokemon($('evolveSearch').value)));
}

function renderPokemon(p,target){
  if(!p){target.className='results empty';target.textContent='Digite ou selecione um Pokémon cadastrado.';return}
  const maps=[...p.maps].sort((a,b)=>b.chance-a.chance);
  target.className='results';
  target.innerHTML=maps.map((m,i)=>`<article class="result"><div class="result-head"><strong>#${p.id} ${escapeHtml(m.name)}</strong><span class="badge">${m.chance}%</span></div><div class="meta">Nível ${m.min}–${m.max} • ${escapeHtml(m.rarity)} • ${i===0?'maior chance cadastrada':''}</div></article>`).join('');
}

function renderEvolution(p){
  const target=$('evolveResult');
  if(!p){target.className='results empty';target.textContent='Digite ou selecione um Pokémon cadastrado.';return}
  target.className='results';
  target.innerHTML=`<article class="result"><div class="result-head"><strong>${escapeHtml(p.name)}</strong><span class="badge">Lv ${p.evolutionLevel}</span></div><div class="meta">Evolui para <strong>${escapeHtml(p.evolution)}</strong>. Use a aba Pokémon para consultar os mapas de captura disponíveis.</div></article>`;
}

function calcXP(){
  const level=Number($('xpLevel').value||1), selected=$('xpMap').value;
  let maps=DATA.maps.filter(m=>!selected||m.name===selected);
  maps=maps.filter(m=>m.maxLevel>=level);
  maps.sort((a,b)=>a.minLevel-b.minLevel);
  $('xpResult').innerHTML=maps.length?maps.map(m=>{
    const safe=m.minLevel<=level && level<=m.maxLevel;
    const gap=Math.max(0,m.minLevel-level);
    return `<article class="result"><div class="result-head"><strong>${escapeHtml(m.name)}</strong><span class="${safe?'positive':'warning'}">${safe?'faixa compatível':'acima do nível atual'}</span></div><div class="meta">Faixa cadastrada: Lv ${m.minLevel}–${m.maxLevel} • ${safe?'sem alerta de faixa':'faltam '+gap+' níveis para entrar na faixa'}</div></article>`;
  }).join(''):'<div class="results empty">Nenhum mapa cadastrado atende ao filtro. Isso não significa que não exista no jogo; significa apenas que o dataset V12 ainda precisa ser ampliado.</div>';
}

function calcSilver(){
  const per=Number($('silverPerWin').value||0), wins=Number($('winsHour').value||0), bonus=Number($('silverBonus').value||0);
  const hourly=per*wins*(1+bonus/100), daily=hourly*24;
  $('silverResult').innerHTML=`<article class="result"><div class="result-head"><strong>Rendimento estimado</strong><span class="badge">${Math.round(hourly).toLocaleString('pt-BR')} / hora</span></div><div class="meta">${Math.round(daily).toLocaleString('pt-BR')} Silver / 24h • cálculo baseado nos valores que você informou • bônus aplicado: ${bonus}%</div></article>`;
}

init().catch(err=>{
  console.error(err);
  document.querySelectorAll('.panel').forEach(p=>p.insertAdjacentHTML('beforeend','<div class="card danger">Não foi possível carregar o dataset. Verifique se o site está servindo a pasta data/.</div>'));
});
