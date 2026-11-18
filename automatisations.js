// La page des automatisations : la liste par systeme d'origine, la fiche dans le panneau.
// L'adresse fait foi : `?id=AUT_0019` ouvre la fiche ; `?sys=Even` (les cartes de l'accueil) remplit la recherche. Ouvrir une
// fiche ajoute une etape a l'historique (le bouton Retour la referme) ; filtrer, non.
"use strict";

const filtres = { statut: "", q: "" };   // l'etat et la recherche
let donneesAutos = null;
let lignesAutos = [];
let groupesAutos = [];
let rafraichirFiltres = () => {};
// la ligne ou s'annonce un rafraichissement demande depuis une ligne (PCP049-1110-p), comme dans Rapports
const avisAutos = el("p", "avis");
avisAutos.setAttribute("aria-live", "polite");

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
  if (!autos.length) {
    return [el("h1", null, "Automatisations"), vueVide("Aucune automatisation déployée",
      "Une automatisation fait chaque jour, seule, un travail répétitif entre vos logiciels, et vous en rend compte ici.")];
  }
  const n = compter(autos);
  const f = filtres;

  // le sous-titre est retire (Antoine, 2026-11-04) : les comptes vivent sur les filtres d'etat

  // le bloc des systemes connectes est retire (Antoine, 2026-11-11 : « tu peux aussi enlever ca dans l'onglet automatisation »)

  // la recherche, comme dans l'onglet Rapports (Antoine, 2026-10-22)
  const lab = el("label", "cherche");
  lab.append(el("span", "sr", "Rechercher une automatisation"));
  const champ = el("input");
  champ.type = "search";
  champ.placeholder = "Rechercher une automatisation…";
  // une carte de systeme de l'accueil arrive par `?sys=Even` : le systeme passe dans la recherche, qui lit aussi le flux
  // (le filtre par systeme est retire le 2026-11-11), puis quitte l'adresse
  const sysAdresse = params().get("sys");
  if (sysAdresse) {
    f.q = sysAdresse.trim().toLowerCase();
    history.replaceState(null, "", adresseAvec((q) => q.delete("sys")));
  }
  champ.value = sysAdresse || f.q;
  champ.addEventListener("input", () => { f.q = champ.value.trim().toLowerCase(); rafraichirFiltres(); });
  lab.append(champ);

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
  // l'en-tete des colonnes, une fois, au-dessus du premier groupe visible, sur la grille des lignes (DEC_00853, choix 1A)
  const enTete = el("div", "lb la-tete-l");
  enTete.setAttribute("aria-hidden", "true");   // la liste n'est pas un tableau : chaque ligne se lit seule
  const lt = el("span", "la la-tete");
  lt.append(el("span"), el("span", null, "N°"), el("span"), el("span", null, "Automatisation"),
            el("span", null, "Documentation"), el("span", "la-h", "Sept derniers passages"), el("span", "la-d", "Dernier passage"));
  enTete.append(lt, el("span", "la-tete-ch"));
  // figee sous la tete de la page, comme l'en-tete des tableaux (Antoine, 2026-11-11 : « il faut figer entete colonne de
  // l'onglet automatisation ») : hors des groupes, pour rester en haut sur toute la liste
  const enTeteW = el("div", "la-tete-w");
  enTeteW.append(enTete);
  const vide = el("p", "vide", "Aucune automatisation ne correspond.");
  vide.hidden = true;

  rafraichirFiltres = () => {
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === f.statut));
    let total = 0;
    for (const [b, a] of lignesAutos) {
      const ok = (!f.statut || statutDe(a) === f.statut)
        && (!f.q || [a.id, a.court, a.nom, a.flux, a.objectif, ...(a.anciens || [])].join(" ").toLowerCase().includes(f.q));
      b.hidden = !ok;
      total += ok ? 1 : 0;
    }
    for (const [sec, cpt] of groupesAutos) {
      const visibles = [...sec.querySelectorAll(".lb:not(.la-tete-l)")].filter((b) => !b.hidden);
      sec.hidden = visibles.length === 0;
      cpt.textContent = String(visibles.length);
      visibles.forEach((b, i) => b.classList.toggle("premier", i === 0));
    }
    vide.hidden = total > 0;
    const premier = groupesAutos.find(([sec]) => !sec.hidden);
    enTeteW.hidden = !premier;
    for (const [sec] of groupesAutos) sec.classList.toggle("sous-tete", Boolean(premier) && sec === premier[0]);
  };
  rafraichirFiltres();
  // la tete figee comme dans Rapports, Retours, Emails et Journaux (Antoine, 2026-11-11 : « fixe la partie filtre de
  // automatisation comme celle de rapport, retours, emails, journal […] que ca soit coéhrent et similaire, standardisé ») ;
  // elle n'etait pas figee depuis le 2026-11-04, quand le bloc des systemes la precedait
  const outils = el("div", "outils ligne");
  outils.append(barre, el("span", "rt-sp"), lab);   // la recherche a droite (DEC_00520, option 5C)
  avisAutos.textContent = "";
  const tete = el("div", "tete-fixe");
  tete.append(el("h1", null, "Automatisations"), outils, avisAutos);
  return [figerTete(tete), enTeteW, ...sections, vide];
}

function ligneAuto(a) {
  const st = statutDe(a);
  // La ligne est un bloc : le bouton du nom ouvre la fiche et couvre toute la ligne ; le bouton
  // Documentation se pose a gauche des carres, au-dessus (Antoine, 2026-10-22).
  const b = el("div", "tiroir-l lb");
  b.dataset.auto = String(a.id);
  b.dataset.ouvrePanneau = "1";
  const ouvrir = bouton("lb-o");
  ouvrir.setAttribute("aria-expanded", "false");
  ouvrir.append(el("strong", null, a.nom));
  const la = el("span", "la");
  const nom = el("span", "la-nom");
  nom.append(ouvrir, el("span", "la-f", flux(a.flux)));
  const histo = el("span", "la-h");
  const passages = Array.isArray(a.passages) ? a.passages.slice(-8) : [];
  if (passages.length) histo.append(carres(passages)); else histo.append(el("span", "discret", "aucun passage au journal"));
  const d = el("span", "la-d mono");
  if (a.fige) d.textContent = FIGE;
  else if (a.dernier) {
    d.textContent = `${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)} · ${motPassage(a.dernier.resultat)}`
                    + (a.test && a.dernier.resultat !== TEST ? " · " + TEST : "") + (a.rodage ? " · " + RODAGE : "");
    if (a.dernier.resultat === "alerte") d.classList.add("alerte");   // le rate signale se voit (2026-10-09)
  } else d.append(el("span", "discret", "jamais lancée"));
  const pt = pastille(st);
  pt.removeAttribute("aria-hidden");
  pt.setAttribute("role", "img");
  pt.setAttribute("aria-label", STATUTS[st]);
  const outils = el("span", "la-o");
  // la demande vivait dans la fiche ; la fiche ne s'ouvre plus quand les details existent : elle passe sur la ligne
  outils.append(boutonDocumentation(a), boutonDemande({ id: a.id, nom: a.nom }, "dm-b"));
  // rafraichir cette automatisation, comme la ligne de son rapport (Antoine, 2026-11-10, PCP049-1110-p) ; absent si
  // le portail ne sait pas le demander, ou sans droit
  // la fleche, dans sa colonne a gauche du nom, comme dans Rapports (Antoine, 2026-11-11, DEC_00835, choix 1A)
  const action = colonneAction(a.rafraichir ? boutonRafraichir(a, a.nom, "/api/automatisations/" + encodeURIComponent(a.id) + "/rafraichir",
                                                                d, avisAutos, relireAutosBientot, "Rafraîchir cette automatisation") : null);
  la.append(pt, el("span", "la-id mono", a.court || String(a.id).slice(-2)), action, nom, outils, histo, d);
  montrerRafraichissement(a, a.nom, d, avisAutos, relireAutosBientot);
  b.append(la, ico("chevron", 16));
  ouvrir.addEventListener("click", () => {
    const id = String(a.id);
    // la ligne ouvre le journal de l'automatisation, sa fiche des sept derniers jours dans Journaux (Antoine,
    // 2026-11-11 : « j'aimerais quand on clique sur la ligne en fait ca affiche le journal ») ; la page Details reste
    // sur le bouton Documentation. Sans aucun passage, la fiche d'avant reste : rien ne disparait sans remplacant.
    if (a.dernier) {
      location.href = "journaux.html?auto=" + encodeURIComponent(id);
      return;
    }
    if (a.notice === "publiee") {
      window.open(API + "/api/automatisations/" + encodeURIComponent(id) + "/notice", "_blank", "noopener");
      return;
    }
    if (params().get("id") !== id) history.pushState(null, "", adresseAvec((q) => q.set("id", id)));
    ouvrirFiche(id);
  });
  return b;
}

let relectureAutos = null;
function relireAutosBientot() {
  if (relectureAutos) return;
  relectureAutos = setTimeout(() => {
    relectureAutos = null;
    suivre([SOURCES.autos], (dd, premier) => {
      const ouverte = panneauMode === "fiche";
      poser(vueAutomatisations(dd), premier);
      if (premier || ouverte) suivreAdresse();
    });
  }, 15000);
}

// la documentation (le bouton et sa fenetre) vit dans commun.js : l'onglet Rapports l'ouvre aussi (Antoine, 2026-11-04)

function section(titre, ...enfants) {
  const s = el("section", "fi-s");
  s.append(el("h3", null, titre), ...enfants);
  return s;
}

// L'automatisation dont la fiche est ouverte est en surbrillance (Antoine, 2026-11-10 : « quand on est sur un item, il
// doit etre en surbrillance »), et seulement le temps de la fiche : rien ne reste selectionne apres (Antoine, 2026-11-11 :
// « j'aime pas qu'un élément reste sélectionné »), ni pour une page ouverte dans un autre onglet.

function ouvrirFiche(id) {
  if (!donneesAutos) return;
  // un lien enregistre avant la bascule du 2026-10-15 porte l'ancien identifiant : il mene au nouveau
  const a = donneesAutos.automatisations.find((x) => String(x.id) === id || (x.anciens || []).includes(id));
  if (!a) return fermerPanneau(false);
  if (String(a.id) !== id) history.replaceState(null, "", adresseAvec((q) => q.set("id", String(a.id))));
  const st = statutDe(a);
  const ligne = lignesAutos.find(([, x]) => x === a);
  const rangee = ligne ? ligne[0] : null;
  const depuis = rangee ? rangee.querySelector(".lb-o") : null;
  for (const [r] of lignesAutos) {
    r.classList.toggle("ouverte", r === rangee);
    r.querySelector(".lb-o").setAttribute("aria-expanded", String(r === rangee));
  }

  const etiquette = el("p", "fi-st " + st);
  etiquette.append(pastille(st), STATUTS[st]);
  const nom = el("h2", "fi-nom", a.nom);
  nom.id = "panneau-titre";
  const fl = el("p", "fi-flux", flux(a.flux));
  fl.append(" ", el("span", "mono", a.id));

  const objectif = a.objectif ? el("p", null, a.objectif) : el("p", "discret", "Objectif à écrire dans la feuille des réglages.");
  const quand = el("p", null, [a.jours, a.heure].filter(Boolean).join(" à ") || "Non renseigné.");

  let dernier;
  if (a.fige) {
    dernier = [el("p", null, FIGE)];
  } else if (a.dernier) {
    const p = el("p");
    p.append(el("strong", null, `${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)}`), " · " + motPassage(a.dernier.resultat));
    if (a.dernier.resultat === "alerte") p.classList.add("alerte");
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
    const t = r.acces ? tag(etatR) : el("span", "tag t-ferme", "Accès restreint");
    li.append(el("span", null, r.sujet));
    if (t) li.append(t);
    raps.append(li);
  }

  ouvrirPanneau("fiche", [etiquette, nom, fl,
    section("Rôle", objectif),
    section("Planification", quand),
    section("Dernier passage", ...dernier),
    section("Huit derniers passages", huit),
    section("Rapports produits", raps),
    section("Une demande, un retour, une correction ?", boutonDemande({ id: a.id, nom: a.nom }, "btn dm-f", "Faire une demande"))], depuis);
  if (rangee) rangee.scrollIntoView({ block: "nearest" });
}

// Fermer la fiche retire `?id` de l'adresse, sans ajouter d'etape a l'historique.
auFermer = (mode) => {
  if (mode !== "fiche") return;
  for (const [r] of lignesAutos) {
    r.classList.remove("ouverte");   // la fiche ferme, rien ne reste selectionne (2026-11-11)
    r.querySelector(".lb-o").setAttribute("aria-expanded", "false");
  }
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
