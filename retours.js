// L'onglet « Retours » (DEC_00457 de PCP009, DEC_00506 de PCP049) : les retours de l'utilisateur et leur etat,
// lus dans la liste que publie OUT_00382 depuis les RET_ des cellules. La forme est celle qu'Antoine a choisie le
// 2026-11-04 sur maquettes : le tableau (option D), la barre segmentee de la page Rapports (barre 1), et un panneau
// de detail et d'historique au clic sur une ligne. La page ne decide de rien : l'API filtre par les droits.
"use strict";

// la date d'un retour en « 04/11 », comme les autres listes (Antoine, 2026-11-11, DEC_00835, choix 5A)
const jourCourtRetour = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}` : (iso || ""); };

const ETATS_RETOUR = { recu: ["Reçu", "t-ferme"], en_cours: ["En cours", "t-ambre"], corrige: ["Traité", "t-vert"],
                       referme: ["Sans suite", "t-ferme"] };   // les mots choisis par Antoine le 2026-11-11 (PCP049-1111-x, A)
// Les mots de la fenetre « Nouveau retour » (depot d'Antoine du 2026-11-05, recommandations de PCP049-1105-c). Un nouveau
// besoin ne porte sur rien d'existant : il part sans liste. Un retour passe classe « demande » porte sur une
// automatisation existante : il se lit « Amelioration ».
const TYPES_RETOUR = [["anomalie", "Anomalie"], ["amelioration", "Amélioration"], ["demande", "Nouveau besoin"]];
// RGI_01879 : le type montre vient du verdict de l'equipe (DEC_01164) ; sans verdict, « À qualifier »
const MOT_TYPE = { anomalie: "Anomalie", amelioration: "Amélioration", besoin: "Nouveau besoin", question: "Question",
                   a_qualifier: "À qualifier" };
const EXEMPLES = { anomalie: "Dans le rapport de ce matin, la ligne… affiche… alors que…",
                   amelioration: "J'aimerais ajouter dans le rapport une colonne…",
                   demande: "J'aimerais recevoir chaque semaine un contrôle sur…" };
// la barre : Tous, Ouverts (recu et en cours), Traites, Sans suite
const GROUPES = [["", "Tous", () => true], ["ouverts", "Ouverts", (r) => r.etat === "recu" || r.etat === "en_cours"],
                 ["corriges", "Traités", (r) => r.etat === "corrige"], ["refermes", "Sans suite", (r) => r.etat === "referme"]];
// Les pieces jointes d'un retour (depot d'Antoine du 2026-11-12 : « un fichier ou des screenshots », RGI_01678) : les memes
// bornes que l'API, dites avant l'envoi ; une capture se colle aussi dans la fenetre (Ctrl+V)
const PIECES_MAX = 5;
const PIECE_MO = 5;
const PIECES_MO = 10;
const PIECES_ACCEPTEES = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.xlsx,.xls,.docx,.doc,.pptx,.csv,.txt,.eml,.msg";
const DELAI_PIECES = 120000;
const SOURCE_RETOURS = { chemin: "/api/retours", verifier: (d) => Array.isArray(d.retours) };
const filtres = { g: "", q: "" };

function tagRetour(etat) {
  const [mot, classe] = ETATS_RETOUR[etat] || ETATS_RETOUR.recu;
  return el("span", "tag " + classe, mot);
}

function vueRetours([rets, autos]) {
  majBandeau(rets.genere_le);
  const liste = rets.retours;
  // le sous-titre est retire (Antoine, 2026-11-04) : le compte vit sur « Tous »
  const avis = el("p", "avis");
  avis.setAttribute("aria-live", "polite");

  const barre = el("div", "gb-barre");
  barre.setAttribute("role", "group");
  barre.setAttribute("aria-label", "État");
  for (const [v, texte, garde] of GROUPES) {
    const b = bouton("gb-o", texte);
    b.append(" ", el("span", null, liste.filter(garde).length));
    b.dataset.v = v;
    b.addEventListener("click", () => { filtres.g = v; filtrer(); });
    barre.append(b);
  }
  const lab = el("label", "cherche");
  lab.append(el("span", "sr", "Rechercher un retour"));
  const champ = el("input");
  champ.type = "search";
  champ.placeholder = "Rechercher un retour…";
  champ.value = filtres.q;
  champ.addEventListener("input", () => { filtres.q = champ.value.trim().toLowerCase(); filtrer(); });
  lab.append(champ);
  const nouveau = bouton("btn rt-n", "＋ Nouveau retour");
  nouveau.addEventListener("click", () => ouvrirNouveau(autos.automatisations, nouveau));
  const outils = el("div", "outils ligne rt-outils");
  outils.append(barre, el("span", "rt-sp"), lab, nouveau);   // la recherche a droite (DEC_00520, option 5C)

  if (!liste.length) {
    return [el("h1", null, "Retours"), outils, vueVide("Aucun retour pour l'instant",
      "Signalez une anomalie, proposez une amélioration ou faites une demande : elle arrive à l'équipe qui suit l'automatisation, et son état s'affiche ici.")];
  }

  const carte = el("div", "carte gd-c");
  const table = el("table", "gd rt");
  // RGI_01902 (DEC_01207) : le numero de ticket, celui de la demande sans son prefixe interne (le prefixe et les zeros de tete retires)
  const cg = el("colgroup");
  for (const w of ["5.5rem", "7.5rem", "7rem", "8rem", "13rem", "", "9rem"]) {
    const c = el("col");
    if (w) c.style.width = w;
    cg.append(c);
  }
  const thead = el("thead");
  const tr = el("tr");
  for (const texte of ["Ticket", "Date", "État", "Type", "Automatisation", "Objet", "De"]) {
    const th = el("th", null, texte);
    th.scope = "col";
    tr.append(th);
  }
  thead.append(tr);
  const tb = el("tbody");
  const lignes = liste.map((r) => {
    const l = el("tr", "rt-l");
    l.tabIndex = 0;
    l.setAttribute("aria-label", `${r.objet}, ${(ETATS_RETOUR[r.etat] || ETATS_RETOUR.recu)[0]} : voir le détail`);
    const e = el("td");
    e.append(tagRetour(r.etat));
    l.append(el("td", "mono", numeroTicket(r.id)), el("td", "mono gd-date", jourCourtRetour(r.date)), e, el("td", null, MOT_TYPE[r.type] || "À qualifier"),
             el("td", null, r.nom), el("td", "rt-o", r.objet), el("td", "discret", r.de || ""));
    // le clic ne remonte pas au document, qui fermerait aussitot le panneau ouvert (commun.js)
    l.addEventListener("click", (ev) => { ev.stopPropagation(); ouvrirDetail(r, l); });
    l.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ouvrirDetail(r, l); } });
    tb.append(l);
    return [l, r];
  });
  table.append(cg, thead, tb);
  colonnesAuContenu(table, 6, true);   // l'objet du retour prend la place qui reste (DEC_00853)
  carte.append(table);
  const vide = el("p", "vide", "Aucun retour ne correspond.");
  vide.hidden = true;

  function filtrer() {
    for (const b of barre.children) b.setAttribute("aria-pressed", String(b.dataset.v === filtres.g));
    const garde = (GROUPES.find((g) => g[0] === filtres.g) || GROUPES[0])[2];
    let total = 0;
    for (const [l, r] of lignes) {
      const texte = `${numeroTicket(r.id)} ${r.objet} ${r.demande} ${r.nom} ${r.de}`.toLowerCase();
      const ok = garde(r) && (!filtres.q || texte.includes(filtres.q));
      l.hidden = !ok;
      total += ok ? 1 : 0;
    }
    vide.hidden = total > 0;
    carte.hidden = total === 0;
  }
  filtrer();
  const tete = el("div", "tete-fixe");
  tete.append(el("h1", null, "Retours"), outils, avis);
  return [figerTete(tete), carte, vide];
}

// RGI_01902 : le numero sans prefixe ni zeros de tete ; une autre forme ne donne rien
function numeroTicket(ident) {
  const m = /^[A-Z]{3}_0*(\d+)$/.exec(String(ident || ""));
  return m ? m[1] : "";
}

// Le panneau d'un retour : son detail, puis son historique (la creation, chaque version publiee qui le cite).
function ouvrirDetail(r, depuis) {
  const titre = el("h2", null, r.objet);
  titre.id = "panneau-titre";
  const tete = el("p", "rt-tete");
  tete.append(tagRetour(r.etat), " ", el("span", "tag", MOT_TYPE[r.type] || "À qualifier"));
  const dl = el("dl", "rt-dl");
  for (const [mot, valeur] of [["Ticket", numeroTicket(r.id) || "—"], ["Automatisation", r.nom], ["Date", r.date], ["De", r.de || "—"]]) {
    dl.append(el("dt", null, mot), el("dd", null, valeur));
  }
  const demande = el("section", "fi-s");
  demande.append(el("h3", null, "Le retour"), el("p", null, r.demande || r.objet));
  const histo = el("section", "fi-s");
  const ol = el("ol", "rt-h");
  for (const h of r.historique || []) {
    const li = el("li");
    li.append(el("span", "mono", h.date), " ", h.quoi === "publie"
      ? `Traité, dans la version ${h.version} de l'automatisation` : "Reçu par l'équipe qui suit l'automatisation");
    ol.append(li);
  }
  if (r.etat === "referme") ol.append(el("li", "discret", "L'équipe n'y donne pas suite."));
  histo.append(el("h3", null, "Historique"), ol);
  ouvrirPanneau("retour", [titre, tete, dl, demande, histo], depuis);
}

// La fenetre « Nouveau retour » : sur quoi, le type, le texte ; elle part par note a l'equipe qui suit
// l'automatisation (`POST /api/demandes`), ou au pilote du client pour un besoin general.
function ouvrirNouveau(autos, depuis, choisi) {
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
  const titre = el("h2", null, "Nouveau retour");
  titre.id = "dm-titre";
  const labSur = el("label", "rt-sur");
  labSur.append(el("span", null, "Sélectionner le rapport"));
  const sur = el("select");
  // seulement ce que l'utilisateur a le droit de voir (Antoine, 2026-11-05 : « borné à ce qui est visible par utilisateur »)
  const permises = autos.filter((a) => a.acces !== false);   // une API pas encore deployee ne dit rien : la liste reste entiere
  for (const a of [...permises].sort((p, q) => String(p.nom).localeCompare(String(q.nom), "fr"))) {
    const o = el("option", null, a.flux ? `${a.nom} · ${a.flux}` : a.nom);   // des noms se repetent d'un systeme a l'autre
    o.value = a.id;
    sur.append(o);
  }
  const connue = Boolean(choisi) && permises.some((a) => String(a.id) === choisi);
  if (connue) sur.value = choisi;
  labSur.append(sur);
  const choix = el("div", "dm-n");
  choix.setAttribute("role", "radiogroup");
  choix.setAttribute("aria-label", "Type");
  for (const [cle, mot] of TYPES_RETOUR) {
    const l = el("label");
    const r = el("input");
    r.type = "radio";
    r.name = "nature";
    r.value = cle;
    // sans droit sur l'automatisation du lien, ou sans aucune, il reste le nouveau besoin
    r.checked = cle === ((choisi && !connue) || !permises.length ? "demande" : "anomalie");
    l.append(r, mot);
    choix.append(l);
  }
  const zone = el("textarea", "dm-t");
  zone.rows = 10;
  zone.maxLength = TEXTE_DEMANDE_MAX;
  zone.setAttribute("aria-label", "Votre retour");
  // les pieces : un bouton qui ouvre le choix des fichiers, la liste de ce qui partira, chaque piece retirable
  const jointes = [];
  const fichier = el("input");
  fichier.type = "file";
  fichier.multiple = true;
  fichier.accept = PIECES_ACCEPTEES;
  fichier.hidden = true;
  const ajouter = bouton("btn btn-s dm-pj-b", "Joindre un fichier");
  ajouter.type = "button";
  const listePieces = el("ul", "dm-pj-l");
  const aidePieces = el("p", "dm-pj-a", `Une capture d'écran se colle aussi ici (Ctrl+V). ${PIECES_MAX} pièces au plus, ${PIECE_MO} Mo chacune.`);
  const montrerPieces = () => {
    listePieces.replaceChildren(...jointes.map((f, i) => {
      const li = el("li", null, `${f.name} · ${Math.max(1, Math.round(f.size / 1024))} Ko `);
      const retirer = bouton("lien-r", "Retirer");
      retirer.type = "button";
      retirer.setAttribute("aria-label", `Retirer ${f.name}`);
      retirer.addEventListener("click", () => { jointes.splice(i, 1); montrerPieces(); });
      li.append(retirer);
      return li;
    }));
  };
  const joindre = (fichiers) => {
    for (const f of fichiers) {
      const total = jointes.reduce((t, x) => t + x.size, 0) + f.size;
      if (jointes.length >= PIECES_MAX || f.size > PIECE_MO * 1048576 || total > PIECES_MO * 1048576) {
        message.className = "message erreur";
        message.textContent = `Pièce refusée : ${PIECES_MAX} au plus, ${PIECE_MO} Mo chacune, ${PIECES_MO} Mo en tout.`;
        break;
      }
      jointes.push(f);
    }
    montrerPieces();
  };
  // jamais grise (la charte, « Le bouton qui attend, et jamais grisé ») : plein, il dit pourquoi au lieu de s'eteindre
  ajouter.addEventListener("click", () => {
    if (jointes.length >= PIECES_MAX) {
      message.className = "message erreur";
      message.textContent = `${PIECES_MAX} pièces au plus : retirez-en une pour en joindre une autre.`;
      return;
    }
    fichier.click();
  });
  fichier.addEventListener("change", () => { joindre([...fichier.files]); fichier.value = ""; });
  fen.addEventListener("paste", (e) => {
    const images = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    e.preventDefault();
    const n = jointes.length;
    joindre(images.map((f, i) => new File([f], `capture-${n + i + 1}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`, { type: f.type })));
  });
  const enBase64 = (f) => new Promise((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] || "");
    r.onerror = () => ko(r.error);
    r.readAsDataURL(f);
  });
  const blocPieces = el("div", "dm-pj");
  blocPieces.append(ajouter, fichier, listePieces, aidePieces);
  const pied = el("div", "dm-pied");
  const message = el("p", "message");
  message.setAttribute("aria-live", "polite");
  const envoyer = bouton("btn", "Envoyer");
  envoyer.type = "submit";
  pied.append(message, envoyer);
  zone.id = "dm-zone";
  const labZone = el("label", "dm-lab", "Décrivez ici");   // un libelle au-dessus de chaque champ (DEC_00520, option 9B)
  labZone.htmlFor = "dm-zone";
  // l'ordre suit le geste : le type d'abord, puis le rapport s'il en faut un, puis le texte
  const natureChoisie = () => (fen.querySelector("input[name=nature]:checked") || {}).value || "demande";
  const accorder = () => {
    const n = natureChoisie();
    labSur.hidden = n === "demande";
    zone.placeholder = EXEMPLES[n];
  };
  fen.append(x, titre, el("p", "dm-lab", "Type"), choix, labSur, labZone, zone, blocPieces, pied);
  choix.addEventListener("change", accorder);
  accorder();
  fen.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texte = zone.value.trim();
    if (!texte) {
      message.className = "message erreur";
      message.textContent = "Écrivez votre retour avant d'envoyer.";
      zone.focus();
      return;
    }
    envoyer.disabled = true;
    message.className = "message";
    message.textContent = "Envoi…";
    const nature = natureChoisie();
    let pieces;
    try {
      pieces = await Promise.all(jointes.map(async (f) => ({ nom: f.name, contenu: await enBase64(f) })));
    } catch (_) {
      envoyer.disabled = false;
      message.className = "message erreur";
      message.textContent = "Une pièce jointe n'a pas pu être lue. Retirez-la et réessayez.";
      return;
    }
    const r = await appeler("POST", "/api/demandes", { id: nature === "demande" ? "GENERAL" : sur.value, rapport: "", nature, texte, pieces },
                            "json", pieces.length ? DELAI_PIECES : undefined);
    if (r.statut === 200) {
      fen.replaceChildren(x, titre, el("p", "dm-ok",
        "Votre retour est transmis. Il apparaîtra dans ce tableau, avec son état, à la prochaine mise à jour."));
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
  sur.focus();
}

// Le bouton des courriels de rapport ouvre `retours.html?nouveau=<AUT_…>` : la fenetre « Nouveau retour » sur cette
// automatisation, apres la connexion s'il le faut (Antoine, 2026-11-05 : « Donnons le lien directement de l'onglet
// faire une demande », note de PCP001). Le parametre part de l'adresse : un rechargement ne rouvre rien.
function ouvrirDepuisLien(autos) {
  const q = new URLSearchParams(location.search);
  const cible = q.get("nouveau");
  if (cible === null) return;
  q.delete("nouveau");
  history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
  ouvrirNouveau(autos, document.querySelector(".rt-n"), cible);
}

demarrer(async () => {
  if (!moi.onglet_retours) {
    poser([el("h1", null, "Retours"), vueVide("Les retours arrivent bientôt",
      "Vous pourrez signaler ici une anomalie, proposer une amélioration ou faire une demande, et suivre son état.")], true);
    return;
  }
  await suivre([SOURCE_RETOURS, SOURCES.autos], (d, premier) => {
    poser(vueRetours(d), premier);
    if (premier) ouvrirDepuisLien(d[1].automatisations);
  });
});
