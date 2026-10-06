// La page d'accueil : le tableau de bord. Le reste vit dans commun.js.
"use strict";

function vueAccueil([autosD, rapsD]) {
  majBandeau(rapsD.maj || autosD.maj);
  const autos = autosD.automatisations;
  const raps = rapsD.rapports;
  const n = compter(autos);
  const total = autos.length;
  const pct = total ? Math.round(n.ok / total * 100) : 0;
  const jour = jourDe(rapsD.maj || autosD.maj || (moi && moi.maj));
  const duJour = raps.filter((r) => r.jour === jour && r.etat !== "interrompu").length;

  // l'anneau et les grandeurs
  const ke = el("div", "ke");
  const anneau = el("div", "ke-anneau");
  anneau.style.setProperty("--p", String(pct));
  anneau.setAttribute("aria-hidden", "true");
  const centre = el("span");
  centre.append(el("strong", null, n.ok), "/" + total);
  anneau.append(centre);
  const t = el("div", "ke-t");
  t.append(el("p", "ke-titre", pct + " % des automatisations fonctionnent"),
    el("p", "ke-s", `${n.ok} fonctionnelle${n.ok > 1 ? "s" : ""} sur ${total} · ${n.panne} interrompue${n.panne > 1 ? "s" : ""} · ${n.construction} en construction`));
  const d = el("div", "ke-d");
  const l1 = el("p");
  l1.append(el("strong", null, duJour), ` ${duJour > 1 ? "rapports" : "rapport"} du jour sur ${raps.length}`);
  d.append(l1);
  ke.append(anneau, t, d);

  // la grille des pastilles
  const etat = el("section", "carte");
  etat.setAttribute("aria-labelledby", "titre-etat");
  const ch = el("div", "c-h");
  const h2 = el("h2");
  h2.id = "titre-etat";
  h2.append(pastille(n.panne ? "panne" : "ok"),
    n.panne ? pluriel(n.panne, "automatisation interrompue", "automatisations interrompues") : "Aucune automatisation interrompue");
  const leg = el("p", "legende");
  for (const [s, texte] of [["ok", "fonctionnelle"], ["panne", "interrompue"], ["construction", "en construction"]]) {
    const x = el("span");
    x.append(pastille(s), texte);
    leg.append(x);
  }
  ch.append(h2, leg);
  const grille = el("ul", "grille");
  for (const a of [...autos].sort(parId)) {
    const st = statutDe(a);
    const li = el("li");
    const lien = el("a", "case " + st);
    lien.href = "automatisations.html?" + new URLSearchParams({ id: String(a.id) });
    const quand = a.dernier ? ` · ${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)}` : "";
    lien.title = `${flux(a.flux)} · ${a.nom} · ${STATUTS[st]}${quand}`;
    const pt = el("span", "pt");
    pt.setAttribute("aria-hidden", "true");
    const num = el("span", null, a.court || String(a.id).slice(-2));
    num.setAttribute("aria-hidden", "true");
    lien.append(pt, num, el("span", "sr", `${a.court || a.id} · ${a.nom} · ${flux(a.flux)} : ${STATUTS[st]}`));
    li.append(lien);
    grille.append(li);
  }
  const pied = el("p", "c-pied");
  const aide = el("a", null, "Comment lire l'état");
  aide.href = "aide.html#etat";
  pied.append(el("span", null, `${phraseEtat(n)} · un numéro ouvre sa fiche`), aide);
  etat.append(ch, grille, pied);

  const systemes = cartesSystemes(autosD, (s) => {
    const a = el("a");
    a.href = s ? "automatisations.html?" + new URLSearchParams({ sys: s }) : "automatisations.html";
    return a;
  });
  return [el("h1", null, "Tableau de bord"), ke, etat, systemes];
}

demarrer(() => suivre([SOURCES.autos, SOURCES.rapports], (d, premier) => poser(vueAccueil(d), premier)));
