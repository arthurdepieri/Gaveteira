# Gaveteira

App web local para organizar consumo cultural como uma gaveteira pessoal: jogos, livros, álbuns, filmes, séries, wishlist e itens em andamento.

## O que está pronto nesta primeira versão

- Tela inicial com gaveteira visual, contadores e itens em andamento.
- Listagens por categoria, Wishlist e Em andamento.
- Filtros por ano, status, gênero, nota mínima e busca por nome/tag.
- Cadastro e edição manual com campos específicos para jogos, livros, álbuns, filmes e séries.
- Status personalizáveis por categoria.
- Tags, links externos, capas/posters por URL e avaliação de 0.5 a 5 estrelas.
- Diário e histórico por item.
- Estatísticas: concluídos, andamento, wishlist, notas médias, gêneros, tags, ranking e concluídos por ano/mês.
- Busca automática de metadados dentro do formulário, com aplicação manual do resultado escolhido.
- Persistência local via `localStorage`.
- Exportação e importação de backup JSON.
- Área de configuração para chaves de API, preparada para IGDB, Steam, RAWG, Google Books, Open Library, Spotify, MusicBrainz, Last.fm e TMDB.
- Modo familiar com Supabase: login, sincronização e gaveteiras separadas por perfil.
- PWA instalável no celular, com manifest, ícones e cache básico do app.

## Como rodar

Requisitos:

- Node.js 20 ou superior.
- npm, pnpm ou outro gerenciador compatível.

Instalação com npm:

```bash
npm install
npm run dev
```

Depois abra a URL exibida pelo Vite, normalmente:

```text
http://127.0.0.1:5173
```

Build de produção:

```bash
npm run build
npm run preview
```

## Instalar no celular

Depois de publicar ou rodar o preview em HTTPS/localhost:

- Android/Chrome: abra a Gaveteira e toque no aviso `Instalar Gaveteira`, ou use o menu do navegador > `Instalar app`.
- iPhone/Safari: toque em compartilhar e depois em `Adicionar à Tela de Início`.

O PWA usa `public/manifest.webmanifest`, `public/sw.js` e os ícones em `public/icons`.

## Dados locais

Os dados são salvos no `localStorage` do navegador, na chave:

```text
gaveteira-da-vida:v1
```

Use `Configurações > Exportar JSON` para backup e `Importar JSON` para restaurar.

## Busca automática

Ao criar ou editar uma ficha, use a área `Completar automaticamente`. Digite o nome, clique em `Buscar dados` e escolha um resultado. O app tenta preencher capa, ano, gênero, links e campos específicos sem alterar status, nota, diário ou histórico.

Provedores usados nesta versão:

- Jogos: RAWG com chave configurada, Steam quando disponível e Wikidata como fallback.
- Livros: Google Books e Open Library.
- Discos: MusicBrainz e Cover Art Archive.
- Filmes: TMDB com chave configurada, iTunes quando disponível e Wikidata como fallback.
- Séries: TMDB com chave configurada e TVMaze como fallback.

### Chaves de busca

As chaves de busca automática ficam somente no navegador de cada pessoa, em `Configurações > Chaves de APIs`.

Se outra pessoa da família quiser usar RAWG, TMDB, OMDb ou outra API com chave, passe a chave individualmente para essa pessoa preencher no próprio navegador.

Também existe uma opção mais segura com Supabase Edge Functions: salve suas chaves como secrets no Supabase e faça deploy da função `metadata-search`.

```bash
supabase secrets set RAWG_API_KEY=sua_rawg
supabase secrets set TMDB_API_KEY=sua_tmdb
supabase secrets set OMDB_API_KEY=sua_omdb
supabase secrets set LASTFM_API_KEY=sua_lastfm
supabase functions deploy metadata-search
```

Com essa função deployada, usuários logados usam RAWG/TMDB/OMDb/Last.fm sem ver as chaves no navegador. Se a função não estiver disponível, o app usa as fontes locais e as chaves configuradas no próprio navegador.

## Modo familiar

Com o modo familiar ativo, a Gaveteira abre primeiro na tela de login. Para compartilhar com primos, crie um projeto no Supabase e rode o SQL de `supabase/schema.sql` no SQL Editor.

Cada login salva os próprios itens na tabela `cultural_items` usando o `owner_id` do usuário. A aba `Família` mostra as gaveteiras separadas por pessoa, então você pode abrir a lista de cada primo sem misturar tudo na sua conta.

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

No app, cada pessoa informa apenas o `Código da família` na tela de login.

Use o mesmo código da família em todos os computadores, por exemplo:

```text
primos-2026
```

Depois abra a Gaveteira, informe um código de família, crie uma conta e use a aba `Família`:

- `Enviar meus itens` para subir sua gaveteira.
- `Atualizar família` para ver o feed do grupo.
- `Baixar minha conta` para mesclar no navegador os itens salvos na sua conta.

## Próximos passos sugeridos

- Trocar `localStorage` por IndexedDB quando o volume de imagens/anexos crescer.
- Implementar clientes reais de metadados em `src/services/metadata.ts`.
- Adicionar upload local de capas, além de URLs.
- Criar modo de recomendação para decidir o próximo item com base em nota, gênero, status e tempo disponível.
