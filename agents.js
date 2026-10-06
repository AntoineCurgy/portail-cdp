// La page des agents : les agents KCP qui s'appuieront sur les automatisations FSI.
// Decision d'Antoine du 2026-10-06 (maquette v16, option A) : l'onglet existe avant les
// agents, chacun au statut « En construction ». Les agents sont ecrits ici, faute de
// service qui les porte ; l'etat de leurs outils, lui, est lu en direct dans l'API.
"use strict";

const NIVEAUX = ["Observe", "Propose", "Agit après validation", "Agit seul"];
const ETAPES = ["Imaginé", "Outils FSI prêts", "Essai sur copie", "En service"];

// id, nom, domaine, mission, outils (automatisations), actions [ce qu'il fera, outil qui verifie, autonomie 0-3], etape 0-3
const AGENTS = [
  ["AGT_CDP_01", "Agent lettrages", "Lettrages",
    "Propose, puis applique, les lettrages des factures fournisseurs entre Yooz et la comptabilité.",
    ["AUT_CDP_07", "AUT_CDP_08", "AUT_CDP_09"],
    [["Proposer les lettrages du jour", "AUT_CDP_07", 1], ["Appliquer un lettrage sûr à l'euro près", "AUT_CDP_09", 2]]],
  ["AGT_CDP_02", "Agent encaissements", "Trésorerie",
    "Rapproche les encaissements bancaires des règlements locataires, et signale ce qui reste seul.",
    ["AUT_CDP_19", "AUT_CDP_30", "AUT_CDP_23", "AUT_CDP_24"],
    [["Pré-rapprocher les encaissements du relevé", "AUT_CDP_30", 1], ["Valider un rapprochement unique", "AUT_CDP_24", 2]]],
  ["AGT_CDP_03", "Agent impayés", "Recouvrement",
    "Suit les impayés locataires et prépare les relances, que l'équipe envoie.",
    ["AUT_CDP_33", "AUT_CDP_10"],
    [["Lister les nouveaux impayés", "AUT_CDP_33", 0], ["Préparer le brouillon de relance", "AUT_CDP_33", 1]]],
  ["AGT_CDP_04", "Agent référentiels", "Référentiels",
    "Repère les tiers et codes auxiliaires incohérents entre systèmes, et propose la correction au référentiel.",
    ["AUT_CDP_27", "AUT_CDP_34"],
    [["Signaler un code auxiliaire en double", "AUT_CDP_34", 0], ["Proposer une correspondance au référentiel", "AUT_CDP_27", 1]]],
  ["AGT_CDP_05", "Agent clôture", "Contrôles de cohérence",
    "Prépare les contrôles de la clôture mensuelle et en rédige la synthèse.",
    ["AUT_CDP_03", "AUT_CDP_04", "AUT_CDP_05", "AUT_CDP_06", "AUT_CDP_26"],
    [["Rassembler les écarts de la clôture", "AUT_CDP_04", 0], ["Rédiger la synthèse pour la direction", "AUT_CDP_26", 1]]],
  ["AGT_CDP_06", "Agent fournisseurs", "Fournisseurs",
    "Suit chaque facture fournisseur de Yooz jusqu'à son paiement dans Yardi, et signale celles qui restent bloquées.",
    ["AUT_CDP_20", "AUT_CDP_21", "AUT_CDP_22"],
    [["Signaler une facture bloquée", "AUT_CDP_20", 0], ["Créer dans Yardi un fournisseur manquant", "AUT_CDP_22", 2]]],
  ["AGT_CDP_07", "Agent prélèvements", "Trésorerie",
    "Vérifie que chaque prélèvement émis revient payé sur le relevé bancaire, et traite les rejets.",
    ["AUT_CDP_02", "AUT_CDP_13", "AUT_CDP_25"],
    [["Signaler un rejet de prélèvement", "AUT_CDP_25", 0], ["Préparer la nouvelle présentation ou la relance", "AUT_CDP_02", 1]]],
  ["AGT_CDP_08", "Agent dépôts de garantie", "Recouvrement",
    "Suit chaque dépôt de garantie, de l'encaissement à la restitution, et prépare le décompte à la sortie d'un locataire.",
    ["AUT_CDP_29", "AUT_CDP_10"],
    [["Signaler un dépôt non comptabilisé", "AUT_CDP_29", 0], ["Calculer la somme à restituer, retenues déduites", "AUT_CDP_10", 1],
     ["Passer l'écriture de restitution", "AUT_CDP_29", 2]]],
  ["AGT_CDP_09", "Agent chiffre d'affaires", "Flux entre systèmes",
    "Vérifie que chaque quittance émise est bien passée en comptabilité, et fait repartir ce qui manque.",
    ["AUT_CDP_01", "AUT_CDP_04"],
    [["Lister les pièces absentes de Sage", "AUT_CDP_04", 0], ["Relancer l'export d'une pièce manquante", "AUT_CDP_01", 2]]],
].map(([id, nom, domaine, mission, outils, actions]) => ({ id, nom, domaine, mission, outils, actions, etape: 0 }));

const filtres = { statut: "" };
let autosParId = new Map();
let lignesAgents = [];

function params() { return new URLSearchParams(location.search); }

function adresseAvec(changer) {
  const q = params();
  changer(q);
  const s = q.toString();
  return location.pathname + (s ? "?" + s : "");
}

function statutAgent(a) { return a.etape === ETAPES.length - 1 ? "ok" : "construction"; }

function jauge(n) {
  const j = el("span", "jauge");
  j.setAttribute("aria-hidden", "true");
  j.title = "Autonomie prévue : " + NIVEAUX[n];
  for (let k = 0; k < 4; k++) j.append(el("span", k <= n ? "on" : ""));
  return j;
}

function autonomie(a) { return Math.max(...a.actions.map((x) => x[2])); }

// Un outil : son numero et son nom, la pastille de son etat reel (lu dans l'API).
function puceOutil(id) {
  const auto = autosParId.get(id);
  const st = auto ? statutDe(auto) : "construction";
  const p = el("span", "o-p");
  p.title = `${id} · ${auto ? auto.nom + " · " + flux(auto.flux) : "automatisation inconnue"} · ${STATUTS[st].toLowerCase()}`;
  p.append(pastille(st), `${id.slice(-2)} ${auto ? auto.nom : id}`);
  return p;
}

function vueAgents([autosD]) {
  majBandeau(autosD.maj);
  autosParId = new Map(autosD.automatisations.map((x) => [String(x.id), x]));
  const nb = AGENTS.length;
  const enService = AGENTS.filter((a) => statutAgent(a) === "ok").length;
  const utilisees = new Set(AGENTS.flatMap((a) => a.outils)).size;

  const sous = el("p", "sous-titre", "Les agents qui s'appuieront sur les automatisations FSI. Tous sont en construction : aucun n'agit encore.");
  const k = el("div", "carte ag-k");
  k.append(pastille(enService ? "ok" : "construction"), el("strong", null, pluriel(nb - enService, "agent en construction", "agents en construction")),
    el("span", "discret", `· ${enService} en service · ils utiliseront ${utilisees} automatisations`));

  const barre = el("div", "gb-barre");
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "État");
  for (const [v, texte, n] of [["", "Tous", nb], ["ok", "En service", enService], ["construction", "En construction", nb - enService]]) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, n));
    b.dataset.v = v;
    b.addEventListener("click", () => { filtres.statut = v; filtrer(); });
    barre.append(b);
  }

  const sec = el("section", "carte grp-c");
  const h2 = el("h2", "grp", "Agents de la Compagnie de Phalsbourg");
  const cpt = el("span", "g-cpt", nb);
  h2.append(" ", cpt);
  sec.append(h2);
  lignesAgents = [];
  for (const a of AGENTS) {
    const b = ligneAgent(a);
    lignesAgents.push([b, a]);
    sec.append(b);
  }
  const vide = el("p", "vide", "Aucun agent ne correspond.");
  vide.hidden = true;

  function filtrer() {
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === filtres.statut));
    let total = 0;
    const visibles = [];
    for (const [b, a] of lignesAgents) {
      const ok = !filtres.statut || statutAgent(a) === filtres.statut;
      b.hidden = !ok;
      if (ok) { total += 1; visibles.push(b); }
    }
    visibles.forEach((b, i) => b.classList.toggle("premier", i === 0));
    cpt.textContent = String(total);
    sec.hidden = total === 0;
    vide.hidden = total > 0;
  }
  filtrer();
  return [el("h1", null, "Agents"), sous, k, barre, sec, vide];
}

function ligneAgent(a) {
  const st = statutAgent(a);
  const b = bouton("tiroir-l lb");
  b.dataset.agent = a.id;
  b.dataset.ouvrePanneau = "1";
  b.setAttribute("aria-expanded", "false");
  const la = el("span", "la ag-la");
  const pt = pastille(st);
  pt.removeAttribute("aria-hidden");
  pt.setAttribute("role", "img");
  pt.setAttribute("aria-label", st === "ok" ? "En service" : "En construction");
  const nom = el("span", "la-nom");
  nom.append(el("strong", null, a.nom), el("span", "la-f", a.mission));
  const outils = el("span", "o-l");
  outils.append(...a.outils.slice(0, 3).map(puceOutil));
  if (a.outils.length > 3) outils.append(el("span", "discret", "+" + (a.outils.length - 3)));
  const n = autonomie(a);
  const d = el("span", "la-d");
  d.append(jauge(n), " " + NIVEAUX[n].toLowerCase());
  la.append(pt, el("span", "la-id mono", a.id.slice(-2)), nom, outils, d);
  b.append(la, ico("chevron", 16));
  b.addEventListener("click", () => {
    if (params().get("id") !== a.id) history.pushState(null, "", adresseAvec((q) => q.set("id", a.id)));
    ouvrirFiche(a.id);
  });
  return b;
}

function section(titre, ...enfants) {
  const s = el("section", "fi-s");
  s.append(el("h3", null, titre), ...enfants);
  return s;
}

function ouvrirFiche(id) {
  const a = AGENTS.find((x) => x.id === id);
  if (!a) return fermerPanneau(false);
  const ligne = lignesAgents.find(([, x]) => x === a);
  const depuis = ligne ? ligne[0] : null;
  for (const b of document.querySelectorAll(".lb[aria-expanded]")) b.setAttribute("aria-expanded", String(b === depuis));

  const st = statutAgent(a);
  const etiquette = el("p", "fi-st " + st);
  etiquette.append(pastille(st), st === "ok" ? "En service" : "En construction");
  const nom = el("h2", "fi-nom", a.nom);
  nom.id = "panneau-titre";
  const dom = el("p", "fi-flux", a.domaine);
  dom.append(" ", el("span", "mono", a.id));

  const outils = el("p", "o-l");
  outils.append(...a.outils.map(puceOutil));
  const prets = a.outils.filter((i) => autosParId.get(i) && statutDe(autosParId.get(i)) === "ok").length;

  const actions = el("ul", "ag-a");
  for (const [texte, outil, n] of a.actions) {
    const li = el("li");
    li.append(el("span", null, texte), el("span", "discret", `vérifié par ${outil} · ${NIVEAUX[n]}`));
    actions.append(li);
  }

  const frise = el("ol", "frise");
  ETAPES.forEach((e, i) => frise.append(el("li", i <= a.etape ? "fait" : "", e)));

  ouvrirPanneau("fiche", [etiquette, nom, dom,
    section("Ce qu'il fera", el("p", null, a.mission)),
    section("Ses outils FSI", outils, el("p", "discret", `${prets} sur ${a.outils.length} déjà fonctionnelles.`)),
    section("Ses actions prévues", actions),
    section("Avancement", frise)], depuis);
  if (depuis) depuis.scrollIntoView({ block: "nearest" });
}

auFermer = (mode) => {
  if (mode !== "fiche") return;
  for (const b of document.querySelectorAll(".lb[aria-expanded]")) b.setAttribute("aria-expanded", "false");
  if (params().has("id")) history.replaceState(null, "", adresseAvec((q) => q.delete("id")));
};

function suivreAdresse() {
  const id = params().get("id");
  if (id) ouvrirFiche(id); else if (panneauMode === "fiche") fermerPanneau(false);
}

window.addEventListener("popstate", suivreAdresse);

demarrer(() => suivre([SOURCES.autos], (d, premier) => {
  const ouverte = panneauMode === "fiche";
  poser(vueAgents(d), premier);
  if (premier || ouverte) suivreAdresse();
}));
