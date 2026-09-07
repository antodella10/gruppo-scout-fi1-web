document.addEventListener("DOMContentLoaded", () => {
  const bookStatus = document.getElementById("book-status");
  const openBookBtn = document.getElementById("open-book");
  const songsList = document.getElementById("songs-list");
  const proposeForm = document.getElementById("propose-form");
  const proposeAlert = document.getElementById("propose-alert");

  async function refreshBook() {
    const book = CanzoniereStore.getBook();
    if (!book) {
      if (bookStatus) bookStatus.textContent = "Il canzoniere non è ancora stato caricato dallo staff.";
      if (openBookBtn) openBookBtn.hidden = true;
      return;
    }
    if (bookStatus) {
      bookStatus.textContent = `Aggiornato ${new Date(book.updatedAt).toLocaleDateString("it-IT")}${book.fileName ? " · " + book.fileName : ""}`;
    }
    if (openBookBtn) {
      openBookBtn.hidden = false;
      openBookBtn.onclick = async () => {
        try {
          await CanzoniereStore.openPdf(book.fileId);
        } catch (err) {
          alert(err.message);
        }
      };
    }
  }

  function refreshSongs() {
    const songs = CanzoniereStore.getSongs();
    if (!songsList) return;
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
      // refresh badge if staff is logged in on another tab later
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
