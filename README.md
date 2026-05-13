# Gaveteira

App web local para organizar consumo cultural como uma gaveteira pessoal: jogos, livros, albuns, filmes, series, wishlist e itens em andamento.

## O que esta pronto nesta primeira versao

- Tela inicial com gaveteira visual, contadores e itens em andamento.
- Listagens por categoria, Wishlist e Em andamento.
- Filtros por ano, status, genero, nota minima e busca por nome/tag.
- Cadastro e edicao manual com campos especificos para jogos, livros, albuns, filmes e series.
- Status personalizaveis por categoria.
- Tags, links externos, capas/posters por URL e avaliacao de 0.5 a 5 estrelas.
- Diario e historico por item.
- Estatisticas: concluidos, andamento, wishlist, notas medias, generos, tags, ranking e concluidos por ano/mes.
- Busca automatica de metadados dentro do formulario, com aplicacao manual do resultado escolhido.
- Persistencia local via `localStorage`.
- Exportacao e importacao de backup JSON.
- Area de configuracao para chaves de API, preparada para IGDB, Steam, RAWG, Google Books, Open Library, Spotify, MusicBrainz, Last.fm e TMDB.
- Modo familiar com Supabase: login, sincronizacao e gaveteiras separadas por perfil.
- Dados mockados iniciais para demonstracao.

## Como rodar

Requisitos:

- Node.js 20 ou superior.
- npm, pnpm ou outro gerenciador compativel.

Instalacao com npm:

```bash
npm install
npm run dev
```

Depois abra a URL exibida pelo Vite, normalmente:

```text
http://127.0.0.1:5173
```

Build de producao:

```bash
npm run build
npm run preview
```

## Dados locais

Os dados sao salvos no `localStorage` do navegador, na chave:

```text
gaveteira-da-vida:v1
```

Use `Configuracoes > Exportar JSON` para backup e `Importar JSON` para restaurar.

## Busca automatica

Ao criar ou editar uma ficha, use a area `Completar automaticamente`. Digite o nome, clique em `Buscar dados` e escolha um resultado. O app tenta preencher capa, ano, genero, links e campos especificos sem alterar status, nota, diario ou historico.

Provedores usados nesta versao:

- Jogos: RAWG com chave configurada, Steam quando disponivel e Wikidata como fallback.
- Livros: Google Books e Open Library.
- Albuns: MusicBrainz e Cover Art Archive.
- Filmes: TMDB com chave configurada, iTunes quando disponivel e Wikidata como fallback.
- Series: TMDB com chave configurada e TVMaze como fallback.

### Chaves de busca

As chaves de busca automatica ficam somente no navegador de cada pessoa, em `Configuracoes > Chaves de APIs`.

Se outra pessoa da familia quiser usar RAWG, TMDB, OMDb ou outra API com chave, passe a chave individualmente para essa pessoa preencher no proprio navegador.

Tambem existe uma opcao mais segura com Supabase Edge Functions: salve suas chaves como secrets no Supabase e faça deploy da funcao `metadata-search`.

```bash
supabase secrets set RAWG_API_KEY=sua_rawg
supabase secrets set TMDB_API_KEY=sua_tmdb
supabase secrets set OMDB_API_KEY=sua_omdb
supabase secrets set LASTFM_API_KEY=sua_lastfm
supabase functions deploy metadata-search
```

Com essa funcao deployada, usuarios logados usam RAWG/TMDB/OMDb/Last.fm sem ver as chaves no navegador. Se a funcao nao estiver disponivel, o app usa as fontes locais e as chaves configuradas no proprio navegador.

## Modo familiar

Com o modo familiar ativo, a Gaveteira abre primeiro na tela de login. Para compartilhar com primos, crie um projeto no Supabase e rode o SQL de `supabase/schema.sql` no SQL Editor.

Cada login salva os proprios itens na tabela `cultural_items` usando o `owner_id` do usuario. A aba `Familia` mostra as gaveteiras separadas por pessoa, entao voce pode abrir a lista de cada primo sem misturar tudo na sua conta.

Depois copie:

- Project URL
- anon public key

No arquivo `src/config/sharedCloud.ts`, preencha:

```ts
export const sharedCloudSettings = {
  supabaseUrl: "https://seu-projeto.supabase.co",
  supabaseAnonKey: "sua-anon-key",
};
```

No app, cada pessoa informa apenas o `Codigo da familia` na tela de login.

Use o mesmo codigo da familia em todos os computadores, por exemplo:

```text
primos-2026
```

Depois abra a Gaveteira, informe um codigo de familia, crie uma conta e use a aba `Familia`:

- `Enviar meus itens` para subir sua gaveteira.
- `Atualizar familia` para ver o feed do grupo.
- `Baixar minha conta` para mesclar no navegador os itens salvos na sua conta.

## Proximos passos sugeridos

- Trocar `localStorage` por IndexedDB quando o volume de imagens/anexos crescer.
- Implementar clientes reais de metadados em `src/services/metadata.ts`.
- Adicionar upload local de capas, alem de URLs.
- Criar modo de recomendacao para decidir o proximo item com base em nota, genero, status e tempo disponivel.
