/* Painel de Achados – salva as ofertas no repositório do GitHub pela API oficial */
(function () {
  'use strict';

  const LOJAS = { ml: 'Mercado Livre', shopee: 'Shopee' };
  const CATEGORIAS = ['Beleza e cuidado pessoal', 'Moda e calçados', 'Esporte e fitness', 'Casa e decoração', 'Cozinha',
    'Bebês', 'Brinquedos', 'Ferramentas', 'Automotivo', 'Pets', 'Eletrônicos', 'Celulares e acessórios', 'Informática', 'Games', 'Outros'];
  const HASHTAGS = {
    'Beleza e cuidado pessoal': '#beleza #skincare #maquiagem #autocuidado',
    'Moda e calçados': '#moda #lookdodia #tenis #estilo',
    'Esporte e fitness': '#fitness #treino #academia #vidasaudavel',
    'Casa e decoração': '#casa #decoracao #organizacao #lar',
    'Cozinha': '#cozinha #utilidades #receitas #casa',
    'Bebês': '#bebe #maternidade #enxoval #mamae',
    'Brinquedos': '#brinquedos #criancas #presente #diversao',
    'Ferramentas': '#ferramentas #facavocemesmo #reforma #obra',
    'Automotivo': '#carro #acessoriosautomotivos #automotivo #moto',
    'Pets': '#pets #cachorro #gato #petshop',
    'Eletrônicos': '#eletronicos #tecnologia #gadgets #tech',
    'Celulares e acessórios': '#celular #acessorios #smartphone #tech',
    'Informática': '#informatica #setup #pcgamer #tecnologia',
    'Games': '#games #gamer #playstation #xbox',
  };

  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reais = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) ? '' :
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hoje = () => new Date().toISOString();
  const dataCurta = (iso) => { try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); } catch (e) { return ''; } };

  let cfg = null;          // { dono, repo, token }
  let dados = null;        // conteúdo de ofertas.json
  let sha = null;          // versão atual do arquivo no GitHub
  let editando = null;     // id da oferta em edição
  const fotosLocais = {};  // imagens recém-enviadas (antes do GitHub Pages atualizar)

  // ---------------------------------------------------------------- utilidades
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { t.style.display = 'none'; }, 3500);
  }

  function lerLocal(chave) { try { return localStorage.getItem(chave); } catch (e) { return null; } }
  function gravarLocal(chave, v) { try { if (v === null) localStorage.removeItem(chave); else localStorage.setItem(chave, v); } catch (e) { /* sem armazenamento */ } }

  function paraBase64(texto) {
    const bytes = new TextEncoder().encode(texto);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function deBase64(b64) {
    const bin = atob(b64.replace(/\n/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function gh(caminho, opcoes = {}) {
    const r = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.dono)}/${encodeURIComponent(cfg.repo)}${caminho}`, {
      method: opcoes.metodo || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + cfg.token,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opcoes.corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
      cache: 'no-store',
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(json.message || ('Erro ' + r.status));
      e.status = r.status;
      throw e;
    }
    return json;
  }

  function explicarErro(e) {
    if (e.status === 401) return 'Token inválido ou vencido. Crie um novo token no GitHub.';
    if (e.status === 403) return 'O token não tem permissão de escrita. Em "Permissions → Contents", marque "Read and write".';
    if (e.status === 404) return 'Repositório não encontrado, ou o token não tem acesso a ele.';
    if (e.status === 409) return 'O arquivo mudou enquanto você editava. Tente salvar de novo.';
    if (e instanceof TypeError) return 'Sem conexão com o GitHub. Verifique a internet.';
    return e.message;
  }

  // ---------------------------------------------------------------- dados
  async function carregar() {
    try {
      const arq = await gh('/contents/ofertas.json');
      sha = arq.sha;
      dados = JSON.parse(deBase64(arq.content));
    } catch (e) {
      if (e.status !== 404) throw e;
      sha = null;
      dados = null;
    }
    dados = dados || {};
    dados.perfil = dados.perfil || { nome: 'Leandro Tech Achados', bio: '', instagram: '', tiktok: '' };
    dados.ofertas = dados.ofertas || [];
    dados.proximo_id = Math.max(Number(dados.proximo_id) || 1, ...dados.ofertas.map((o) => Number(o.id) + 1));
  }

  async function salvar(mensagem, alterar) {
    // tenta duas vezes: se alguém salvou no meio do caminho, recarrega e reaplica a mudança
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      alterar(dados);
      dados.atualizado_em = hoje();
      try {
        const r = await gh('/contents/ofertas.json', {
          metodo: 'PUT',
          corpo: { message: mensagem, content: paraBase64(JSON.stringify(dados, null, 2) + '\n'), ...(sha ? { sha } : {}) },
        });
        sha = r.content.sha;
        return;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && tentativa === 0) { await carregar(); continue; }
        throw e;
      }
    }
  }

  async function enviarFoto(arquivo, id) {
    const dataUrl = await reduzirImagem(arquivo, 900);
    const caminho = `img/achado-${id}-${Date.now().toString(36)}.jpg`;
    await gh('/contents/' + caminho, {
      metodo: 'PUT',
      corpo: { message: `Foto do achado nº ${id}`, content: dataUrl.split(',')[1] },
    });
    fotosLocais[caminho] = dataUrl;
    return caminho;
  }

  function reduzirImagem(arquivo, max) {
    return new Promise((ok, falha) => {
      const leitor = new FileReader();
      leitor.onerror = () => falha(new Error('Não consegui ler a foto.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => falha(new Error('Arquivo de imagem inválido.'));
        img.onload = () => {
          const escala = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * escala);
          c.height = Math.round(img.height * escala);
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          ok(c.toDataURL('image/jpeg', 0.86));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  // ---------------------------------------------------------------- conexão
  async function conectar(novo, lembrar) {
    cfg = novo;
    await gh(''); // confere se o repositório existe e o token funciona
    await carregar();
    if (lembrar) gravarLocal('achados_cfg', JSON.stringify(cfg));
    $('#tela-conexao').classList.add('escondido');
    $('#app').classList.remove('escondido');
    $('#sair').classList.remove('escondido');
    mostrarAba('ofertas');
  }

  $('#form-conexao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const erro = $('#erro-conexao');
    erro.classList.add('escondido');
    const botao = e.target.querySelector('button[type=submit]');
    botao.disabled = true; botao.textContent = 'Conectando…';
    try {
      await conectar({ dono: f.get('dono').trim(), repo: f.get('repo').trim(), token: f.get('token').trim() }, f.get('lembrar') === 'on');
    } catch (err) {
      erro.textContent = explicarErro(err);
      erro.classList.remove('escondido');
      cfg = null;
    } finally {
      botao.disabled = false; botao.textContent = 'Conectar';
    }
  });

  $('#sair').addEventListener('click', () => {
    gravarLocal('achados_cfg', null);
    location.reload();
  });

  // ---------------------------------------------------------------- abas
  function mostrarAba(nome) {
    document.querySelectorAll('[data-secao]').forEach((s) => s.classList.toggle('escondido', s.dataset.secao !== nome));
    document.querySelectorAll('.aba').forEach((a) => a.setAttribute('aria-selected', String(a.dataset.aba === nome || (nome === 'arte' && a.dataset.aba === 'ofertas'))));
    if (nome === 'ofertas') desenharLista();
    if (nome === 'nova' && editando === null) prepararForm(null);
    if (nome === 'perfil') prepararPerfil();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.aba').forEach((a) => a.addEventListener('click', () => { if (a.dataset.aba === 'nova') editando = null; mostrarAba(a.dataset.aba); }));

  // ---------------------------------------------------------------- lista
  function urlFoto(img) {
    if (!img) return '';
    return fotosLocais[img] || img;
  }

  function desenharLista() {
    const ofertas = [...dados.ofertas].sort((a, b) => Number(b.id) - Number(a.id));
    const ativas = ofertas.filter((o) => o.ativo !== false).length;
    $('#resumo').textContent = `${ativas} na vitrine · ${ofertas.length} no total`;
    const corpo = $('#linhas');
    if (!ofertas.length) {
      corpo.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--tinta-3)">Nenhuma oferta ainda. Clique em <strong>+ Nova oferta</strong> pra começar.</td></tr>';
      return;
    }
    corpo.innerHTML = ofertas.map((o) => `
      <tr class="${o.ativo === false ? 'inativa' : ''}">
        <td>${o.imagem ? `<img src="${esc(urlFoto(o.imagem))}" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : ''}</td>
        <td><strong>${esc(o.id)}</strong></td>
        <td><div style="font-weight:700">${esc(o.titulo)}</div>
          <div style="font-size:12px;color:var(--tinta-3)">${esc(LOJAS[o.loja] || o.loja)}${o.categoria ? ' · ' + esc(o.categoria) : ''} · ${dataCurta(o.criado_em)}${o.destaque ? ' · ⭐ destaque' : ''}</div></td>
        <td>${reais(o.preco)}${o.preco_antigo ? `<div style="font-size:12px;color:var(--tinta-3);text-decoration:line-through">${reais(o.preco_antigo)}</div>` : ''}</td>
        <td><label class="marcar"><input type="checkbox" data-ativo="${esc(o.id)}" ${o.ativo === false ? '' : 'checked'}><span class="escondido">Mostrar na vitrine</span></label></td>
        <td style="white-space:nowrap"><div class="linha-botoes">
          <button class="botao peq prim" type="button" data-arte="${esc(o.id)}">Arte e legenda</button>
          <button class="botao peq" type="button" data-editar="${esc(o.id)}">Editar</button>
          <button class="botao peq perigo" type="button" data-apagar="${esc(o.id)}">Apagar</button>
        </div></td>
      </tr>`).join('');
    corpo.querySelectorAll('[data-ativo]').forEach((c) => c.addEventListener('change', async () => {
      const id = Number(c.dataset.ativo);
      c.disabled = true;
      try {
        await salvar(`${c.checked ? 'Mostra' : 'Esconde'} achado nº ${id}`, (d) => { const o = d.ofertas.find((x) => Number(x.id) === id); if (o) o.ativo = c.checked; });
        toast(c.checked ? 'Voltou pra vitrine.' : 'Saiu da vitrine.');
        desenharLista();
      } catch (e) { toast(explicarErro(e)); c.checked = !c.checked; } finally { c.disabled = false; }
    }));
    corpo.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => { editando = Number(b.dataset.editar); mostrarAba('nova'); prepararForm(editando); }));
    corpo.querySelectorAll('[data-arte]').forEach((b) => b.addEventListener('click', () => abrirArte(Number(b.dataset.arte))));
    corpo.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', () => confirmarApagar(b)));
  }

  function confirmarApagar(botao) {
    // confirmação em duas etapas no próprio botão (sem janelas do navegador)
    if (botao.dataset.confirmar !== '1') {
      botao.dataset.confirmar = '1';
      botao.textContent = 'Confirmar?';
      setTimeout(() => { if (botao.isConnected) { botao.dataset.confirmar = ''; botao.textContent = 'Apagar'; } }, 4000);
      return;
    }
    const id = Number(botao.dataset.apagar);
    botao.disabled = true;
    salvar(`Apaga achado nº ${id}`, (d) => { d.ofertas = d.ofertas.filter((o) => Number(o.id) !== id); })
      .then(() => { toast(`Achado nº ${id} apagado.`); desenharLista(); })
      .catch((e) => { toast(explicarErro(e)); botao.disabled = false; });
  }

  // ---------------------------------------------------------------- formulário
  const form = $('#form-oferta');
  $('#lista-categorias').innerHTML = CATEGORIAS.map((c) => `<option value="${esc(c)}"></option>`).join('');

  function prepararForm(id) {
    form.reset();
    $('#erro-form').classList.add('escondido');
    const o = id !== null ? dados.ofertas.find((x) => Number(x.id) === id) : null;
    $('#titulo-form').textContent = o ? `Editar achado nº ${o.id}` : `Nova oferta (vai ser o achado nº ${dados.proximo_id})`;
    $('#salvar-oferta').textContent = o ? 'Salvar alterações' : 'Salvar e publicar';
    if (o) {
      form.loja.value = o.loja || 'ml';
      form.categoria.value = o.categoria || '';
      form.link.value = o.link || '';
      form.titulo.value = o.titulo || '';
      form.preco.value = o.preco ?? '';
      form.preco_antigo.value = o.preco_antigo ?? '';
      form.imagem.value = o.imagem || '';
      form.destaque.checked = !!o.destaque;
      form.ativo.checked = o.ativo !== false;
    }
  }

  function erroForm(msg) {
    const el = $('#erro-form');
    el.textContent = msg;
    el.classList.remove('escondido');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#erro-form').classList.add('escondido');
    const link = form.link.value.trim();
    const titulo = form.titulo.value.trim();
    const preco = Number(form.preco.value);
    const precoAntigo = form.preco_antigo.value === '' ? null : Number(form.preco_antigo.value);
    if (!/^https:\/\//i.test(link)) return erroForm('Cole o link de afiliado completo, começando com https://');
    if (!titulo) return erroForm('Escreva o nome do produto.');
    if (!(preco > 0)) return erroForm('Informe o preço atual do anúncio.');
    if (precoAntigo !== null && precoAntigo <= preco) return erroForm('O preço antigo precisa ser maior que o atual (ou deixe em branco).');
    let imagem = form.imagem.value.trim();
    if (imagem && !/^https:\/\//i.test(imagem) && !/^img\//.test(imagem)) return erroForm('O endereço da foto precisa começar com https://');

    const botao = $('#salvar-oferta');
    botao.disabled = true;
    const textoBotao = botao.textContent;
    try {
      const id = editando !== null ? editando : dados.proximo_id;
      const arquivo = form.arquivo.files[0];
      if (arquivo) { botao.textContent = 'Enviando foto…'; imagem = await enviarFoto(arquivo, id); }
      botao.textContent = 'Publicando…';
      const campos = {
        loja: form.loja.value, categoria: form.categoria.value.trim(), link, titulo, preco,
        preco_antigo: precoAntigo, imagem, destaque: form.destaque.checked, ativo: form.ativo.checked,
      };
      if (editando !== null) {
        await salvar(`Edita achado nº ${id}`, (d) => { const o = d.ofertas.find((x) => Number(x.id) === id); if (o) Object.assign(o, campos); });
        toast(`Achado nº ${id} atualizado.`);
      } else {
        let novoId = id;
        await salvar(`Novo achado: ${titulo.slice(0, 60)}`, (d) => {
          novoId = d.proximo_id;
          d.ofertas = d.ofertas.filter((o) => Number(o.id) !== novoId);
          d.ofertas.push({ id: novoId, ...campos, criado_em: hoje() });
          d.proximo_id = novoId + 1;
        });
        toast(`Achado nº ${novoId} publicado! A vitrine atualiza em cerca de 1 minuto.`);
        editando = null;
        abrirArte(novoId);
        return;
      }
      editando = null;
      mostrarAba('ofertas');
    } catch (err) {
      erroForm(explicarErro(err));
    } finally {
      botao.disabled = false;
      botao.textContent = textoBotao;
    }
  });
  $('#cancelar-form').addEventListener('click', () => { editando = null; mostrarAba('ofertas'); });

  // ---------------------------------------------------------------- perfil
  const formPerfil = $('#form-perfil');
  function prepararPerfil() {
    const p = dados.perfil;
    formPerfil.nome.value = p.nome || '';
    formPerfil.bio.value = p.bio || '';
    formPerfil.instagram.value = p.instagram || '';
    formPerfil.tiktok.value = p.tiktok || '';
  }
  formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();
    const novo = {
      nome: formPerfil.nome.value.trim(), bio: formPerfil.bio.value.trim(),
      instagram: formPerfil.instagram.value.trim().replace(/^@/, ''), tiktok: formPerfil.tiktok.value.trim().replace(/^@/, ''),
    };
    try { await salvar('Atualiza perfil da vitrine', (d) => { d.perfil = novo; }); toast('Perfil salvo.'); } catch (err) { toast(explicarErro(err)); }
  });

  // ---------------------------------------------------------------- arte e legendas
  function enderecoVitrine(id) {
    const base = location.href.replace(/admin\.html.*$/, '').replace(/[?#].*$/, '');
    return base + (id ? '#' + id : '');
  }

  function desconto(o) {
    if (!o.preco_antigo || !o.preco || o.preco_antigo <= o.preco) return 0;
    return Math.round((1 - o.preco / o.preco_antigo) * 100);
  }

  function hashtags(o) {
    const loja = o.loja === 'ml' ? '#mercadolivre #achadosmercadolivre' : '#shopee #achadosshopee';
    return `#achados #promocao #oferta ${loja} ${HASHTAGS[o.categoria] || ''}`.replace(/\s+/g, ' ').trim();
  }

  function legendas(o) {
    const d = desconto(o);
    const loja = LOJAS[o.loja] || 'loja';
    const preco = d ? `De ${reais(o.preco_antigo)} por ${reais(o.preco)} (${d}% OFF)` : `Por ${reais(o.preco)}`;
    const insta = [
      `🔥 ACHADO Nº ${o.id}`,
      '',
      o.titulo,
      '',
      `💰 ${preco}`,
      `🛒 ${loja}`,
      '',
      `👉 Link na bio! Procure pelo nº ${o.id}.`,
      '',
      `⚠️ Preço visto em ${dataCurta(o.criado_em || hoje())}. Promoções mudam rápido, confira antes de comprar.`,
      '',
      hashtags(o),
    ].join('\n');
    const tiktok = `Achado nº ${o.id}: ${o.titulo} ${d ? `com ${d}% OFF` : ''} 🔥 Link na bio, procure pelo número ${o.id}! ${hashtags(o)} #fyp #tiktokachados`.replace(/\s+/g, ' ').trim();
    const roteiro = [
      'GANCHO (0 a 3s): mostre o produto na mão ou na tela',
      `"${d >= 20 ? `Esse aqui tá com ${d}% de desconto e eu precisava te mostrar!` : 'Olha o achado que eu encontrei hoje!'}"`,
      '',
      'MOSTRAR (3 a 15s): 2 ou 3 detalhes que aparecem no anúncio',
      `"É ${o.titulo.toLowerCase()}, tá saindo por ${reais(o.preco)} ${o.loja === 'ml' ? 'no Mercado Livre' : o.loja === 'shopee' ? 'na Shopee' : 'na loja'}."`,
      '(mostre a foto do anúncio, as avaliações e um detalhe do produto)',
      '',
      'CHAMADA (15 a 20s): número grande na tela',
      `"Corre que promoção acaba rápido! É o achado número ${o.id}, o link tá na minha bio."`,
      '',
      'DICA: use a arte de Stories como capa e deixe o número na tela o vídeo todo.',
    ].join('\n');
    return { insta, tiktok, roteiro };
  }

  function carregarImagem(src) {
    return new Promise((ok) => {
      if (!src) return ok({ img: null, bloqueada: false });
      const img = new Image();
      if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => ok({ img, bloqueada: false });
      img.onerror = () => ok({ img: null, bloqueada: true });
      img.src = src;
    });
  }

  function retanguloArredondado(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function quebrarTexto(ctx, texto, largura, maxLinhas) {
    const palavras = String(texto).split(/\s+/);
    const linhas = [];
    let atual = '';
    for (const p of palavras) {
      const teste = atual ? atual + ' ' + p : p;
      if (ctx.measureText(teste).width <= largura) atual = teste;
      else { if (atual) linhas.push(atual); atual = p; }
      if (linhas.length === maxLinhas) break;
    }
    if (linhas.length < maxLinhas && atual) linhas.push(atual);
    if (linhas.length === maxLinhas && palavras.join(' ').length > linhas.join(' ').length) {
      let ultima = linhas[maxLinhas - 1];
      while (ctx.measureText(ultima + '…').width > largura && ultima.length) ultima = ultima.slice(0, -1);
      linhas[maxLinhas - 1] = ultima.trimEnd() + '…';
    }
    return linhas;
  }

  function desenharArte(canvas, o, foto, formato) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const story = formato === 'story';
    const d = desconto(o);
    const T = "'Bricolage Grotesque', Arial, sans-serif";
    const B = "'Manrope', Arial, sans-serif";

    // fundo
    ctx.fillStyle = '#14161F';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FF4F2E';
    ctx.beginPath(); ctx.arc(W + 80, -60, story ? 420 : 340, 0, Math.PI * 2); ctx.fill();

    // marca
    const topo = story ? 120 : 70;
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${story ? 44 : 38}px ${T}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText((dados.perfil.nome || 'Leandro Tech Achados').toUpperCase(), 70, topo);

    // selo do número
    const seloY = topo + (story ? 50 : 36);
    ctx.font = `800 ${story ? 92 : 76}px ${T}`;
    const textoNum = `ACHADO Nº ${o.id}`;
    const wNum = ctx.measureText(textoNum).width + 70;
    ctx.fillStyle = '#FF4F2E';
    retanguloArredondado(ctx, 70, seloY, wNum, story ? 130 : 108, 28); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(textoNum, 105, seloY + (story ? 98 : 82));

    // cartão do produto
    const cardY = seloY + (story ? 180 : 140);
    const cardH = story ? 1120 : 860;
    ctx.fillStyle = '#fff';
    retanguloArredondado(ctx, 60, cardY, W - 120, cardH, 44); ctx.fill();

    // foto
    const fotoH = story ? 560 : 400;
    const fx = 110, fy = cardY + 50, fw = W - 220, fh = fotoH;
    if (foto) {
      const esc2 = Math.min(fw / foto.width, fh / foto.height);
      const iw = foto.width * esc2, ih = foto.height * esc2;
      ctx.drawImage(foto, fx + (fw - iw) / 2, fy + (fh - ih) / 2, iw, ih);
    } else {
      ctx.fillStyle = '#F4F2EE';
      retanguloArredondado(ctx, fx, fy, fw, fh, 28); ctx.fill();
      ctx.fillStyle = '#636A7E'; ctx.font = `600 36px ${B}`; ctx.textAlign = 'center';
      ctx.fillText('Foto do produto', W / 2, fy + fh / 2);
      ctx.textAlign = 'left';
    }

    // desconto
    if (d >= 5) {
      ctx.fillStyle = '#FF4F2E';
      retanguloArredondado(ctx, W - 330, cardY + 40, 230, 100, 24); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 58px ${T}`; ctx.textAlign = 'center';
      ctx.fillText(`-${d}%`, W - 215, cardY + 112); ctx.textAlign = 'left';
    }

    // loja
    let y = fy + fh + (story ? 70 : 50);
    const loja = LOJAS[o.loja] || '';
    ctx.font = `800 30px ${B}`;
    const wLoja = ctx.measureText(loja.toUpperCase()).width + 40;
    ctx.fillStyle = o.loja === 'ml' ? '#FFE600' : '#EE4D2D';
    retanguloArredondado(ctx, 110, y - 40, wLoja, 56, 12); ctx.fill();
    ctx.fillStyle = o.loja === 'ml' ? '#2D3277' : '#fff';
    ctx.fillText(loja.toUpperCase(), 130, y - 2);

    // preços ancorados no rodapé do cartão (nunca vazam)
    const precoY = cardY + cardH - (story ? 70 : 56);
    const deY = precoY - (story ? 112 : 94);

    // título: usa só o espaço que sobra entre a loja e os preços
    y += story ? 80 : 64;
    const alturaLinha = story ? 64 : 56;
    const limite = (d >= 1 ? deY - (story ? 66 : 54) : precoY - (story ? 124 : 104));
    const cabem = Math.max(1, Math.min(story ? 3 : 2, Math.floor((limite - y) / alturaLinha) + 1));
    ctx.fillStyle = '#14161F';
    ctx.font = `700 ${story ? 50 : 44}px ${B}`;
    const linhas = quebrarTexto(ctx, o.titulo, W - 220, cabem);
    linhas.forEach((l, i) => ctx.fillText(l, 110, y + i * alturaLinha));

    if (d >= 1) {
      ctx.fillStyle = '#636A7E';
      ctx.font = `600 ${story ? 42 : 36}px ${B}`;
      const de = 'De ' + reais(o.preco_antigo);
      ctx.fillText(de, 110, deY);
      const wDe = ctx.measureText(de).width;
      ctx.fillRect(110, deY - (story ? 14 : 12), wDe, 4);
    }
    ctx.fillStyle = '#14161F';
    ctx.font = `800 ${story ? 110 : 92}px ${T}`;
    ctx.fillText(reais(o.preco), 110, precoY);

    // chamada final
    const ctaY = cardY + cardH + (story ? 90 : 60);
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${story ? 70 : 54}px ${T}`;
    ctx.textAlign = 'center';
    ctx.fillText('LINK NA BIO 👆', W / 2, ctaY);
    ctx.font = `600 ${story ? 40 : 34}px ${B}`;
    ctx.fillStyle = '#C9CDD8';
    ctx.fillText(`Procure pelo achado nº ${o.id}`, W / 2, ctaY + (story ? 70 : 54));
    if (story) {
      ctx.font = `500 28px ${B}`;
      ctx.fillStyle = '#8A90A2';
      ctx.fillText(`Preço visto em ${dataCurta(o.criado_em || hoje())}. Pode mudar.`, W / 2, H - 70);
    }
    ctx.textAlign = 'left';
  }

  async function abrirArte(id) {
    const o = dados.ofertas.find((x) => Number(x.id) === id);
    if (!o) return;
    mostrarAba('arte');
    $('#titulo-arte').textContent = `Arte e legenda · achado nº ${o.id}`;
    const l = legendas(o);
    $('#leg-insta').value = l.insta;
    $('#leg-tiktok').value = l.tiktok;
    $('#roteiro').value = l.roteiro;
    $('#link-story').value = o.link;
    const erro = $('#erro-arte');
    erro.classList.add('escondido');
    try { await document.fonts.load("800 40px 'Bricolage Grotesque'"); await document.fonts.load("700 40px 'Manrope'"); } catch (e) { /* usa fonte padrão */ }
    const { img, bloqueada } = await carregarImagem(urlFoto(o.imagem));
    for (const [formato, canvas] of [['story', $('#cv-story')], ['feed', $('#cv-feed')]]) desenharArte(canvas, o, img, formato);
    // confere se a loja permite usar a foto (senão o navegador bloqueia o download da arte)
    let travada = bloqueada;
    try { $('#cv-feed').getContext('2d').getImageData(0, 0, 1, 1); } catch (e) { travada = true; }
    if (travada) {
      for (const [formato, canvas] of [['story', $('#cv-story')], ['feed', $('#cv-feed')]]) desenharArte(canvas, o, null, formato);
      erro.innerHTML = 'A loja não deixa usar essa foto direto na arte. Tire um <strong>print do produto</strong>, clique em <strong>Editar</strong> e envie a foto pelo campo "Ou enviar foto do aparelho".';
      erro.classList.remove('escondido');
    }
    abrirArte.atual = o;
  }

  document.querySelectorAll('[data-baixar]').forEach((b) => b.addEventListener('click', () => {
    const o = abrirArte.atual;
    if (!o) return;
    const canvas = b.dataset.baixar === 'story' ? $('#cv-story') : $('#cv-feed');
    try {
      canvas.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `achado-${o.id}-${b.dataset.baixar}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, 'image/png');
    } catch (e) { toast('Não foi possível baixar a arte com essa foto. Envie a foto pelo painel.'); }
  }));

  document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    const campo = document.getElementById(b.dataset.copiar);
    try { await navigator.clipboard.writeText(campo.value); toast('Copiado!'); }
    catch (e) { campo.select(); document.execCommand('copy'); toast('Copiado!'); }
  }));
  $('#voltar-arte').addEventListener('click', () => mostrarAba('ofertas'));

  // ---------------------------------------------------------------- início
  (async function () {
    const salvo = lerLocal('achados_cfg');
    if (!salvo) return;
    try {
      const c = JSON.parse(salvo);
      $('#form-conexao').dono.value = c.dono; $('#form-conexao').repo.value = c.repo;
      await conectar(c, true);
    } catch (e) {
      const erro = $('#erro-conexao');
      erro.textContent = explicarErro(e) + ' Conecte de novo.';
      erro.classList.remove('escondido');
    }
  })();
})();
