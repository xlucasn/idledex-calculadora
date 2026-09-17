(function(){
  const SPRITE='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  function addThumbs(){
    if(!window.DATA) return;
    document.querySelectorAll('.xp-fauna-label').forEach(label=>{
      if(label.querySelector('.pokemon-thumb')) return;
      const name=label.querySelector('strong')?.textContent?.trim();
      const p=DATA.pokemon.find(x=>String(x.name||'').trim()===name || String(x.name||'').trim().toLowerCase()===name?.toLowerCase());
      if(!p || !p.id) return;
      const img=document.createElement('img');
      img.className='pokemon-thumb'; img.alt=''; img.title=name;
      img.loading='lazy'; img.src=SPRITE+encodeURIComponent(p.id)+'.png';
      img.onerror=()=>img.remove();
      label.querySelector('strong')?.before(img);
    });
  }
  new MutationObserver(addThumbs).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',addThumbs);
})();
