# WPP SWOT Positioning Tool

App web interattiva a 3 step. L'analisi AI viene elaborata da Claude e inviata via email a team@weddingplannerspro.it.

## Struttura

```
wpp-swot/
├── public/
│   ├── index.html      ← App (palette bianco/azzurro/blu)
│   └── logo.jpg        ← Logo Wedding Planners Pro
├── netlify/functions/
│   └── analyze.mjs     ← Claude API + invio email Resend
├── netlify.toml
└── README.md
```

## Variabili d'ambiente (Netlify → Site settings → Environment variables)

| Chiave | Dove ottenerla |
|--------|---------------|
| ANTHROPIC_API_KEY | console.anthropic.com |
| RESEND_API_KEY | resend.com → API Keys |

## Setup Resend (email)

1. Crea account su resend.com (gratis: 100 email/giorno)
2. Domains → aggiungi weddingplannerspro.it → verifica DNS
3. Crea API Key → inserisci in Netlify

**Test rapido senza dominio verificato**: cambia FROM in analyze.mjs:
  const FROM = "WPP <onboarding@resend.dev>";

## Deploy

  netlify deploy --prod

oppure drag & drop della cartella su netlify.com/drop (solo per test, senza functions).
