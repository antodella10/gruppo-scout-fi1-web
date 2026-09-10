document.addEventListener("DOMContentLoaded", () => {
  BranchView.persist("reparto", { updateUrl: false });

  const bookStatus = document.getElementById("book-status");
  const bookEmpty = document.getElementById("book-empty");
  const bookFrame = document.getElementById("book-frame");
  const bookViewer = document.getElementById("book-viewer");
  const bookMeta = document.getElementById("book-meta-line");
  const downloadBtn = document.getElementById("pdf-download");
  const openBtn = document.getElementById("pdf-open");
  const pdfStage = document.getElementById("pdf-stage");
  const fsBtn = document.getElementById("pdf-fullscreen");
  const exitFsBtn = document.getElementById("pdf-exit-fs");
  const songsList = document.getElementById("songs-list");
  const proposeForm = document.getElementById("propose-form");
  const proposeAlert = document.getElementById("propose-alert");

  let currentBookUrl = null;
  let currentBookName = "canzoniere.pdf";
  let pdfJsPromise = null;
  let renderToken = 0;

  function isMobileUi() {
    const ua = navigator.userAgent || "";
    return /iPhone|iPad|iPod|Android/i.test(ua) || window.matchMedia("(max-width: 900px)").matches;
  }

  function pdfSrc(url, { toolbar = true, zoom = 100 } = {}) {
    if (toolbar) {
      return `${url}#toolbar=1&navpanes=0&zoom=${zoom}`;
    }
    return `${url}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`;
  }

  function inAnyFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      pdfStage?.classList.contains("is-pseudo-fs")
    );
  }

  function setExitFsVisible(on) {
    if (!exitFsBtn) return;
    exitFsBtn.hidden = !on;
    exitFsBtn.classList.toggle("is-visible", on);
    exitFsBtn.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function enablePseudoFs() {
    if (!pdfStage) return;
    pdfStage.classList.add("is-pseudo-fs");
    document.body.classList.add("pdf-pseudo-fs-open");
    setExitFsVisible(true);
  }

  function disablePseudoFs() {
    pdfStage?.classList.remove("is-pseudo-fs");
    document.body.classList.remove("pdf-pseudo-fs-open");
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;
    pdfJsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.async = true;
      s.onload = () => {
        try {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(window.pdfjsLib);
        } catch (err) {
          reject(err);
        }
      };
      s.onerror = () => reject(new Error("Impossibile caricare il visualizzatore PDF."));
      document.head.appendChild(s);
    });
    return pdfJsPromise;
  }

  async function renderPdfJs(url) {
    if (!bookViewer) return;
    const token = ++renderToken;
    bookViewer.hidden = false;
    bookViewer.classList.add("is-visible");
    bookViewer.innerHTML = `<p class="pdf-viewer-status">Caricamento anteprima…</p>`;

    try {
      const pdfjsLib = await loadPdfJs();
      if (token !== renderToken) return;

      const pdf = await pdfjsLib.getDocument({ url, withCredentials: false }).promise;
      if (token !== renderToken) return;

      bookViewer.innerHTML = "";
      const width = Math.max(bookViewer.clientWidth || pdfStage?.clientWidth || window.innerWidth - 32, 280);

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (token !== renderToken) return;
        const page = await pdf.getPage(pageNum);
        const unscaled = page.getViewport({ scale: 1 });
        const scale = Math.min(2.2, (width - 8) / unscaled.width);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.className = "pdf-page-canvas";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (token !== renderToken) return;
        bookViewer.appendChild(canvas);
      }
    } catch (err) {
      if (token !== renderToken) return;
      bookViewer.innerHTML = `<p class="pdf-viewer-status">Anteprima non disponibile su questo telefono. Usa <strong>Apri PDF</strong>.</p>`;
      console.warn("[canzoniere] pdf.js", err);
    }
  }

  function clearViewer() {
    renderToken += 1;
    if (bookViewer) {
      bookViewer.innerHTML = "";
      bookViewer.hidden = true;
      bookViewer.classList.remove("is-visible");
    }
  }

  function showEmpty(message) {
    if (bookEmpty) {
      bookEmpty.hidden = false;
      bookEmpty.classList.add("is-visible");
    }
    if (bookFrame) {
      bookFrame.hidden = true;
      bookFrame.removeAttribute("src");
      bookFrame.classList.remove("is-visible");
    }
    clearViewer();
    if (bookStatus) bookStatus.textContent = message;
    if (fsBtn) fsBtn.hidden = true;
    if (downloadBtn) downloadBtn.hidden = true;
    if (openBtn) openBtn.hidden = true;
    disablePseudoFs();
    setExitFsVisible(false);
  }

  function showPdf(url) {
    if (bookEmpty) {
      bookEmpty.hidden = true;
      bookEmpty.classList.remove("is-visible");
    }

    const mobile = isMobileUi();
    if (mobile && bookViewer) {
      if (bookFrame) {
        bookFrame.hidden = true;
        bookFrame.removeAttribute("src");
        bookFrame.classList.remove("is-visible");
      }
      renderPdfJs(url);
    } else {
      clearViewer();
      if (bookFrame) {
        const next = pdfSrc(url, { toolbar: true, zoom: 100 });
        if (bookFrame.getAttribute("src") !== next) bookFrame.src = next;
        bookFrame.hidden = false;
        bookFrame.classList.add("is-visible");
      }
    }

    if (fsBtn) fsBtn.hidden = false;
    if (downloadBtn) downloadBtn.hidden = false;
    if (openBtn) openBtn.hidden = false;
    setExitFsVisible(inAnyFullscreen());
  }

  async function refreshBook() {
    const book = CanzoniereStore.getBook();
    if (!bookFrame && !bookEmpty && !bookViewer) return;

    if (!book) {
      showEmpty("Il canzoniere non è ancora stato caricato dallo staff.");
      if (bookMeta) bookMeta.textContent = "Reparto · nessun PDF";
      return;
    }

    try {
      if (currentBookUrl) URL.revokeObjectURL(currentBookUrl);
      currentBookUrl = await CanzoniereStore.getPdfUrl(book.fileId);
      currentBookName = book.fileName || "canzoniere.pdf";
      showPdf(currentBookUrl);
      if (bookMeta) {
        const when = new Date(book.updatedAt).toLocaleDateString("it-IT");
        bookMeta.textContent = `${currentBookName} · aggiornato ${when}`;
      }
    } catch (err) {
      showEmpty(err.message || "Impossibile aprire il PDF.");
    }
  }

  function refreshSongs() {
    if (!songsList) return;
    const songs = CanzoniereStore.getSongs();
    if (!songs.length) {
      songsList.innerHTML = `<div class="empty-state">Nessuna canzone sfusa ancora.</div>`;
      return;
    }
    songsList.innerHTML = songs
      .map(
        (s) => `
        <button type="button" class="song-row" data-file="${s.fileId}">
          <span class="song-title">${escapeHtml(s.title)}</span>
          <span class="song-action">Apri PDF</span>
        </button>`
      )
      .join("");
  }

  songsList?.addEventListener("click", async (e) => {
    const row = e.target.closest("[data-file]");
    if (!row) return;
    try {
      await CanzoniereStore.openPdf(row.dataset.file);
    } catch (err) {
      alert(err.message);
    }
  });

  async function enterFullscreen() {
    const el = pdfStage || bookFrame;
    if (!el) return;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else enablePseudoFs();
    } catch {
      enablePseudoFs();
    }
  }

  async function exitFullscreen() {
    disablePseudoFs();
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    } catch {
      /* ignore */
    }
    setExitFsVisible(false);
  }

  function openCurrentBook() {
    if (!currentBookUrl) return;
    const a = document.createElement("a");
    a.href = currentBookUrl;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  fsBtn?.addEventListener("click", enterFullscreen);
  exitFsBtn?.addEventListener("click", exitFullscreen);
  openBtn?.addEventListener("click", openCurrentBook);

  downloadBtn?.addEventListener("click", () => {
    if (!currentBookUrl) return;
    const a = document.createElement("a");
    a.href = currentBookUrl;
    a.download = currentBookName || "canzoniere.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  function onFsChange() {
    const nativeOn = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (pdfStage) {
      pdfStage.classList.toggle("is-fs", document.fullscreenElement === pdfStage);
    }
    setExitFsVisible(nativeOn || !!pdfStage?.classList.contains("is-pseudo-fs"));
  }

  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pdfStage?.classList.contains("is-pseudo-fs")) {
      exitFullscreen();
    }
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    if (!isMobileUi() || !currentBookUrl || !bookViewer || bookViewer.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderPdfJs(currentBookUrl), 350);
  });

  setExitFsVisible(false);

  proposeForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(proposeForm);
    try {
      await CanzoniereStore.proposeSong({
        title: data.get("title"),
        notes: data.get("notes"),
        fromName: data.get("fromName"),
      });
      proposeForm.reset();
      if (proposeAlert) {
        proposeAlert.hidden = false;
        proposeAlert.className = "alert alert-ok";
        proposeAlert.textContent = "Proposta inviata! Lo staff reparto la vedrà nelle notifiche.";
      }
      updateNavAuth();
    } catch (err) {
      if (proposeAlert) {
        proposeAlert.hidden = false;
        proposeAlert.className = "alert alert-error";
        proposeAlert.textContent = err.message;
      }
    }
  });

  (async () => {
    if (bookStatus) bookStatus.textContent = "Caricamento canzoniere…";
    await CanzoniereStore.pullRemote?.().catch(() => {});
    await refreshBook();
    refreshSongs();
  })();
});
