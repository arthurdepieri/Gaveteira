# Changelog

## 0.6.0-beta - Diario Vivo - 2026-05-19

Versao beta focada em transformar o diario em uma parte central da Gaveteira.

### Destaques

- Diario como acao rapida na ficha, com botao sempre visivel.
- Tipos de entrada para o diario: Impressao, Citacao, Teoria, Progresso, Memoria, Revisita e Opiniao final.
- Prompts leves de escrita para reduzir a tela em branco.
- Privacidade clara por entrada: privado ou visivel para amigos.
- Preferencia de privacidade persistente: ao mudar para visivel, as proximas entradas seguem essa escolha.
- Entradas de diario aparecem junto do historico, criando uma linha do tempo mais viva do consumo.
- Cards agora mostram marcadores de diario, como quantidade de notas, ultima impressao e tipos registrados.
- Feed ganhou um Canto do diario separado para entradas publicas.
- Entradas publicas do diario abrem a ficha focada na nota correspondente.
- Resumo final assistido: itens concluidos com varias notas podem virar opiniao final.

### Observacoes

- O diario continua privado por padrao.
- O pacote de release desta versao fica em `releases/Gaveteira-0.6.0-beta.zip`.

## 0.5.0-beta - 2026-05-19

Versao beta focada em tornar a Gaveteira mais social, clara e agradavel no uso diario.

### Destaques

- Dashboard inicial transformado em painel da vida cultural, com ultimas adicoes, favoritos recentes, sugestoes e atividade dos amigos.
- Onboarding mais guiado para novas contas, com perfil, gavetas favoritas, primeiro item e sincronizacao.
- Estados vazios melhores nas gavetas, com chamadas especificas para adicionar o primeiro item.
- Diario com mais destaque na ficha e entradas privadas ou visiveis para amigos.
- Feed social refinado com movimento proprio e movimento dos amigos, abrindo a ficha relacionada.
- Perfis e amigos mais pessoais, com paginas separadas no menu social.
- Estados de sincronizacao mais claros: salvo localmente, pendente, enviando, enviado, falhou, sem conexao e sessao expirada.
- Busca automatica de capas e metadados melhorada, principalmente para livros e filmes.
- Fichas vazias criadas por engano agora sao removidas ao fechar.
- Renomeacao de Albuns para Discos.

### Observacoes

- A funcao Supabase `metadata-search` tambem foi preparada para melhorar busca de livros e filmes na versao online.
- O pacote de release desta versao fica em `releases/Gaveteira-0.5.0-beta.zip`.

## 0.4.0-beta - 2026-05-18

Versao beta marcada para consolidar a Gaveteira como app pessoal/social instalavel.

### Destaques

- PWA instalavel no celular, com manifest, icones e service worker.
- Experiencia mobile refinada com navegacao inferior, gavetas em painel e cards mais compactos.
- Perfis sociais separados em Meu perfil e Amigos.
- Feed social leve com atividades suas e dos amigos.
- Comparacoes sociais e acesso a perfis de amigos.
- Auto-salvamento online com estados de sincronizacao, pendencia, erro e sessao expirada.
- Tela inicial mais viva, com ultimas adicoes, favoritos recentes e sugestoes.
- Melhorias de ficha pessoal, carimbo visual e editor de perfil.
- Remocao dos exemplos iniciais para novas contas.

### Observacoes

- A Gaveteira ainda e beta: sincronizacao, instalacao PWA e fluxo social devem ser testados em celulares reais.
- O pacote de release desta versao fica em `releases/Gaveteira-0.4.0-beta.zip`.
