// Le portail des rapports : ce que toutes les pages partagent, sur le modele du `config.js`
// de l'app web KCP. Chargee en premier par chaque page ; chaque page a ensuite son script.
// La page ne decide de rien : l'API refuse, la page affiche. L'adresse de l'API est
// publique ; aucun secret ne vit ici. La session est un cookie HttpOnly pose par l'API.
// Ecriture dans la page : textContent et createElement ; innerHTML seulement pour les
// icones, balisage constant ecrit ici.
"use strict";

// En local, page et API sur `localhost` : meme site, donc le cookie strict passe.
const HOTE = location.hostname;
const API = (HOTE === "localhost" || HOTE === "127.0.0.1" || HOTE === "")
  ? "http://localhost:8790"
  : "https://api-" + HOTE;   // portail-cdp.88systems.io -> api-portail-cdp.88systems.io
const DELAI = 15000;
const CONTACT = "acurgy-ext@compagniedephalsbourg.com";
// Trois etats (Antoine, 2026-10-05) ; « a_valider » est ramene a « ok » a la lecture.
const ETATS = { ok: ["fonctionnel", "t-vert"], interrompu: ["interrompu", "t-rouge"], construction: ["en construction", "t-ferme"],
                illisible: ["illisible", "t-rouge"] };
const STATUTS = { ok: "Fonctionnelle", panne: "Interrompue", construction: "En construction" };
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

// L'etat montre d'un rapport : « en construction » si son automatisation l'est (le Statut pose
// par Antoine fait autorite, 2026-10-08), sinon l'etat mesure de son dernier passage.
function etatAffiche(r) { return r.construction ? "construction" : r.etat; }

// "2026-10-07T07:02:51+00:00" -> "09:02" (heure de Paris)
// Le mot d'un dernier passage : « échec », « écarts », « alerte », sinon « abouti » (« ok », « à voir »).
function motPassage(resultat) {
  return resultat === "échec" || resultat === "écarts" || resultat === "alerte" ? resultat : "abouti";
}

function heureDe(iso) {
  const p = parties(iso);
  return p ? `${p.hour}:${p.minute}` : "";
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

// Une lecture : 401 = session perdue, tout autre echec est dit, une reponse de forme
// inattendue est un echec (jamais une page vide).
async function lire(source) {
  const { statut, donnees } = await appeler("GET", source.chemin);
  if (statut === 401) throw new SessionPerdue();
  if (statut !== 200 || !donnees || !source.verifier(donnees)) {
    throw new Error(statut === 503 ? "Une source du portail est momentanément indisponible. Réessayez dans quelques minutes." : PANNE_SERVICE);
  }
  return source.normaliser ? source.normaliser(donnees) : donnees;
}

const SOURCES = {
  moi: { chemin: "/api/moi", verifier: (d) => typeof d.adresse === "string" && d.adresse !== "" },
  autos: { chemin: "/api/automatisations", verifier: (d) => Array.isArray(d.automatisations) },
  // Un « a_valider » residuel (courriels d'avant le 2026-10-05) se lit « ok » : affiche, filtre et compte pareil.
  rapports: { chemin: "/api/rapports", verifier: (d) => Array.isArray(d.rapports),
              normaliser: (d) => { for (const r of d.rapports) if (r && r.etat === "a_valider") r.etat = "ok"; return d; } },
  parametres: { chemin: "/api/parametres", verifier: (d) => Array.isArray(d.lignes) },
};

// ------------------------------------------------------------------ le cache (comme l'app KCP)
// Afficher tout de suite ce qu'on a deja, puis revalider en reseau, et redessiner
// seulement si la reponse a change. Une cle par adresse connectee ; tout est efface a la
// deconnexion et a la perte de session. Le resume et le classeur ne sont jamais gardes.
// Le stockage peut manquer (navigation privee, site bloque) : tout marche sans lui.

const PREFIXE = "portail:";

function relire(cle) {
  try { return JSON.parse(localStorage.getItem(PREFIXE + cle) || "null"); } catch (_) { return null; }
}

function stocker(cle, valeur) {
  try { localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur)); } catch (_) { /* stockage plein ou refuse */ }
}

function oublier(cle) {
  try { localStorage.removeItem(PREFIXE + cle); } catch (_) { /* stockage refuse */ }
}

function viderCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIXE)) localStorage.removeItem(k);
  } catch (_) { /* stockage refuse */ }
}

let moi = null;

function cleDe(source) { return (moi ? moi.adresse : "?") + ":" + source.chemin; }

// `rendre(donnees, premier)` recoit une valeur par source, dans l'ordre. Elle est appelee
// une fois avec le cache s'il est complet, puis une fois avec le frais s'il differe.
async function suivre(sources, rendre) {
  const caches = sources.map((s) => relire(cleDe(s)));
  const complet = caches.every((c) => c !== null);
  if (complet) rendre(caches, true);
  let frais;
  try {
    frais = await Promise.all(sources.map(lire));
  } catch (err) {
    if (err instanceof SessionPerdue) return sessionPerdue();
    if (!complet) throw err;
    horsLigne();   // le cache reste affiche, et la page le dit
    return;
  }
  sources.forEach((s, i) => stocker(cleDe(s), frais[i]));
  if (!complet || JSON.stringify(frais) !== JSON.stringify(caches)) rendre(frais, !complet);
}

function horsLigne() {
  const m = $("maj");
  if (m && !m.textContent.includes("hors ligne")) m.textContent += " · hors ligne";
}

// ------------------------------------------------------------------ session et chrome

const PAGES = ["index.html", "rapports.html", "automatisations.html", "agents.html", "parametres.html", "aide.html"];

function pageCourante() {
  const p = location.pathname.split("/").pop() || "index.html";
  return PAGES.includes(p) ? p : "index.html";
}

// Retour a la connexion ; `retour` ne peut nommer qu'une page du portail.
function versConnexion(motif) {
  const q = new URLSearchParams({ retour: pageCourante() + location.search });
  if (motif) q.set("motif", motif);
  location.replace("connexion.html?" + q.toString());
}

function sessionPerdue() {
  viderCache();
  versConnexion("perdue");
}

function majBandeau(iso) {
  if (iso) $("maj").textContent = "Mis à jour " + majLisible(iso);
}

function poserMoi() {
  const adresse = String(moi.adresse);
  const initiales = moi.initiales ? String(moi.initiales) : adresse.slice(0, 2).toUpperCase();
  const avatar = $("avatar");
  avatar.textContent = initiales;
  avatar.title = moi.nom ? moi.nom + " · " + adresse : adresse;
  avatar.setAttribute("aria-label", "Connecté : " + (moi.nom || adresse));
  if (!$("maj").textContent) majBandeau(moi.maj);
}

// L'adresse connectee, du cache si on l'a (la page s'affiche tout de suite), revalidee en
// reseau dans tous les cas. Un autre compte que celui du cache vide tout et recharge.
// Rend false quand la page part vers la connexion : elle ne doit plus rien charger.
async function session() {
  const garde = relire("moi");
  const enReseau = lire(SOURCES.moi).then((d) => {
    if (garde && garde.adresse !== d.adresse) { viderCache(); location.reload(); return null; }
    stocker("moi", d);
    moi = d;
    poserMoi();
    return d;
  });
  if (garde && garde.adresse) {
    moi = garde;
    poserMoi();
    enReseau.catch((err) => { if (err instanceof SessionPerdue) sessionPerdue(); });
    return true;
  }
  try {
    return (await enReseau) !== null;
  } catch (err) {
    if (err instanceof SessionPerdue) { versConnexion(""); return false; }
    throw err;
  }
}

if ($("deconnexion")) {
  $("deconnexion").addEventListener("click", async () => {
    viderCache();
    await appeler("POST", "/api/deconnexion", {});
    location.replace("connexion.html?motif=fin");
  });
}

// Le contenu de la page. Au premier rendu : titre de l'onglet et focus sur le titre ;
// aux suivants (donnees revalidees), on remplace sans voler le focus ni le defilement.
function poser(noeuds, premier) {
  const zone = $("contenu");
  zone.replaceChildren(...noeuds);
  if (premier) {
    const h1 = zone.querySelector("h1");
    if (h1) { h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  }
}

function montrerErreur(err) {
  const p = el("p", "erreur", (err && err.message) || PANNE_SERVICE);
  p.setAttribute("role", "alert");
  $("contenu").replaceChildren(el("h1", null, document.title.split(" · ")[0]), p);
}

// Le demarrage de chaque page protegee : la session, puis `charger()`, qui affiche.
async function demarrer(charger) {
  try {
    if (!(await session())) return;
    if (charger) await charger();
  } catch (err) {
    if (err instanceof SessionPerdue) return sessionPerdue();
    montrerErreur(err);
  }
}

// ------------------------------------------------------------------ panneau de droite

let panneauMode = null;
let declencheur = null;
let auFermer = null;   // une page peut reagir a la fermeture (la fiche retire ?id de l'adresse)

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
  if (!p || p.hidden) return;
  p.hidden = true;
  $("panneau-corps").replaceChildren();
  const mode = panneauMode;
  panneauMode = null;
  if (auFermer) auFermer(mode);
  if (rendreFocus && declencheur && document.contains(declencheur)) declencheur.focus();
  declencheur = null;
}

if ($("panneau")) {
  $("panneau-fermer").addEventListener("click", () => fermerPanneau());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerPanneau(); });
  document.addEventListener("click", (e) => {
    const p = $("panneau");
    if (p.hidden || p.contains(e.target)) return;
    if (e.target.closest && e.target.closest("[data-ouvre-panneau]")) return;
    fermerPanneau(false);
  });
}

// ------------------------------------------------------------------ calculs partages

function compter(autos) {
  const n = { ok: 0, panne: 0, construction: 0 };
  for (const a of autos) n[a.statut in n ? a.statut : "panne"] += 1;   // un statut inconnu compte comme panne, jamais omis
  return n;
}

function statutDe(a) { return a.statut in STATUTS ? a.statut : "panne"; }

function statutSysteme(autos) {
  if (autos.some((a) => statutDe(a) === "panne")) return "panne";
  if (autos.some((a) => statutDe(a) === "ok")) return "ok";
  return "construction";
}

// « actives » : celles qui ne sont pas en construction, comme dans la maquette v14
function actives(liste) {
  const k = liste.filter((a) => statutDe(a) !== "construction").length;
  return k + " " + (k > 1 ? "actives" : "active") + " sur " + liste.length;
}

function phraseEtat(n) {
  return `${n.ok} fonctionnelle${n.ok > 1 ? "s" : ""}, ${n.panne} interrompue${n.panne > 1 ? "s" : ""}, ${n.construction} en construction`;
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

function carres(passages) {
  const h = el("span", "histo");
  for (const p of passages) {
    // rouge : « échec », et « alerte », pour que le rate signale se voie (2026-10-09) ; vert : le reste
    const classe = p.resultat === "échec" || p.resultat === "alerte" ? "panne" : "ok";
    const c = el("span", "h " + classe);
    const mot = motPassage(p.resultat);
    c.title = `${jourCourt(p.date)} · ${mot}`;
    c.append(el("span", "sr", `${jourCourt(p.date)} : ${mot}`));
    h.append(c);
  }
  return h;
}

// ------------------------------------------------------------------ les anciennes adresses
// Jusqu'au 2026-10-06, le portail tenait en une page a ancres (#rapports,
// #automatisations/AUT_CDP_19?sys=Even, #aide/etat). Un favori ancien mene a la bonne page.
(function anciennesAncres() {
  if (pageCourante() !== "index.html" || !/^#(accueil|rapports|automatisations|parametres|aide)\b/.test(location.hash)) return;
  let h = location.hash.slice(1);
  try { h = decodeURIComponent(h); } catch (_) { /* prise telle quelle */ }
  const [chemin, requete = ""] = h.split("?");
  const [page, sous = ""] = chemin.split("/");
  const q = new URLSearchParams(requete);
  if (page === "automatisations" && sous) q.set("id", sous);
  const cible = page === "accueil" ? "index.html" : page + ".html";
  const suite = q.toString() ? "?" + q.toString() : "";
  location.replace(cible + suite + (page === "aide" && sous ? "#" + sous : ""));
})();
