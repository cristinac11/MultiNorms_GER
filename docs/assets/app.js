(() => {
  "use strict";
  const config = window.SITE_CONFIG || {};
  const DIMENSIONS = [
    ["Size", "size_mean", "size_std"],
    ["Numerosity", "numerosity_mean", "numerosity_std"],
    ["Space", "space_mean", "space_std"],
    ["Time", "time_mean", "time_std"],
    ["Cognition", "cognition_mean", "cognition_std"],
    ["Social interaction", "social_interaction_mean", "social_interaction_std"],
    ["Arousal", "arousal_mean", "arousal_std"],
    ["Emotion", "emotion_mean", "emotion_std"],
    ["Interoception", "interoception_mean", "interoception_std"],
    ["Visual perception", "visual_perception_mean", "visual_perception_std"],
    ["Auditory perception", "auditory_perception_mean", "auditory_perception_std"],
    ["Tactile perception", "tactile_perception_mean", "tactile_perception_std"],
    ["Olfactory perception", "olfactory_perception_mean", "olfactory_perception_std"],
    ["Gustatory perception", "gustatory_perception_mean", "gustatory_perception_std"],
    ["Action", "action_mean", "action_std"],
    ["Valence", "valence_mean_rescaled", "valence_std"]
  ];
  const state = { rows: [], filtered: [], page: 1, pageSize: 10, sortKey: "word", sortDirection: 1, selectedDimension: "visual_perception_mean" };
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const fmt = (v, digits = 2) => Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : "—";
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

  function canonicalHeader(header, index) {
    let h = String(header || "").replace(/^\uFEFF/, "").trim();
    if (!h) return index === 0 ? "word" : `column_${index + 1}`;

    const germanToEnglish = {
      "größe": "size",
      "numerosität": "numerosity",
      "raum": "space",
      "zeit": "time",
      "kognition": "cognition",
      "soziale interaktion": "social_interaction",
      "erregung": "arousal",
      "emotion": "emotion",
      "innere körperwahrnehmung": "interoception",
      "visuelle wahrnehmung": "visual_perception",
      "auditive wahrnehmung": "auditory_perception",
      "taktile wahrnehmung": "tactile_perception",
      "olfaktorische wahrnehmung": "olfactory_perception",
      "gustatorische wahrnehmung": "gustatory_perception",
      "handlung": "action",
      "valenz": "valence",
      "valenz_abs": "valence_abs",
      "vertrautheit": "familiarity"
    };

    // First normalize separators/case while keeping German characters available
    // for the explicit translation aliases below.
    let normalized = h
      .replace(/\s+/g, " ")
      .trim();

    // Translate German dimension names when they occur at the beginning of a
    // statistic column, e.g. "Größe_mean" or "Soziale Interaktion_std".
    for (const [de, en] of Object.entries(germanToEnglish)) {
      const escaped = de.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      normalized = normalized.replace(new RegExp(`^${escaped}(?=_|$)`, "i"), en);
    }

    normalized = normalized
      .replace(/[ -]+/g, "_")
      .replace(/__+/g, "_")
      .toLowerCase();

    const aliases = {
      "word": "word",
      "count_participants": "participant_count",
      "participants_count": "participant_count",
      "participant_count": "participant_count",
      "dominant_dimension": "dominant_dimension",
      "exclusivity_score": "exclusivity_score",
      "word_length": "word_length",
      "subtlex": "subtlex",
      "valenz_abs_mean_rescaled": "valence_abs_mean_rescaled",
      "valenz_mean": "valence_mean",
      "valenz_std": "valence_std",
      "valenz_max": "valence_max",
      "valenz_min": "valence_min",
      "valenz_abs_mean": "valence_abs_mean",
      "valenz_abs_std": "valence_abs_std",
      "valenz_abs_max": "valence_abs_max",
      "valenz_abs_min": "valence_abs_min",
      "vertrautheit_mean": "familiarity_mean",
      "vertrautheit_std": "familiarity_std",
      "vertrautheit_max": "familiarity_max",
      "vertrautheit_min": "familiarity_min"
    };

    if (aliases[normalized]) return aliases[normalized];

    // Accept both old forms such as Word_Germanet_dimension0 and the current
    // germanet_dimension_0 form.
    const germanetMatch = normalized.match(/^(?:word_)?germanet_dimension_?(\d+)$/);
    if (germanetMatch) return `germanet_dimension_${germanetMatch[1]}`;

    return normalized;
  }

  function normalizeDominantDimension(value) {
    const raw = String(value ?? "").trim();
    const key = raw.toLowerCase().replace(/[ _-]+/g, " ");
    if (["valence intensity", "valence abs mean rescaled", "valence abs", "valenz abs", "valenz abs mean rescaled"].includes(key)) return "Valence";
    return raw;
  }

  function parseCSV(text) {
    const out = []; let row = []; let value = ""; let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { value += '"'; i++; }
        else if (c === '"') quoted = false;
        else value += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(value); value = ""; }
      else if (c === '\n') { row.push(value.replace(/\r$/, "")); out.push(row); row = []; value = ""; }
      else value += c;
    }
    if (value.length || row.length) { row.push(value.replace(/\r$/, "")); out.push(row); }
    const headers = (out.shift() || []).map((h, i) => canonicalHeader(h, i));
    return out
      .map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])))
      .map(record => {
        if ("dominant_dimension" in record) record.dominant_dimension = normalizeDominantDimension(record.dominant_dimension);

        // Valence was originally collected on a signed scale centred on zero.
        // For the website only, display it on the same 1–7 range as the other
        // experiential dimensions by shifting the mean by +4. The underlying
        // downloadable CSV remains unchanged.
        const signedValence = Number(record.valence_mean);
        if (Number.isFinite(signedValence)) record.valence_mean_rescaled = signedValence + 4;

        return record;
      })
      .filter(r => String(r.word || "").trim());
  }

  function applyConfig() {
    document.title = config.title || document.title;
    const mappings = {
      "#brand-name": config.shortTitle, "#site-title": config.title, "#site-subtitle": config.subtitle,
      "#site-description": config.description, "#site-version": config.version,
      "#site-authors": config.authors, "#site-affiliation": config.affiliation,
      "#correspondence-name": config.correspondenceName, "#correspondence-address": config.correspondenceAddress,
      "#correspondence-email": config.contact, "#footer-title": config.title
    };
    Object.entries(mappings).forEach(([selector, value]) => { if (value && $(selector)) $(selector).textContent = value; });
    ["#hero-download", "#main-download"].forEach(selector => { const el = $(selector); if (el) el.href = config.dataFile || "data/MultiNorms_GER_summary_level_dataset.csv"; });
    ["#participant-download", "#hero-participant-download"].forEach(selector => {
      const participantLink = $(selector);
      if (!participantLink) return;
      if (config.participantDataAvailable) {
        participantLink.href = config.participantDataFile || "data/MultiNorms_GER_participant_level_dataset.csv";
      } else {
        participantLink.removeAttribute("href");
        participantLink.removeAttribute("download");
        participantLink.setAttribute("aria-disabled", "true");
        participantLink.classList.add("disabled");
        participantLink.textContent = "Participant-level CSV (pending)";
      }
    });
    if ($("#osf-link")) {
      if (config.osfUrl) $("#osf-link").href = config.osfUrl;
      else $("#osf-link").classList.add("hidden");
    }

    const preprintLink = $("#preprint-link");
    if (preprintLink) {
      if (config.preprintUrl) {
        preprintLink.href = config.preprintUrl;
        preprintLink.classList.remove("hidden");
      } else {
        preprintLink.classList.add("hidden");
      }
    }

    const paperLink = $("#paper-link");
    const paperUrl = config.paperUrl || (config.doi ? (String(config.doi).startsWith("http") ? config.doi : `https://doi.org/${config.doi}`) : "");
    if (paperLink) {
      if (paperUrl) {
        paperLink.href = paperUrl;
        paperLink.classList.remove("hidden");
      } else {
        paperLink.classList.add("hidden");
      }
    }

    const publicationStatus = $("#publication-status");
    if (publicationStatus) {
      const journal = escapeHtml(config.journalName || "the target journal");
      if (paperUrl) {
        publicationStatus.innerHTML = `The peer-reviewed article describing this dataset is published in <em>${journal}</em>. The article link is provided below.`;
      } else if (config.preprintUrl) {
        publicationStatus.innerHTML = `A manuscript describing this dataset is currently in the publication process for <em>${journal}</em>. The accompanying preprint is available below. The final journal article and DOI will be added once published.`;
      } else {
        publicationStatus.innerHTML = `A manuscript describing this dataset is being prepared for submission to <em>${journal}</em>. A preprint will be linked here when available. The final journal article and DOI will be added once published.`;
      }
    }

    if ($("#correspondence-email") && config.contact) {
      $("#correspondence-email").href = `mailto:${config.contact}`;
    }

    const citationButton = $("#copy-citation");
    const citationGuidance = $("#citation-guidance");
    if (citationButton) {
      if (paperUrl) {
        citationButton.textContent = "Copy article citation";
        citationButton.classList.remove("hidden");
        if (citationGuidance) citationGuidance.innerHTML = `<strong>How to cite.</strong> Please cite the peer-reviewed article in <em>${escapeHtml(config.journalName || "the journal")}</em> when using this resource.`;
      } else if (config.preprintUrl) {
        citationButton.textContent = "Copy preprint citation";
        citationButton.classList.remove("hidden");
        if (citationGuidance) citationGuidance.innerHTML = `<strong>How to cite.</strong> Please cite the accompanying preprint when using this resource. The final peer-reviewed article will replace the preprint as the preferred citation once published.`;
      } else {
        citationButton.classList.add("hidden");
      }
    }
    $("#current-year").textContent = new Date().getFullYear();
  }


  function populateControls() {
    const dimSelect = $("#dimension-select");
    DIMENSIONS.forEach(([label, key]) => dimSelect.add(new Option(label, key)));
    dimSelect.value = state.selectedDimension;
    const dominantValues = [...new Set(state.rows.map(r => r.dominant_dimension).filter(Boolean))].sort((a,b) => a.localeCompare(b,"de"));
    dominantValues.forEach(v => $("#dominant-select").add(new Option(v, v)));
  }

  function populateToolkitControls() {
    const wordSelect = $("#toolkit-word-select");
    if (!wordSelect) return;

    wordSelect.innerHTML = "";
    state.rows
      .map(row => row.word)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }))
      .forEach(word => wordSelect.add(new Option(word, word)));

    if (state.rows[0]) wordSelect.value = state.rows[0].word;
  }

  function getProfile(row) {
    const features = [];
    const values = [];

    DIMENSIONS.forEach(([label, key]) => {
      const value = Number(row[key]);
      if (Number.isFinite(value)) {
        features.push(label);
        values.push(value);
      }
    });

    return { features, values };
  }

  function renderToolkitPlot() {
    const plot = $("#toolkit-plot");
    const wordSelect = $("#toolkit-word-select");
    const plotSelect = $("#toolkit-plot-select");

    if (!plot || !wordSelect || !plotSelect || !state.rows.length) return;

    if (!window.Plotly) {
      plot.innerHTML = '<div class="plot-error">Plotly could not be loaded. Reload the page or check that assets/vendor/plotly-3.3.1.min.js is present.</div>';
      return;
    }

    const selectedWord = wordSelect.value || state.rows[0].word;
    const plotType = plotSelect.value || "radar";
    const row = state.rows.find(item => item.word === selectedWord) || state.rows[0];
    const { features, values } = getProfile(row);
    const formatted = values.map(value => value.toFixed(2));

    const goldFill = "#f6e27a";
    const goldDark = "#d4af37";
    const commonFont = {
      family: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      color: "#172033"
    };

    const commonLayout = {
      title: { text: row.word, x: 0.02, xanchor: "left" },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: commonFont,
      showlegend: false,
      hoverlabel: { bgcolor: "#172033", font: { color: "#ffffff" } }
    };

    const plotConfig = {
      responsive: true,
      displaylogo: false,
      toImageButtonOptions: {
        format: "png",
        filename: `german_noun_profile_${row.word}_${plotType}`,
        scale: 2
      },
      modeBarButtonsToRemove: ["select2d", "lasso2d"]
    };

    let traces;
    let layout;

    if (plotType === "radar") {
      traces = [{
        type: "scatterpolar",
        mode: "lines+markers",
        r: [...values, values[0]],
        theta: [...features, features[0]],
        fill: "toself",
        fillcolor: "rgba(246,226,122,0.45)",
        line: { color: goldDark, width: 3 },
        marker: { color: goldDark, size: 7 },
        hovertemplate: "%{theta}: %{r:.2f}<extra></extra>"
      }];
      layout = {
        ...commonLayout,
        height: 650,
        margin: { l: 90, r: 90, t: 80, b: 70 },
        polar: {
          bgcolor: "rgba(0,0,0,0)",
          radialaxis: { visible: true, range: [0, 7], tickvals: [1,2,3,4,5,6,7], gridcolor: "#dce3ee" },
          angularaxis: { gridcolor: "#e7ebf1", tickfont: { size: 11 } }
        }
      };
    } else if (plotType === "bar") {
      traces = [{
        type: "bar",
        x: features,
        y: values,
        text: formatted,
        textposition: "outside",
        cliponaxis: false,
        marker: { color: goldFill, line: { color: goldDark, width: 1.5 } },
        hovertemplate: "%{x}: %{y:.2f}<extra></extra>"
      }];
      layout = {
        ...commonLayout,
        height: 570,
        margin: { l: 70, r: 35, t: 75, b: 140 },
        xaxis: { tickangle: -38, automargin: true },
        yaxis: { title: "Mean rating", range: [0, 7.5], dtick: 1, gridcolor: "#e7ebf1", zeroline: false }
      };
    } else if (plotType === "heatmap") {
      traces = [{
        type: "heatmap",
        z: [values],
        x: features,
        y: [row.word],
        zmin: 1,
        zmax: 7,
        colorscale: [[0, "#fff9dc"], [0.5, "#f6e27a"], [1, "#d4af37"]],
        text: [formatted],
        texttemplate: "%{text}",
        textfont: { color: "#172033", size: 12 },
        colorbar: { title: "Rating", tickvals: [1,2,3,4,5,6,7] },
        hovertemplate: "%{x}: %{z:.2f}<extra></extra>"
      }];
      layout = {
        ...commonLayout,
        height: 350,
        margin: { l: 100, r: 55, t: 75, b: 125 },
        xaxis: { tickangle: -38, automargin: true },
        yaxis: { automargin: true }
      };
    } else {
      traces = [];
      layout = commonLayout;
    }

    plot.setAttribute("aria-label", `${plotType} experiential profile for ${row.word}`);
    window.Plotly.react(plot, traces, layout, plotConfig);
  }

  function renderMetrics() {
    $("#metric-words").textContent = state.rows.length.toLocaleString();
    const counts = state.rows.map(r => Number(r.participant_count)).filter(Number.isFinite).sort((a,b) => a-b);
    const mid = Math.floor(counts.length / 2);
    const median = counts.length ? (counts.length % 2 ? counts[mid] : (counts[mid-1] + counts[mid]) / 2) : NaN;
    $("#metric-participants").textContent = Number.isFinite(median) ? fmt(median, median % 1 ? 1 : 0) : "—";
    const example = state.rows[0];
    if (!example) return;
    $("#preview-word").textContent = example.word;
    $("#preview-dominant").textContent = example.dominant_dimension || "—";
    const ranked = DIMENSIONS.map(([label,key]) => ({label, value:Number(example[key])})).filter(x => Number.isFinite(x.value)).sort((a,b) => b.value-a.value).slice(0,7);
    $("#preview-bars").innerHTML = ranked.map(x => `<div class="mini-row"><span>${escapeHtml(x.label)}</span><div class="mini-track"><div class="mini-fill" style="width:${Math.max(0,Math.min(100,x.value/7*100))}%"></div></div><strong>${fmt(x.value,1)}</strong></div>`).join("");
  }

  function applyFilters() {
    const query = $("#search-input").value.trim().toLocaleLowerCase("de");
    const dominant = $("#dominant-select").value;
    const minEx = Number($("#exclusivity-input").value);
    state.filtered = state.rows.filter(r => {
      return (!query || String(r.word).toLocaleLowerCase("de").includes(query)) &&
             (!dominant || r.dominant_dimension === dominant) &&
             (Number(r.exclusivity_score) >= minEx || (!r.exclusivity_score && minEx === 0));
    });
    sortRows();
    state.page = Math.min(state.page, Math.max(1, Math.ceil(state.filtered.length / state.pageSize)));
    renderTable();
  }

  function sortRows() {
    const key = state.sortKey, dir = state.sortDirection;
    state.filtered.sort((a,b) => {
      const av = a[key], bv = b[key], an = Number(av), bn = Number(bv);
      if (av === bv) return 0;
      if (Number.isFinite(an) && Number.isFinite(bn) && av !== "" && bv !== "") return (an - bn) * dir;
      return String(av ?? "").localeCompare(String(bv ?? ""), "de", {numeric:true}) * dir;
    });
  }

  function renderTable() {
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.pageSize;
    const pageRows = state.filtered.slice(start, start + state.pageSize);
    const dimLabel = DIMENSIONS.find(d => d[1] === state.selectedDimension)?.[0] || "Selected rating";
    $("#dimension-sort").dataset.sort = state.selectedDimension;
    $("#dimension-sort").firstChild.nodeValue = `${dimLabel} `;
    const tbody = $("#data-table tbody");
    if (!pageRows.length) tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No words match the current filters.</td></tr>`;
    else tbody.innerHTML = pageRows.map((r, i) => `<tr tabindex="0" data-index="${start+i}" aria-label="Open profile for ${escapeHtml(r.word)}">
      <td>${escapeHtml(r.word)}</td>
      <td><span class="dimension-tag">${escapeHtml(r.dominant_dimension || "—")}</span></td>
      <td class="value-cell">${fmt(r[state.selectedDimension])}</td>
      <td class="value-cell">${fmt(r.exclusivity_score,3)}</td>
      <td class="value-cell">${fmt(r.concreteness_mean)}</td>
      <td class="value-cell">${fmt(r.familiarity_mean)}</td>
      <td class="value-cell">${fmt(r.participant_count,0)}</td>
    </tr>`).join("");
    $("#result-count").textContent = `${state.filtered.length.toLocaleString()} ${state.filtered.length === 1 ? "word" : "words"}`;
    $("#page-info").textContent = `Page ${state.page} of ${totalPages}`;
    $("#prev-page").disabled = state.page <= 1;
    $("#next-page").disabled = state.page >= totalPages;
    $$("#data-table thead button span").forEach(s => s.textContent = "");
    const active = $(`#data-table thead button[data-sort="${CSS.escape(state.sortKey)}"] span`);
    if (active) active.textContent = state.sortDirection > 0 ? "↑" : "↓";
  }

  function openWord(row) {
    $("#dialog-word").textContent = row.word;
    $("#dialog-meta").innerHTML = `<span class="dimension-pill">Dominant: ${escapeHtml(row.dominant_dimension || "—")}</span><span class="tag">Exclusivity ${fmt(row.exclusivity_score,3)}</span><span class="tag">${fmt(row.participant_count,0)} raters</span>`;
    $("#profile-chart").innerHTML = DIMENSIONS.map(([label,key,sdKey]) => {
      const value = Number(row[key]), sd = Number(row[sdKey]);
      return `<div class="bar-row"><span class="bar-label">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Number.isFinite(value) ? Math.max(0,Math.min(100,value/7*100)) : 0}%"></div></div><span class="bar-value">${fmt(value)}${Number.isFinite(sd) ? ` ± ${fmt(sd)}` : ""}</span></div>`;
    }).join("");
    const displayedValence = Number(row.valence_mean_rescaled);
    const summaries = [
      ["Dominant dimension", row.dominant_dimension || "—"], ["Exclusivity", fmt(row.exclusivity_score,3)],
      ["Concreteness", fmt(row.concreteness_mean)], ["Familiarity", fmt(row.familiarity_mean)],
      ["Valence", fmt(displayedValence)], ["Participants", fmt(row.participant_count,0)]
    ];
    $("#word-summary").innerHTML = summaries.map(([k,v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("");
    const tags = Object.keys(row).filter(k => k.startsWith("germanet_dimension_") && row[k]).map(k => row[k]);
    $("#germanet-tags").innerHTML = tags.length ? [...new Set(tags)].map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("") : `<span class="tag">No field listed</span>`;
    $("#word-dialog").showModal();
  }

  function downloadFiltered() {
    if (!state.filtered.length) return showToast("No filtered records to download.");
    const headers = Object.keys(state.rows[0]);
    const quote = value => { const s = String(value ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv = "\uFEFF" + [headers.map(quote).join(","), ...state.filtered.map(r => headers.map(h => quote(r[h])).join(","))].join("\r\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "MultiNorms_GER_filtered.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function showToast(message) { const t=$("#toast"); t.textContent=message; t.classList.add("visible"); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>t.classList.remove("visible"),2300); }

  function bindEvents() {
    $("#nav-toggle").addEventListener("click", e => { const open=$("#site-nav").classList.toggle("open"); e.currentTarget.setAttribute("aria-expanded", String(open)); });
    $$("#site-nav a").forEach(a => a.addEventListener("click", () => $("#site-nav").classList.remove("open")));
    $("#search-input").addEventListener("input", () => { state.page=1; applyFilters(); });
    $("#dominant-select").addEventListener("change", () => { state.page=1; applyFilters(); });
    $("#exclusivity-input").addEventListener("input", e => { $("#exclusivity-value").textContent=Number(e.target.value).toFixed(2); state.page=1; applyFilters(); });
    $("#dimension-select").addEventListener("change", e => { state.selectedDimension=e.target.value; state.sortKey=e.target.value; state.sortDirection=-1; applyFilters(); });
    $("#page-size").addEventListener("change", e => { state.pageSize=Number(e.target.value); state.page=1; renderTable(); });
    $("#prev-page").addEventListener("click", () => { state.page--; renderTable(); });
    $("#next-page").addEventListener("click", () => { state.page++; renderTable(); });
    $("#reset-filters").addEventListener("click", () => { $("#search-input").value=""; $("#dominant-select").value=""; $("#exclusivity-input").value=0; $("#exclusivity-value").textContent="0.00"; state.page=1; applyFilters(); });
    $("#download-filtered").addEventListener("click", downloadFiltered);
    $("#data-table thead").addEventListener("click", e => { const b=e.target.closest("button[data-sort]"); if(!b) return; const key=b.dataset.sort; if(state.sortKey===key) state.sortDirection*=-1; else { state.sortKey=key; state.sortDirection=1; } applyFilters(); });
    $("#data-table tbody").addEventListener("click", e => { const tr=e.target.closest("tr[data-index]"); if(tr) openWord(state.filtered[Number(tr.dataset.index)]); });
    $("#data-table tbody").addEventListener("keydown", e => { if((e.key==="Enter"||e.key===" ") && e.target.matches("tr[data-index]")) { e.preventDefault(); openWord(state.filtered[Number(e.target.dataset.index)]); } });
    $("#close-dialog").addEventListener("click", () => $("#word-dialog").close());
    $("#word-dialog").addEventListener("click", e => { const d=e.currentTarget; if(e.target===d) d.close(); });
    if ($("#toolkit-word-select")) $("#toolkit-word-select").addEventListener("change", renderToolkitPlot);
    if ($("#toolkit-plot-select")) $("#toolkit-plot-select").addEventListener("change", renderToolkitPlot);
    if ($("#copy-citation")) $("#copy-citation").addEventListener("click", async () => {
      const authorText = config.citationAuthors || config.authors || "Authors";
      const year = config.releaseYear || new Date().getFullYear();
      const title = config.title || "A multidimensional normative database of experiential ratings for German nouns";
      const journal = config.journalName || "Behavior Research Methods";
      const paperUrl = config.paperUrl || (config.doi ? (String(config.doi).startsWith("http") ? config.doi : `https://doi.org/${config.doi}`) : "");
      let citation = "";

      if (paperUrl) {
        citation = `${authorText} (${year}). ${title}. ${journal}. ${paperUrl}`;
      } else if (config.preprintUrl) {
        citation = `${authorText} (${year}). ${title}. Preprint. ${config.preprintUrl}`;
      } else {
        showToast("The publication citation will be available when the preprint is public.");
        return;
      }

      try { await navigator.clipboard.writeText(citation); showToast("Publication citation copied."); }
      catch { showToast(citation); }
    });
  }

  async function init() {
    applyConfig(); bindEvents();
    try {
      const response = await fetch(config.dataFile || "data/MultiNorms_GER_summary_level_dataset.csv");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.rows = parseCSV(await response.text());
      if (!state.rows.length) throw new Error("The CSV contains no rows with a word value.");
      state.filtered = [...state.rows];
      populateControls(); populateToolkitControls(); renderMetrics(); applyFilters(); renderToolkitPlot();
    } catch (err) {
      const box=$("#load-error"); box.textContent=`The dataset could not be loaded (${err.message}). Open the site through a local web server or GitHub Pages rather than by double-clicking index.html.`; box.classList.remove("hidden");
      $("#result-count").textContent="Dataset unavailable";
    }
  }
  window.addEventListener("DOMContentLoaded", init);
})();
