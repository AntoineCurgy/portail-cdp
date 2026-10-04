// Le portail des rapports. La page ne decide de rien : l'API refuse, la page affiche.
// L'adresse de l'API est publique ; aucun secret ne vit ici. La session est un
// cookie HttpOnly pose par l'API : rien n'est garde dans le stockage du navigateur.
// Ecriture dans la page : textContent et createElement ; innerHTML seulement pour
// les icones, balisage constant ecrit ici.
"use strict";

// En local, page et API sur `localhost` : meme site, donc le cookie strict passe.
const HOTE = location.hostname;
const API = (HOTE === "localhost" || HOTE === "127.0.0.1" || HOTE === "")
  ? "http://localhost:8790"
  : "https://api-" + HOTE;   // portail-cdp.88systems.io -> api-portail-cdp.88systems.io
const DELAI = 15000;
const CONTACT = "acurgy-ext@compagniedephalsbourg.com";
const PAGES = ["accueil", "rapports", "automatisations", "parametres", "aide"];
const ORDRE_DOMAINES = ["Contrôles de cohérence", "Flux entre systèmes", "Lettrages", "Grands livres", "Référentiels"];
const JOURS = { lun: ["Lun.", "Lundi"], mar: ["Mar.", "Mardi"], mer: ["Mer.", "Mercredi"], jeu: ["Jeu.", "Jeudi"],
                ven: ["Ven.", "Vendredi"], sam: ["Sam.", "Samedi"], dim: ["Dim.", "Dimanche"] };
const ETATS = { ok: ["validé", "t-vert"], a_valider: ["à valider", "t-ambre"], interrompu: ["interrompu", "t-rouge"],
                illisible: ["illisible", "t-rouge"] };
const STATUTS = { ok: "En service", panne: "En panne", pause: "Jamais lancée" };
const PANNE_SERVICE = "Le service ne répond pas pour l'instant. Réessayez dans quelques minutes.";

const ICONES = {
  cadenas: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  chevron: '<polyline points="9 18 15 12 9 6"/>',
};

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ outils DOM

function el(tag, classe, texte) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texte !== undefined && texte !== null) e.textContent = String(texte);
  return e;
}

function ico(nom, taille) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const [k, v] of Object.entries({ class: "ico", width: taille, height: taille, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) {
    s.setAttribute(k, String(v));
  }
  s.innerHTML = ICONES[nom];   // balisage constant, jamais une donnee
  return s;
}

function cadenas(taille) {
  const c = el("span", "cad");
  c.append(ico("cadenas", taille));
  return c;
}

function pastille(statut) {
  const p = el("span", "pt " + statut);
  p.setAttribute("aria-hidden", "true");
  return p;
}

function tag(etat) {
  const e = ETATS[etat];
  if (!e) return etat ? el("span", "tag t-ferme", etat) : null;   // un etat inconnu se montre tel quel
  return el("span", "tag " + e[1], e[0]);
}

function bouton(classe, texte) {
  const b = el("button", classe, texte);
  b.type = "button";
  return b;
}

function pluriel(n, un, plusieurs) { return n + " " + (n > 1 ? plusieurs : un); }

// "Even <> Sage" -> "Even ↔ Sage" ; "Even > Sage" -> "Even → Sage"
function flux(f) { return (f || "").replace(/<>/g, "↔").replace(/>/g, "→"); }

// "2026-10-03" -> "03/10"
function jourCourt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? m[3] + "/" + m[2] : (iso || "");
}

function heureCourte(h) { return (h || "").slice(0, 5); }

const FORMAT_PARIS = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function parties(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const p = {};
  for (const x of FORMAT_PARIS.formatToParts(d)) p[x.type] = x.value;
  return p;
}

// "2026-10-03T19:42:00+00:00" -> "03/10/2026 à 21 h 42" (heure de Paris)
function majLisible(iso) {
  const p = parties(iso);
  return p ? `${p.day}/${p.month}/${p.year} à ${p.hour} h ${p.minute}` : (iso || "");
}

// la date du jour de `maj`, a Paris, en AAAA-MM-JJ
function jourDe(iso) {
  const p = parties(iso);
  return p ? `${p.year}-${p.month}-${p.day}` : "";
}

// ------------------------------------------------------------------ appels a l'API

class SessionPerdue extends Error {}

async function appeler(methode, chemin, corps, format = "json") {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI);
  try {
    const r = await fetch(API + chemin, {
      method: methode, credentials: "include", signal: controle.signal,
      headers: corps ? { "Content-Type": "application/json" } : {},
      body: corps ? JSON.stringify(corps) : undefined,
    });
    let donnees = null;
    try { donnees = format === "texte" ? await r.text() : await r.json(); } catch (_) { donnees = null; }
    return { statut: r.status, donnees };
  } catch (_) {
    return { statut: 0, donnees: null };
  } finally {
    clearTimeout(minuteur);
  }
}

// Une lecture de page : 401 renvoie a la connexion, tout autre echec est dit.
async function lire(chemin, verifier) {
  const { statut, donnees } = await appeler("GET", chemin);
  if (statut === 401) throw new SessionPerdue();
  if (statut !== 200 || !donnees || !verifier(donnees)) {
    throw new Error(statut === 503 ? "Une source du portail est momentanément indisponible. Réessayez dans quelques minutes." : PANNE_SERVICE);
  }
  return donnees;
}

const lireAutos = () => lire("/api/automatisations", (d) => Array.isArray(d.automatisations));
const lireRapports = () => lire("/api/rapports", (d) => Array.isArray(d.rapports));
const lireParametres = () => lire("/api/parametres", (d) => Array.isArray(d.lignes));

// ------------------------------------------------------------------ session

let moi = null;

async function demarrer() {
  const { statut, donnees } = await appeler("GET", "/api/moi");
  if (statut === 401) return montrerConnexion("");
  if (statut !== 200 || !donnees || !donnees.adresse) return montrerConnexion(PANNE_SERVICE, true);
  moi = donnees;
  entrer();
}

function majBandeau(iso) {
  if (iso) $("maj").textContent = "Mis à jour " + majLisible(iso);
}

function entrer() {
  const adresse = String(moi.adresse);
  const initiales = moi.initiales ? String(moi.initiales) : adresse.slice(0, 2).toUpperCase();
  const avatar = $("avatar");
  avatar.textContent = initiales;
  avatar.title = moi.nom ? moi.nom + " · " + adresse : adresse;
  avatar.setAttribute("aria-label", "Connecté : " + (moi.nom || adresse));
  avatar.setAttribute("role", "img");
  majBandeau(moi.maj);
  for (const x of document.querySelectorAll(".session")) x.hidden = false;
  $("vue-connexion").hidden = true;
  $("vue-appli").hidden = false;
  pageAffichee = null;
  router();
}

function sessionPerdue() {
  montrerConnexion("Votre session a pris fin. Reconnectez-vous pour continuer.", false);
}

// ------------------------------------------------------------------ connexion

let adresseSaisie = "";
const cases = () => [...document.querySelectorAll(".case-c")];

function direConnexion(texte, erreur = false, contact = null) {
  const m = $("message-connexion");
  m.replaceChildren();
  m.className = "message" + (erreur ? " erreur" : "");
  if (contact) {
    // « Cette adresse n'a pas encore de compte. Écrivez à <contact> pour que l'administrateur vous ajoute. »
    const a = el("a", null, contact);
    a.href = "mailto:" + contact;
    m.append("Cette adresse n'a pas encore de compte. Écrivez à ", a, " pour que l'administrateur vous ajoute.");
  } else {
    m.textContent = texte;
  }
}

function etape(n) {
  $("f-adresse").hidden = n !== 1;
  $("f-code").hidden = n !== 2;
  $("etape-1").classList.toggle("on", n === 1);
  $("etape-2").classList.toggle("on", n === 2);
  if (n === 1) $("adresse").focus(); else cases()[0].focus();
}

function montrerConnexion(message, erreur = false) {
  moi = null;
  fermerPanneau(false);
  for (const x of document.querySelectorAll(".session")) x.hidden = true;
  $("vue-appli").hidden = true;
  $("contenu").replaceChildren();
  pageAffichee = null;
  $("vue-connexion").hidden = false;
  for (const c of cases()) c.value = "";
  direConnexion(message || "", erreur);
  etape(1);
}

$("f-adresse").addEventListener("submit", async (e) => {
  e.preventDefault();
  const champ = $("adresse");
  adresseSaisie = champ.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresseSaisie)) {
    champ.setAttribute("aria-invalid", "true");
    return direConnexion("Saisissez une adresse complète, par exemple prenom.nom@compagniedephalsbourg.com.", true);
  }
  champ.removeAttribute("aria-invalid");
  direConnexion("Envoi du code…");
  const { statut, donnees } = await appeler("POST", "/api/connexion", { adresse: adresseSaisie });
  if (statut !== 200 || !donnees) return direConnexion(PANNE_SERVICE, true);
  if (donnees.inconnue) {
    // Decision d'Antoine du 2026-10-04 : une adresse sans compte ne recoit pas de code,
    // on reste a l'etape 1 et on lui dit a qui ecrire.
    champ.setAttribute("aria-invalid", "true");
    return direConnexion("", true, String(donnees.contact || CONTACT));
  }
  if (donnees.ok !== true) return direConnexion(String(donnees.message || PANNE_SERVICE), true);
  $("adresse-envoyee").textContent = adresseSaisie;
  for (const c of cases()) c.value = "";
  direConnexion("");
  etape(2);
});

$("f-code").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = cases().map((c) => c.value).join("");
  if (!/^\d{6}$/.test(code)) return direConnexion("Saisissez les six chiffres du code reçu.", true);
  direConnexion("Vérification…");
  const { statut } = await appeler("POST", "/api/session", { adresse: adresseSaisie, code });
  if (statut === 401) {
    for (const c of cases()) c.value = "";
    cases()[0].focus();
    return direConnexion("Ce code n'est pas valable, ou il a expiré. Demandez-en un nouveau.", true);
  }
  if (statut === 429) return direConnexion("Trop d'essais. Attendez un quart d'heure, puis demandez un nouveau code.", true);
  if (statut !== 200) return direConnexion(PANNE_SERVICE, true);
  for (const c of cases()) c.value = "";
  direConnexion("");
  demarrer();
});

$("changer-adresse").addEventListener("click", () => { direConnexion(""); etape(1); });

cases().forEach((x, i, toutes) => {
  x.addEventListener("focus", () => x.select());
  x.addEventListener("input", () => {
    const chiffres = x.value.replace(/\D/g, "");
    if (chiffres.length > 1) return repartir(chiffres, i);   // remplissage automatique du code entier
    x.value = chiffres;
    if (chiffres && toutes[i + 1]) toutes[i + 1].focus();
  });
  x.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !x.value && toutes[i - 1]) { toutes[i - 1].focus(); toutes[i - 1].value = ""; e.preventDefault(); }
    if (e.key === "ArrowLeft" && toutes[i - 1]) toutes[i - 1].focus();
    if (e.key === "ArrowRight" && toutes[i + 1]) toutes[i + 1].focus();
  });
  x.addEventListener("paste", (e) => {
    const t = ((e.clipboardData && e.clipboardData.getData("text")) || "").replace(/\D/g, "");
    if (!t) return;
    e.preventDefault();
    repartir(t, i);
  });
});

function repartir(chiffres, depuis) {
  const toutes = cases();
  const debut = chiffres.length >= 6 ? 0 : depuis;   // un code complet colle remplit tout
  chiffres.slice(0, 6 - debut).split("").forEach((d, j) => { toutes[debut + j].value = d; });
  const suivant = Math.min(debut + chiffres.length, 5);
  toutes[suivant].focus();
}

$("deconnexion").addEventListener("click", async () => {
  await appeler("POST", "/api/deconnexion", {});
  montrerConnexion("Vous êtes déconnecté.");
});

// ------------------------------------------------------------------ navigation

let pageAffichee = null;
let jeton = 0;   // une page affichee plus tard rend caduque une lecture plus ancienne
const filtres = { rapports: { g: "", e: "", q: "" }, automatisations: { statut: "", sys: "" } };

function lireAncre() {
  let h = location.hash.slice(1);
  try { h = decodeURIComponent(h); } catch (_) { /* ancre mal formee : prise telle quelle */ }
  const [chemin, requete = ""] = h.split("?");
  const [page, sous = ""] = chemin.split("/");
  return { page: PAGES.includes(page) ? page : "accueil", sous, params: new URLSearchParams(requete) };
}

function ancre(page, sous, params) {
  let h = "#" + page + (sous ? "/" + encodeURIComponent(sous) : "");
  const q = params && params.toString();
  return q ? h + "?" + q : h;
}

function remplacerAncre(h) {
  if (location.hash !== h) history.replaceState(null, "", h);
}

async function router() {
  if (!moi) return;
  const { page, sous, params } = lireAncre();
  if (page === "automatisations") filtres.automatisations.sys = params.get("sys") || "";   // l'ancre fait foi
  if (page !== pageAffichee) {
    fermerPanneau(false);
    await afficher(page);
  } else if (page === "automatisations") {
    appliquerFiltresAutos();
  }
  if (pageAffichee !== page) return;   // la page n'a pas pu s'afficher
  if (page === "automatisations") {
    if (sous) ouvrirFiche(sous); else if (panneauMode === "fiche") fermerPanneau(false);
  }
  if (page === "aide" && sous) {
    const s = $("aide-" + sous);
    if (s) s.scrollIntoView({ block: "start" });
  }
}

async function afficher(page) {
  const mon = ++jeton;
  pageAffichee = page;
  for (const a of document.querySelectorAll(".rail [data-page]")) {
    if (a.dataset.page === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
  const zone = $("contenu");
  const attente = el("p", "chargement", "Chargement…");
  attente.setAttribute("role", "status");
  zone.replaceChildren(attente);
  try {
    const noeuds = await VUES[page]();
    if (mon !== jeton) return;
    zone.replaceChildren(...noeuds);
    const h1 = zone.querySelector("h1");
    document.title = (h1 ? h1.textContent + " · " : "") + "Portail des rapports";
    if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  } catch (err) {
    if (mon !== jeton) return;
    if (err instanceof SessionPerdue) return sessionPerdue();
    pageAffichee = null;
    const p = el("p", "erreur", err.message || PANNE_SERVICE);
    p.setAttribute("role", "alert");
    zone.replaceChildren(el("h1", null, "Portail des rapports"), p);
  }
}

window.addEventListener("hashchange", router);

// ------------------------------------------------------------------ calculs partages

function compter(autos) {
  const n = { ok: 0, panne: 0, pause: 0 };
  for (const a of autos) n[a.statut in n ? a.statut : "panne"] += 1;   // un statut inconnu compte comme panne, jamais omis
  return n;
}

function statutDe(a) { return a.statut in STATUTS ? a.statut : "panne"; }

function statutSysteme(autos) {
  if (autos.some((a) => statutDe(a) === "panne")) return "panne";
  if (autos.some((a) => statutDe(a) === "ok")) return "ok";
  return "pause";
}

// « actives » : celles qui ont deja tourne (en service ou en panne), comme dans la maquette v14
function actives(liste) {
  const k = liste.filter((a) => statutDe(a) !== "pause").length;
  return k + " " + (k > 1 ? "actives" : "active") + " sur " + liste.length;
}

function phraseEtat(n) {
  return `${n.ok} en service, ${n.panne} en panne, ${n.pause} pas encore lancée${n.pause > 1 ? "s" : ""}`;
}

// Les cartes « Tous » puis une par systeme. `fabrique(valeur)` rend un lien ou un bouton.
function cartesSystemes(donnees, fabrique) {
  const autos = donnees.automatisations;
  const n = compter(autos);
  const total = autos.length || 1;
  const cartes = [];
  const tous = fabrique("");
  tous.className = "sr-p tous";
  const pt = pastille("tous");
  pt.style.setProperty("--ok", String(Math.round(n.ok / total * 100)));
  pt.style.setProperty("--hs", String(Math.round((n.ok + n.panne) / total * 100)));
  tous.append(pt, el("strong", null, "Tous"), el("span", null, actives(autos)));
  cartes.push(tous);
  const systemes = Array.isArray(donnees.systemes) ? donnees.systemes : [];
  for (const s of systemes) {
    const liste = autos.filter((a) => Array.isArray(a.systemes) && a.systemes.includes(s));
    const st = statutSysteme(liste);
    const c = fabrique(s);
    c.className = "sr-p " + st;
    c.append(pastille(st), el("strong", null, s), el("span", null, actives(liste)));
    cartes.push(c);
  }
  const carte = el("section", "carte");
  const h = el("div", "c-h");
  h.append(el("h2", null, pluriel(systemes.length, "système connecté", "systèmes connectés")));
  const grille = el("div", "srl");
  grille.append(...cartes);
  carte.append(h, grille);
  return carte;
}

function parId(a, b) { return String(a.id).localeCompare(String(b.id), "fr", { numeric: true }); }

// ------------------------------------------------------------------ accueil

async function vueAccueil() {
  const [autosD, rapsD] = await Promise.all([lireAutos(), lireRapports()]);
  majBandeau(rapsD.maj || autosD.maj);
  const autos = autosD.automatisations;
  const raps = rapsD.rapports;
  const n = compter(autos);
  const total = autos.length;
  const pct = total ? Math.round(n.ok / total * 100) : 0;
  const jour = jourDe(rapsD.maj || autosD.maj || (moi && moi.maj));
  const duJour = raps.filter((r) => r.jour === jour && r.etat !== "interrompu").length;
  const aValider = raps.filter((r) => r.etat === "a_valider").length;

  // l'anneau et les grandeurs
  const ke = el("div", "ke");
  const anneau = el("div", "ke-anneau");
  anneau.style.setProperty("--p", String(pct));
  anneau.setAttribute("aria-hidden", "true");
  const centre = el("span");
  centre.append(el("strong", null, n.ok), "/" + total);
  anneau.append(centre);
  const t = el("div", "ke-t");
  t.append(el("p", "ke-titre", pct + " % des automatisations tournent"),
    el("p", "ke-s", `${n.ok} en service sur ${total} · ${n.panne} en panne · ${n.pause} pas encore lancée${n.pause > 1 ? "s" : ""}`));
  const d = el("div", "ke-d");
  const l1 = el("p");
  l1.append(el("strong", null, duJour), ` ${duJour > 1 ? "rapports" : "rapport"} du jour sur ${raps.length}`);
  const l2 = el("p");
  l2.append(el("strong", "ambre", aValider), " à valider");
  d.append(l1, l2);
  ke.append(anneau, t, d);

  // la grille des pastilles
  const etat = el("section", "carte");
  etat.setAttribute("aria-labelledby", "titre-etat");
  const ch = el("div", "c-h");
  const h2 = el("h2");
  h2.id = "titre-etat";
  h2.append(pastille(n.panne ? "panne" : "ok"),
    n.panne ? pluriel(n.panne, "automatisation en panne", "automatisations en panne") : "Aucune automatisation en panne");
  const leg = el("p", "legende");
  for (const [s, texte] of [["ok", "en service"], ["panne", "en panne"], ["pause", "jamais lancée"]]) {
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
    lien.href = ancre("automatisations", String(a.id));
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
  aide.href = "#aide/etat";
  pied.append(el("span", null, `${n.ok} en service · ${n.panne} en panne · ${n.pause} jamais lancée${n.pause > 1 ? "s" : ""} · un numéro ouvre sa fiche`), aide);
  etat.append(ch, grille, pied);

  const systemes = cartesSystemes(autosD, (s) => {
    const a = el("a");
    a.href = s ? ancre("automatisations", "", new URLSearchParams({ sys: s })) : ancre("automatisations", "", new URLSearchParams({ sys: "" }));
    return a;
  });
  return [el("h1", null, "Tableau de bord"), ke, etat, systemes];
}

// ------------------------------------------------------------------ rapports

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

async function vueRapports() {
  const donnees = await lireRapports();
  majBandeau(donnees.maj);
  const raps = [...donnees.rapports].sort((a, b) => String(a.sujet).localeCompare(String(b.sujet), "fr"));
  const f = filtres.rapports;
  const restreints = raps.filter((r) => !r.acces).length;
  const avis = el("p", "avis");
  avis.setAttribute("aria-live", "polite");

  const sous = el("p", "sous-titre", `Dernière version de chaque rapport · ${pluriel(raps.length, "rapport", "rapports")}`);
  if (restreints) sous.append(" · ", cadenas(14), `${restreints} en accès restreint`);

  // domaines
  const domaines = ordreDomaines(raps);
  const barre = el("div", "gb-barre");
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "Domaines");
  const choix = [["", "Tous", raps.length], ...domaines.map((g) => [g, g, raps.filter((r) => (r.domaine || "Autres") === g).length])];
  for (const [v, texte, n] of choix) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, n));
    b.dataset.v = v;
    b.addEventListener("click", () => { f.g = v; filtrer(); });
    barre.append(b);
  }

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
  const pe = el("div", "pe");
  pe.setAttribute("role", "group");
  pe.setAttribute("aria-label", "État");
  for (const [v, texte] of [["", "Tous"], ["ok", "Validés"], ["a_valider", "À valider"], ["interrompu", "Interrompus"]]) {
    const b = bouton("pe-b", texte);
    b.append(" ", el("span", null, v ? raps.filter((r) => r.etat === v).length : raps.length));
    b.dataset.v = v;
    b.addEventListener("click", () => { f.e = v; filtrer(); });
    pe.append(b);
  }
  ligne.append(lab, pe);
  const outils = el("div", "outils");
  outils.append(barre, ligne);

  // le tableau
  const carte = el("div", "carte gd-c");
  const table = el("table", "gd");
  const cg = el("colgroup");
  for (const w of ["", "12rem", "9rem", "8rem", "3.5rem", "7rem", "11rem"]) {
    const c = el("col");
    if (w) c.style.width = w;
    cg.append(c);
  }
  const thead = el("thead");
  const tr = el("tr");
  for (const [texte, classe, cache] of [["Rapport"], ["Systèmes", "c"], ["Système d'origine"], ["État"], ["Date"], ["Résumé", null, true], ["Télécharger", null, true]]) {
    const th = el("th", classe);
    th.scope = "col";
    if (cache) th.append(el("span", "sr", texte)); else th.textContent = texte;
    tr.append(th);
  }
  thead.append(tr);
  table.append(cg, thead);
  const lignes = [];
  for (const g of domaines) {
    const liste = raps.filter((r) => (r.domaine || "Autres") === g);
    const tb = el("tbody");
    const bande = el("tr", "gd-b");
    const th = el("th", null, g);
    th.colSpan = 7;
    th.scope = "rowgroup";
    th.append(" ", el("span", null, pluriel(liste.length, "rapport", "rapports")));
    bande.append(th);
    tb.append(bande);
    for (const r of liste) {
      const l = ligneRapport(r, avis);
      lignes.push([l, r, g]);
      tb.append(l);
    }
    table.append(tb);
  }
  carte.append(table);
  const vide = el("p", "vide", "Aucun rapport ne correspond.");
  vide.hidden = true;

  function filtrer() {
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === f.g));
    for (const b of pe.children) b.setAttribute("aria-pressed", String(b.dataset.v === f.e));
    let total = 0;
    for (const [l, r, g] of lignes) {
      const ok = (!f.g || g === f.g) && (!f.e || r.etat === f.e) && (!f.q || String(r.sujet).toLowerCase().includes(f.q));
      l.hidden = !ok;
      total += ok ? 1 : 0;
    }
    for (const tb of table.tBodies) tb.hidden = !tb.querySelector("tr[data-r]:not([hidden])");
    vide.hidden = total > 0;
    carte.hidden = total === 0;
    avis.textContent = "";
  }
  filtrer();
  return [el("h1", null, "Rapports"), sous, outils, avis, carte, vide];
}

function ligneRapport(r, avis) {
  const tr = el("tr");
  tr.dataset.r = "1";
  const nom = el("th");
  nom.scope = "row";
  const f = el("td", "td-f", flux(r.flux));
  const origine = el("td", "discret", r.origine || "");
  const etat = el("td");
  const date = el("td", "mono discret");
  const resume = el("td", "act");
  const action = el("td", "act");
  if (!r.acces) {
    tr.className = "restreint";
    nom.append(cadenas(14), String(r.sujet));
    const b = bouton("btn eteint");
    b.setAttribute("aria-disabled", "true");
    b.append(ico("cadenas", 14), "Accès restreint");
    b.setAttribute("aria-label", "Accès restreint : " + r.sujet);
    b.addEventListener("click", () => {
      avis.textContent = `Vous n'avez pas accès à « ${r.sujet} ». Votre administrateur peut vous l'ouvrir.`;
    });
    action.append(b);
  } else {
    nom.textContent = String(r.sujet);
    const t = tag(r.etat);
    if (t) etat.append(t);
    date.textContent = jourCourt(r.jour);
    if (r.resume) {
      const b = bouton("lien-r", "Voir le résumé");
      b.dataset.ouvrePanneau = "1";
      b.setAttribute("aria-label", "Voir le résumé de " + r.sujet);
      b.addEventListener("click", () => ouvrirResume(r, b));
      resume.append(b);
    }
    if (r.livrable === "interface") {
      // Decision d'Antoine du 2026-10-04 : une interface depose dans un autre systeme ;
      // on voit son etat et son resume, jamais de bouton de telechargement.
    } else if (r.telechargeable) {
      const a = el("a", "btn", "Télécharger");
      a.href = urlRapport(r);
      a.setAttribute("aria-label", "Télécharger " + r.sujet);
      action.append(a);
    } else {
      // Decision d'Antoine du 2026-10-03 : un passage interrompu ne se telecharge pas,
      // et l'utilisateur qui essaie recoit une explication, pas une erreur.
      const b = bouton("btn eteint", "Télécharger");
      b.setAttribute("aria-disabled", "true");
      b.setAttribute("aria-label", "Télécharger " + r.sujet + " (indisponible)");
      b.addEventListener("click", () => {
        avis.textContent = `« ${r.sujet} » : le dernier passage n'a pas abouti, il n'y a rien à télécharger. Le rapport reviendra au prochain passage réussi.`;
      });
      action.append(b);
    }
  }
  tr.append(nom, f, origine, etat, date, resume, action);
  return tr;
}

// ------------------------------------------------------------------ panneau de droite

let panneauMode = null;
let declencheur = null;

function ouvrirPanneau(mode, enfants, depuis) {
  const p = $("panneau");
  panneauMode = mode;
  declencheur = depuis || document.activeElement;
  p.classList.toggle("large", mode === "resume");
  $("panneau-corps").replaceChildren(...enfants);
  p.hidden = false;
  $("panneau-fermer").focus();
}

function fermerPanneau(rendreFocus = true) {
  const p = $("panneau");
  if (p.hidden) return;
  p.hidden = true;
  $("panneau-corps").replaceChildren();
  if (panneauMode === "fiche") {
    for (const b of document.querySelectorAll(".lb[aria-expanded]")) b.setAttribute("aria-expanded", "false");
    const { page, params } = lireAncre();
    if (page === "automatisations") remplacerAncre(ancre("automatisations", "", params));
  }
  panneauMode = null;
  if (rendreFocus && declencheur && document.contains(declencheur)) declencheur.focus();
  declencheur = null;
}

$("panneau-fermer").addEventListener("click", () => fermerPanneau());
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerPanneau(); });
document.addEventListener("click", (e) => {
  const p = $("panneau");
  if (p.hidden || p.contains(e.target)) return;
  if (e.target.closest && e.target.closest("[data-ouvre-panneau]")) return;
  fermerPanneau(false);
});

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

// ------------------------------------------------------------------ automatisations

let donneesAutos = null;
let lignesAutos = [];
let groupesAutos = [];
let rafraichirFiltres = () => {};

function libelleGroupe(origine) {
  if (!origine) return "Origine non renseignée";
  return /^Tous/.test(origine) ? origine : "Depuis " + origine;
}

async function vueAutomatisations() {
  const donnees = await lireAutos();
  donneesAutos = donnees;
  majBandeau(donnees.maj);
  const autos = donnees.automatisations;
  const n = compter(autos);
  const f = filtres.automatisations;

  const sous = el("p", "sous-titre", `Ce que chacune fait, quand elle tourne, et ses derniers passages. ${phraseEtat(n)}.`);

  const cartes = cartesSystemes(donnees, (s) => {
    const b = bouton("");
    b.dataset.sys = s;
    b.addEventListener("click", () => {
      f.sys = s;
      const params = new URLSearchParams(s ? { sys: s } : {});
      remplacerAncre(ancre("automatisations", lireAncre().sous, params));
      appliquerFiltresAutos();
    });
    return b;
  });

  const barre = el("div", "gb-barre");
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "État");
  for (const [v, texte, k] of [["", "Toutes", autos.length], ["ok", "En service", n.ok], ["panne", "En panne", n.panne], ["pause", "Pas encore lancées", n.pause]]) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, k));
    b.dataset.v = v;
    b.addEventListener("click", () => { f.statut = v; appliquerFiltresAutos(); });
    barre.append(b);
  }

  // groupes par systeme d'origine : les plus actifs d'abord
  const parOrigine = new Map();
  for (const a of autos) {
    const k = a.origine || "";
    if (!parOrigine.has(k)) parOrigine.set(k, []);
    parOrigine.get(k).push(a);
  }
  const lancees = (l) => l.filter((a) => statutDe(a) !== "pause").length;
  const origines = [...parOrigine.keys()].sort((a, b) => {
    const la = parOrigine.get(a), lb = parOrigine.get(b);
    return (lancees(lb) - lancees(la)) || (lb.length - la.length) || a.localeCompare(b, "fr");
  });
  lignesAutos = [];
  groupesAutos = [];
  const sections = [];
  for (const o of origines) {
    const liste = parOrigine.get(o).sort((a, b) => ((statutDe(a) === "pause") - (statutDe(b) === "pause")) || parId(a, b));
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
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === f.statut));
    for (const c of cartes.querySelectorAll("[data-sys]")) c.setAttribute("aria-pressed", String(c.dataset.sys === f.sys));
    let total = 0;
    for (const [b, a] of lignesAutos) {
      const ok = (!f.statut || statutDe(a) === f.statut) && (!f.sys || (Array.isArray(a.systemes) && a.systemes.includes(f.sys)));
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

function appliquerFiltresAutos() { rafraichirFiltres(); }

function carres(passages) {
  const h = el("span", "histo");
  for (const p of passages) {
    const classe = p.resultat === "ok" ? "ok" : p.resultat === "à voir" ? "voir" : "panne";
    const c = el("span", "h " + classe);
    c.title = `${jourCourt(p.date)} · ${p.resultat}`;
    c.append(el("span", "sr", `${jourCourt(p.date)} : ${p.resultat}`));
    h.append(c);
  }
  return h;
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
  if (a.dernier) d.textContent = `${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)} · ${a.dernier.resultat}`;
  else d.append(el("span", "discret", "jamais lancée"));
  const pt = pastille(st);
  pt.removeAttribute("aria-hidden");
  pt.setAttribute("role", "img");
  pt.setAttribute("aria-label", STATUTS[st]);
  la.append(pt, el("span", "la-id mono", a.court || String(a.id).slice(-2)), nom, histo, d);
  b.append(la, ico("chevron", 16));
  b.addEventListener("click", () => {
    const { params } = lireAncre();
    location.hash = ancre("automatisations", String(a.id), params);
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
    p.append(el("strong", null, `${jourCourt(a.dernier.date)} à ${heureCourte(a.dernier.heure)}`), " · " + a.dernier.resultat);
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
    const t = r.acces ? tag(r.etat) : el("span", "tag t-ferme", "accès restreint");
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

// ------------------------------------------------------------------ parametres

async function vueParametres() {
  const donnees = await lireParametres();
  const jours = Array.isArray(donnees.jours) && donnees.jours.length ? donnees.jours : ["lun", "mar", "mer", "jeu", "ven"];
  const carte = el("div", "carte gd-c");
  const table = el("table", "pa");
  const thead = el("thead");
  const tr = el("tr");
  for (const [texte, classe] of [["Automatisation"], ["Par courriel"], ...jours.map((j) => [(JOURS[j] || [j])[0], "c"])]) {
    const th = el("th", classe, texte);
    th.scope = "col";
    tr.append(th);
  }
  thead.append(tr);
  const tbody = el("tbody");
  const suivies = [];   // [ligne de l'API, interrupteur, cases par jour, etat d'origine]

  for (const l of donnees.lignes) {
    const ligne = el("tr");
    const th = el("th");
    th.scope = "row";
    const nom = el("span", "la-nom");
    nom.append(el("strong", null, l.nom), el("span", "la-f", flux(l.flux)));
    th.append(nom);
    ligne.append(th);
    if (!l.acces) {
      const td = el("td");
      const f = el("span", "ferme-p");
      f.append(ico("cadenas", 13), " Accès restreint");
      td.append(f);
      const vide = el("td");
      vide.colSpan = jours.length;
      ligne.append(td, vide);
      tbody.append(ligne);
      continue;
    }
    const tdSw = el("td");
    const sw = el("label", "sw");
    const inter = el("input");
    inter.type = "checkbox";
    inter.setAttribute("role", "switch");
    inter.checked = !!l.courriel;
    const rail = el("span", "sw-r");
    rail.setAttribute("aria-hidden", "true");
    sw.append(inter, rail, el("span", "sr", "Recevoir par courriel : " + l.nom));
    tdSw.append(sw);
    ligne.append(tdSw);
    // Decisions d'Antoine du 2026-10-04 : un jour absent de `jours_possibles` est grise et
    // ne se coche jamais ; couper l'interrupteur decoche les jours, le rallumer recoche
    // tous les jours possibles (sans ce defaut, l'utilisateur ne recevrait rien sans le savoir).
    const possibles = Array.isArray(l.jours_possibles) ? l.jours_possibles : jours;
    const casesJ = {};
    for (const j of jours) {
      const td = el("td", "c");
      const c = el("input");
      c.type = "checkbox";
      const possible = possibles.includes(j);
      c.checked = possible && inter.checked && Array.isArray(l.jours) && l.jours.includes(j);
      c.disabled = !possible || !inter.checked;
      if (!possible) c.setAttribute("aria-disabled", "true");
      c.setAttribute("aria-label", `${(JOURS[j] || [j, j])[1]} : ${l.nom}` + (possible ? "" : " (elle ne tourne pas ce jour-là)"));
      td.append(c);
      ligne.append(td);
      if (possible) casesJ[j] = c;
    }
    inter.addEventListener("change", () => {
      for (const c of Object.values(casesJ)) {
        c.disabled = !inter.checked;
        c.checked = inter.checked;
      }
    });
    const suivi = { l, inter, casesJ, origine: null };
    suivi.origine = etatLigne(suivi);
    suivies.push(suivi);
    tbody.append(ligne);
  }
  table.append(thead, tbody);
  carte.append(table);

  const enr = el("div", "enr");
  const b = bouton("btn", "Enregistrer");
  const m = el("span", "enr-m");
  m.setAttribute("aria-live", "polite");
  let enCours = false;
  b.addEventListener("click", async () => {
    if (enCours) return;
    const modifiees = suivies.filter((s) => etatLigne(s) !== s.origine);
    if (!modifiees.length) { m.className = "enr-m"; m.textContent = "Aucune modification à enregistrer."; return; }
    enCours = true;
    b.setAttribute("aria-disabled", "true");
    m.className = "enr-m";
    m.textContent = "Enregistrement…";
    const echecs = [];
    for (const s of modifiees) {
      const corps = { id: s.l.id, courriel: s.inter.checked, jours: Object.keys(s.casesJ).filter((j) => s.casesJ[j].checked) };
      const { statut, donnees: rep } = await appeler("POST", "/api/parametres", corps);
      if (statut === 401) { enCours = false; return sessionPerdue(); }
      if (statut === 200 && rep && rep.ok) {
        if (rep.ligne && typeof rep.ligne === "object") {
          s.inter.checked = !!rep.ligne.courriel;
          for (const j of Object.keys(s.casesJ)) {
            s.casesJ[j].checked = s.inter.checked && Array.isArray(rep.ligne.jours) && rep.ligne.jours.includes(j);
            s.casesJ[j].disabled = !s.inter.checked;
          }
        }
        s.origine = etatLigne(s);
      } else {
        echecs.push(`${s.l.nom} (${statut === 403 ? "accès refusé" : statut === 400 ? "demande refusée" : "service indisponible"})`);
      }
    }
    enCours = false;
    b.removeAttribute("aria-disabled");
    if (echecs.length) {
      m.className = "enr-m erreur";
      m.textContent = `Non enregistré pour : ${echecs.join(", ")}. Réessayez dans quelques minutes.`
        + (echecs.length < modifiees.length ? ` Le reste est enregistré.` : "");
    } else {
      m.className = "enr-m";
      m.textContent = `Enregistré : ${pluriel(modifiees.length, "ligne mise à jour", "lignes mises à jour")}.`;
    }
  });
  enr.append(b, m);
  return [el("h1", null, "Paramètres"),
    el("p", "sous-titre", "Définissez ici les jours où vous souhaitez recevoir les rapports par courriel."), carte, enr];
}

function etatLigne(s) {
  return JSON.stringify([s.inter.checked, Object.entries(s.casesJ).filter(([, c]) => c.checked).map(([j]) => j)]);
}

// ------------------------------------------------------------------ aide

async function vueAide() {
  const t = $("tpl-aide").content.cloneNode(true);
  return [...t.childNodes];
}

const VUES = { accueil: vueAccueil, rapports: vueRapports, automatisations: vueAutomatisations, parametres: vueParametres, aide: vueAide };

demarrer();
