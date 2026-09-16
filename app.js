let DATA;

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money = (n) => Math.round(n).toLocaleString('pt-BR');

async function init(){
  const res = await fetch('data/idledex-data.json');
  if(!res.ok) throw new Error(`Dataset HTTP ${res.status}`);
  DATA = await res.json();
  fillLists(); fillMapSelect(); bindTabs(); bindSearches();
  $('xpCalc').onclick = calcXP;
  $('silverCalc').onclick = calcSilver;
  $('collectorCalc').onclick = calcCollectors;
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
    btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
  });
}
function findPokemon(value){ return DATA.pokemon.find(p=>p.name.toLowerCase()===value.trim().toLowerCase()); }
function bindSearches(){
  $('captureSearch').addEventListener('input',()=>renderPokemon(findPokemon($('captureSearch').value),$('captureResult')));
  $('evolveSearch').addEventListener('input',()=>renderEvolution(findPokemon($('evolveSearch').value)));
}
function renderPokemon(p,target){
  if(!p){target.className='results empty';target.textContent='Digite ou selecione um Pokémon cadastrado.';return;}
  const maps=[...p.maps].sort((a,b)=>b.chance-a.chance);
  target.className='results';
  target.innerHTML=maps.map((m,i)=>`<article class="result"><div class="result-head"><strong>#${p.id} ${escapeHtml(m.name)}</strong><span class="badge">${m.chance}%</span></div><div class="meta">Nível ${m.min}–${m.max} • ${escapeHtml(m.rarity)} • ${i===0?'maior chance cadastrada':''}</div></article>`).join('');
}
function renderEvolution(p){
  const target=$('evolveResult');
  if(!p){target.className='results empty';target.textContent='Digite ou selecione um Pokémon cadastrado.';return;}
  target.className='results';
  target.innerHTML=`<article class="result"><div class="result-head"><strong>${escapeHtml(p.name)}</strong><span class="badge">Lv ${p.evolutionLevel}</span></div><div class="meta">Evolui para <strong>${escapeHtml(p.evolution)}</strong>.</div></article>`;
}
function calcXP(){
  const level=Number($('xpLevel').value||1), selected=$('xpMap').value;
  let maps=DATA.maps.filter(m=>!selected||m.name===selected).filter(m=>m.maxLevel>=level).sort((a,b)=>a.minLevel-b.minLevel);
  $('xpResult').innerHTML=maps.length?maps.map(m=>{
    const safe=m.minLevel<=level && level<=m.maxLevel;
    const gap=Math.max(0,m.minLevel-level);
    return `<article class="result"><div class="result-head"><strong>${escapeHtml(m.name)}</strong><span class="${safe?'positive':'warning'}">${safe?'faixa compatível':'acima do nível atual'}</span></div><div class="meta">Faixa: Lv ${m.minLevel}–${m.maxLevel} • ${safe?'compatível com o nível informado':'faltam '+gap+' níveis para entrar na faixa'}</div></article>`;
  }).join(''):'<div class="results empty">Nenhum mapa cadastrado atende ao filtro. O dataset ainda não é completo.</div>';
}
function calcSilver(){
  const per=Number($('silverPerWin').value||0), wins=Number($('winsHour').value||0), bonus=Number($('silverBonus').value||0);
  const hourly=per*wins*(1+bonus/100), daily=hourly*24;
  $('silverResult').innerHTML=per>0?`<article class="result"><div class="result-head"><strong>Rendimento estimado</strong><span class="badge">${money(hourly)} / hora</span></div><div class="meta">${money(daily)} Silver / 24h • bônus aplicado: ${bonus}%</div></article>`:'<div class="results empty">Silver por vitória ainda não está cadastrado com fonte verificada. Informe um valor do jogo para fazer uma estimativa manual.</div>';
}
function collectorReward(level){
  const rows=DATA.mechanics.collector.rewardsByTrainerLevel;
  return rows.filter(r=>level>=r.minTrainerLevel).at(-1) || rows[0];
}
function calcCollectors(){
  const level=Number($('collectorTrainerLevel').value||1);
  const deliveries=Math.min(4,Math.max(0,Number($('collectorDeliveries').value||0)));
  const windows=Math.max(1,Number($('collectorWindows').value||1));
  const reward=collectorReward(level);
  const perWindow=deliveries*reward.silver;
  const total=perWindow*windows;
  const dailyWindows=4;
  const daily=deliveries*reward.silver*dailyWindows;
  $('collectorResult').innerHTML=`<article class="result"><div class="result-head"><strong>Nível de treinador ${level}</strong><span class="badge">${money(reward.silver)} / entrega</span></div><div class="meta">Até ${money(perWindow)} por janela de 6h com ${deliveries} entrega(s) • ${money(daily)} por 24h se mantiver ${deliveries} entregas nas 4 janelas • ${money(total)} no período informado.</div><div class="meta muted">Limite oficial: 4 entregas por janela, somando todos os mapas.</div></article>`;
}
init().catch(err=>{
  console.error(err);
  document.querySelectorAll('.panel').forEach(p=>p.insertAdjacentHTML('beforeend','<div class="card danger">Não foi possível carregar o dataset. Verifique se o site está servindo a pasta data/.</div>'));
});
