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
    carte.append(lien);
  } else {
    carte.append(el("p", "ca-t", "Cartographie en cours"),
      el("p", "discret", "La carte de votre système d'information sera ici dès qu'elle est publiée."));
  }
  return [el("h1", null, "Cartographie"), sous, carte];
}

demarrer(() => suivre([SOURCES.cartographie], (d, premier) => poser(vueCartographie(d), premier)));
