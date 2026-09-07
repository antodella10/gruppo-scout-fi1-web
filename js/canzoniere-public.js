document.addEventListener("DOMContentLoaded", () => {
  // Su queste pagine restiamo in contesto reparto per logo/home
  BranchView.persist("reparto", { updateUrl: false });

  const bookStatus = document.getElementById("book-status");
  const bookEmpty = document.getElementById("book-empty");
  const bookFrame = document.getElementById("book-frame");
  const songsList = document.getElementById("songs-list");
  const proposeForm = document.getElementById("propose-form");
  const proposeAlert = document.getElementById("propose-alert");

  let currentBookUrl = null;

  async function refreshBook() {
    const book = CanzoniereStore.getBook();
    if (!bookFrame && !bookEmpty) return;

    if (!book) {
      if (bookEmpty) bookEmpty.hidden = false;
      if (bookStatus) bookStatus.textContent = "Il canzoniere non è ancora stato caricato dallo staff.";
      if (bookFrame) {
        bookFrame.hidden = true;
        bookFrame.removeAttribute("src");
      }
      return;
    }

    try {
      if (currentBookUrl) URL.revokeObjectURL(currentBookUrl);
      currentBookUrl = await CanzoniereStore.getPdfUrl(book.fileId);
      if (bookFrame) {
        bookFrame.src = currentBookUrl;
        bookFrame.hidden = false;
      }
      if (bookEmpty) bookEmpty.hidden = true;
    } catch (err) {
      if (bookEmpty) bookEmpty.hidden = false;
      if (bookStatus) bookStatus.textContent = err.message || "Impossibile aprire il PDF.";
      if (bookFrame) bookFrame.hidden = true;
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
