/**
 * analyze.mjs
 * 1. Chiama Claude API con i dati dei 3 step
 * 2. Formatta un'email HTML professionale
 * 3. Invia via Resend a team@weddingplannerspro.it
 * 4. Restituisce il JSON dell'analisi al client (per mostrare la schermata di conferma)
 */

const RECIPIENT = "team@weddingplannerspro.it";
const FROM      = "WPP SWOT Tool <onboarding@resend.dev>";

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const RESEND_KEY    = process.env.RESEND_API_KEY;

  if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_API_KEY non configurata" }, 500);
  if (!RESEND_KEY)    return json({ error: "RESEND_API_KEY non configurata" }, 500);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "JSON non valido" }, 400); }

  const { step1, step2, step3 } = body;
  const nome = step1?.nome || "Wedding Planner";

  // ── 1. Chiama Claude ────────────────────────────────────────────────────
  const systemPrompt = `Sei un'esperta consulente di brand strategy e posizionamento per wedding planner in Italia.
Analizza i dati dei 3 step del questionario SWOT e restituisci un'analisi professionale, concreta e motivante.
Rispondi SEMPRE in italiano, tono caldo ma professionale. Usa un linguaggio diretto, evita frasi banali.
Restituisci SOLO un oggetto JSON valido, senza markdown, senza backtick, senza testo prima o dopo.`;

  const userPrompt = `Analizza questi dati di una wedding planner aspirante/principiante e restituisci un'analisi SWOT con proposte di posizionamento.

## STEP 1 — ANALISI PERSONALE E PROFESSIONALE
${JSON.stringify(step1, null, 2)}

## STEP 2 — ANALISI DELLA CONCORRENZA
${JSON.stringify(step2, null, 2)}

## STEP 3 — TARGET DI PUBBLICO IDEALE
${JSON.stringify(step3, null, 2)}

Restituisci un oggetto JSON con ESATTAMENTE questa struttura:
{
  "nome": "nome della wedding planner",
  "citta": "città/regione (da step1)",
  "sintesi": "2-3 frasi che descrivono chi è e il suo potenziale unico. Tono incoraggiante ma realistico.",
  "swot": {
    "forze": ["punto 1", "punto 2", "punto 3", "punto 4"],
    "debolezze": ["punto 1", "punto 2", "punto 3"],
    "opportunita": ["punto 1", "punto 2", "punto 3"],
    "minacce": ["punto 1", "punto 2", "punto 3"]
  },
  "posizionamenti": [
    {
      "titolo": "Nome breve e memorabile (es. 'La Planner dell'Intimità')",
      "tagline": "Una frase di posizionamento potente, max 12 parole",
      "descrizione": "2-3 frasi: perché funziona per lei, a chi si rivolge",
      "punti_forza": ["perché sfrutta i suoi punti di forza"],
      "rischi": ["un rischio o limite di questo posizionamento"],
      "fit_score": 85
    }
  ],
  "posizionamento_consigliato": 0,
  "prossimi_passi": ["azione concreta 1", "azione concreta 2", "azione concreta 3", "azione concreta 4"],
  "messaggio_finale": "Un paragrafo motivante rivolto direttamente a lei. Usa 'tu'. Max 4 frasi."
}

Note:
- Proponi tra 2 e 3 posizionamenti distinti e credibili
- fit_score è un numero intero tra 60 e 98
- posizionamento_consigliato è l'indice (0, 1 o 2) del più adatto
- Forze/debolezze SWOT specifiche ai suoi dati reali, non generiche
- Prossimi passi: azioni realizzabili nei prossimi 30-60 giorni`;

  let analysis;
  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5-20251101",
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return json({ error: `Claude API error: ${err}` }, 500);
    }

    const claudeData = await claudeRes.json();
    const raw = claudeData.content?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    analysis = JSON.parse(clean);
  } catch (err) {
    return json({ error: `Errore analisi Claude: ${err.message}` }, 500);
  }

  // ── 2. Costruisci email HTML ────────────────────────────────────────────
  const today = new Date().toLocaleDateString("it-IT", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const swotColors = {
    forze:       { bg: "#EEF4FF", accent: "#2563EB", label: "S — Punti di Forza" },
    debolezze:   { bg: "#FFF0F5", accent: "#E8739A", label: "W — Punti di Debolezza" },
    opportunita: { bg: "#F0FDF4", accent: "#16A34A", label: "O — Opportunità" },
    minacce:     { bg: "#FFF7ED", accent: "#EA580C", label: "T — Minacce" },
  };

  const swotHtml = Object.entries(swotColors).map(([key, c]) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="background:${c.bg};border-radius:10px;padding:16px 20px;border-left:4px solid ${c.accent};">
          <p style="margin:0 0 8px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${c.accent};">${c.label}</p>
          ${(analysis.swot[key] || []).map(item => `
            <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#1e3a5f;line-height:1.5;">
              <span style="color:${c.accent};font-weight:700;">›</span> ${item}
            </p>`).join("")}
        </td>
      </tr>
    </table>`).join("");

  const posHtml = (analysis.posizionamenti || []).map((p, i) => {
    const isRec = i === analysis.posizionamento_consigliato;
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="background:#ffffff;border-radius:12px;padding:24px;border:${isRec ? "2px solid #2563EB" : "1px solid #dde6f5"};">
          ${isRec ? `<p style="margin:0 0 12px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;background:#2563EB;display:inline-block;padding:4px 12px;border-radius:20px;">★ Consigliato per te</p>` : ""}
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-family:Georgia,serif;font-size:20px;color:#0f2042;">${p.titolo}</p>
              </td>
              <td align="right" valign="top">
                <div style="background:#EEF4FF;border-radius:8px;padding:8px 14px;text-align:center;display:inline-block;">
                  <p style="margin:0;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#2563EB;line-height:1;">${p.fit_score}%</p>
                  <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:10px;color:#7a95b8;">fit score</p>
                </div>
              </td>
            </tr>
          </table>
          <p style="margin:10px 0 12px;font-family:Georgia,serif;font-style:italic;font-size:14px;color:#2563EB;border-left:3px solid #C9A84C;padding-left:12px;">${p.tagline}</p>
          <p style="margin:0 0 16px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#3a5272;line-height:1.65;">${p.descrizione}</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%" style="background:#F0FDF4;border-radius:8px;padding:12px;vertical-align:top;">
                <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;color:#16A34A;">✓ Perché funziona</p>
                ${(p.punti_forza || []).map(f => `<p style="margin:0 0 3px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#1e3a5f;">· ${f}</p>`).join("")}
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#FFF7ED;border-radius:8px;padding:12px;vertical-align:top;">
                <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:10px;font-weight:700;text-transform:uppercase;color:#EA580C;">⚠ Rischi</p>
                ${(p.rischi || []).map(r => `<p style="margin:0 0 3px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#1e3a5f;">· ${r}</p>`).join("")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
  }).join("");

  const stepsHtml = (analysis.prossimi_passi || []).map((step, i) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
      <tr>
        <td width="36" valign="top">
          <div style="width:28px;height:28px;border-radius:50%;background:#2563EB;text-align:center;line-height:28px;">
            <span style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;font-weight:700;color:#ffffff;">${i + 1}</span>
          </div>
        </td>
        <td style="padding-top:5px;">
          <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#1e3a5f;line-height:1.5;">${step}</p>
        </td>
      </tr>
    </table>`).join("");

  // Dati grezzi per allegato testo
  const rawData = formatRawData(step1, step2, step3);

  const emailHtml = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Analisi SWOT — ${analysis.nome}</title></head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'DM Sans',Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0f2042 0%,#1a3a6b 100%);border-radius:16px 16px 0 0;padding:32px 36px 28px;">
    <p style="margin:0 0 4px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#C9A84C;">Wedding Planners Pro</p>
    <p style="margin:0 0 2px;font-family:Georgia,serif;font-size:26px;color:#ffffff;">Nuova Analisi SWOT</p>
    <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#93b5e1;">${analysis.nome}${analysis.citta ? " · " + analysis.citta : ""}</p>
    <p style="margin:12px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.5);">Ricevuta il ${today}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:#ffffff;padding:32px 36px;">

    <!-- Sintesi -->
    <p style="margin:0 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563EB;">Profilo</p>
    <p style="margin:0 0 28px;font-family:Georgia,serif;font-style:italic;font-size:16px;color:#1e3a5f;line-height:1.7;border-left:3px solid #C9A84C;padding-left:16px;">${analysis.sintesi}</p>

    <!-- SWOT -->
    <p style="margin:0 0 14px;font-family:Georgia,serif;font-size:20px;color:#0f2042;">Analisi SWOT</p>
    ${swotHtml}

    <!-- Posizionamenti -->
    <p style="margin:28px 0 6px;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563EB;">Proposte di Posizionamento</p>
    <p style="margin:0 0 16px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#7a95b8;">${analysis.posizionamenti.length} posizionamenti identificati. Quello consigliato è evidenziato in blu.</p>
    ${posHtml}

    <!-- Prossimi passi -->
    <p style="margin:28px 0 16px;font-family:Georgia,serif;font-size:20px;color:#0f2042;">Prossimi Passi</p>
    ${stepsHtml}

    <!-- Messaggio finale -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
      <tr><td style="background:linear-gradient(135deg,#1a3a6b,#2563EB);border-radius:12px;padding:24px 28px;">
        <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#ffffff;line-height:1.75;">${analysis.messaggio_finale}</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- Divider -->
  <tr><td style="background:#EEF4FF;padding:20px 36px;">
    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#2563EB;">Risposte originali</p>
    <p style="margin:6px 0 0;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#7a95b8;">Le risposte complete della candidata sono riportate di seguito in formato testo.</p>
  </td></tr>

  <!-- Raw data -->
  <tr><td style="background:#f8fbff;padding:24px 36px;border-top:1px solid #dde6f5;">
    <pre style="margin:0;font-family:'Courier New',monospace;font-size:11px;color:#3a5272;line-height:1.7;white-space:pre-wrap;word-break:break-word;">${escapeHtml(rawData)}</pre>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#0f2042;border-radius:0 0 16px 16px;padding:20px 36px;text-align:center;">
    <p style="margin:0;font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.4);">Wedding Planners Pro · SWOT Positioning Tool · ${today}</p>
  </td></tr>

</table>
</td></tr>
</table>

</body></html>`;

  // ── 3. Invia via Resend ─────────────────────────────────────────────────
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [RECIPIENT],
        subject: `📋 Nuova Analisi SWOT — ${analysis.nome}${analysis.citta ? " (" + analysis.citta + ")" : ""}`,
        html: emailHtml,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error("Resend error:", err);
      // Non blocchiamo — l'analisi è OK anche se email fallisce
    }
  } catch (err) {
    console.error("Email send error:", err.message);
  }

  // ── 4. Rispondi al client ───────────────────────────────────────────────
  return json({ ok: true, nome: analysis.nome }, 200);
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatRawData(step1, step2, step3) {
  const lines = [];
  const s = (label, val) => {
    if (val !== null && val !== undefined && val !== "") {
      lines.push(`${label}:\n  ${String(val).replace(/\n/g, "\n  ")}`);
    }
  };
  const h = (title) => lines.push(`\n${"=".repeat(50)}\n${title}\n${"=".repeat(50)}`);
  const sh = (title) => lines.push(`\n— ${title} —`);

  h("STEP 1 — ANALISI PERSONALE");
  s("Nome", step1?.nome);
  s("Città", step1?.citta);
  s("Esperienza", step1?.esperienza);

  sh("Punti di Forza");
  s("Esperienze pregresse", step1?.forze?.esperienze_pregresse);
  s("Qualità personali", step1?.forze?.qualita_personali);
  s("Gestione stress (1-5)", step1?.forze?.gestione_stress);
  s("Rete contatti", step1?.forze?.rete_contatti);
  s("Capacità digitali (1-5)", step1?.forze?.capacita_digitali);
  s("Talento unico", step1?.forze?.talento_unico);

  sh("Punti di Debolezza");
  s("Lacune tecniche", step1?.debolezze?.lacune_tecniche);
  s("Comunicazione (1-5)", step1?.debolezze?.capacita_comunicazione);
  s("Paure/blocchi", step1?.debolezze?.paure_blocchi);
  s("Visibilità online (1-5)", step1?.debolezze?.visibilita_online);

  sh("Opportunità");
  s("Motivazione/momento", step1?.opportunita?.motivazione_momento);
  s("Caratteristiche territorio", step1?.opportunita?.caratteristiche_territorio);
  s("Nicchia naturale", step1?.opportunita?.nicchia_naturale);

  sh("Minacce");
  s("Contesto sociale", step1?.minacce?.contesto_sociale);
  s("Ostacoli carattere", step1?.minacce?.ostacoli_carattere);

  sh("Visione");
  s("Sogno a 3 anni", step1?.visione?.sogno_3anni);
  s("Definizione successo", step1?.visione?.definizione_successo);

  h("STEP 2 — ANALISI CONCORRENZA");
  s("N° competitor area", step2?.mercato_locale?.numero_competitor);
  s("Descrizione competitor", step2?.mercato_locale?.descrizione_competitor);
  s("Forze competitor e spazi", step2?.mercato_locale?.forze_competitor_e_spazi);
  s("Nicchia libera", step2?.mercato_locale?.nicchia_libera);
  s("Fasce prezzo mercato", step2?.prezzi_posizionamento?.fasce_prezzo_mercato);
  s("Posizionamento atteso", step2?.prezzi_posizionamento?.posizionamento_atteso);
  s("Elemento differenziante", step2?.prezzi_posizionamento?.elemento_differenziante);

  h("STEP 3 — TARGET IDEALE");
  s("Profilo coppia ideale", step3?.coppia_ideale?.profilo);
  s("Tipo matrimonio", step3?.coppia_ideale?.tipo_matrimonio);
  s("Budget indicativo", step3?.coppia_ideale?.budget);
  s("Provenienza geografica", step3?.coppia_ideale?.provenienza);
  s("Canali di ricerca", step3?.percorso_decisionale?.canali_ricerca);
  s("Paure/obiezioni", step3?.percorso_decisionale?.paure_obiezioni);
  s("Motivo della scelta", step3?.percorso_decisionale?.motivo_scelta);
  s("Valori condivisi", step3?.valori_contesto?.valori_condivisi);
  s("Anti-target", step3?.valori_contesto?.anti_target);

  return lines.join("\n");
}

export const config = { path: "/api/analyze" };
