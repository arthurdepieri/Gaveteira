# Gaveteira

Gaveteira é um app web/PWA para organizar consumo cultural como um arquivo pessoal: jogos, livros, discos, filmes, séries, wishlist, itens em andamento, diário, perfil social e amigos.

O projeto roda localmente no navegador, pode ser instalado no celular como PWA e também pode sincronizar dados com Supabase quando as credenciais da nuvem estiverem configuradas.

## Recursos principais

- Gavetas para jogos, livros, discos, filmes e séries, com filtros, busca, tags, notas e capas.
- Fichas próprias por categoria, com campos específicos de progresso, avaliação, links, histórico e diário.
- Diário vivo com tipos de entrada, privacidade, prompts de escrita e publicações no Feed quando a entrada for visível.
- Tela inicial com continuar, últimas adições, favoritos recentes, sugestões e atividade dos amigos.
- Perfis, amigos, convites, Feed social e visualização de fichas públicas.
- Sincronização local/nuvem com fila, pendências, reenvio e avisos de sessão expirada.
- Backup e portabilidade com exportação/importação JSON, prévia de restauração e deduplicação.
- PWA instalável no celular, com manifest, ícones, service worker e orientação em modo retrato.
- Busca automática de metadados e capas por fontes públicas e por Edge Function do Supabase quando configurada.

## Como rodar localmente

Requisitos:

- Node.js 20 ou superior.
- npm.

Instale as dependências:

```bash
npm install
```

Abra em modo desenvolvimento:

```bash
npm run dev
```

Depois acesse a URL exibida pelo Vite, normalmente:

```text
http://127.0.0.1:5173
```

Build de produção:

```bash
npm run build
```

Prévia do build:

```bash
npm run preview
```

## Experimentos locais

### Gaveteira Duel

O protótipo de jogo de cartas fica isolado em `experiments/gaveteira-duel/`. Ele não aparece na navegação principal, não usa dados reais e pode ser aberto separadamente:

```bash
npm run duel
```

URL direta:

```text
http://127.0.0.1:5173/experiments/gaveteira-duel/
```

Instruções extras ficam em `experiments/gaveteira-duel/README.md`.

## Instalar no celular

Depois de publicar a Gaveteira em HTTPS ou rodar localmente em ambiente permitido pelo navegador:

- Android/Chrome: use o aviso `Instalar Gaveteira` ou o menu do navegador > `Instalar app`.
- iPhone/Safari: toque em compartilhar e depois em `Adicionar à Tela de Início`.

Os arquivos do PWA ficam em:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons`

## Configuração da nuvem

A Gaveteira funciona localmente mesmo sem nuvem. Para login, amigos, Feed social e sincronização entre dispositivos, configure o Supabase.

1. Crie um projeto no Supabase.
2. Rode o SQL de `supabase/schema.sql` no SQL Editor.
3. Copie o Project URL e a anon public key.
4. Preencha `src/config/sharedCloud.ts`:

```ts
export const sharedCloudSettings = {
  supabaseUrl: "https://seu-projeto.supabase.co",
  supabaseAnonKey: "sua-anon-key",
};
```

As fichas de cada usuário ficam vinculadas ao próprio login. Ao sair da conta, o app limpa os dados locais da sessão anterior para evitar que uma conta veja a gaveta da outra no mesmo navegador.

## Busca automática e capas

Ao criar ou editar uma ficha, use `Completar automaticamente` para buscar dados e capas.

Fontes usadas:

- Jogos: RAWG, Steam e Wikidata.
- Livros: Google Books e Open Library, com suporte a busca por ISBN.
- Discos: MusicBrainz, Cover Art Archive e Last.fm quando configurado.
- Filmes: TMDB, OMDb, iTunes e Wikidata.
- Séries: TMDB e TVMaze.

As chaves de API podem ficar no navegador de cada pessoa em `Configurações > Chaves de APIs`. Para uma opção mais segura, salve as chaves como secrets no Supabase e faça deploy da Edge Function `metadata-search`.

```bash
supabase secrets set RAWG_API_KEY=sua_rawg
supabase secrets set TMDB_API_KEY=sua_tmdb
supabase secrets set OMDB_API_KEY=sua_omdb
supabase secrets set LASTFM_API_KEY=sua_lastfm
supabase functions deploy metadata-search
```

## Fluxo de release local

Antes de gerar um pacote beta, crie uma seção correspondente no `CHANGELOG.md`:

```md
## 0.6.3-beta - Nome da versão - 2026-05-22

Resumo curto da versão.

### Destaques

- Mudança importante.
- Outra mudança importante.
```

Depois rode:

```bash
npm run release -- 0.6.3-beta
```

Esse comando:

- compila a Gaveteira com `npm run build`;
- cria `releases/Gaveteira-0.6.3-beta.zip`;
- extrai as notas da seção `0.6.3-beta` do `CHANGELOG.md`;
- atualiza `releases/manifest.json` com versão, data, título, notas e caminho do zip.

Os zips em `releases/` são artefatos locais e ficam fora do Git. O `manifest.json` pode ser versionado como índice leve das versões empacotadas.

## Roadmap

Os próximos recursos planejados ficam em [ROADMAP.md](./ROADMAP.md).
