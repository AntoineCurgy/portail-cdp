// Le portail des rapports : ce que toutes les pages partagent, sur le modele du `config.js`
// de l'app web KCP. Chargee en premier par chaque page ; chaque page a ensuite son script.
// La page ne decide de rien : l'API refuse, la page affiche. L'adresse de l'API est
// publique ; aucun secret ne vit ici. La session est un cookie HttpOnly pose par l'API.
// Ecriture dans la page : textContent et createElement ; innerHTML seulement pour les
// icones, balisage constant ecrit ici.
"use strict";

// En local, page et API sur `localhost` : meme site, donc le cookie strict passe. Ailleurs, l'adresse
// de l'API vient de la fiche du client (`clients/<client>.json`, « api ») : la page ne la deduit plus de
// son adresse, pour pouvoir etre servie en chemin sous 88systems.io (/cdp, /te, /demo ; DEC_00166).
const HOTE = location.hostname;
const API = (HOTE === "localhost" || HOTE === "127.0.0.1" || HOTE === "")
  ? "http://localhost:8790"
  : "https://api-portail-cdp.88systems.io";
const DELAI = 15000;
const CONTACT = "acurgy-ext@compagniedephalsbourg.com";
// Trois etats (Antoine, 2026-10-05) ; « a_valider » est ramene a « ok » a la lecture.
// Le mot avec sa majuscule, en police du texte apres un point de couleur (Antoine, 2026-11-04, DEC_00520, option 8C).
const ETATS = { ok: ["Fonctionnel", "t-vert"], interrompu: ["Interrompu", "t-rouge"], construction: ["En construction", "t-ferme"],
                illisible: ["Illisible", "t-rouge"] };
const STATUTS = { ok: "Fonctionnelle", panne: "Interrompue", construction: "En construction" };
// Une automatisation « Figée » ne tourne plus : ce texte remplace sa date (Antoine, 2026-10-22).
const FIGE = "Historique figé";
const TEST = "base de test";   // « En service sur base de test » (Antoine, 2026-11-12, choix A a PCP001-1112-j)
const RODAGE = "en rodage";   // « En rodage » : servie, sans destinataire (DEC_00937 de PCP059, RGI_01733)
const PANNE_SERVICE = "Le service ne répond pas pour l'instant. Réessayez dans quelques minutes.";

// le jeu unique d'icones, lu a la publication dans portail/charte/icones/ (DEC_00842) ; la source fait foi
const ICONES = {
  "a-traiter": "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\"/><path d=\"M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\"/>",
  "accueil": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/>",
  "agents": "<rect x=\"4\" y=\"7\" width=\"16\" height=\"12\" rx=\"3\"/><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"7\"/><circle cx=\"9\" cy=\"13\" r=\"1\"/><circle cx=\"15\" cy=\"13\" r=\"1\"/>",
  "aide": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>",
  "attention": "<path d=\"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z\"/><line x1=\"12\" y1=\"9\" x2=\"12\" y2=\"13\"/><line x1=\"12\" y1=\"17\" x2=\"12.01\" y2=\"17\"/>",
  "bulle": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/>",
  "cadenas": "<rect x=\"3\" y=\"11\" width=\"18\" height=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
  "calendrier": "<rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/><line x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/>",
  "carte": "<polygon points=\"1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6\"/><line x1=\"8\" y1=\"2\" x2=\"8\" y2=\"18\"/><line x1=\"16\" y1=\"6\" x2=\"16\" y2=\"22\"/>",
  "chevron": "<g class=\"net\" stroke-width=\"1.5\"><polyline points=\"9 18 15 12 9 6\"/></g>",
  "deconnexion": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"/><polyline points=\"16 17 21 12 16 7\"/><line x1=\"21\" y1=\"12\" x2=\"9\" y2=\"12\"/>",
  "defaut": "<path d=\"M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z\"/><line x1=\"4\" y1=\"22\" x2=\"4\" y2=\"15\"/>",
  "deposer": "<line x1=\"12\" y1=\"5\" x2=\"12\" y2=\"19\"/><line x1=\"5\" y1=\"12\" x2=\"19\" y2=\"12\"/>",
  "doutes": "<path d=\"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z\"/><path d=\"M9.6 7.6a2.5 2.5 0 0 1 4.8 1c0 1.6-2.4 2.2-2.4 2.2\"/><line x1=\"12\" y1=\"14\" x2=\"12.01\" y2=\"14\"/>",
  "envois": "<path d=\"M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z\"/><polyline points=\"22 6 12 13 2 6\"/>",
  "erreur": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><line x1=\"15\" y1=\"9\" x2=\"9\" y2=\"15\"/><line x1=\"9\" y1=\"9\" x2=\"15\" y2=\"15\"/>",
  "externe": "<path d=\"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/><polyline points=\"15 3 21 3 21 9\"/><line x1=\"10\" y1=\"14\" x2=\"21\" y2=\"3\"/>",
  "fermer": "<line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/>",
  "journaux": "<polyline points=\"22 12 18 12 15 21 9 3 6 12 2 12\"/>",
  "livre": "<path d=\"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z\"/><path d=\"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z\"/>",
  "machine": "<rect x=\"2\" y=\"2\" width=\"20\" height=\"8\" rx=\"2\" ry=\"2\"/><rect x=\"2\" y=\"14\" width=\"20\" height=\"8\" rx=\"2\" ry=\"2\"/><line x1=\"6\" y1=\"6\" x2=\"6.01\" y2=\"6\"/><line x1=\"6\" y1=\"18\" x2=\"6.01\" y2=\"18\"/>",
  "menu": "<line x1=\"3\" y1=\"6\" x2=\"21\" y2=\"6\"/><line x1=\"3\" y1=\"12\" x2=\"21\" y2=\"12\"/><line x1=\"3\" y1=\"18\" x2=\"21\" y2=\"18\"/>",
  "parametres": "<line x1=\"4\" y1=\"21\" x2=\"4\" y2=\"14\"/><line x1=\"4\" y1=\"10\" x2=\"4\" y2=\"3\"/><line x1=\"12\" y1=\"21\" x2=\"12\" y2=\"12\"/><line x1=\"12\" y1=\"8\" x2=\"12\" y2=\"3\"/><line x1=\"20\" y1=\"21\" x2=\"20\" y2=\"16\"/><line x1=\"20\" y1=\"12\" x2=\"20\" y2=\"3\"/><line x1=\"1\" y1=\"14\" x2=\"7\" y2=\"14\"/><line x1=\"9\" y1=\"8\" x2=\"15\" y2=\"8\"/><line x1=\"17\" y1=\"16\" x2=\"23\" y2=\"16\"/>",
  "piece-jointe": "<path d=\"M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48\"/>",
  "prospection": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
  "rafraichir": "<g class=\"net\" stroke-width=\"1.5\"><polyline points=\"23 4 23 10 17 10\"/><polyline points=\"1 20 1 14 7 14\"/><path d=\"M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15\"/></g>",
  "rapports": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"/><polyline points=\"14 2 14 8 20 8\"/><line x1=\"16\" y1=\"13\" x2=\"8\" y2=\"13\"/><line x1=\"16\" y1=\"17\" x2=\"8\" y2=\"17\"/>",
  "regles": "<polyline points=\"9 11 12 14 22 4\"/><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/>",
  "sessions": "<polyline points=\"4 17 10 11 4 5\"/><line x1=\"12\" y1=\"19\" x2=\"20\" y2=\"19\"/>",
  "succes": "<path d=\"M22 11.08V12a10 10 0 1 1-5.93-9.14\"/><polyline points=\"22 4 12 14.01 9 11.01\"/>",
  "telecharger": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"/><polyline points=\"7 10 12 15 17 10\"/><line x1=\"12\" y1=\"15\" x2=\"12\" y2=\"3\"/>",
};

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ outils DOM

// Les colonnes au contenu (DEC_00853, choix 2A) : la colonne `reste` (comptee de 1) prend la place qui reste ; un texte
// long s'y tronque (`tronquer`). Les largeurs du colgroup cedent ; la regle vit dans portail.css (.gd.cc).
function colonnesAuContenu(table, reste, tronquer) {
  table.classList.add("cc", "cc-r" + reste);
  if (tronquer) table.classList.add("cc-tronque");
}

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

// la colonne d'action a gauche du nom, de la meme largeur dans Rapports et Automatisations : la fleche de
// rafraichissement, ou le cadenas d'une ligne restreinte, ou rien (Antoine, 2026-11-11, DEC_00835, choix 1A)
function colonneAction(contenu) {
  const s = el("span", "rf-col");
  if (contenu) s.append(contenu);
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

// Une ligne de rapport ne se montre que si elle porte un bouton « Télécharger », grisé ou non
// (Antoine, 2026-10-30 : « si ya pas de bouton télécharger, ya pas de ligne ») : une interface et
// un rapport d'une automatisation en construction n'en ont pas, ils sortent de l'onglet et des comptes.
// Un rapport en accès restreint garde sa ligne (son bouton « Accès restreint »).
function rapportMontre(r) { return !r.acces || !(r.livrable === "interface" || r.construction); }

// "2026-10-07T07:02:51+00:00" -> "09:02" (heure de Paris)
// Le mot d'un dernier passage : « échec », « écarts », « alerte », sinon « abouti » (« ok », « à voir »).
function motPassage(resultat) {
  return resultat === "échec" || resultat === "écarts" || resultat === "alerte" || resultat === TEST ? resultat : "abouti";
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
  return p ? `${p.day}/${p.month} à ${p.hour}:${p.minute}` : (iso || "");   // la forme des listes, « 10/11 à 09:00 » (DEC_00835, DEC_00853)
}

// la date du jour de `maj`, a Paris, en AAAA-MM-JJ
function jourDe(iso) {
  const p = parties(iso);
  return p ? `${p.year}-${p.month}-${p.day}` : "";
}

// ------------------------------------------------------------------ appels a l'API

class SessionPerdue extends Error {}

async function appeler(methode, chemin, corps, format = "json", delai = DELAI) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), delai);   // un envoi de pieces jointes attend plus longtemps
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
  cartographie: { chemin: "/api/cartographie", verifier: (d) => typeof d.publiee === "boolean" },
  // les agents d'IA publies pour le client (DEC_00892) ; « source: absente » tant que rien n'est publie
  agents: { chemin: "/api/agents", verifier: (d) => Array.isArray(d.agents) && typeof d.source === "string" },
};

// ---------------------------------------------------------------- les agents d'IA (DEC_00892, maquettes 1A et 2A)
const ETAPES_AG = ["Imaginé", "Essai", "Recette", "En service", "Arrêté"];   // 4 : arrete (PCP001-1112-y)
function etapeAg(a) { return ETAPES_AG[a.etape] || ETAPES_AG[0]; }
function bancAg(a) { return `${a.banc.reussis} sur ${a.banc.cas}`; }
function pctBanc(a) { return a.banc.cas ? Math.round(a.banc.reussis / a.banc.cas * 100) : 0; }
function statutAg(a) { return a.etape === 3 ? "ok" : "construction"; }
function tagEtape(a) { return el("span", "tag " + (a.etape === 3 ? "t-vert" : "t-ferme"), etapeAg(a)); }
function jaugeBanc(a) {
  const j = el("span", "agb");
  j.setAttribute("aria-hidden", "true");
  const p = el("span");
  p.style.setProperty("--p", String(pctBanc(a)));
  j.append(p);
  return j;
}

// ------------------------------------------------------------------ le cache (comme l'app KCP)
// Afficher tout de suite ce qu'on a deja, puis revalider en reseau, et redessiner
// seulement si la reponse a change. Une cle par adresse connectee ; tout est efface a la
// deconnexion et a la perte de session. Le resume et le classeur ne sont jamais gardes.
// Le stockage peut manquer (navigation privee, site bloque) : tout marche sans lui.

const PREFIXE = "portail:cdp:";   // un cache par client : servis en chemins, les portails partagent une origine (DEC_00166)

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

// la cle du cache d'une source : son chemin, ou sa propre cle quand une page ne garde qu'une partie de la reponse
function cleDe(source) { return (moi ? moi.adresse : "?") + ":" + (source.cle || source.chemin); }

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

const PAGES = ["index.html", "rapports.html", "automatisations.html", "agents.html", "cartographie.html", "parametres.html", "retours.html", "envois.html", "journaux.html", "aide.html"];

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
  // l'onglet « Retours » n'existe que si le service lit la liste des retours (DEC_00506) ; il remplace alors les bulles ;
  // l'onglet « Emails » n'existe que pour l'administrateur du portail (DEC_00598, DEC_00606). Les deux se montrent par
  // une classe de <html>, posee des le <head> depuis le cache (le script en ligne de chaque page) : le rail ne
  // clignote plus a chaque page, le temps que ce script tourne (audit du 2026-11-11, « ca flash un peu bizarrement »).
  ongletsDuRail(moi);
  document.body.classList.toggle("avec-retours", Boolean(moi.onglet_retours));
  // L'onglet « Agents » reste toujours visible, vide ou non (Antoine, 2026-10-31, PCP049-1031-c : « toujours
  // montrer Agents IA, Automatisations, Rapports et Cartographie », pour donner envie) ; il disparaissait quand
  // la feuille masquait chaque agent (2026-10-16).
}

function ongletsDuRail(m) {
  const c = document.documentElement.classList;
  c.toggle("sans-retours", !m.onglet_retours);
  c.toggle("sans-envois", !m.onglet_envois);
}

// Un onglet vide le dit, et dit ce qu'il pourrait porter (PCP049-1031-c, 2026-10-31).
function vueVide(titre, texte) {
  const c = el("div", "carte ca");
  c.append(el("p", "ca-t", titre), el("p", "discret", texte));
  const l = el("a", "lien-c", CONTACT);
  l.href = "mailto:" + CONTACT;
  const p = el("p", "discret", "Pour en savoir plus : ");
  p.append(l);
  c.append(p);
  return c;
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
// La tete figee d'une page (titre, filtres, recherche) : sa hauteur part dans --tete, que l'en-tete du
// tableau lit pour se figer juste dessous (Antoine, 2026-11-04 : « Tout figer jusqu'a : Rapport Systemes ... Date »).
let observeTete = null;
function figerTete(tete) {
  if (observeTete) observeTete.disconnect();
  const poserHauteur = () => document.documentElement.style.setProperty("--tete", tete.offsetHeight + "px");
  if (typeof ResizeObserver === "function") { observeTete = new ResizeObserver(poserHauteur); observeTete.observe(tete); }
  requestAnimationFrame(poserHauteur);
  return tete;
}

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

// ------------------------------------------------------------------ la fenetre de detail
// Au centre de l'ecran, sur un voile, a la place du panneau de droite (Antoine, 2026-11-04, DEC_00520,
// option 4A : tete claire, 760 px, pied de boutons). Le titre de la page (#panneau-titre) monte dans la
// tete, une rangee d'actions (.r-act) descend dans le pied, a cote de « Fermer ». Elle se ferme comme le
// panneau : la croix, « Fermer », un clic dehors (sur le voile), Echap ; la page derriere ne defile plus.

let panneauMode = null;
let declencheur = null;
let auFermer = null;   // une page peut reagir a la fermeture (la fiche retire ?id de l'adresse)

function ouvrirPanneau(mode, enfants, depuis) {
  const p = $("panneau");
  panneauMode = mode;
  declencheur = depuis || document.activeElement;
  p.classList.toggle("fen-mail", mode === "envoi");   // la fenetre d'un email, plus grande (2026-11-11)
  const titre = enfants.find((x) => x && x.id === "panneau-titre");
  const actions = enfants.filter((x) => x && x.classList && x.classList.contains("r-act"));
  $("panneau-tete").replaceChildren(...(titre ? [titre] : []));
  $("panneau-corps").replaceChildren(...enfants.filter((x) => x !== titre && !actions.includes(x)));
  $("panneau-pied").replaceChildren(...actions, $("panneau-fermer-bas"));
  $("panneau-corps").scrollTop = 0;
  p.hidden = false;
  document.body.classList.add("fen-ouverte");
  $("panneau-fermer").focus();
}

function fermerPanneau(rendreFocus = true) {
  const p = $("panneau");
  if (!p || p.hidden) return;
  p.hidden = true;
  document.body.classList.remove("fen-ouverte");
  $("panneau-tete").replaceChildren();
  $("panneau-corps").replaceChildren();
  $("panneau-pied").replaceChildren($("panneau-fermer-bas"));
  const mode = panneauMode;
  panneauMode = null;
  if (auFermer) auFermer(mode);
  if (rendreFocus && declencheur && document.contains(declencheur)) declencheur.focus();
  declencheur = null;
}

if ($("panneau")) {
  $("panneau-fermer").addEventListener("click", () => fermerPanneau());
  $("panneau-fermer-bas").addEventListener("click", () => fermerPanneau());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") fermerPanneau(); });
  document.addEventListener("click", (e) => {
    const p = $("panneau");
    if (p.hidden || $("panneau-fen").contains(e.target)) return;
    if (e.target.closest && e.target.closest("[data-ouvre-panneau]")) return;
    fermerPanneau(false);
  });
}

// ------------------------------------------------------------------ la documentation d'une automatisation
// Partagee par les onglets Automatisations et Rapports : le meme bouton, la meme fenetre (Antoine, 2026-11-04 :
// « Remplacer Notice par Documentation dans l'onglet rapport / Et ce bouton Documentation fait exactement la meme
// chose que dans l'onglet automatisations »).
// Une fenetre, quatre pieces, un bandeau vert si la documentation suit la version en service,
// orange sinon ; le bouton reste grise tant qu'aucune piece n'est publiee (Antoine, 2026-10-22).
// Le script ne se telecharge plus (Antoine, 2026-10-30) ; pour le remettre :
// ["script", "Script", "texte"], et "script" dans api.PIECES_SERVIES.
const PIECES_DOC = [["documentation", "Documentation", "PDF"], ["classeur", "Dossier de l'automatisation", "Excel"],
  ["historique", "Historique des versions", "Excel"]];
const COULEUR_DOC = { vert: "var(--vert)", orange: "var(--ambre)" };
let fenetreDoc = null;

function dateLongue(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function ligneVersion(nom, v) {
  if (!v) return `${nom} : pas encore publiée`;
  const d = dateLongue(v.date);
  return `${nom} : version ${v.version}` + (d ? `, mise à jour le ${d}` : "");
}

function boutonDocumentation(a) {
  const d = a.documentation || {};
  const pieces = d.pieces || {};
  const dispo = PIECES_DOC.some(([k]) => pieces[k]) || a.notice === "publiee";
  const b = bouton("btn doc-b" + (dispo ? "" : " eteint"));
  const pt = el("span", "pt");
  pt.style.backgroundColor = dispo ? (COULEUR_DOC[d.etat] || "var(--pale)") : "var(--pale)";
  b.append(pt, "Documentation");
  if (!dispo) {
    b.setAttribute("aria-disabled", "true");
    b.title = "Pas encore disponible";
  }
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dispo) ouvrirDocumentation(a, b);
  });
  return b;
}

function fermerDocumentation() {
  if (!fenetreDoc) return;
  const { voile, depuis } = fenetreDoc;
  fenetreDoc = null;
  voile.remove();
  if (depuis && document.contains(depuis)) depuis.focus();
}

function ouvrirDocumentation(a, depuis) {
  fermerDocumentation();
  const d = a.documentation || {};
  const pieces = d.pieces || {};
  const voile = el("div", "doc-voile");
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-labelledby", "doc-titre");
  const fen = el("div", "doc-fen");
  const x = bouton("doc-x", "×");
  x.setAttribute("aria-label", "Fermer");
  x.addEventListener("click", fermerDocumentation);
  const titre = el("h2", null, "Documentation");
  titre.id = "doc-titre";
  const bandeau = el("p", "doc-bandeau" + (d.etat ? " " + d.etat : ""));
  bandeau.append(ligneVersion("Automatisation", d.en_service), el("br"), ligneVersion("Documentation", d.documentee));
  const liste = el("ul", "doc-l");
  for (const [cle, nom, format] of PIECES_DOC) {
    const li = el("li");
    const n = el("span", null, nom);
    n.append(el("span", "f", " · " + format));
    li.append(n);
    if (pieces[cle]) {
      const lien = el("a", "btn", "Télécharger");
      lien.href = API + "/api/automatisations/" + encodeURIComponent(a.id) + "/documentation/" + cle;
      lien.setAttribute("aria-label", "Télécharger " + nom);
      if (cle === "documentation") { lien.target = "_blank"; lien.rel = "noopener"; }
      li.append(lien);
    } else {
      li.append(el("span", "absent", "pas encore disponible"));
    }
    liste.append(li);
  }
  // La notice, quatrieme document (Antoine, 2026-10-30) : une page, dans un nouvel onglet, comme
  // dans l'onglet Rapports ; elle ne s'ouvre qu'a qui a le droit sur l'automatisation.
  if (a.notice) {
    const li = el("li");
    const n = el("span", null, "Détails");   // « "Notice" devient "Détails" » (Antoine, 2026-11-10)
    n.append(el("span", "f", " · page"));
    li.append(n);
    if (a.notice === "publiee") {
      const lien = el("a", "btn", "Ouvrir");
      lien.href = API + "/api/automatisations/" + encodeURIComponent(a.id) + "/notice";
      lien.target = "_blank";
      lien.rel = "noopener";
      lien.setAttribute("aria-label", "Ouvrir les détails (nouvel onglet)");
      li.append(lien);
    } else {
      li.append(el("span", "absent", a.notice === "restreinte" ? "réservée aux destinataires du rapport" : "pas encore disponible"));
    }
    liste.append(li);
  }
  fen.append(x, titre, bandeau, liste);
  voile.append(fen);
  // un clic dans la fenetre ne ferme pas le panneau ; un clic sur le voile ferme la fenetre seule
  voile.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!fen.contains(e.target)) fermerDocumentation();
  });
  document.body.append(voile);
  fenetreDoc = { voile, depuis };
  x.focus();
}

// Echap ferme d'abord la fenetre, et seulement elle
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fenetreDoc) {
    e.stopImmediatePropagation();
    fermerDocumentation();
  }
}, true);

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
// #automatisations/AUT_0019?sys=Even, #aide/etat). Un favori ancien mene a la bonne page.
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

// ------------------------------------------------------------------ faire une demande
// Une demande, un retour ou une correction sur une automatisation ou l'un de ses rapports (DEC_00165,
// Antoine, 2026-10-31) : l'API la depose en note chez la cellule qui porte l'automatisation.
// ------------------------------------------------------------------ rafraichir une ligne
// Le bouton « Rafraichir » d'une ligne, dans Rapports (DEC_00379 de PCP001, 2026-11-02) et dans Automatisations
// (Antoine, 2026-11-10, PCP049-1110-p : « bouton rafraichir sur ligne onglet rapport ET automatisation ») ; les deux
// deposent la meme demande, celle de l'automatisation. `cible.rafraichir` porte l'etat que l'API rend.

const EN_COURS_RAF = ["en_file", "en_cours"];

// L'etat d'un rafraichissement, sous la date : en file ou en cours le temps qu'il tourne ; refuse ou en echec,
// son motif tel que le lanceur l'ecrit ; fait, rien (la date dit le nouveau passage).
function montrerRafraichissement(cible, nom, date, avis, relire) {
  const e = cible.rafraichir && cible.rafraichir.etat;
  const textes = { en_file: "Rafraîchissement demandé…", en_cours: "Rafraîchissement en cours…",
                   refuse: "Non rafraîchi", echec: "Rafraîchissement en échec" };
  if (!textes[e]) return;
  // RGI_01887 : un recalcul a une date d'arrete choisie dit sa date
  const au = cible.rafraichir.arrete ? " (au " + dateLongue(cible.rafraichir.arrete) + ")" : "";
  const p = el("span", "rf-e" + (EN_COURS_RAF.includes(e) ? "" : " rf-k"), textes[e] + au);
  // le motif d'un refus ou d'un echec, tel que le lanceur l'ecrit : a la demande, comme le resume
  if (cible.rafraichir.motif && !EN_COURS_RAF.includes(e)) {
    const v = bouton("lien-r rf-v", "voir pourquoi");
    v.setAttribute("aria-label", "Pourquoi « " + nom + " » n'a pas été rafraîchi");
    v.addEventListener("click", (ev) => { ev.stopPropagation(); avis.textContent = `« ${nom} » : ${cible.rafraichir.motif}`; });
    p.append(" · ", v);
  }
  date.append(p);
  if (EN_COURS_RAF.includes(e)) relire();
}

function boutonRafraichir(cible, nom, chemin, date, avis, relire, titre) {
  const b = bouton("dm-b rf-b");
  b.prepend(ico("rafraichir", 15));
  b.title = titre;
  b.setAttribute("aria-label", "Rafraîchir " + nom);
  const occupe = () => EN_COURS_RAF.includes(cible.rafraichir && cible.rafraichir.etat);
  if (occupe()) b.setAttribute("aria-disabled", "true");
  b.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (occupe()) { avis.textContent = `« ${nom} » est déjà en cours de rafraîchissement.`; return; }
    b.setAttribute("aria-disabled", "true");
    const { statut, donnees } = await appeler("POST", chemin);
    if (statut === 401) return sessionPerdue();
    if (statut !== 200 || !donnees) {
      b.removeAttribute("aria-disabled");
      avis.textContent = `« ${nom} » ne peut pas être rafraîchi : ${(donnees && donnees.erreur) || "service indisponible"}.`;
      return;
    }
    cible.rafraichir = donnees;
    for (const s of date.querySelectorAll(".rf-e")) s.remove();
    montrerRafraichissement(cible, nom, date, avis, relire);
    avis.textContent = `« ${nom} » sera rafraîchi dans la minute ; la ligne se met à jour seule.`;
  });
  return b;
}

// ------------------------------------------------------------------ recalculer a une date d'arrete
// RGI_01887 (Antoine, 2026-11-18, PCP074-1118-b : « date au choix au portail, second classeur ») : sur la ligne d'un
// rapport que l'index marque, une date d'arrete ; le classeur du matin ne change pas, un second classeur au nom
// constant est recalcule a cette date. La fenetre reprend celle d'une demande (memes classes, meme fermeture).

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre",
                    "novembre", "décembre"];

function dateLongue(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso || "");
  const j = Number(m[3]);
  return (j === 1 ? "1er" : j) + " " + MOIS_LONGS[Number(m[2]) - 1] + " " + m[1];
}

function aujourdhuiParis() {
  // la date du jour a Paris, au format du champ (AAAA-MM-JJ) ; l'API refuse de toute facon une date future
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

function boutonArrete(cible, nom, chemin, date, avis, relire) {
  const b = bouton("dm-b rf-b");
  b.prepend(ico("calendrier", 15));
  b.title = "Recalculer à une date";
  b.setAttribute("aria-label", "Recalculer « " + nom + " » à une date");
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    if (EN_COURS_RAF.includes(cible.rafraichir && cible.rafraichir.etat)) {
      avis.textContent = `« ${nom} » est déjà en cours de rafraîchissement.`;
      return;
    }
    ouvrirArrete(cible, nom, chemin, date, avis, relire, b);
  });
  return b;
}

function ouvrirArrete(cible, nom, chemin, date, avis, relire, depuis) {
  fermerDemande();
  const voile = el("div", "doc-voile");
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-labelledby", "ar-titre");
  const fen = el("form", "doc-fen dm");
  fen.noValidate = true;
  const x = bouton("doc-x", "×");
  x.setAttribute("aria-label", "Fermer");
  x.addEventListener("click", fermerDemande);
  const titre = el("h2", null, "Recalculer à une date");
  titre.id = "ar-titre";
  const sur = el("p", "dm-sur", `Rapport « ${nom} »`);
  const explication = el("p", "dm-sur", "Le rapport du matin ne change pas. Un second classeur, « " + nom
    + " à date choisie », est recalculé à la date d'arrêté que vous choisissez ; il remplace celui demandé plus tôt dans la journée.");
  const champ = el("input", "champ");
  champ.type = "date";
  champ.id = "ar-date";
  champ.min = "2020-01-01";
  champ.max = aujourdhuiParis();
  champ.required = true;
  const lab = el("label", "dm-lab", "Date d'arrêté");
  lab.htmlFor = "ar-date";
  const pied = el("div", "dm-pied");
  const message = el("p", "message");
  message.setAttribute("aria-live", "polite");
  const envoyer = bouton("btn", "Recalculer");
  envoyer.type = "submit";
  pied.append(message, envoyer);
  fen.append(x, titre, sur, explication, lab, champ, pied);
  fen.addEventListener("submit", async (e) => {
    e.preventDefault();
    const jour = champ.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) {
      message.className = "message erreur";
      message.textContent = "Choisissez une date d'arrêté.";
      champ.focus();
      return;
    }
    if (jour > champ.max || jour < champ.min) {
      message.className = "message erreur";
      message.textContent = "Choisissez une date entre le 1er janvier 2020 et aujourd'hui.";
      champ.focus();
      return;
    }
    envoyer.disabled = true;
    message.className = "message";
    message.textContent = "Envoi…";
    const r = await appeler("POST", chemin, { arrete: jour });
    if (r.statut === 401) return sessionPerdue();
    if (r.statut !== 200 || !r.donnees) {
      envoyer.disabled = false;
      message.className = "message erreur";
      message.textContent = (r.donnees && r.donnees.erreur) ? `Recalcul impossible : ${r.donnees.erreur}.`
        : "Recalcul impossible pour l'instant. Réessayez dans quelques minutes.";
      return;
    }
    cible.rafraichir = r.donnees;
    for (const s of date.querySelectorAll(".rf-e")) s.remove();
    montrerRafraichissement(cible, nom, date, avis, relire);
    fen.replaceChildren(x, titre, sur, el("p", "dm-ok", `Le recalcul au ${dateLongue(jour)} est demandé. `
      + `Le classeur « ${nom} à date choisie » apparaît dans la liste dans quelques minutes.`));
    x.focus();
  });
  voile.append(fen);
  voile.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!fen.contains(e.target)) fermerDemande();
  });
  document.body.append(voile);
  fenetreDemande = { voile, depuis };
  champ.focus();
}

const NATURES_DEMANDE = [["demande", "Une demande"], ["retour", "Un retour"], ["correction", "Une correction"]];
const TEXTE_DEMANDE_MAX = 4000;
let fenetreDemande = null;

function fermerDemande() {
  if (!fenetreDemande) return;
  const { voile, depuis } = fenetreDemande;
  fenetreDemande = null;
  voile.remove();
  if (depuis && document.contains(depuis)) depuis.focus();
}

function boutonDemande(cible, classe, texte) {
  const b = bouton(classe, texte);
  b.prepend(ico("bulle", 15));
  b.setAttribute("aria-label", "Faire une demande sur " + (cible.rapport || cible.nom));
  b.title = "Faire une demande";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    ouvrirDemande(cible, b);
  });
  return b;
}

function ouvrirDemande(cible, depuis) {
  fermerDemande();
  const voile = el("div", "doc-voile");
  voile.setAttribute("role", "dialog");
  voile.setAttribute("aria-modal", "true");
  voile.setAttribute("aria-labelledby", "dm-titre");
  const fen = el("form", "doc-fen dm");
  fen.noValidate = true;
  const x = bouton("doc-x", "×");
  x.setAttribute("aria-label", "Fermer");
  x.addEventListener("click", fermerDemande);
  const titre = el("h2", null, "Faire une demande");
  titre.id = "dm-titre";
  const sur = el("p", "dm-sur", cible.rapport ? `Rapport « ${cible.rapport} »` : `Automatisation « ${cible.nom} »`);
  const choix = el("div", "dm-n");
  choix.setAttribute("role", "radiogroup");
  choix.setAttribute("aria-label", "Nature");
  for (const [cle, mot] of NATURES_DEMANDE) {
    const l = el("label");
    const r = el("input");
    r.type = "radio";
    r.name = "nature";
    r.value = cle;
    r.checked = cle === "demande";
    l.append(r, mot);
    choix.append(l);
  }
  const zone = el("textarea", "dm-t");
  zone.rows = 6;
  zone.maxLength = TEXTE_DEMANDE_MAX;
  zone.placeholder = "Décrivez votre demande : ce que vous voyez, ce que vous attendez.";
  zone.setAttribute("aria-label", "Votre message");
  const pied = el("div", "dm-pied");
  const message = el("p", "message");
  message.setAttribute("aria-live", "polite");
  const envoyer = bouton("btn", "Envoyer");
  envoyer.type = "submit";
  pied.append(message, envoyer);
  zone.id = "dm-zone";
  const labZone = el("label", "dm-lab", "Votre message");   // un libelle au-dessus de chaque champ (DEC_00520, option 9B)
  labZone.htmlFor = "dm-zone";
  fen.append(x, titre, sur, el("p", "dm-lab", "Nature"), choix, labZone, zone, pied);
  fen.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texte = zone.value.trim();
    if (!texte) {
      message.className = "message erreur";
      message.textContent = "Écrivez votre message avant d'envoyer.";
      zone.focus();
      return;
    }
    envoyer.disabled = true;
    message.className = "message";
    message.textContent = "Envoi…";
    const nature = (fen.querySelector("input[name=nature]:checked") || {}).value || "demande";
    const r = await appeler("POST", "/api/demandes", { id: cible.id, rapport: cible.rapport || "", nature, texte });
    if (r.statut === 200) {
      fen.replaceChildren(x, titre, sur, el("p", "dm-ok", "Votre demande est transmise. L'équipe qui suit cette automatisation la traite."));
      x.focus();
      return;
    }
    envoyer.disabled = false;
    message.className = "message erreur";
    message.textContent = r.statut === 401 ? "Votre session a expiré : reconnectez-vous."
      : (r.donnees && r.donnees.erreur) ? `Envoi impossible : ${r.donnees.erreur}.`
      : "Envoi impossible pour l'instant. Réessayez dans quelques minutes.";
  });
  voile.append(fen);
  voile.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!fen.contains(e.target)) fermerDemande();
  });
  document.body.append(voile);
  fenetreDemande = { voile, depuis };
  zone.focus();
}

// Echap ferme d'abord la fenetre de demande, et seulement elle
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && fenetreDemande) {
    e.stopImmediatePropagation();
    fermerDemande();
  }
}, true);
