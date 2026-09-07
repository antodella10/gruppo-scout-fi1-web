document.addEventListener("DOMContentLoaded", () => {
  BranchView.persist("reparto", { updateUrl: false });

  const bookStatus = document.getElementById("book-status");
  const bookEmpty = document.getElementById("book-empty");
  const bookFrame = document.getElementById("book-frame");
  const bookMeta = document.getElementById("book-meta-line");
  const songsList = document.getElementById("songs-list");
  const proposeForm = document.getElementById("propose-form");
  const proposeAlert = document.getElementById("propose-alert");

  let currentBookUrl = null;

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
  }

  function showPdf(url) {
    if (bookEmpty) {
      bookEmpty.hidden = true;
      bookEmpty.classList.remove("is-visible");
    }
    if (bookFrame) {
      bookFrame.src = url;
      bookFrame.hidden = false;
      bookFrame.classList.add("is-visible");
    }
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
