/**
 * Google Apps Script — email di approvazione account Firenze 1
 *
 * 1. Vai su https://script.google.com → Nuovo progetto
 * 2. Incolla questo codice
 * 3. Modifica MAIL_SECRET (stesso valore che metti su Cloudflare: APPROVAL_MAIL_SECRET)
 * 4. Distribuisci → Nuova distribuzione → Tipo: App web
 *    - Esegui come: Me
 *    - Chi ha accesso: Chiunque
 * 5. Copia l’URL e mettilo su Cloudflare Worker come APPROVAL_MAIL_WEBHOOK
 *
 * Le email partono da scoutfirenze1ms@gmail.com (l’account Google con cui apri lo script).
 */
const MAIL_SECRET = "CAMBIA-QUESTO-SECRET";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    if (!data.secret || data.secret !== MAIL_SECRET) {
      return ContentService.createTextOutput("forbidden").setMimeType(ContentService.MimeType.TEXT);
    }
    const to = String(data.to || "").trim();
    const subject = String(data.subject || "Account approvato — Firenze 1");
    const body = String(data.body || "");
    if (!to) {
      return ContentService.createTextOutput("missing to").setMimeType(ContentService.MimeType.TEXT);
    }
    GmailApp.sendEmail(to, subject, body, {
      name: "Gruppo Scout Firenze 1",
      replyTo: "scoutfirenze1ms@gmail.com",
    });
    return ContentService.createTextOutput("ok").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput(String(err)).setMimeType(ContentService.MimeType.TEXT);
  }
}
