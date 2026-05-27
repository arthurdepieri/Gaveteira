# Gaveteira Duel

Experimento local e isolado de um jogo de cartas inspirado nas fichas da Gaveteira.

## Como abrir

Na raiz do projeto:

```bash
npm run duel
```

Ou rode o app normalmente:

```bash
npm run dev
```

Depois acesse:

```text
http://127.0.0.1:5173/experiments/gaveteira-duel/
```

## Isolamento

- Não aparece na navegação principal da Gaveteira.
- Não usa login, Supabase, localStorage ou dados reais.
- Usa cartas mockadas dentro de `src/main.ts`.
- Entra no build apenas como página experimental separada.

## Objetivo do protótipo

- Testar montagem de baralho com 5 cartas.
- Testar duelo em 5 rodadas.
- Testar atributos derivados do cuidado das fichas.
- Testar consulta de cartas por pop-up.
