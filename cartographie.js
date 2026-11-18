// La page Cartographie : la carte du systeme d'information du client, telle que la publie sa
// cellule de cartographie (DEC_00181, Antoine, 2026-10-31). Une page a part, dans un nouvel
// onglet ; « cartographie en cours » tant qu'elle n'est pas publiee. Le reste vit dans commun.js.
"use strict";

function dateCarte(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function vueCartographie([d]) {
  const sous = el("p", "sous-titre", "Les applications de votre système d'information, les flux qui les relient et les processus qu'elles servent.");
  const carte = el("div", "carte ca");
  if (d.publiee) {
    const date = dateCarte(d.date);
    carte.append(el("p", "ca-t", "La carte de votre système d'information"),
      el("p", "discret", date ? `Mise à jour le ${date}.` : "Publiée."));
    const lien = el("a", "btn ca-b");
    lien.append(ico("carte", 15), "Ouvrir la cartographie");
    lien.href = API + "/api/cartographie/page";
    lien.target = "_blank";
    lien.rel = "noopener";
    lien.setAttribute("aria-label", "Ouvrir la cartographie (nouvel onglet)");
    const gestes = el("div", "ca-g");
    gestes.append(lien);
    if (d.pdf) {   // RGI_01751 : le PDF de la carte, une vue par page (DEC_00961)
      const pdf = el("a", "btn btn-s ca-b");
      pdf.append(ico("telecharger", 15), "Télécharger en PDF");
      pdf.href = API + "/api/cartographie/pdf";
      pdf.setAttribute("aria-label", "Télécharger la cartographie en PDF");
      gestes.append(pdf);
    }
    carte.append(gestes);
  } else {
    carte.append(el("p", "ca-t", "Cartographie en cours"),
      el("p", "discret", "La carte de votre système d'information sera ici dès qu'elle est publiée."));
  }
  return [el("h1", null, "Cartographie"), sous, carte];
}

// Le lien direct vers une vue (Antoine, 2026-11-12) : cartographie.html?carte=<ancre>&vue=<vue> ouvre la carte sur
// cette vue, une fois connecte ; une seule fois par minute, pour ne jamais boucler si la carte refusait la session.
function lienVue() {
  const q = new URLSearchParams(location.search);
  const carte = q.get("carte") || "", vue = q.get("vue") || "";
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(carte) && !/^[A-Za-z0-9_-]{1,40}$/.test(vue)) return "";
  const p = /^[A-Za-z0-9_-]{1,40}$/.test(vue) ? "?" + new URLSearchParams({ vue }) : "";
  return API + "/api/cartographie/page" + p + (/^[A-Za-z0-9_-]{1,80}$/.test(carte) ? "#" + carte : "");
}

demarrer(() => suivre([SOURCES.cartographie], (d, premier) => {
  poser(vueCartographie(d), premier);
  const vers = premier && d.publiee ? lienVue() : "";
  let deja = 0;
  try { deja = Number(sessionStorage.getItem("carte-saut") || 0); } catch (_) { /* rien */ }
  if (vers && Date.now() - deja > 60000) {
    try { sessionStorage.setItem("carte-saut", String(Date.now())); } catch (_) { /* rien */ }
    location.replace(vers);
  }
}));
