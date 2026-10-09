document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "documenti" });
  if (!user) return;
  if (!SentieroStore.canManage(user)) {
    location.href = "./documenti.html";
    return;
  }

  const alertBox = document.getElementById("sen-alert");
  const libMeta = document.getElementById("libretto-meta");
  const libForm = document.getElementById("libretto-form");
  const libClear = document.getElementById("libretto-clear");
  const classiList = document.getElementById("classi-images-list");

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  async function refreshLibretto() {
    const lib = await SentieroStore.getLibretto();
    if (!libMeta) return;
    if (!lib) {
      libMeta.textContent = "Nessun libretto caricato.";
      if (libClear) libClear.hidden = true;
      return;
    }
    libMeta.innerHTML = `${escapeHtml(lib.fileName || "libretto.pdf")}
      <div class="inline-actions" style="margin-top:.55rem">
        <button type="button" class="btn btn-ghost btn-small" id="libretto-preview">Apri PDF</button>
      </div>`;
    if (libClear) libClear.hidden = false;
    document.getElementById("libretto-preview")?.addEventListener("click", async () => {
      try {
        await SentieroStore.openPdf(lib);
      } catch (err) {
        flash(err.message, false);
      }
    });
  }

  async function refreshClassImages() {
    if (!classiList) return;
    const classi = ScoutStore.CLASSI_SENTIERO || [];
    const images = await SentieroStore.getClassImages();
    classiList.innerHTML = classi
      .map((c) => {
        const rec = images[c.id];
        return `
        <article class="classe-image-row" data-classe="${escapeHtml(c.id)}">
          <div class="classe-image-preview" data-preview="${escapeHtml(c.id)}">
            <span class="hint">Nessuna immagine</span>
          </div>
          <div>
            <strong>${escapeHtml(c.label)}</strong>
            <p class="hint">${rec?.fileName ? escapeHtml(rec.fileName) : "PNG non caricato"}</p>
            <div class="inline-actions" style="margin-top:.45rem">
              <label class="btn btn-ghost btn-small classe-image-upload">
                Carica PNG
                <input type="file" accept="image/png,image/*" hidden data-upload-classe="${escapeHtml(c.id)}">
              </label>
              <button type="button" class="btn btn-ghost btn-small" data-clear-classe="${escapeHtml(c.id)}" ${
                rec?.fileId ? "" : "hidden"
              }>Rimuovi</button>
            </div>
          </div>
        </article>`;
      })
      .join("");

    await Promise.all(
      classi.map(async (c) => {
        const el = classiList.querySelector(`[data-preview="${CSS.escape(c.id)}"]`);
        if (!el || !images[c.id]?.fileId) return;
        try {
          const src = await SentieroStore.resolveClassImageUrl(c.id);
          if (src) el.innerHTML = `<img src="${src}" alt="${escapeHtml(c.label)}">`;
        } catch {
          /* ignore */
        }
      })
    );
  }

  libForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await SentieroStore.setLibretto(libForm.librettoPdf.files?.[0], user);
      libForm.reset();
      flash("Libretto aggiornato.");
      await refreshLibretto();
    } catch (err) {
      flash(err.message, false);
    }
  });

  libClear?.addEventListener("click", async () => {
    if (!confirm("Rimuovere il libretto?")) return;
    try {
      await SentieroStore.clearLibretto(user);
      flash("Libretto rimosso.");
      await refreshLibretto();
    } catch (err) {
      flash(err.message, false);
    }
  });

  classiList?.addEventListener("change", async (e) => {
    const input = e.target.closest("[data-upload-classe]");
    if (!input || !(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!file) return;
    try {
      await SentieroStore.setClassImage(input.dataset.uploadClasse, file, user);
      flash("Immagine classe aggiornata.");
      await refreshClassImages();
    } catch (err) {
      flash(err.message || "Upload fallito.", false);
    } finally {
      input.value = "";
    }
  });

  classiList?.addEventListener("click", async (e) => {
    const clear = e.target.closest("[data-clear-classe]");
    if (!clear) return;
    if (!confirm("Rimuovere l’immagine di questa classe?")) return;
    try {
      await SentieroStore.clearClassImage(clear.dataset.clearClasse, user);
      flash("Immagine rimossa.");
      await refreshClassImages();
    } catch (err) {
      flash(err.message, false);
    }
  });

  (async () => {
    await SentieroStore.ensureMeta();
    await refreshLibretto();
    await refreshClassImages();
  })();
});
