# Backup do menu antes da gaveta lateral

Data do registro: 2026-07-23

Este arquivo registra o menu existente imediatamente antes da implementação do
menu lateral responsivo em forma de gaveta.

## Ponto de restauração

- Commit-base: `94c012df8dfcdf2b4bbfea1cedc076e84f0e00d0`
- Arquivo do menu e de seu comportamento: `src/App.tsx`
- Arquivo dos estilos: `src/styles.css`

No momento deste registro, `src/App.tsx` tinha uma alteração local somente no
onboarding `FirstCardStart`, depois do bloco de navegação. O menu, sua marcação e
seus estilos ainda coincidiam com o commit-base indicado acima.

Para recuperar o menu anterior sem apagar outras mudanças, extraia apenas os
blocos de navegação desses dois arquivos no commit-base. Não restaure os
arquivos inteiros por cima da árvore de trabalho.

## Ordem e nomes preservados

1. Início
2. Feed
3. Gavetas
   - Jogos
   - Livros
   - Discos
   - Filmes
   - Séries
4. Social
   - Meu perfil
   - Amigos
5. Admin, quando o usuário for administrador
   - Modelo Canva
   - Membros
6. Wishlist
7. Em andamento
8. Estatísticas
9. Configurações
10. Sair

## Comportamento anterior

- Desktop: barra lateral fixa e visível.
- Grupos: submenus abertos por foco, hover ou quando continham a página ativa.
- Mobile: barra de navegação inferior.
- Gavetas no mobile: painel aberto de baixo para cima.
- A página ativa era destacada.
- As gavetas exibiam a contagem de fichas.

## Barra inferior mobile preservada

A barra inferior removida pela nova gaveta também está preservada no
commit-base. Sua ordem visível era:

1. Início
2. Gavetas
3. Feed
4. Social
5. Admin, quando o usuário fosse administrador
6. Config

O botão Gavetas abria o painel inferior `mobile-drawer-panel`, com as categorias
na ordem Jogos, Livros, Discos, Filmes e Séries. Tanto a barra quanto o painel
podem ser recuperados seletivamente de `src/App.tsx` e `src/styles.css` no
commit-base indicado acima.
