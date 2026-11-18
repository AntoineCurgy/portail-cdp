// L'onglet Agents IA (Antoine, 2026-11-12, DEC_00892 : « 1A ok mais sans la partie "imaginés" ») : le tableau a lignes
// de l'onglet Automatisations, un groupe par etape, l'en-tete des colonnes fige, la barre de filtres par etape, la fiche
// dans la fenetre centree. Les agents viennent de /api/agents, la liste publiee par la cellule qui les construit ;
// l'etat des automatisations dont ils se servent, de /api/automatisations. Visible par toute personne connectee.
"use strict";

let autosParId = new Map();
let agentsVus = [];
const filtreAg = { e: "" };
const GROUPES_AG = { 1: "Agents en essai", 2: "Agents en recette", 3: "Agents en service", 4: "Agents arrêtés" };

function params() { return new URLSearchParams(location.search); }

// une automatisation dont l'agent se sert : son numero court, son nom, la pastille de son etat reel
function puceAuto(id) {
  const auto = autosParId.get(id);
  const st = auto ? statutDe(auto) : "construction";
  const p = el("a", "o-p");
  p.href = "automatisations.html?" + new URLSearchParams({ id });
  p.title = auto ? `${auto.nom} · ${flux(auto.flux)} · ${STATUTS[st].toLowerCase()}` : id;
  p.append(pastille(st), `${auto ? auto.court || id.slice(-4) : id} ${auto ? auto.nom : ""}`);
  return p;
}

function blocFiche(titre, ...enfants) {
  const s = el("section", "fi-s");
  s.append(el("h3", null, titre), ...enfants);
  return s;
}

function ficheAgent(a) {
  const st = el("p", "fi-st " + statutAg(a));
  st.append(pastille(statutAg(a)), a.etape === 3 ? "En service" : a.etape === 4 ? "Arrêté" : `En construction · ${etapeAg(a)}`);
  const nom = el("h2", "fi-nom", a.nom);
  nom.id = "panneau-titre";
  const ref = el("p", "fi-flux", a.sert);
  ref.append(" ", el("span", "mono", a.court));
  const frise = el("ol", "frise");
  ETAPES_AG.slice(0, 4).forEach((e, i) => frise.append(el("li", i <= a.etape && a.etape < 4 ? "fait" : "", e)));
  const banc = el("p", "ag-bl");
  banc.append(el("strong", null, bancAg(a)), jaugeBanc(a),
    el("span", "discret", [a.banc.quand, a.banc.seuil ? "seuil " + a.banc.seuil : ""].filter(Boolean).join(" · ")));
  const garde = el("p", "ag-garde");
  garde.append(cadenas(14), a.garde);
  const blocs = [st, nom, ref, blocFiche("Rôle", el("p", null, a.phrase))];
  const avancement = [frise];
  if (a.prochaine) avancement.push(el("p", "discret ag-suite", a.prochaine));
  blocs.push(a.etape === 4 ? blocFiche("Avancement", el("p", null, "Arrêté : il ne passe pas au réel."), ...avancement.slice(1))
                           : blocFiche("Avancement", ...avancement));
  const bancB = [banc];
  if (a.corriges) bancB.push(el("p", "discret", a.corriges));
  blocs.push(blocFiche("Banc d'essai", ...bancB), blocFiche("Garde", garde));
  const faits = [["Données lues", (a.lit || []).join(", ")], ["Fréquence", a.quand], ["Depuis", a.depuis ? dateLongue(a.depuis) : ""]]
    .filter(([, v]) => v);
  if (faits.length) {
    const dl = el("dl", "rt-dl");
    for (const [k, v] of faits) dl.append(el("dt", null, k), el("dd", null, v));
    blocs.push(blocFiche("Fonctionnement", dl));
  }
  if ((a.appuie || []).length) {
    const outils = el("p", "o-l");
    outils.append(...a.appuie.map(puceAuto));
    blocs.push(blocFiche("Automatisations utilisées", outils));
  }
  if (a.ouvert) blocs.push(blocFiche("Point ouvert", el("p", null, a.ouvert)));
  return blocs;
}

function enTete() {
  const w = el("div", "la-tete-w");
  const l = el("div", "lb la-tete-l");
  const g = el("span", "ag1 la-tete");
  for (const t of ["", "N°", "Agent", "Rôle", "Étape", "Banc d'essai", "Garde"]) g.append(el("span", null, t));
  l.append(g, el("span", "la-tete-ch"));
  w.append(l);
  return w;
}

function ligneAgent(a) {
  const b = bouton("tiroir-l lb");
  b.dataset.ouvrePanneau = "1";
  b.dataset.agent = a.id;
  b.setAttribute("aria-expanded", "false");
  const g = el("span", "ag1");
  const nom = el("span", "la-nom");
  nom.append(el("strong", null, a.nom), el("span", "la-f", a.sert));
  const banc = el("span", "ag1-b");
  banc.append(el("span", "mono", bancAg(a)), jaugeBanc(a));
  const garde = el("span", "ag1-g");
  garde.append(cadenas(13), a.garde_court);
  const pt = pastille(statutAg(a));
  pt.removeAttribute("aria-hidden");
  pt.setAttribute("role", "img");
  pt.setAttribute("aria-label", etapeAg(a));
  g.append(pt, el("span", "la-id mono", a.court), nom, el("span", "ag1-r", a.phrase), tagEtape(a), banc, garde);
  b.append(g, ico("chevron", 16));
  b.addEventListener("click", () => {
    if (params().get("id") !== a.id) history.pushState(null, "", location.pathname + "?" + new URLSearchParams({ id: a.id }));
    ouvrirFiche(a.id);
  });
  return b;
}

function ouvrirFiche(id) {
  const a = agentsVus.find((x) => x.id === id);
  if (!a) return fermerPanneau(false);
  const depuis = document.querySelector(`[data-agent="${id}"]`);
  for (const b of document.querySelectorAll("[data-agent]")) b.setAttribute("aria-expanded", String(b === depuis));
  ouvrirPanneau("fiche", ficheAgent(a), depuis);
}

function vueAgents([autosD, agD]) {
  majBandeau(agD.maj || autosD.maj);
  autosParId = new Map(autosD.automatisations.map((x) => [String(x.id), x]));
  agentsVus = agD.agents.filter((a) => a.etape > 0);   // les agents imagines ne se montrent pas (DEC_00892)
  if (!agentsVus.length) {
    return [el("h1", null, "Agents"), vueVide(agD.source === "absente" ? "Aucun agent IA publié" : agD.source === "illisible" ? "Liste des agents illisible" : "Aucun agent IA en essai",
      "Un agent IA s'appuie sur vos automatisations pour traiter une tâche de bout en bout. Ceux en essai apparaîtront ici.")];
  }
  const n = (e) => agentsVus.filter((a) => a.etape === e).length;
  const barre = el("div", "gb-barre");
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "Étape");
  for (const [v, t, k] of [["", "Tous", agentsVus.length], ["1", "En essai", n(1)], ["2", "En recette", n(2)], ["3", "En service", n(3)], ["4", "Arrêtés", n(4)]].filter((x) => x[0] !== "4" || x[2])) {
    const b = bouton("gb-o", t);
    b.append(" ", el("span", null, k));
    b.dataset.v = v;
    b.addEventListener("click", () => { filtreAg.e = v; filtrer(); });
    barre.append(b);
  }
  const tete = el("div", "tete-fixe");
  tete.append(el("h1", null, "Agents"), barre);
  const groupes = [];
  for (const e of [3, 2, 1, 4]) {
    const liste = agentsVus.filter((a) => a.etape === e);
    if (!liste.length) continue;
    const sec = el("section", "carte grp-c");
    const h2 = el("h2", "grp", GROUPES_AG[e]);
    h2.append(" ", el("span", "g-cpt", liste.length));
    sec.append(h2, ...liste.map(ligneAgent));
    groupes.push([sec, e]);
  }
  function filtrer() {
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === filtreAg.e));
    for (const [sec, e] of groupes) sec.hidden = filtreAg.e !== "" && String(e) !== filtreAg.e;
  }
  filtrer();
  if (groupes[0]) groupes[0][0].classList.add("sous-tete");
  const corps = el("div", "ag1-corps");
  corps.append(enTete(), ...groupes.map(([sec]) => sec));
  return [figerTete(tete), corps];
}

auFermer = (mode) => {
  if (mode !== "fiche") return;
  for (const b of document.querySelectorAll("[data-agent]")) b.setAttribute("aria-expanded", "false");
  if (params().has("id")) history.replaceState(null, "", location.pathname);
};

function suivreAdresse() {
  const id = params().get("id");
  if (id) ouvrirFiche(id); else if (panneauMode === "fiche") fermerPanneau(false);
}

window.addEventListener("popstate", suivreAdresse);

demarrer(() => suivre([SOURCES.autos, SOURCES.agents], (d, premier) => {
  const ouverte = panneauMode === "fiche";
  poser(vueAgents(d), premier);
  if (premier || ouverte) suivreAdresse();
}));
