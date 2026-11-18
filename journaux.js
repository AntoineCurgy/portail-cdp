// L'onglet « Journaux » (Antoine, 2026-11-11, DEC_00817 : « je préfère A, mais visible par tous, filtré par gouvernance
// par accès aux automatisations / rapports bien sur ») : la forme A de la planche du 2026-11-10, le fil des passages des
// sept derniers jours groupe par jour, sur le modele de l'onglet Emails ; la barre segmentee et la recherche, le detail
// dans la fenetre centree. L'API ne rend que les automatisations ou « Gouvernance » donne un droit a la personne.
"use strict";

const SOURCE_JOURNAUX = { chemin: "/api/journaux", verifier: (d) => Array.isArray(d.passages) };
const RESULTAT = { ok: ["Réussi", "t-vert"], "écarts": ["Écarts trouvés", "t-ferme"], alerte: ["Alerte", "t-ambre"],
                   "à voir": ["À voir", "t-ambre"], "échec": ["Échec", "t-rouge"],
                   "base de test": ["Base de test", "t-ferme"] };
const GROUPES_JOURNAUX = [["", "Tous", () => true], ["echec", "Échecs", (p) => p.resultat === "échec"],
                          ["alerte", "Alertes", (p) => p.resultat === "alerte"], ["ecarts", "Écarts", (p) => p.resultat === "écarts"]];
const filtresJournaux = { g: "", q: "" };

const tagPassage = (r) => { const [mot, c] = RESULTAT[r] || [r, "t-ferme"]; return el("span", "tag " + c, mot); };
function jourLisibleJ(iso) {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const t = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const duree = (s) => {
  if (s === "" || s == null || Number.isNaN(Number(s))) return "—";
  const n = Math.round(Number(s));
  return n < 60 ? `${n} s` : `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, "0")}`;
};

// La fiche d'un passage, en recit (Antoine, 2026-11-11, DEC_00835, choix 4C, sur le modele d'une alerte de Sentry) : le
// resultat et sa date, puis la description a la ligne (« faut juste un petit "entrée" avant ») ; depuis quand ; la
// chronologie des sept jours ; les faits de l'automatisation, lus dans /api/automatisations. « Description », jamais
// « Ce qui s'est passé » (DEC_00832).
const COULEUR_FICHE = { "échec": "var(--rouge)", alerte: "var(--ambre)", "à voir": "var(--ambre)", ok: "var(--vert)" };
const STATUT_FICHE = { ok: "Fonctionnelle", panne: "Interrompue", construction: "En construction" };
let faitsAutos = null;   // les automatisations, lues une fois a la premiere fiche
async function faitsDe(id) {
  if (!faitsAutos) {
    const { statut, donnees } = await appeler("GET", "/api/automatisations");
    if (statut === 401) { sessionPerdue(); return {}; }
    faitsAutos = (statut === 200 && donnees && Array.isArray(donnees.automatisations)) ? donnees.automatisations : null;
  }
  return (faitsAutos || []).find((a) => a.id === id) || {};
}
const fluxLisibleJ = (f) => String(f || "").replace(/\s*<>\s*/g, " ↔ ").replace(/\s*>\s*/g, " → ");
function joursLisibles(j) {
  const l = String(j || "").split("-").filter(Boolean);
  if (l.length === 7) return "tous les jours";
  const n = { LU: "lundi", MA: "mardi", ME: "mercredi", JE: "jeudi", VE: "vendredi", SA: "samedi", DI: "dimanche" };
  return l.map((x) => n[x] || x).join(", ");
}
const heureJ = (p) => (p.heure || "").slice(0, 5);
function depuisLeJ(i) {
  const [j, h] = String(i.ouvert || "").split(" ");
  return `${jourLisibleJ(j).toLowerCase()} à ${(h || "").slice(0, 5)}`;
}

async function ouvrirPassage(p, d, depuis) {
  const a = await faitsDe(p.id);
  const hist = (d.passages || []).filter((x) => x.id === p.id);
  const inc = (d.incidents || []).filter((i) => i.id === p.id);
  // le titre porte le numero et le flux sur sa ligne ; aucune redite dans la fiche : le dernier passage est le premier
  // de la liste (Antoine, 2026-11-11 : « on arrête avec les redondance dans une meme fiche »)
  const titre = el("h2", "jx-titre");
  titre.id = "panneau-titre";
  titre.append(el("span", null, p.nom), el("span", "jx-ref", `${String(p.id).replace("AUT_", "")} · ${fluxLisibleJ(a.flux) || "—"}`));
  const dep = inc.length ? el("p", "jx-depuis", `Incident ouvert depuis le ${depuisLeJ(inc[0])} : ${inc[0].passages} passages au même résultat.`) : null;
  const ol = el("ol", "jx-ch");
  hist.forEach((x, n) => {
    const li = el("li");
    li.style.setProperty("--c", COULEUR_FICHE[x.resultat] || "var(--pale)");
    li.append(el("span", "jx-q", `${jourLisibleJ(x.date)} à ${heureJ(x)}`), " · ", tagPassage(x.resultat), " · ",
              el("span", "jx-m", duree(x.duree)), el("br"),
              el("span", "jx-m", n > 0 && x.detail === hist[n - 1].detail ? "même description que la veille" : (x.detail || "—")));
    ol.append(li);
  });
  const chrono = el("section", "jx-b jx-premier");
  chrono.append(ol);
  const faits = el("dl", "jx-dl");
  // un libelle nomme la chose, jamais par un pronom (« Ce qu'elle fait », « Son état » : refuses le 2026-11-11)
  for (const [mot, v] of [["Objectif", a.objectif || "—"], ["Fréquence", a.jours ? `${joursLisibles(a.jours)}, à ${a.heure || "—"}` : "—"],
                          ["État", STATUT_FICHE[a.statut] || "—"], ["Version du code", p.version || "—"], ["Machine", p.machine || "—"]])
    faits.append(el("dt", null, mot), el("dd", null, v));
  const auto = el("section", "jx-b");
  auto.append(el("h3", null, "L'automatisation"), faits);
  ouvrirPanneau("envoi", [titre, dep, chrono, auto].filter(Boolean), depuis);
  const voile = document.querySelector(".fen-voile");
  if (voile) voile.classList.add("fen-mail");   // la fenetre large des emails : la chronologie s'y lit
}

function vue(d) {
  const titre = el("h1", null, "Journal");
  const passages = d.passages;
  if (!passages.length) {
    const vide = el("div", "carte vide");
    vide.append(el("p", null, "Aucun passage de vos automatisations ces sept derniers jours."));
    const tete = el("div", "tete-fixe");
    tete.append(titre);
    return [figerTete(tete), vide];
  }
  const barre = el("div", "gb-barre");
  for (const [v, texte, garde] of GROUPES_JOURNAUX) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, passages.filter(garde).length));
    b.dataset.v = v;
    b.addEventListener("click", () => { filtresJournaux.g = v; filtrer(); });
    barre.append(b);
  }
  const lab = el("label", "cherche");
  lab.append(el("span", "sr", "Rechercher dans les journaux"));
  const champ = el("input");
  champ.type = "search";
  champ.placeholder = "Rechercher une automatisation, un message…";
  champ.value = filtresJournaux.q;
  champ.addEventListener("input", () => { filtresJournaux.q = champ.value.trim().toLowerCase(); filtrer(); });
  lab.append(champ);
  const outils = el("div", "outils ligne rt-outils");
  outils.append(barre, el("span", "rt-sp"), lab);   // la recherche a droite, comme les onglets Retours et Emails

  const carte = el("div", "carte gd-c");
  const table = el("table", "gd ev");
  const cg = el("colgroup");
  for (const w of ["6rem", "17rem", "10rem", "6rem", ""]) { const c = el("col"); if (w) c.style.width = w; cg.append(c); }
  const thead = el("thead");
  const tr = el("tr");
  for (const t of ["Heure", "Automatisation", "Résultat", "Durée", "Description"]) tr.append(el("th", null, t));
  thead.append(tr);
  table.append(cg, thead);
  colonnesAuContenu(table, 5, true);   // la description prend la place qui reste (DEC_00853)
  const groupes = [];
  for (const jour of [...new Set(passages.map((p) => p.date))]) {
    const du = passages.filter((p) => p.date === jour);
    const tb = el("tbody");
    const bande = el("tr", "gd-b");
    const th = el("th", null, jourLisibleJ(jour));
    th.colSpan = 5;
    const cpt = el("span", "g-cpt", du.length);
    th.append(" ", cpt);
    bande.append(th);
    tb.append(bande);
    const lignes = du.map((p) => {
      const l = el("tr", "rt-l");
      const r = el("td");
      r.append(tagPassage(p.resultat));
      const a = el("td", "rt-o");
      a.append(el("span", "mono discret", p.id.replace("AUT_", "") + " "), p.nom);
      const det = el("td", "discret", p.detail);
      det.style.whiteSpace = "nowrap"; det.style.overflow = "hidden"; det.style.textOverflow = "ellipsis";
      l.append(el("td", "mono gd-date", (p.heure || "").slice(0, 5)), a, r, el("td", "mono", duree(p.duree)), det);
      l.tabIndex = 0;
      const ouvrir = (ev) => { ev.stopPropagation(); ouvrirPassage(p, d, l); };
      l.addEventListener("click", ouvrir);
      l.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrir(ev); } });
      tb.append(l);
      return [l, p];
    });
    table.append(tb);
    groupes.push([tb, cpt, lignes]);
  }
  carte.append(table);
  function filtrer() {
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === filtresJournaux.g));
    const garde = GROUPES_JOURNAUX.find((g) => g[0] === filtresJournaux.g)[2];
    for (const [tb, cpt, lignes] of groupes) {
      let n = 0;
      for (const [l, p] of lignes) {
        const ok = garde(p) && (!filtresJournaux.q || `${p.id} ${p.nom} ${p.detail}`.toLowerCase().includes(filtresJournaux.q));
        l.hidden = !ok; n += ok;
      }
      tb.hidden = !n; cpt.textContent = n;
    }
  }
  filtrer();
  // arrivee depuis une ligne d'Automatisations (journaux.html?auto=AUT_…) : la fiche de son dernier passage s'ouvre,
  // une fois ; l'adresse perd ?auto pour qu'une relecture ne la rouvre pas (Antoine, 2026-11-11)
  const auto = new URLSearchParams(location.search).get("auto");
  if (auto) {
    history.replaceState(null, "", location.pathname);
    const premiere = groupes.flatMap((g) => g[2]).find(([, p]) => p.id === auto);
    if (premiere) setTimeout(() => ouvrirPassage(premiere[1], d, premiere[0]), 0);
  }
  const tete = el("div", "tete-fixe");
  tete.append(titre, outils);
  return [figerTete(tete), carte];
}

demarrer(async () => { await suivre([SOURCE_JOURNAUX], (d, premier) => poser(vue(d[0]), premier)); });
