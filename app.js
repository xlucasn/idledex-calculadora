let DATA;

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
const money = (n) => Math.round(n).toLocaleString('pt-BR');

function fixText(value){
  let text = String(value ?? '');
  for(let i = 0; i < 2 && /[ÃÂâ]/.test(text); i++){
    try{
      const bytes = new Uint8Array(Array.from(text, ch => ch.charCodeAt(0) & 255));
      const decoded = new TextDecoder('utf-8', {fatal:true}).decode(bytes);
      if(decoded === text) break;
      text = decoded;
    }catch(e){ break; }
  }
  return text.replace(/\uFFFD/g, '').trim();
}

function displayMap(m){ return fixText(m.name); }
function displayPokemon(p){ return fixText(p.name); }
function displayTypes(p){ return (p.types || []).map(fixText).filter(Boolean); }
function typeClass(type){
  const key=fixText(type).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
  const aliases={planta:'grass',grama:'grass',grass:'grass',veneno:'poison',poison:'poison',fogo:'fire',fire:'fire',agua:'water',water:'water',eletrico:'electric',electric:'electric',gelo:'ice',ice:'ice',lutador:'fighting',fighting:'fighting',terrestre:'ground',ground:'ground',voador:'flying',flying:'flying',psiquico:'psychic',psychic:'psychic',inseto:'bug',bug:'bug',pedra:'rock',rock:'rock',fantasma:'ghost',ghost:'ghost',dragao:'dragon',dragon:'dragon',sombrio:'dark',dark:'dark',aco:'steel',steel:'steel',fada:'fairy',fairy:'fairy',normal:'normal'};
  return `type-${aliases[key]||key||'unknown'}`;
}

async function init(){
  const res = await fetch(`data/idledex-data.json?v=${Date.now()}`, {cache:'no-store'});
  if(!res.ok) throw new Error(`Dataset HTTP ${res.status}`);
  DATA = await res.json();
  fillLists(); fillMapSelect(); bindTabs(); bindSearches();
  $('xpCalc').onclick = calcXP; $('silverCalc').onclick = calcSilver; $('collectorCalc').onclick = calcCollectors;
}

function fillLists(){
  const names = [...new Set(DATA.pokemon.map(p => displayPokemon(p)))].sort((a,b) => a.localeCompare(b, 'pt-BR'));
  for(const id of ['pokemonList','pokemonListXp']) $(id).innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');
}

function mapProgressionSort(a,b){
  const nameA = displayMap(a), nameB = displayMap(b);
  const routeA = nameA.match(/^Rota\s+(\d+)/i), routeB = nameB.match(/^Rota\s+(\d+)/i);
  if(routeA && routeB){ const numA=Number(routeA[1]), numB=Number(routeB[1]); if(numA!==numB) return numA-numB; return nameA.localeCompare(nameB,'pt-BR'); }
  if(routeA) return -1; if(routeB) return 1; return nameA.localeCompare(nameB,'pt-BR');
}

function fillMapSelect(){
  const maps = [...DATA.maps].sort(mapProgressionSort);
  $('xpMap').innerHTML = `<option value="">Todos os mapas cadastrados</option>` + maps.map(m => `<option value="${escapeHtml(m.name)}">${escapeHtml(`${displayMap(m)} — Lv ${m.minLevel}–${m.maxLevel}`)}</option>`).join('');
}

function bindTabs(){
  document.querySelectorAll('.tab').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.tab,.panel').forEach(x => x.classList.remove('active'));
    btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
  });
}

function findPokemon(value){
  const clean = fixText(value).trim().toLowerCase();
  return DATA.pokemon.find(p => displayPokemon(p).toLowerCase() === clean || p.name.toLowerCase() === clean);
}

function bindSearches(){
  $('captureSearch').addEventListener('input', () => renderPokemon(findPokemon($('captureSearch').value), $('captureResult')));
  $('xpPokemon').addEventListener('input', () => { const p=findPokemon($('xpPokemon').value); if(p && $('xpLevel').value) calcXP(); });
  $('xpLevel').addEventListener('input', () => { if($('xpPokemon').value) calcXP(); });
}

function renderPokemon(p,target){
  if(!p){ target.className='results empty'; target.textContent='Digite ou selecione um Pokémon cadastrado.'; return; }
  const maps=[...(p.maps||[])].sort((a,b)=>b.chance-a.chance); target.className='results';
  if(!maps.length){ target.innerHTML=`<article class="result"><div class="result-head"><strong>${escapeHtml(displayPokemon(p))}</strong><span class="badge">Sem mapa específico</span></div><div class="meta">A Wiki informa que esta espécie pode aparecer pela tabela geral de nível de treinador, mas não há mapa específico listado para ela.</div></article>`; return; }
  const best=maps[0];
  target.innerHTML=`<article class="result"><div class="result-head"><strong>${escapeHtml(displayMap(best))}</strong><span class="badge">${best.chance}%</span></div><div class="meta">Nível ${best.min}–${best.max} • ${escapeHtml(fixText(best.rarity))} • maior chance cadastrada</div></article>`;
}

function getMapFauna(mapName){
  const byId=new Map();
  DATA.pokemon.forEach(p=>{
    const match=(p.maps||[]).find(m=>fixText(m.name)===fixText(mapName));
    if(!match || byId.has(p.id)) return;
    byId.set(p.id,{id:p.id,name:displayPokemon(p),types:displayTypes(p),chance:Number(match.chance||0),min:Number(match.min||0),max:Number(match.max||0),rarity:fixText(match.rarity)});
  });
  const fauna=[...byId.values()].filter(x=>Number.isFinite(x.chance)&&x.chance>0);
  const total=fauna.reduce((sum,x)=>sum+x.chance,0);
  return fauna.map(x=>({...x,percentage:total>0?(x.chance/total)*100:0})).sort((a,b)=>b.percentage-a.percentage || a.name.localeCompare(b.name,'pt-BR'));
}

function pokemonSprite(id){ return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${encodeURIComponent(id)}.png`; }

function renderFaunaChart(mapName){
  const fauna=getMapFauna(mapName);
  if(!fauna.length) return '<div class="xp-fauna-empty">A fauna detalhada deste mapa não foi encontrada na base atual.</div>';
  const rows=fauna.map(x=>{
    const types=x.types.length?x.types.map(t=>`<span class="type-badge ${typeClass(t)}">${escapeHtml(t)}</span>`).join(''):'<span class="type-badge type-unknown">Tipo não identificado</span>';
    const pct=x.percentage.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    return `<div class="xp-fauna-item"><div class="xp-fauna-top"><img class="pokemon-thumb" src="${pokemonSprite(x.id)}" alt="${escapeHtml(x.name)}" loading="lazy" onerror="this.style.display='none'"><strong>${escapeHtml(x.name)}</strong></div><div class="xp-fauna-chance">${pct}%</div><div class="xp-fauna-types">${types}</div><div class="xp-fauna-level">Lv ${x.min}–${x.max}</div></div>`;
  }).join('');
  return `<div class="xp-fauna"><div class="result-head"><strong>Fauna do mapa</strong><span class="badge">${fauna.length} espécies</span></div><div class="meta">Chance proporcional entre as espécies cadastradas neste mapa. Soma das porcentagens: 100%.</div><div class="xp-fauna-chart">${rows}</div></div>`;
}

function calcXP(){
  const pokemon=findPokemon($('xpPokemon').value||''), level=Number($('xpLevel').value||1), selectedName=$('xpMap').value;
  const selectedMap=DATA.maps.find(m=>m.name===selectedName), target=$('xpResult');
  if(!pokemon){ target.className='results empty'; target.textContent='Primeiro selecione o Pokémon que você quer upar.'; return; }
  if(level<1||level>100){ target.className='results empty'; target.textContent='Informe um nível entre 1 e 100.'; return; }
  const unlockMax=selectedMap?Number(selectedMap.maxLevel):Infinity;
  const maps=DATA.maps.filter(m=>Number(m.maxLevel)<=unlockMax).filter(m=>Number(m.maxLevel)<=level).sort((a,b)=>Number(b.maxLevel)-Number(a.maxLevel)||Number(b.minLevel)-Number(a.minLevel)||displayMap(a).localeCompare(displayMap(b),'pt-BR'));
  target.className='results';
  if(!maps.length){ target.innerHTML=`<article class="result"><div class="result-head"><strong>Nenhum mapa seguro pelo critério atual</strong><span class="warning">⚠️</span></div><div class="meta">Com o Pokémon ${escapeHtml(displayPokemon(pokemon))} no Lv ${level}, nenhum mapa dentro do seu limite de mapas liberados tem nível máximo dos selvagens ≤ seu nível.</div></article>`; return; }
  const best=maps[0], unlockText=selectedMap?`Seu limite: ${escapeHtml(displayMap(selectedMap))} (Lv ${selectedMap.minLevel}–${selectedMap.maxLevel}).`:'Sem limite de mapa selecionado.';
  const faunaChart=renderFaunaChart(best.name);
  target.innerHTML=`<article class="result featured-result"><div class="result-head"><strong>🏆 Melhor mapa para upar</strong><span class="positive">Lv ${best.minLevel}–${best.maxLevel}</span></div><h3>${escapeHtml(displayMap(best))}</h3><div class="meta">${escapeHtml(displayPokemon(pokemon))} Lv ${level} • nível máximo selvagem ${best.maxLevel} • critério conservador atendido.</div><div class="meta muted">${unlockText}</div>${faunaChart}</article><article class="result"><div class="result-head"><strong>⏱️ XP por hora</strong><span class="badge">Não estimável com segurança</span></div><div class="meta">A Wiki informa níveis, espécies, chances e dados de experiência, mas não fornece uma taxa confiável de batalhas/XP por hora. Para não inventar um número, não mostraremos uma estimativa baseada apenas na Wiki.</div></article>`;
}

function calcSilver(){ const per=Number($('silverPerWin').value||0),wins=Number($('winsHour').value||0),bonus=Number($('silverBonus').value||0),hourly=per*wins*(1+bonus/100),daily=hourly*24; $('silverResult').innerHTML=per>0?`<article class="result"><div class="result-head"><strong>Rendimento estimado</strong><span class="badge">${money(hourly)} / hora</span></div><div class="meta">${money(daily)} Silver / 24h • bônus aplicado: ${bonus}%</div></article>`:'<div class="results empty">Silver por vitória ainda não está cadastrado com fonte verificada. Informe um valor do jogo para fazer uma estimativa manual.</div>'; }
function collectorReward(level){ const rows=DATA.mechanics.collector.rewardsByTrainerLevel; return rows.filter(r=>level>=r.minTrainerLevel).at(-1)||rows[0]; }
function calcCollectors(){ const level=Number($('collectorTrainerLevel').value||1),deliveries=Math.min(4,Math.max(0,Number($('collectorDeliveries').value||0))),windows=Math.max(1,Number($('collectorWindows').value||1)),reward=collectorReward(level),perWindow=deliveries*reward.silver,total=perWindow*windows,daily=deliveries*reward.silver*4; $('collectorResult').innerHTML=`<article class="result"><div class="result-head"><strong>Nível de treinador ${level}</strong><span class="badge">${money(reward.silver)} / entrega</span></div><div class="meta">Até ${money(perWindow)} por janela de 6h com ${deliveries} entrega(s) • ${money(daily)} por 24h se mantiver ${deliveries} entregas nas 4 janelas • ${money(total)} no período informado.</div><div class="meta muted">Limite oficial: 4 entregas por janela, somando todos os mapas.</div></article>`; }

init().catch(err=>{ console.error(err); document.querySelectorAll('.panel').forEach(p=>p.insertAdjacentHTML('beforeend','<div class="card danger">Não foi possível carregar o dataset. Verifique se o site está servindo a pasta data/.</div>')); });