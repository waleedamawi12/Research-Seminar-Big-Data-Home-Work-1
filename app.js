// app.js
(() => {
  const MODEL_URL =
    "https://api-inference.huggingface.co/models/siebert/sentiment-roberta-large-english";
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
    els.analyzeBtn.innerHTML = busy
      ? `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing…`
      : `<i class="fa-solid fa-wand-magic-sparkles"></i> Pick Random Review & Analyze`;
  }

  function setTopMessage(msg, kind = "muted") {
    els.topMessage.textContent = msg || "";
    if (!msg) return;
    els.topMessage.style.color =
      kind === "error"
        ? "rgba(255,93,108,0.95)"
        : kind === "ok"
        ? "rgba(59,214,127,0.95)"
        : "";
  }

  function setApiMessage(msg, kind = "muted") {
    els.apiMessage.textContent = msg || "";
    if (!msg) return;
    els.apiMessage.style.color =
      kind === "error"
        ? "rgba(255,93,108,0.95)"
        : kind === "ok"
        ? "rgba(59,214,127,0.95)"
        : "";
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

  function normalizeText(v) {
    return v == null ? "" : String(v).trim();
  }

  function stripHtml(s) {
    return String(s).replace(/<[^>]*>/g, " ");
  }

  function pickRandomReview() {
    return reviews[Math.floor(Math.random() * reviews.length)] || null;
  }

  async function loadTSV() {
    setDataStatus("", "Loading TSV…");
    setTopMessage("");

    try {
      const res = await fetch(TSV_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch TSV (HTTP ${res.status})`);

      const text = await res.text();
      const parsed = Papa.parse(text, {
        header: true,
        delimiter: "\t",
        skipEmptyLines: true,
      });

      const rows = parsed.data || [];
      reviews = rows
        .map((r) => normalizeText(r?.text))
        .filter(Boolean);

      els.reviewCountText.textContent = `${reviews.length} reviews`;

      if (!reviews.length) {
        setDataStatus("bad", "No valid reviews found");
        setTopMessage("TSV loaded but no 'text' column found.", "error");
      } else {
        setDataStatus("ok", `TSV loaded (${reviews.length} reviews)`);
        setTopMessage("TSV loaded. Ready to analyze.", "ok");
      }
    } catch (e) {
      reviews = [];
      els.reviewCountText.textContent = "0 reviews";
      setDataStatus("bad", "Failed to load TSV");
      setTopMessage(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function buildHeaders() {
  const token = normalizeText(els.hfToken.value);
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}


  async function fetchWithRetry(url, options, retries = 1) {
    try {
      return await fetch(url, options);
    } catch (e) {
      if (retries <= 0) throw e;
      await new Promise((r) => setTimeout(r, 1500));
      return fetch(url, options);
    }
  }

  async function analyzeReview(reviewText) {
    const body = JSON.stringify({ inputs: stripHtml(reviewText) });

    let res;
    try {
      res = await fetchWithRetry(
        MODEL_URL,
        {
          method: "POST",
          headers: buildHeaders(),
          body,
        },
        1
      );
    } catch (e) {
      throw new Error("Network error contacting Hugging Face API.");
    }

    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new Error("Authorization failed. Check Hugging Face token.");
      }
      if (res.status === 429) {
        throw new Error("Rate limited by Hugging Face. Try again later.");
      }
      throw new Error(data?.error || `HF API error (HTTP ${res.status})`);
    }

    return data;
  }

  function classifyFromResponse(data) {
    const top = data?.[0]?.[0];
    if (!top || typeof top.score !== "number") {
      return { sentiment: "Neutral", confidence: null };
    }
    if (top.label === "POSITIVE") {
      return { sentiment: "Positive", confidence: top.score };
    }
    if (top.label === "NEGATIVE") {
      return { sentiment: "Negative", confidence: top.score };
    }
    return { sentiment: "Neutral", confidence: top.score };
  }

  async function onAnalyzeClick() {
    if (isBusy || !reviews.length) return;

    const review = pickRandomReview();
    if (!review) return;

    els.reviewText.textContent = review;
    setResultUI("—", null);
    setApiMessage("");
    setBusy(true);

    try {
      const data = await analyzeReview(review);
      const { sentiment, confidence } = classifyFromResponse(data);
      setResultUI(sentiment, confidence);
      setApiMessage("Analysis complete.", "ok");
    } catch (e) {
      setResultUI("Neutral", null);
      setApiMessage(e.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function init() {
    setBusy(true);
    els.analyzeBtn.addEventListener("click", onAnalyzeClick);
    loadTSV();
  }

  init();
})();
