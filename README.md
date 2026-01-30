# Research-Seminar-Big-Data-Home-Work-1

## Project Overview

This project implements a **web-based sentiment analysis application** that analyzes product reviews stored in a TSV dataset. The application randomly selects a review, sends it to a transformer-based sentiment analysis model hosted on Hugging Face, and displays the predicted sentiment and confidence score in a user-friendly interface.
Because the application is deployed on **static hosting (GitHub Pages)**, a serverless backend using **Cloudflare Workers** was introduced to securely communicate with the Hugging Face Inference API and handle browser security constraints such as CORS.

---

## Step 1: Creating the GitHub Repository

The project began by creating a new GitHub repository named:

```
Research-Seminar-Big-Data-Home-Work-1
```

This repository serves as:

* Version control for all source code
* The deployment source for GitHub Pages
* A reproducible artifact for evaluation

The initial structure included:

* `index.html` – frontend UI
* `app.js` – frontend application logic
* `reviews_test.tsv` – dataset containing text reviews
* `README.md` – project description
* `LICENSE` – licensing information

---

## Step 2: Building the Frontend (Static Web Application)

The frontend was implemented using **HTML, CSS, and vanilla JavaScript**.

### Responsibilities of the frontend:

* Load the TSV dataset (`reviews_test.tsv`)
* Parse the dataset using PapaParse
* Randomly select a review
* Display review text, sentiment label, and confidence
* Trigger sentiment analysis via a backend endpoint

Because the site is hosted on **GitHub Pages**, the frontend is purely static and runs entirely in the browser.

---

## Step 3: Dataset Handling (TSV Parsing)

The dataset (`reviews_test.tsv`) contains hundreds of product reviews stored in tab-separated format.

The frontend:

1. Fetches the TSV file
2. Parses it using PapaParse
3. Extracts the `text` column
4. Stores reviews in memory
5. Selects a random review when requested

This design avoids precomputing results and demonstrates dynamic interaction with real data.

---

## Step 4: Initial Hugging Face API Integration Attempt

The initial design attempted to call the **Hugging Face Inference API** directly from the browser to analyze sentiment using the model:

```
siebert/sentiment-roberta-large-english
```

However, this approach failed due to:

* **CORS restrictions**
* **Browser security policies**
* **Inability to safely store API tokens in client-side code**

These limitations made a direct browser → Hugging Face connection unsuitable.

---

## Step 5: Introducing a Serverless Backend (Cloudflare Worker)

To solve these issues, a **Cloudflare Worker** was introduced as a lightweight serverless backend.

### Why Cloudflare Workers?

* Runs at the network edge
* Requires no server management
* Supports secure environment variables
* Easily handles CORS
* Ideal for proxying API requests

---

## Step 6: Creating and Deploying the Cloudflare Worker

A new Worker was created via the Cloudflare Dashboard and deployed at:

```
https://weathered-art-ecd7.waleed-amawi-12.workers.dev
```

The Worker acts as a **secure proxy**:

* Receives POST requests from the frontend
* Forwards them to Hugging Face
* Attaches the API token server-side
* Returns the response to the browser

---

## Step 7: Handling CORS and Preflight Requests

Modern browsers issue an **OPTIONS preflight request** before sending POST requests with JSON payloads.

The Worker was explicitly configured to:

* Respond to `OPTIONS` requests
* Return proper CORS headers
* Allow cross-origin requests from GitHub Pages

This step was essential to eliminate “Failed to fetch” and “Load failed” errors.

---

## Step 8: Migrating to the New Hugging Face Router API

During testing, Hugging Face deprecated the old endpoint:

```
https://api-inference.huggingface.co
```

The Worker was updated to use the new router endpoint:

```
https://router.huggingface.co/hf-inference/models/siebert/sentiment-roberta-large-english
```

This ensured continued compatibility with Hugging Face’s infrastructure.

---

## Step 9: Connecting Frontend to the Worker

The frontend `app.js` was updated so that **all sentiment analysis requests** are sent to the Cloudflare Worker instead of directly to Hugging Face.

This completed the request flow:

```
Browser (GitHub Pages)
        ↓
Cloudflare Worker
        ↓
Hugging Face Inference API
        ↓
Cloudflare Worker
        ↓
Browser
```

---

## Step 10: Final Result

The final application:

* Successfully loads and parses the dataset
* Randomly selects reviews
* Sends them securely for inference
* Displays sentiment (Positive / Negative / Neutral)
* Shows a confidence score
* Works across browsers and devices

The Hugging Face API token is **never exposed to the client**, making the solution secure and production-ready.

---

## Architectural Summary

* **Frontend:** GitHub Pages (static hosting)
* **Backend:** Cloudflare Worker (serverless proxy)
* **Model:** Transformer-based sentiment classifier (RoBERTa)
* **Data:** TSV product review dataset
* **Security:** Server-side token handling + CORS compliance

---

## Conclusion

This project demonstrates how to build a modern web-based data application that integrates large-scale NLP models while respecting browser security constraints. By combining static hosting, serverless computing, and third-party ML inference, the solution achieves scalability, security, and clarity without requiring a traditional backend server.

---
