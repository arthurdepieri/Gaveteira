# Changelog

## 0.6.3-beta - Release local e livros por PDF - 2026-05-26

Versão beta focada em organizar o fechamento de versões e acelerar a entrada de livros a partir de arquivos PDF locais.

### Destaques

- Fluxo local de release com `npm run release -- <versão>`, compilando o app, criando o zip versionado e atualizando `releases/manifest.json`.
- `README.md` revisado para refletir a Gaveteira atual, com instruções de execução, PWA, nuvem, busca automática e empacotamento.
- `ROADMAP.md` criado para separar próximos recursos planejados da documentação principal.
- Importação rápida de livros por PDF: seleção local do arquivo, título inferido pelo nome, status `Lendo`, data de início opcional e abertura direta da ficha em edição.
- O fluxo de PDF continua compatível com modo offline: o arquivo não é salvo nem enviado, apenas cria um rascunho de livro com formato `PDF`.
- A ficha criada por PDF permanece compatível com a busca de metadados existente para completar autor, capa, editora, ano e gênero.

### Observações

- Os arquivos `.zip` em `releases/` seguem como artefatos locais e ficam fora do Git.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.3-beta.zip`.

## 0.6.2-beta - Polimento de uso - 2026-05-21

Versão beta focada em deixar a Gaveteira mais confortável, clara e tranquilizadora no uso diário.

### Destaques

- Home reorganizada com hierarquia mais clara: continuar, movimento recente, sugestões e gavetas.
- Ficha do item refinada para celular, com aba Resumo, atalhos para Diário e Histórico e seções vazias menos ruidosas.
- Estados vazios e microtextos revisados para reforçar a linguagem de arquivo pessoal, gavetas, fichas e diário.
- Cartão de sincronização mais tranquilizador, com último envio bem-sucedido e área para ver pendências da nuvem.
- Melhorias em mensagens de erro para reduzir termos técnicos e deixar claro quando fichas seguem salvas localmente.
- Ajustes em textos de Feed, Amigos, Estatísticas, login, busca de capas e backup.

### Observações

- Esta versão consolida polimentos feitos depois da 0.6.1, sem mudar o eixo principal do app.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.2-beta.zip`.

## 0.6.0-beta - Diário Vivo - 2026-05-19

Versão beta focada em transformar o diário em uma parte central da Gaveteira.

### Destaques

- Diário como ação rápida na ficha, com botão sempre visível.
- Tipos de entrada para o diário: Impressão, Citação, Teoria, Progresso, Memória, Revisita e Opinião final.
- Prompts leves de escrita para reduzir a tela em branco.
- Privacidade clara por entrada: privado ou visível para amigos.
- Preferência de privacidade persistente: ao mudar para visível, as próximas entradas seguem essa escolha.
- Entradas de diário aparecem junto do histórico, criando uma linha do tempo mais viva do consumo.
- Cards agora mostram marcadores de diário, como quantidade de notas, última impressão e tipos registrados.
- Feed ganhou um Canto do diário separado para entradas públicas.
- Entradas públicas do diário abrem a ficha focada na nota correspondente.
- Resumo final assistido: itens concluídos com várias notas podem virar opinião final.

### Observações

- O diário continua privado por padrão.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.0-beta.zip`.

## 0.5.0-beta - 2026-05-19

Versão beta focada em tornar a Gaveteira mais social, clara e agradável no uso diário.

### Destaques

- Dashboard inicial transformado em painel da vida cultural, com últimas adições, favoritos recentes, sugestões e atividade dos amigos.
- Onboarding mais guiado para novas contas, com perfil, gavetas favoritas, primeiro item e sincronização.
- Estados vazios melhores nas gavetas, com chamadas específicas para adicionar o primeiro item.
- Diário com mais destaque na ficha e entradas privadas ou visíveis para amigos.
- Feed social refinado com movimento próprio e movimento dos amigos, abrindo a ficha relacionada.
- Perfis e amigos mais pessoais, com páginas separadas no menu social.
- Estados de sincronização mais claros: salvo localmente, pendente, enviando, enviado, falhou, sem conexão e sessão expirada.
- Busca automática de capas e metadados melhorada, principalmente para livros e filmes.
- Fichas vazias criadas por engano agora são removidas ao fechar.
- Renomeação de Álbuns para Discos.

### Observações

- A função Supabase `metadata-search` também foi preparada para melhorar busca de livros e filmes na versão online.
- O pacote de release desta versão fica em `releases/Gaveteira-0.5.0-beta.zip`.

## 0.4.0-beta - 2026-05-18

Versão beta marcada para consolidar a Gaveteira como app pessoal/social instalável.

### Destaques

- PWA instalável no celular, com manifest, ícones e service worker.
- Experiência mobile refinada com navegação inferior, gavetas em painel e cards mais compactos.
- Perfis sociais separados em Meu perfil e Amigos.
- Feed social leve com atividades suas e dos amigos.
- Comparações sociais e acesso a perfis de amigos.
- Auto-salvamento online com estados de sincronização, pendência, erro e sessão expirada.
- Tela inicial mais viva, com últimas adições, favoritos recentes e sugestões.
- Melhorias de ficha pessoal, carimbo visual e editor de perfil.
- Remoção dos exemplos iniciais para novas contas.

### Observações

- A Gaveteira ainda é beta: sincronização, instalação PWA e fluxo social devem ser testados em celulares reais.
- O pacote de release desta versão fica em `releases/Gaveteira-0.4.0-beta.zip`.
