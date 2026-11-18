// La page des rapports : la liste par domaine, le resume dans le panneau de droite.
"use strict";

const ORDRE_DOMAINES = ["Contrôles de cohérence", "Flux entre systèmes", "Lettrages", "Grands livres", "Référentiels"];
const filtres = { g: "", e: "", q: "" };   // gardes d'un rendu a l'autre : la revalidation ne les perd pas

function ordreDomaines(raps) {
  const vus = [...new Set(raps.map((r) => r.domaine || "Autres"))];
  return vus.sort((a, b) => {
    const ia = ORDRE_DOMAINES.indexOf(a), ib = ORDRE_DOMAINES.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a.localeCompare(b, "fr");
  });
}

function urlRapport(r) { return API + "/api/rapports/" + encodeURIComponent(r.id); }

function vueRapports([donnees, autos]) {
  const autosParId = new Map(((autos && autos.automatisations) || []).map((a) => [String(a.id), a]));
  majBandeau(donnees.maj);
  const raps = donnees.rapports.filter(rapportMontre).sort((a, b) => String(a.sujet).localeCompare(String(b.sujet), "fr"));
  if (!raps.length) {
    return [el("h1", null, "Rapports"), vueVide("Aucun rapport déployé",
      "Un rapport vous donne chaque jour, dans un classeur et par email, l'état d'un contrôle entre vos logiciels.")];
  }
  const f = filtres;
  const restreints = raps.filter((r) => !r.acces).length;
  const avis = el("p", "avis");
  avis.setAttribute("aria-live", "polite");

  // le sous-titre est retire (Antoine, 2026-11-04) : le compte vit sur « Tous » ; seul le compte des acces restreints, qu'aucun
  // filtre ne porte, reste, et seulement s'il y en a
  const sous = restreints ? el("p", "sous-titre") : null;
  if (sous) sous.append(cadenas(14), `${restreints} en accès restreint`);

  // le filtre par systeme est retire (Antoine, 2026-11-11 : « dans l'onglet Rapport tu peux enlever carrément tout ca ») ;
  // les groupes du tableau restent par domaine
  const domaines = ordreDomaines(raps);

  // recherche et etats
  const ligne = el("div", "outils ligne");
  const lab = el("label", "cherche");
  lab.append(el("span", "sr", "Rechercher un rapport"));
  const champ = el("input");
  champ.type = "search";
  champ.placeholder = "Rechercher un rapport…";
  champ.value = f.q;
  champ.addEventListener("input", () => { f.q = champ.value.trim().toLowerCase(); filtrer(); });
  lab.append(champ);
  const pe = el("div", "gb-barre");   // le meme composant que les filtres des autres onglets (2026-11-11)
  pe.setAttribute("role", "group");
  pe.setAttribute("aria-label", "État");
  for (const [v, texte] of [["", "Tous"], ["ok", "Fonctionnels"], ["interrompu", "Interrompus"], ["construction", "En construction"]]) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, v ? raps.filter((r) => etatAffiche(r) === v).length : raps.length));
    b.dataset.v = v;
    b.addEventListener("click", () => { f.e = v; filtrer(); });
    pe.append(b);
  }
  // les groupes de filtres sur une ligne, la recherche a droite (Antoine, 2026-11-04, DEC_00520, option 5C)
  ligne.append(pe, el("span", "rt-sp"), lab);
  const outils = ligne;

  // le tableau
  const carte = el("div", "carte gd-c");
  const table = el("table", "gd");
  const cg = el("colgroup");
  for (const w of ["", "8.5rem", "8rem", "8rem", "8.5rem", "8.5rem", "9.5rem"]) {   // sept colonnes depuis le retrait de « Système d'origine » (2026-11-11)
    // Resume et Documentation tiennent leur bouton (2026-11-04)
    const c = el("col");
    if (w) c.style.width = w;
    cg.append(c);
  }
  const thead = el("thead");
  const tr = el("tr");
  for (const [texte, classe, cache] of [["Rapport"], ["Systèmes", "c"], ["État"], ["Date"], ["Résumé", null, true], ["Documentation", null, true], ["Télécharger", null, true]]) {
    const th = el("th", classe);
    th.scope = "col";
    if (cache) th.append(el("span", "sr", texte)); else th.textContent = texte;
    tr.append(th);
  }
  thead.append(tr);
  table.append(cg, thead);
  colonnesAuContenu(table, 5, false);   // sans texte long, la colonne du résumé prend la place : les boutons restent à droite (DEC_00853)
  const lignes = [];
  for (const g of domaines) {
    const liste = raps.filter((r) => (r.domaine || "Autres") === g);
    const tb = el("tbody");
    const bande = el("tr", "gd-b");
    // le titre du groupe a la forme de ceux de l'onglet Automatisations, « Depuis Even 17 » (Antoine, 2026-11-04)
    const th = el("th", null, g);
    th.colSpan = 7;
    th.scope = "rowgroup";
    const cpt = el("span", "g-cpt", liste.length);
    cpt.append(el("span", "sr", liste.length > 1 ? " rapports" : " rapport"));
    th.append(" ", cpt);
    bande.append(th);
    tb.append(bande);
    for (const r of liste) {
      const l = ligneRapport(r, avis, autosParId.get(String(r.automatisation)));
      lignes.push([l, r, g]);
      tb.append(l);
    }
    table.append(tb);
  }
  carte.append(table);
  const vide = el("p", "vide", "Aucun rapport ne correspond.");
  vide.hidden = true;

  function filtrer() {
    for (const b of pe.children) b.setAttribute("aria-pressed", String(b.dataset.v === f.e));
    let total = 0;
    for (const [l, r] of lignes) {
      const ok = (!f.e || etatAffiche(r) === f.e) && (!f.q || String(r.sujet).toLowerCase().includes(f.q));
      l.hidden = !ok;
      total += ok ? 1 : 0;
    }
    for (const tb of table.tBodies) tb.hidden = !tb.querySelector("tr[data-r]:not([hidden])");
    vide.hidden = total > 0;
    carte.hidden = total === 0;
    avis.textContent = "";
  }
  filtrer();
  const tete = el("div", "tete-fixe");
  tete.append(...[el("h1", null, "Rapports"), sous, outils, avis].filter(Boolean));
  return [figerTete(tete), carte, vide];
}

function ligneRapport(r, avis, auto) {
  const tr = el("tr");
  tr.dataset.r = "1";
  const nom = el("th");
  nom.scope = "row";
  const f = el("td", "td-f", flux(r.flux));
  const etat = el("td");
  const date = el("td", "la-d mono gd-date");   // le style de la date des automatisations, sur une ligne
  const notice = el("td", "act");   // la colonne Documentation (ex-Notice)
  const resume = el("td", "gd-resume");   // a gauche, comme l'etat et la date : trois departs a pas egal (2026-10-23)
  const action = el("td", "act");
  if (!r.acces) {
    tr.className = "restreint";
    if (auto) notice.append(boutonDocumentation(auto));   // comme dans l'onglet Automatisations, ou chacun la voit
    nom.append(colonneAction(cadenas(14)), String(r.sujet));
    const b = bouton("btn eteint");
    b.setAttribute("aria-disabled", "true");
    b.append(ico("cadenas", 14), "Accès restreint");
    b.setAttribute("aria-label", "Accès restreint : " + r.sujet);
    b.addEventListener("click", () => {
      avis.textContent = `Vous n'avez pas accès à « ${r.sujet} ». Votre administrateur peut vous l'ouvrir.`;
    });
    action.append(b);
  } else {
    nom.append(colonneAction(null), String(r.sujet));
    // une demande sur ce rapport, chez la cellule qui porte son automatisation (DEC_00165, 2026-10-31)
    // les boutons d'une ligne restent ensemble, meme quand le nom passe a la ligne
    const outilsL = el("span", "dm-g");
    outilsL.append(boutonDemande({ id: r.automatisation, nom: r.sujet, rapport: String(r.sujet) }, "dm-b"));
    // RGI_01887 : recalculer a une date d'arrete, a cote de la demande, pour un rapport que l'index marque
    if (r.arrete_au_choix) outilsL.append(boutonArrete(r, String(r.sujet), "/api/rapports/" + encodeURIComponent(r.id) + "/rafraichir",
                                                       date, avis, relireBientot));
    // rafraichir ce seul rapport (Antoine, 2026-11-02, DEC_00379 de PCP001 : « un bouton par ligne, quand on clique
    // sur un bouton ca raffraichit uniquement ce rapport ») ; absent si le portail ne sait pas le demander
    // la fleche, dans sa colonne a gauche du nom (Antoine, 2026-11-11, DEC_00835, choix 1A)
    if (r.rafraichir) nom.firstChild.append(boutonRafraichir(r, r.sujet, "/api/rapports/" + encodeURIComponent(r.id) + "/rafraichir",
                                                             date, avis, relireBientot, "Rafraîchir ce rapport"));
    nom.append(outilsL);
    const t = tag(etatAffiche(r));
    if (t) etat.append(t);
    // la date et l'heure du dernier passage, a Paris (demande des metiers, 2026-10-08)
    const h = heureDe(r.produit_le);
    date.textContent = (r.fige ? FIGE : jourCourt(r.jour) + (h ? " à " + h : "")) + (r.test ? " · " + TEST : "") + (r.rodage ? " · " + RODAGE : "");
    montrerRafraichissement(r, r.sujet, date, avis, relireBientot);
    if (r.resume) {
      const b = bouton("btn btn-s b-resume", "Voir le résumé");   // un bouton blanc borde (DEC_00520, option 7C)
      b.dataset.ouvrePanneau = "1";
      b.setAttribute("aria-label", "Voir le résumé de " + r.sujet);
      b.addEventListener("click", () => ouvrirResume(r, b));
      resume.append(b);
    }
    // « Notice » devient « Documentation » : le bouton et la fenetre de l'onglet Automatisations, la notice
    // y est la quatrieme piece (Antoine, 2026-11-04) ; la couleur de Notice (2026-10-30) tombe avec lui.
    if (auto) notice.append(boutonDocumentation(auto));
    if (r.livrable === "interface" || r.construction) {
      // Decisions d'Antoine : une interface depose dans un autre systeme (2026-10-04) ; un
      // rapport d'une automatisation en construction ne se telecharge pas (2026-10-08).
      // On voit leur etat et leur resume, jamais de bouton de telechargement.
    } else if (r.telechargeable) {
      const a = el("a", "btn b-l");
      a.append(ico("telecharger", 15), "Télécharger");
      a.href = urlRapport(r);
      a.setAttribute("aria-label", "Télécharger " + r.sujet);
      action.append(a);
    } else {
      // Decision d'Antoine du 2026-10-03 : un passage interrompu ne se telecharge pas,
      // et l'utilisateur qui essaie recoit une explication, pas une erreur.
      const b = bouton("btn b-l eteint");
      b.append(ico("telecharger", 15), "Télécharger");
      b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-label", "Télécharger " + r.sujet + " (indisponible)");
      b.addEventListener("click", () => {
        avis.textContent = `« ${r.sujet} » : le dernier passage n'a pas abouti, il n'y a rien à télécharger. Le rapport reviendra au prochain passage réussi.`;
      });
      action.append(b);
    }
  }
  tr.append(nom, f, etat, date, resume, notice, action);   // sans « Système d'origine », redondant avec Systèmes (Antoine, 2026-11-11)
  return tr;
}

// ------------------------------------------------------------------ rafraichir une ligne
// le bouton et son etat vivent dans commun.js : l'onglet Automatisations les pose aussi (PCP049-1110-p, 2026-11-10)

let relectureRaf = null;
function relireBientot() {
  if (relectureRaf) return;
  relectureRaf = setTimeout(() => {
    relectureRaf = null;
    suivre([SOURCES.rapports, SOURCES.autos], (d, premier) => poser(vueRapports(d), premier));
  }, 15000);
}

// Le resume n'est jamais mis en cache : c'est le courriel du dernier passage, lu a la demande.
async function ouvrirResume(r, depuis) {
  const titre = el("h2", "r-titre", r.sujet);
  titre.id = "panneau-titre";
  const act = el("div", "r-act");
  if (r.telechargeable) {
    const a = el("a", "btn", "Télécharger le classeur");
    a.href = urlRapport(r);
    act.append(a);
  }
  const etat = el("p", "chargement", "Chargement du résumé…");
  etat.setAttribute("aria-live", "polite");
  ouvrirPanneau("resume", [el("p", "r-sur", "Résumé du dernier passage"), titre, act, etat], depuis);
  const { statut, donnees } = await appeler("GET", "/api/rapports/" + encodeURIComponent(r.id) + "/resume", null, "texte");
  if (panneauMode !== "resume" || !document.contains(etat)) return;   // panneau ferme ou remplace entre-temps
  if (statut === 401) return sessionPerdue();
  if (statut !== 200 || typeof donnees !== "string") {
    etat.className = "erreur";
    etat.textContent = statut === 403 ? "Vous n'avez pas accès à ce résumé."
      : statut === 404 ? "Ce rapport n'a pas de résumé pour son dernier passage." : PANNE_SERVICE;
    return;
  }
  // Le courriel est montre dans un cadre isole (sandbox sans script), sans sa marge
  // par defaut, pour s'aligner a gauche avec le titre (maquette v14).
  const style = "<style>body{margin:0}</style>";
  const html = /<head(\s[^>]*)?>/i.test(donnees) ? donnees.replace(/<head(\s[^>]*)?>/i, (m) => m + style) : style + donnees;
  const cadre = el("iframe", "r-cadre");
  cadre.setAttribute("sandbox", "");
  cadre.title = "Résumé : " + r.sujet;
  cadre.srcdoc = html;
  etat.replaceWith(cadre);
}

demarrer(() => suivre([SOURCES.rapports, SOURCES.autos], (d, premier) => poser(vueRapports(d), premier)));
