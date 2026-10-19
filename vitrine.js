/* Leandro Tech Achados – vitrine pública */
(function () {
  'use strict';

  const LOJAS = { ml: 'Mercado Livre', shopee: 'Shopee' };
  const grade = document.getElementById('grade');
  const busca = document.getElementById('campo-busca');
  const filtrosEl = document.getElementById('filtros');
  let ofertas = [];
  let filtro = 'todos';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reais = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) ? '' :
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataCurta = (iso) => { try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); } catch (e) { return ''; } };
  const linkSeguro = (u) => /^https:\/\//i.test(String(u || '')) ? u : null;
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function desconto(o) {
    const de = Number(o.preco_antigo), por = Number(o.preco);
    if (!de || !por || de <= por) return 0;
    return Math.round((1 - por / de) * 100);
  }

  function icone(nome) {
    if (nome === 'instagram') return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.5 2.5 2.5 4.5 5 5"/></svg>';
  }

  function montarPerfil(p) {
    if (!p) return;
    if (p.nome) { document.getElementById('nome').textContent = p.nome; document.title = p.nome; }
    if (p.bio) document.getElementById('bio').textContent = p.bio;
    const redes = [];
    const ig = String(p.instagram || '').replace(/^@/, '').trim();
    const tt = String(p.tiktok || '').replace(/^@/, '').trim();
    if (ig) redes.push(`<a href="https://www.instagram.com/${encodeURIComponent(ig)}/" target="_blank" rel="noopener">${icone('instagram')}@${esc(ig)}</a>`);
    if (tt) redes.push(`<a href="https://www.tiktok.com/@${encodeURIComponent(tt)}" target="_blank" rel="noopener">${icone('tiktok')}@${esc(tt)}</a>`);
    document.getElementById('redes').innerHTML = redes.join('');
  }

  function montarFiltros() {
    const categorias = [...new Set(ofertas.map((o) => o.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const lojas = Object.keys(LOJAS).filter((l) => ofertas.some((o) => o.loja === l));
    const itens = [['todos', 'Todos']]
      .concat(lojas.length > 1 ? lojas.map((l) => ['loja:' + l, LOJAS[l]]) : [])
      .concat(categorias.map((c) => ['cat:' + c, c]));
    filtrosEl.innerHTML = itens.map(([v, t]) => `<button type="button" class="chip" data-f="${esc(v)}" aria-pressed="${filtro === v}">${esc(t)}</button>`).join('');
    filtrosEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.f; montarFiltros(); desenhar(); }));
  }

  function cartao(o) {
    const d = desconto(o);
    const link = linkSeguro(o.link);
    const img = linkSeguro(o.imagem) || (o.imagem && !/^[a-z]+:/i.test(o.imagem) ? o.imagem : null);
    return `<article class="oferta${o.destaque ? ' destacada' : ''}" id="achado-${esc(o.id)}">
      <div class="foto">
        ${img ? `<img src="${esc(img)}" alt="${esc(o.titulo)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'sem-foto',textContent:'Foto indisponível'}))">` : '<span class="sem-foto">Sem foto</span>'}
        <span class="num">Nº ${esc(o.id)}</span>
        ${d >= 5 ? `<span class="desc">-${d}%</span>` : ''}
      </div>
      <div class="corpo">
        <span class="loja ${esc(o.loja)}">${esc(LOJAS[o.loja] || o.loja)}</span>
        <h3>${esc(o.titulo)}</h3>
        <div class="precos">
          ${d >= 1 ? `<span class="de">${reais(o.preco_antigo)}</span>` : ''}
          ${o.preco ? `<span class="por">${reais(o.preco)}</span>` : ''}
        </div>
        ${link ? `<a class="comprar" href="${esc(link)}" target="_blank" rel="sponsored noopener nofollow">Ver oferta</a>` : ''}
        ${o.criado_em ? `<span class="data">Preço visto em ${dataCurta(o.criado_em)}. Pode mudar.</span>` : ''}
      </div>
    </article>`;
  }

  function desenhar() {
    const termo = busca.value.trim();
    const num = /^#?\d+$/.test(termo) ? Number(termo.replace('#', '')) : null;
    let lista = ofertas;
    if (filtro.startsWith('loja:')) lista = lista.filter((o) => o.loja === filtro.slice(5));
    if (filtro.startsWith('cat:')) lista = lista.filter((o) => o.categoria === filtro.slice(4));
    if (num !== null) lista = ofertas.filter((o) => Number(o.id) === num);
    else if (termo) {
      const t = semAcento(termo);
      lista = lista.filter((o) => semAcento(o.titulo + ' ' + (o.categoria || '')).includes(t));
    }
    document.getElementById('titulo-lista').textContent = num !== null ? `Achado nº ${num}` : termo ? 'Resultado da busca' : 'Achados do momento';
    document.getElementById('contagem').textContent = lista.length ? `${lista.length} ${lista.length === 1 ? 'oferta' : 'ofertas'}` : '';
    if (!ofertas.length) {
      grade.innerHTML = '<div class="vazio"><strong>Novos achados chegando!</strong>Volte em breve ou siga o perfil pra não perder nada.</div>';
    } else if (!lista.length) {
      grade.innerHTML = num !== null
        ? `<div class="vazio"><strong>Achado nº ${num} não encontrado</strong>Ele pode ter esgotado ou saído da promoção. Veja os outros achados abaixo.</div>`
        : '<div class="vazio"><strong>Nada encontrado</strong>Tente outra palavra ou o número do achado.</div>';
    } else {
      grade.innerHTML = lista.map(cartao).join('');
    }
  }

  async function iniciar() {
    try {
      const r = await fetch('ofertas.json?v=' + Date.now(), { cache: 'no-store' });
      const dados = await r.json();
      montarPerfil(dados.perfil);
      ofertas = (dados.ofertas || []).filter((o) => o.ativo !== false)
        .sort((a, b) => (Number(!!b.destaque) - Number(!!a.destaque)) || (Number(b.id) - Number(a.id)));
    } catch (e) {
      ofertas = [];
    }
    const alvo = location.hash.match(/^#(\d+)$/);
    if (alvo) busca.value = alvo[1];
    montarFiltros();
    desenhar();
  }

  let espera;
  busca.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(desenhar, 120); });
  window.addEventListener('hashchange', () => { const a = location.hash.match(/^#(\d+)$/); if (a) { busca.value = a[1]; desenhar(); } });
  iniciar();
})();
