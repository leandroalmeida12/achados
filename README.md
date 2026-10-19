# Leandro Tech Achados

Vitrine "link na bio" com os achados do Mercado Livre e da Shopee, e o painel para cadastrar as ofertas.

- **Vitrine (pública):** https://leandroalmeida12.github.io/achados/
- **Painel (só você usa):** https://leandroalmeida12.github.io/achados/admin.html

## Como funciona

1. No painel, cole o **link oficial de afiliado** do produto, o nome, o preço e a foto
2. Ao salvar, a oferta ganha um **número** (achado nº 1, 2, 3…) e entra na vitrine em cerca de 1 minuto
3. O painel gera na hora a **arte para Stories/Reels e Feed**, a **legenda do Instagram**, a **legenda do TikTok** e um **roteiro de vídeo**
4. No vídeo ou post você fala "achado nº 23, link na bio", e o seguidor digita o número na vitrine

Dica: no Story, use a figurinha de link com o endereço `https://leandroalmeida12.github.io/achados/#23`, que já abre direto no achado.

## Primeiro acesso ao painel: criar o token

O painel salva as ofertas neste repositório pela API do GitHub. Para isso ele precisa de um token:

1. github.com → foto → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
2. Nome: `painel-achados`. Validade: 1 ano
3. **Repository access → Only select repositories →** `achados`
4. **Permissions → Repository permissions → Contents → Read and write**
5. Gere e cole o token no painel (marque "Lembrar neste aparelho")

O token fica guardado só no seu navegador. Nunca coloque o token em nenhum arquivo deste repositório.

## Regras dos programas de afiliados (resumo)

- Use sempre o link gerado no painel oficial de afiliados, sem encurtar nem esconder
- Coloque o preço que aparece no anúncio na hora; a vitrine avisa que o preço pode mudar
- Compras feitas por você mesmo não geram comissão

## Arquivos

- `index.html`, `vitrine.js`, `estilo.css`: vitrine pública
- `admin.html`, `admin.js`: painel
- `ofertas.json`: as ofertas (o painel edita este arquivo)
- `img/`: fotos enviadas pelo painel
