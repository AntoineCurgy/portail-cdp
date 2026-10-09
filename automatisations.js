// La page des automatisations : la liste par systeme d'origine, la fiche dans le panneau.
// L'adresse fait foi : `?sys=Even` filtre, `?id=AUT_CDP_19` ouvre la fiche. Ouvrir une
// fiche ajoute une etape a l'historique (le bouton Retour la referme) ; filtrer, non.
"use strict";

const filtres = { statut: "" };   // l'etat ; le systeme vit dans l'adresse
let donneesAutos = null;
let lignesAutos = [];
let groupesAutos = [];
let rafraichirFiltres = () => {};

function params() { return new URLSearchParams(location.search); }

function adresseAvec(changer) {
  const q = params();
  changer(q);
  const s = q.toString();
  return location.pathname + (s ? "?" + s : "");
}

function libelleGroupe(origine) {
  if (!origine) return "Origine non renseignée";
  return /^Tous/.test(origine) ? origine : "Depuis " + origine;
}

function vueAutomatisations([donnees]) {
  donneesAutos = donnees;
  majBandeau(donnees.maj);
  const autos = donnees.automatisations;
  const n = compter(autos);
  const f = filtres;

  const sous = el("p", "sous-titre", `Ce que chacune fait, quand elle tourne, et ses derniers passages. ${phraseEtat(n)}.`);

  const cartes = cartesSystemes(donnees, (s) => {
    const b = bouton("");
    b.dataset.sys = s;
    b.addEventListener("click", () => {
      history.replaceState(null, "", adresseAvec((q) => { if (s) q.set("sys", s); else q.delete("sys"); }));
      rafraichirFiltres();
    });
    return b;
  });

  const barre = el("div", "gb-barre");
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "État");
  for (const [v, texte, k] of [["", "Toutes", autos.length], ["ok", "Fonctionnelles", n.ok], ["panne", "Interrompues", n.panne], ["construction", "En construction", n.construction]]) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, k));
    b.dataset.v = v;
    b.addEventListener("click", () => { f.statut = v; rafraichirFiltres(); });
    barre.append(b);
  }

  // groupes par systeme d'origine : les plus actifs d'abord
  const parOrigine = new Map();
  for (const a of autos) {
    const k = a.origine || "";
    if (!parOrigine.has(k)) parOrigine.set(k, []);
    parOrigine.get(k).push(a);
  }
  const lancees = (l) => l.filter((a) => statutDe(a) !== "construction").length;
  const origines = [...parOrigine.keys()].sort((a, b) => {
    const la = parOrigine.get(a), lb = parOrigine.get(b);
    return (lancees(lb) - lancees(la)) || (lb.length - la.length) || a.localeCompare(b, "fr");
  });
  lignesAutos = [];
  groupesAutos = [];
  const sections = [];
  for (const o of origines) {
    const liste = parOrigine.get(o).sort((a, b) => ((statutDe(a) === "construction") - (statutDe(b) === "construction")) || parId(a, b));
    const sec = el("section", "carte grp-c");
    const h2 = el("h2", "grp", libelleGroupe(o));
    const cpt = el("span", "g-cpt", liste.length);
    h2.append(" ", cpt);
    sec.append(h2);
    for (const a of liste) {
      const b = ligneAuto(a);
      lignesAutos.push([b, a]);
      sec.append(b);
    }
    groupesAutos.push([sec, cpt]);
    sections.push(sec);
  }
  const vide = el("p", "vide", "Aucune automatisation ne correspond.");
  vide.hidden = true;

  rafraichirFiltres = () => {
    const sys = params().get("sys") || "";
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === f.statut));
    for (const c of cartes.querySelectorAll("[data-sys]")) c.setAttribute("aria-pressed", String(c.dataset.sys === sys));
    let total = 0;
    for (const [b, a] of lignesAutos) {
      const ok = (!f.statut || statutDe(a) === f.statut) && (!sys || (Array.isArray(a.systemes) && a.systemes.includes(sys)));
      b.hidden = !ok;
      total += ok ? 1 : 0;
    }
    for (const [sec, cpt] of groupesAutos) {
      const visibles = [...sec.querySelectorAll(".lb")].filter((b) => !b.hidden);
      sec.hidden = visibles.length === 0;
      cpt.textContent = String(visibles.length);
      visibles.forEach((b, i) => b.classList.toggle("premier", i === 0));
    }
    vide.hidden = total > 0;
  };
  rafraichirFiltres();
  return [el("h1", null, "Automatisations"), sous, cartes, barre, ...sections, vide];
}

function ligneAuto(a) {
  const st = statutDe(a);
  const b = bouton("tiroir-l lb");
  b.dataset.auto = String(a.id);
  b.dataset.ouvrePanneau = "1";
  b.setAttribute("aria-expanded", "false");
  const la = el("span", "la");
  const nom = el("span", "la-nom");
  nom.append(el("strong", null, a.nom), el("span", "la-f", flux(a.flux)));
  const histo = el("span", "la-h");
  const passages = Array.isArray(a.passages) ? a.passages.slice(-8) : [];
  if (passages.length) histo.append(carres(passages)); else histo.append(el("span", "discret", "aucun passage au journal"));
  const d = el("span", "la-d mono");
  if (a.dernier) d.textContent = `${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)} · ${motPassage(a.dernier.resultat)}`;
  else d.append(el("span", "discret", "jamais lancée"));
  const pt = pastille(st);
  pt.removeAttribute("aria-hidden");
  pt.setAttribute("role", "img");
  pt.setAttribute("aria-label", STATUTS[st]);
  la.append(pt, el("span", "la-id mono", a.court || String(a.id).slice(-2)), nom, histo, d);
  b.append(la, ico("chevron", 16));
  b.addEventListener("click", () => {
    const id = String(a.id);
    if (params().get("id") !== id) history.pushState(null, "", adresseAvec((q) => q.set("id", id)));
    ouvrirFiche(id);
  });
  return b;
}

function section(titre, ...enfants) {
  const s = el("section", "fi-s");
  s.append(el("h3", null, titre), ...enfants);
  return s;
}

function ouvrirFiche(id) {
  if (!donneesAutos) return;
  const a = donneesAutos.automatisations.find((x) => String(x.id) === id);
  if (!a) return fermerPanneau(false);
  const st = statutDe(a);
  const ligne = lignesAutos.find(([, x]) => x === a);
  const depuis = ligne ? ligne[0] : null;
  for (const b of document.querySelectorAll(".lb[aria-expanded]")) b.setAttribute("aria-expanded", String(b === depuis));

  const etiquette = el("p", "fi-st " + st);
  etiquette.append(pastille(st), STATUTS[st]);
  const nom = el("h2", "fi-nom", a.nom);
  nom.id = "panneau-titre";
  const fl = el("p", "fi-flux", flux(a.flux));
  fl.append(" ", el("span", "mono", a.id));

  const objectif = a.objectif ? el("p", null, a.objectif) : el("p", "discret", "Objectif à écrire dans la feuille des réglages.");
  const quand = el("p", null, [a.jours, a.heure].filter(Boolean).join(" à ") || "Non renseigné.");

  let dernier;
  if (a.dernier) {
    const p = el("p");
    p.append(el("strong", null, `${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)}`), " · " + motPassage(a.dernier.resultat));
    dernier = [p];
    if (a.dernier.detail) dernier.push(el("p", "fi-box mono", a.dernier.detail));
  } else {
    dernier = [el("p", "discret", "Jamais lancée : aucun passage au journal.")];
  }

  const passages = Array.isArray(a.passages) ? a.passages.slice(-8) : [];
  const huit = el("p");
  if (passages.length) huit.append(carres(passages)); else huit.append(el("span", "discret", "aucun passage au journal"));

  const raps = el("ul", "fi-r");
  const produits = Array.isArray(a.rapports) ? a.rapports : [];
  if (!produits.length) raps.append(el("li", "discret", "aucun rapport sur le portail"));
  for (const r of produits) {
    const li = el("li");
    // le Statut fait autorite : une automatisation en construction montre ses rapports « en construction »
    const etatR = st === "construction" ? "construction" : (r.etat === "a_valider" ? "ok" : r.etat);
    const t = r.acces ? tag(etatR) : el("span", "tag t-ferme", "accès restreint");
    li.append(el("span", null, r.sujet));
    if (t) li.append(t);
    raps.append(li);
  }

  ouvrirPanneau("fiche", [etiquette, nom, fl,
    section("Ce qu'elle fait", objectif),
    section("Quand elle tourne", quand),
    section("Dernier passage", ...dernier),
    section("Huit derniers passages", huit),
    section("Rapports produits", raps)], depuis);
  if (depuis) depuis.scrollIntoView({ block: "nearest" });
}

// Fermer la fiche retire `?id` de l'adresse, sans ajouter d'etape a l'historique.
auFermer = (mode) => {
  if (mode !== "fiche") return;
  for (const b of document.querySelectorAll(".lb[aria-expanded]")) b.setAttribute("aria-expanded", "false");
  if (params().has("id")) history.replaceState(null, "", adresseAvec((q) => q.delete("id")));
};

// L'adresse fait foi : apres un rendu, et quand on revient en arriere ou en avant.
function suivreAdresse() {
  rafraichirFiltres();
  const id = params().get("id");
  if (id) ouvrirFiche(id); else if (panneauMode === "fiche") fermerPanneau(false);
}

window.addEventListener("popstate", suivreAdresse);

demarrer(() => suivre([SOURCES.autos], (d, premier) => {
  const ouverte = panneauMode === "fiche";
  poser(vueAutomatisations(d), premier);
  // au premier rendu, ou si la fiche etait ouverte : la rouvrir sur les donnees fraiches
  if (premier || ouverte) suivreAdresse();
}));
