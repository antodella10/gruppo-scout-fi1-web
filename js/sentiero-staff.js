document.addEventListener("DOMContentLoaded", () => {
  const user = StaffShell.boot({ active: "sentiero" });
  if (!user) return;
  if (!SentieroStore.canManage(user)) {
    location.href = "./index.html";
    return;
  }

  const alertBox = document.getElementById("sen-alert");
  const libMeta = document.getElementById("libretto-meta");
  const libForm = document.getElementById("libretto-form");
  const libClear = document.getElementById("libretto-clear");
  const specForm = document.getElementById("spec-form");
  const specList = document.getElementById("spec-admin-list");
  const formTitle = document.getElementById("spec-form-title");
  const resetBtn = document.getElementById("spec-reset");
  const editHint = document.getElementById("spec-edit-hint");
  const resetSeed = document.getElementById("spec-reset-seed");

  function flash(msg, ok = true) {
    flashAlert(alertBox, msg, ok);
  }

  function resetSpecForm() {
    specForm?.reset();
    if (specForm) specForm.id.value = "";
    if (formTitle) formTitle.textContent = "Nuova specialità";
    if (resetBtn) resetBtn.hidden = true;
    if (editHint) editHint.hidden = true;
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

  async function refreshSpecs() {
    if (!specList) return;
    const list = await SentieroStore.getSpecialita();
    if (!list.length) {
      specList.innerHTML = `<div class="empty-state">Nessuna specialità.</div>`;
      return;
    }
    specList.innerHTML = list
      .map(
        (s) => `
      <div class="shop-admin-row">
        <div class="shop-admin-thumb" data-img="${escapeHtml(s.id)}"><span>★</span></div>
        <div class="shop-admin-meta">
          <strong>${escapeHtml(s.name)}</strong>
          <div style="color:var(--muted)">${s.source === "static" ? "Dal catalogo iniziale" : "Caricata / modificata"}</div>
        </div>
        <div class="inline-actions">
          <button type="button" class="btn btn-ghost btn-small" data-open="${escapeHtml(s.id)}">Apri</button>
          <button type="button" class="btn btn-ghost btn-small" data-edit="${escapeHtml(s.id)}">Modifica</button>
          <button type="button" class="btn btn-ghost btn-small" data-del="${escapeHtml(s.id)}">Elimina</button>
        </div>
      </div>`
      )
      .join("");

    await Promise.all(
      list.map(async (s) => {
        const el = specList.querySelector(`[data-img="${CSS.escape(s.id)}"]`);
        if (!el) return;
        try {
          const src = await SentieroStore.resolveImageUrl(s);
          if (src) el.innerHTML = `<img src="${src}" alt="">`;
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

  specForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(specForm);
    const id = String(data.get("id") || "");
    try {
      await SentieroStore.upsertSpecialita(
        { id, name: data.get("name") },
        user,
        {
          pdfFile: specForm.pdf.files?.[0] || null,
          imageFile: specForm.image.files?.[0] || null,
        }
      );
      flash(id ? "Specialità aggiornata." : "Specialità aggiunta.");
      resetSpecForm();
      await refreshSpecs();
    } catch (err) {
      flash(err.message, false);
    }
  });

  resetBtn?.addEventListener("click", resetSpecForm);

  specList?.addEventListener("click", async (e) => {
    const open = e.target.closest("[data-open]");
    const edit = e.target.closest("[data-edit]");
    const del = e.target.closest("[data-del]");
    const list = await SentieroStore.getSpecialita();
    try {
      if (open) {
        const item = list.find((x) => x.id === open.dataset.open);
        await SentieroStore.openPdf(item);
      }
      if (edit) {
        const item = list.find((x) => x.id === edit.dataset.edit);
        if (!item || !specForm) return;
        specForm.id.value = item.id;
        specForm.name.value = item.name;
        specForm.pdf.value = "";
        specForm.image.value = "";
        if (formTitle) formTitle.textContent = "Modifica specialità";
        if (resetBtn) resetBtn.hidden = false;
        if (editHint) editHint.hidden = false;
        specForm.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (del) {
        if (!confirm("Eliminare questa specialità?")) return;
        await SentieroStore.deleteSpecialita(del.dataset.del, user);
        flash("Specialità eliminata.");
        if (specForm?.id.value === del.dataset.del) resetSpecForm();
        await refreshSpecs();
      }
    } catch (err) {
      flash(err.message, false);
    }
  });

  resetSeed?.addEventListener("click", async () => {
    if (!confirm("Ripristinare l’elenco iniziale delle specialità? Le modifiche locali andranno perse.")) return;
    try {
      await SentieroStore.resetToSeed(user);
      flash("Elenco iniziale ripristinato.");
      resetSpecForm();
      await refreshLibretto();
      await refreshSpecs();
    } catch (err) {
      flash(err.message, false);
    }
  });

  (async () => {
    await SentieroStore.ensureMeta();
    await refreshLibretto();
    await refreshSpecs();
  })();
});
