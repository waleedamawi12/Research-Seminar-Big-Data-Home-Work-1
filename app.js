// app.js
(() => {
  const MODEL_URL = "https://weathered-art-ecd7.waleed-amawi-12.workers.dev";
  const TSV_PATH = "reviews_test.tsv";

  const els = {
    hfToken: document.getElementById("hfToken"),
    analyzeBtn: document.getElementById("analyzeBtn"),
    topMessage: document.getElementById("topMessage"),
    dataStatusDot: document.getElementById("dataStatusDot"),
    dataStatusText: document.getElementById("dataStatusText"),
    reviewCountText: document.getElementById("reviewCountText"),
    reviewText: document.getElementById("reviewText"),
    sentimentLabel: document.getElementById("sentimentLabel"),
    sentimentIcon: document.getElementById("sentimentIcon"),
    confidenceValue: document.getElementById("confidenceValue"),
    confidenceBar: document.getElementById("confidenceBar"),
    apiMessage: document.getElementById("apiMessage"),
  };

  let reviews = [];
  let isBusy = false;

  function setBusy(busy) {
    isBusy = busy;
    els.analyzeBtn.disabled = busy || reviews.length === 0;
    if (busy) {
      els.analyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing…`;
    } else {
      els.analyzeBtn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Pick Random Review & Analyze`;
    }
  }

  function setTopMessage(msg, kind = "muted") {
    els.topMessage.textContent = msg || "";
    if (!msg) return;
    if (kind === "error") {
      els.topMessage.style.color = "rgba(255,93,108,0.95)";
    } else if (kind === "ok") {
      els.topMessage.style.color = "rgba(59,214,127,0.95)";
    } else {
      els.topMessage.style.color = "";
    }
  }

  function setApiMessage(msg, kind = "muted") {
    els.apiMessage.textContent = msg || "";
    if (!msg) return;
    if (kind === "error") {
      els.apiMessage.style.color = "rgba(255,93,108,0.95)";
    } else if (kind === "ok") {
      els.apiMessage.style.color = "rgba(59,214,127,0.95)";
    } else {
      els.apiMessage.style.color = "";
    }
  }

  function setDataStatus(status, text) {
    els.dataStatusText.textContent = text;
    els.dataStatusDot.classList.remove("ok", "bad");
    if (status === "ok") els.dataStatusDot.classList.add("ok");
    if (status === "bad") els.dataStatusDot.classList.add("bad");
  }

  function setResultUI(sentiment, confidence) {
    els.sentimentLabel.textContent = sentiment || "—";

    const iconEl = els.sentimentIcon;
    iconEl.classList.remove("good", "bad", "neutral");

    let iconHtml = `<i class="fa-solid fa-circle-question"></i>`;
    let cls = "neutral";

    if (sentiment === "Positive") {
      iconHtml = `<i class="fa-solid fa-thumbs-up"></i>`;
      cls = "good";
    } else if (sentiment === "Negative") {
      iconHtml = `<i class="fa-solid fa-thumbs-down"></i>`;
      cls = "bad";
    } else if (sentiment === "Neutral") {
      iconHtml = `<i class="fa-solid fa-circle-question"></i>`;
      cls = "neutral";
    }

    iconEl.classList.add(cls);
    iconEl.innerHTML = iconHtml;

    if (typeof confidence === "number" && Number.isFinite(confidence)) {
      const pct = Math.max(0, Math.min(100, confidence * 100));
      els.confidenceValue.textContent = `${pct.toFixed(1)}%`;
      els.confidenceBar.style.width = `${pct}%`;
    } else {
      els.confidenceValue.textContent = "—";
      els.confidenceBar.style.width = "0%";
    }
  }

  function pickRandomReview() {
    if (!reviews.length) return null;
    const idx = Math.floor(Math.random() * reviews.length);
    return reviews[idx];
  }

  function normalizeText(v) {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  }

  // Strips HTML tags so we don't send <a href=...> etc. to the model
  function stripHtml(s) {
    return String(s).replace(/<[^>]*>/g, " ");
  }

  async function loadTSV() {
    setDataStatus("", "Loading TSV…");
    setTopMessage("");
    try {
      const res = await fetch(TSV_PATH, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to fetch ${TSV_PATH} (HTTP ${res.status})`);
      }
      const tsvText = await res.text();

      const parsed = Papa.parse(tsvText, {
        header: true,
        delimiter: "\t",
        skipEmptyLines: true,
      });

      if (parsed.errors && parsed.errors.length) {
        const firstErr = parsed.errors[0];
        throw new Error(firstErr.message || "Failed to parse TSV.");
      }

      const rows = Array.isArray(parsed.data) ? parsed.data : [];
      const extracted = rows
        .map((r) => normalizeText(r?.text))
        .filter((t) => t.length > 0);

      reviews = extracted;

      els.reviewCountText.textContent = `${reviews.length} reviews`;
      if (reviews.length === 0) {
        setDataStatus("bad", "TSV loaded, but no 'text' rows found");
        setTopMessage("No reviews found in TSV. Ensure there is a 'text' column with review content.", "error");
      } else {
        setDataStatus("ok", `TSV loaded (${reviews.length} reviews)`);
        setTopMessage("TSV loaded. Ready to analyze.", "ok");
      }

      setBusy(false);
    } catch (err) {
      reviews = [];
      els.reviewCountText.textContent = `0 reviews`;
      setDataStatus("bad", "Failed to load TSV");
      setTopMessage(err?.message ? String(err.message) : "Failed to load TSV.", "error");
      setBusy(false);
    }
  }

  function buildHeaders() {
    const token = normalizeText(els.hfToken.value);
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  function classifyFromResponse(data) {
    const top = data?.[0]?.[0];
    const label = top?.label;
    const score = top?.score;

    if (typeof score !== "number" || !Number.isFinite(score) || typeof label !== "string") {
      return { sentiment: "Neutral", confidence: null };
    }

    if (label === "POSITIVE" && score > 0.5) {
      return { sentiment: "Positive", confidence: score };
    }
    if (label === "NEGATIVE" && score > 0.5) {
      return { sentiment: "Negative", confidence: score };
    }
    return { sentiment: "Neutral", confidence: score };
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function postToHF(body, attempt = 1) {
    let res;
    try {
      res = await fetch(MODEL_URL, {
        method: "POST",
        headers: buildHeaders(),
        body,
        mode: "cors",
      });
    } catch (e) {
      // This is where Safari often throws for CORS/preflight issues.
      throw new Error(`Network error while contacting Hugging Face Inference API. (${e?.message || "fetch failed"})`);
    }

    // Handle model cold-start (503)
    if (res.status === 503 && attempt === 1) {
      // Try to read estimated_time (if provided), otherwise wait a bit.
      let waitMs = 2000;
      try {
        const txt = await res.text();
        const obj = txt ? JSON.parse(txt) : null;
        if (obj && typeof obj.estimated_time === "number") {
          waitMs = Math.min(15000, Math.max(2000, Math.ceil(obj.estimated_time * 1000)));
        }
      } catch {}
      await sleep(waitMs);
      return postToHF(body, 2);
    }

    return res;
  }

  async function analyzeReview(reviewText) {
    const clean = stripHtml(reviewText);
    const body = JSON.stringify({ inputs: clean });

    const res = await postToHF(body);

    let payloadText = "";
    try {
      payloadText = await res.text();
    } catch {
      payloadText = "";
    }

    let data = null;
    try {
      data = payloadText ? JSON.parse(payloadText) : null;
    } catch {
      data = null;
    }

    if (!res.ok) {
      const apiMsg =
        (data && (data.error || data.estimated_time)) ||
        (typeof payloadText === "string" && payloadText.trim().slice(0, 220)) ||
        `HTTP ${res.status}`;

      if (res.status === 401 || res.status === 403) {
        throw new Error("Authorization failed. Check your Hugging Face token (or remove it to try unauthenticated).");
      }
      if (res.status === 429) {
        throw new Error("Rate limited by Hugging Face (HTTP 429). Try again later or add a token.");
      }
      throw new Error(`Hugging Face API error: ${apiMsg}`);
    }

    if (data && data.error) {
      throw new Error(String(data.error));
    }

    return data;
  }

  async function onAnalyzeClick() {
    if (isBusy) return;
    if (!reviews.length) {
      setTopMessage("No reviews loaded yet.", "error");
      return;
    }

    const review = pickRandomReview();
    if (!review) {
      setTopMessage("Could not pick a review from TSV.", "error");
      return;
    }

    els.reviewText.textContent = review;
    setResultUI("—", null);
    setApiMessage("");

    setBusy(true);
    try {
      const data = await analyzeReview(review);
      const { sentiment, confidence } = classifyFromResponse(data);
      setResultUI(sentiment, confidence);
      setApiMessage("Analysis complete.", "ok");
    } catch (err) {
      setResultUI("Neutral", null);
      setApiMessage(err?.message ? String(err.message) : "An error occurred.", "error");
    } finally {
      setBusy(false);
    }
  }

  function init() {
    setBusy(true);
    setResultUI("—", null);
    els.analyzeBtn.addEventListener("click", onAnalyzeClick);
    loadTSV();
  }

  init();
})();
