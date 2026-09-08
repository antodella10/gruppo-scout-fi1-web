document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "canzoniere" });
  if (!user) return;
  if (!CanzoniereStore.canManage(user)) {
    location.href = "./index.html";
    return;
  }

  const bookForm = document.getElementById("book-form");
  const bookMeta = document.getElementById("book-meta");
  const songForm = document.getElementById("song-form");
  const songsAdmin = document.getElementById("songs-admin");
  const proposalsAdmin = document.getElementById("proposals-admin");
  const alertBox = document.getElementById("cz-alert");

  function flash(msg, ok = true) {
    if (!alertBox) return;
    alertBox.hidden = false;
    alertBox.className = ok ? "alert alert-ok" : "alert alert-error";
    alertBox.textContent = msg;
  }

  function refreshBookMeta() {
    const book = CanzoniereStore.getBook();
    if (!bookMeta) return;
    if (!book) {
      bookMeta.textContent = "Nessun canzoniere caricato.";
      return;
    }
    bookMeta.innerHTML = `${escapeHtml(book.fileName || "canzoniere.pdf")} · aggiornato ${new Date(book.updatedAt).toLocaleString("it-IT")}
      <div class="inline-actions" style="margin-top:.6rem">
        <button type="button" class="btn btn-ghost btn-small" id="preview-book">Apri PDF attuale</button>
      </div>`;
    document.getElementById("preview-book")?.addEventListener("click", async () => {
      try {
        await CanzoniereStore.openPdf(book.fileId);
      } catch (err) {
        flash(err.message, false);
      }
    });
  }

  function refreshSongs() {
    const songs = CanzoniereStore.getSongs();
    if (!songsAdmin) return;
    if (!songs.length) {
      songsAdmin.innerHTML = `<div class="empty-state">Nessuna canzone sfusa.</div>`;
      return;
    }
    songsAdmin.innerHTML = songs
      .map(
        (s) => `
        <div class="event-admin-item">
          <div>
            <strong>${escapeHtml(s.title)}</strong><br>
            <span style="color:var(--muted)">${escapeHtml(s.fileName || "PDF")}</span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-ghost btn-small" data-open="${s.fileId}">Apri</button>
            <button type="button" class="btn btn-ghost btn-small" data-del-song="${s.id}">Elimina</button>
          </div>
        </div>`
      )
      .join("");
  }

  function refreshProposals() {
    const list = CanzoniereStore.getProposals().filter((p) => p.status === "pending");
    if (!proposalsAdmin) return;
    if (!list.length) {
      proposalsAdmin.innerHTML = `<div class="empty-state">Nessuna proposta in attesa.</div>`;
      return;
    }
    proposalsAdmin.innerHTML = list
      .map(
        (p) => `
        <div class="event-admin-item">
          <div>
            <strong>${escapeHtml(p.title)}</strong><br>
            <span style="color:var(--muted)">da ${escapeHtml(p.fromName)} · ${new Date(p.createdAt).toLocaleDateString("it-IT")}${p.notes ? " — " + escapeHtml(p.notes) : ""}</span>
          </div>
          <div class="inline-actions">
            <button type="button" class="btn btn-primary btn-small" data-prop-done="${p.id}">Segna fatta</button>
            <button type="button" class="btn btn-ghost btn-small" data-prop-reject="${p.id}">Rifiuta</button>
          </div>
        </div>`
      )
      .join("");
  }

  bookForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = bookForm.bookPdf.files?.[0];
    try {
      await CanzoniereStore.setBook(file, user);
      bookForm.reset();
      flash("Canzoniere aggiornato.");
      refreshBookMeta();
    } catch (err) {
      flash(err.message, false);
    }
  });

  songForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(songForm);
    try {
      await CanzoniereStore.addSong(
        { title: data.get("title"), file: songForm.songPdf.files?.[0] },
        user
      );
      songForm.reset();
      flash("Canzone aggiunta.");
      refreshSongs();
    } catch (err) {
      flash(err.message, false);
    }
  });

  songsAdmin?.addEventListener("click", async (e) => {
    const open = e.target.closest("[data-open]");
    const del = e.target.closest("[data-del-song]");
    try {
      if (open) await CanzoniereStore.openPdf(open.dataset.open);
      if (del) {
        if (!confirm("Eliminare questa canzone?")) return;
        await CanzoniereStore.deleteSong(del.dataset.delSong, user);
        refreshSongs();
      }
    } catch (err) {
      flash(err.message, false);
    }
  });

  proposalsAdmin?.addEventListener("click", (e) => {
    const done = e.target.closest("[data-prop-done]");
    const reject = e.target.closest("[data-prop-reject]");
    try {
      if (done) {
        CanzoniereStore.setProposalStatus(done.dataset.propDone, "done", user);
        refreshProposals();
        updateNavAuth();
      }
      if (reject) {
        CanzoniereStore.setProposalStatus(reject.dataset.propReject, "rejected", user);
        refreshProposals();
        updateNavAuth();
      }
    } catch (err) {
      flash(err.message, false);
    }
  });

  refreshBookMeta();
  refreshSongs();
  refreshProposals();
});
