# Changelog

## 0.6.8-beta - Onboarding guiado - 2026-06-14

Versão beta focada em deixar a primeira chegada na Gaveteira mais clara, guiada e confortável no computador e no celular.

### Destaques

- Pop-up inicial em três páginas explicando a Gaveteira, o conceito de cards e a escolha da primeira gaveta.
- Tutorial obrigatório dentro da primeira ficha, separando preenchimento, status/nota/visibilidade e primeiro diário.
- Botão de conclusão bloqueado até o usuário passar por todas as etapas da primeira ficha.
- Mensagem final de boas-vindas após concluir a primeira ficha, apontando Gavetas, Feed e Social.
- Cortinas opacas e animações próprias para os pop-ups do onboarding, sem mostrar a tela por trás.
- Ajustes mobile para que os pop-ups fiquem centralizados, legíveis e com scroll seguro em telas pequenas.

### Observações

- Esta versão é uma subversão de experiência inicial da linha `0.6.x`, sem mudar o modelo de dados.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.8-beta.zip`.

## 0.6.7-beta - Admin real e backend social - 2026-06-11

Versão beta focada em transformar a base social da Gaveteira em uma estrutura mais confiável para publicação, administração e crescimento futuro.

### Destaques

- Área administrativa com promoção e remoção de admins a partir do próprio app.
- Logs administrativos simples para ações importantes, como alterar papéis e destacar/remover recomendações de curadoria.
- Curadoria mais auditável, mantendo autoria das fichas destacadas e registrando ações relevantes.
- Regras SQL reforçadas para que usuários editem apenas o próprio conteúdo, amigos vejam apenas fichas visíveis e diário privado continue protegido.
- Feed, social e curadoria preparados para usar funções do Supabase em vez de depender apenas de montagem no navegador.
- Busca automática movida para Edge Function, deixando chaves de APIs externas fora do frontend.
- Upload de avatar e capas próprias preparado com Supabase Storage, incluindo fallback local quando a nuvem não estiver disponível.
- Sync mais sólido com fila/registro de alterações no banco para reduzir duplicatas e acompanhar falhas com mais precisão.

### Observações

- Rode o SQL atualizado em `supabase/schema.sql` no Supabase antes de usar os recursos novos de admin, Storage, feed e sync em produção.
- Esta versão altera backend, permissões e funções RPC. Depois de publicar, o PWA instalado deve receber o aviso de atualização.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.7-beta.zip`.

## 0.6.6-beta - Polimento visual e estados vivos - 2026-06-11

Versão beta focada em deixar a Gaveteira mais refinada durante carregamentos, sincronização, instalação e uso em modo escuro.

### Destaques

- Skeletons visuais em formato de ficha/card para buscas automáticas de dados, busca de capas, Feed e área de amigos.
- Feedback de sincronização mais vivo, com pulso suave, linha de estado e cores próprias para salvo localmente, na fila, enviando, enviado, falha e sessão expirada.
- Aviso de nova versão disponível com destaque mais perceptível, sem parecer erro.
- Splash de abertura mais suave, com entrada e saída mais elegantes e fundo claro próprio, independente do modo escuro.
- Convite de instalação PWA redesenhado como etiqueta de arquivo/convite de mesa, com texto menos técnico.
- Dark mode mais autoral, com atmosfera de arquivo à noite, fundos menos chapados, bordas mais suaves e cards sem branco agressivo.
- Ajustes de contraste em superfícies sociais, fichas, cards, busca de metadados e componentes mobile no tema escuro.

### Observações

- Esta versão é uma subversão de polimento visual da linha `0.6.x`, sem mudar o modelo de dados.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.6-beta.zip`.

## 0.6.5-beta - Mobile mais leve e retrato fixo - 2026-06-10

Versão beta focada em deixar a Gaveteira instalada no celular mais confortável e fazer o PWA anunciar uma atualização nova de forma clara.

### Destaques

- Revisão mobile separada do desktop, com cards mais compactos, menus mais baixos e modais menos pesados.
- Barra inferior reduzida para ocupar menos tela no celular.
- Painel de Gavetas no mobile mais curto, com botões menores e leitura mais rápida.
- Ficha do item simplificada: topo mais direto, ações rápidas menores, abas sem excesso de sticky e blocos mais limpos.
- Cards de jogos no mobile mostram tempo jogado de forma discreta.
- Manifesto PWA atualizado para `portrait-primary`.
- Reforço da trava de orientação em retrato via Screen Orientation API e fallback visual quando o navegador/celular ignora a trava.
- Versão/cache do PWA avançados para que a Gaveteira instalada mostre o CTA de atualização.

### Observações

- Em alguns celulares, especialmente iOS, o sistema pode impedir uma trava física total da rotação em apps web. Nesses casos, a Gaveteira bloqueia visualmente o uso em paisagem e pede para voltar ao modo retrato.

## 0.6.4-beta - Atualização segura do PWA - 2026-05-29

Versão beta focada em deixar a Gaveteira instalada mais confiável entre betas, evitando assets antigos e protegendo dados locais antes de operações sensíveis.

### Destaques

- Fluxo de atualização do PWA com cache versionado a partir da versão do `package.json`.
- Geração automática de `pwa-version.json` e `pwa-build.js` durante o build para forçar o service worker a perceber novas betas.
- Aviso dentro do app quando existe uma nova versão pronta, com CTA simples para atualizar/recarregar.
- Limpeza de caches antigos do PWA após ativar a nova versão.
- Snapshots locais de segurança antes de restaurar backup, antes de aplicar atualização PWA e ao detectar mudança de versão/schema.
- Lista de snapshots em Configurações, com retenção curta e rollback com um clique.
- Ajustes de instalação mobile: novo ícone, splash mais suave e bloqueio reforçado em orientação retrato.
- Onboarding inicial fechado: login/registro antes do conteúdo, primeira ficha obrigatória para contas vazias e guia leve dentro do primeiro card.
- Gaveteira Duel publicado como experimento local isolado em `experiments/gaveteira-duel/`.

### Observações

- Snapshots ficam apenas no navegador, separados da nuvem e dos backups JSON exportados.
- Em alguns navegadores móveis, o bloqueio de orientação depende das regras do sistema ou do PWA instalado.
- O pacote de release desta versão fica em `releases/Gaveteira-0.6.4-beta.zip`.

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
