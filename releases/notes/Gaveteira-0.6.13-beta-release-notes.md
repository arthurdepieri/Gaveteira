# Gaveteira 0.6.13-beta - Conquistas e controle dos jogos

Data: 2026-11-05
Arquivo final: Gaveteira-0.6.13-beta.zip
Pasta no Google Drive: Gaveteira Versions

## Resumo

Atualização que reúne as conquistas dos jogos, o controle manual de plataforma e tempo jogado e os conteúdos locais que ainda aguardavam publicação.

## Destaques

- Status Platinado nos jogos, medalhas de conclusão em todas as gavetas e diamantes nos jogos platinados, visíveis nos cards e nas fichas.
- Plataforma escolhida pelo usuário entre PlayStation, Xbox, Computador e Nintendo Switch, com ícones nos cards e nas fichas; APIs não preenchem nem alteram esse campo.
- Tempo jogado editado em horas e minutos, preservando a leitura dos registros antigos e limitando minutos a 0–59.
- Remoção da curadoria administrativa e publicação dos modelos visuais do Canva e do backup documental da navegação.
- Diagnóstico seguro do RAWG, com status HTTP, timeout e indicação de chave ausente, sem registrar credenciais.

## Upload

Com token do Google Drive configurado:

```bash
npm run release:drive -- 0.6.13-beta
```
