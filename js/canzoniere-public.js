document.addEventListener("DOMContentLoaded", () => {
  BranchView.persist("reparto", { updateUrl: false });

  const bookStatus = document.getElementById("book-status");
  const bookEmpty = document.getElementById("book-empty");
  const bookFrame = document.getElementById("book-frame");
  const bookMeta = document.getElementById("book-meta-line");
  const pdfStage = document.getElementById("pdf-stage");
  const fsBtn = document.getElementById("pdf-fullscreen");
  const exitFsBtn = document.getElementById("pdf-exit-fs");
  const songsList = document.getElementById("songs-list");
  const proposeForm = document.getElementById("propose-form");
  const proposeAlert = document.getElementById("propose-alert");

  let currentBookUrl = null;

  function pdfSrc(url, { toolbar = false, zoom = 110 } = {}) {
    const flags = [
      `zoom=${zoom}`,
      `toolbar=${toolbar ? 1 : 0}`,
      "navpanes=0",
      "scrollbar=1",
      "view=FitH",
    ];
    return `${url}#${flags.join("&")}`;
  }

  function showEmpty(message) {
    if (bookEmpty) {
      bookEmpty.hidden = false;
      bookEmpty.classList.add("is-visible");
    }
    if (bookStatus) bookStatus.textContent = message;
    if (bookFrame) {
      bookFrame.hidden = true;
      bookFrame.removeAttribute("src");
      bookFrame.classList.remove("is-visible");
    }
    if (fsBtn) fsBtn.hidden = true;
  }

  function showPdf(url) {
    if (bookEmpty) {
      bookEmpty.hidden = true;
      bookEmpty.classList.remove("is-visible");
    }
    if (bookFrame) {
      const fullscreen = !!document.fullscreenElement;
      bookFrame.src = pdfSrc(url, { toolbar: fullscreen, zoom: 110 });
      bookFrame.hidden = false;
      bookFrame.classList.add("is-visible");
    }
    if (fsBtn) fsBtn.hidden = false;
  }

  function reloadPdfForMode() {
    if (!currentBookUrl || !bookFrame?.classList.contains("is-visible")) return;
    const fullscreen = !!document.fullscreenElement;
    bookFrame.src = pdfSrc(currentBookUrl, { toolbar: fullscreen, zoom: 110 });
  }

  async function refreshBook() {
    const book = CanzoniereStore.getBook();
    if (!bookFrame && !bookEmpty) return;

    if (!book) {
      showEmpty("Il canzoniere non è ancora stato caricato dallo staff.");
      if (bookMeta) bookMeta.textContent = "Reparto · nessun PDF";
      return;
    }

    try {
      if (currentBookUrl) URL.revokeObjectURL(currentBookUrl);
      currentBookUrl = await CanzoniereStore.getPdfUrl(book.fileId);
      showPdf(currentBookUrl);
      if (bookMeta) {
        const when = new Date(book.updatedAt).toLocaleDateString("it-IT");
        bookMeta.textContent = `${book.fileName || "canzoniere.pdf"} · aggiornato ${when}`;
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
    if (!pdfStage) return;
    try {
      if (pdfStage.requestFullscreen) await pdfStage.requestFullscreen();
      else if (pdfStage.webkitRequestFullscreen) pdfStage.webkitRequestFullscreen();
    } catch (err) {
      alert("Impossibile entrare a schermo intero su questo browser.");
    }
  }

  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }

  fsBtn?.addEventListener("click", enterFullscreen);
  exitFsBtn?.addEventListener("click", exitFullscreen);

  document.addEventListener("fullscreenchange", () => {
    const on = !!document.fullscreenElement;
    if (exitFsBtn) exitFsBtn.hidden = !on;
    if (fsBtn) fsBtn.textContent = on ? "Schermo intero" : "Schermo intero";
    reloadPdfForMode();
  });

  proposeForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(proposeForm);
    try {
      CanzoniereStore.proposeSong({
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

  refreshBook();
  refreshSongs();
});
