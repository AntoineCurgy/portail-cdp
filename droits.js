// Les droits des utilisateurs, regles au portail par l'administrateur (RGI_01949, RGI_01950 ; DEC_01353, DEC_01355,
// DEC_01360) : l'interrupteur « Administrer » et le bouton « Utilisateurs » du bandeau ; la fenetre en trois onglets,
// Utilisateurs, Groupes (les membres en pastilles sous un champ fixe, 2B) et Emails (1B), chacun avec ses filtres
// (PCP049-1122-l : l'onglet Rapports retire) ; l'oeil et le nombre de
// personnes sur chaque ligne de Rapports, l'oeil sur chaque ligne d'Automatisations et d'Agents. Chaque geste s'ecrit dans la
// feuille des reglages par l'API (BRQ_00377), qui refuse ce qui casserait la lecture d'un client ; la page ne change
// son etat qu'apres la reponse. Rien ne se montre si l'API ne sert pas les droits (cle droits_au_portail de la fiche du
// client absente : 503), a un utilisateur qui n'est pas l'administrateur (403), ni sous « Voir comme » (403).
"use strict";

const DROITS = (() => {
  const CLE_ADMIN = PREFIXE + "administrer";
  let M = null;              // le modele lu dans la feuille : groupes, personnes, droits, rapports, caches
  let occupe = false;        // un geste a la fois : l'API ecrit sous verrou, la page attend sa reponse
  const vues = new Set();    // les rendus a refaire apres un geste (fenetre, lignes)

  // ------------------------------------------------------------ le modele
  function charger(d) {
    const droits = {};
    for (const [k, v] of Object.entries(d.droits || {})) droits[k] = { groupes: new Set(v.groupes), personnes: new Set(v.personnes) };
    M = { groupes: (d.groupes || []).map((g) => ({ nom: g.nom, membres: g.membres.slice() })),
          personnes: (d.personnes || []).map((p) => Object.assign({}, p, { groupes: p.groupes.slice() })),
          droits, rapports: d.rapports || [], caches: new Set(d.caches_par_l_oeil || []),
          courriels: JSON.parse(JSON.stringify(d.courriels || {})), passages: d.passages || {} };
  }
  const dr = (aut) => M.droits[aut] || (M.droits[aut] = { groupes: new Set(), personnes: new Set() });
  const groupe = (nom) => M.groupes.find((g) => g.nom === nom);
  const personne = (ini) => M.personnes.find((p) => p.ini === ini);
  const parNom = (a, b) => a.nom.localeCompare(b.nom, "fr");
  function qui(aut) {   // qui voit ce rapport : les membres de ses groupes, et les personnes cochees seules
    const s = new Set(), x = dr(aut);
    for (const g of x.groupes) for (const i of (groupe(g) || { membres: [] }).membres) s.add(i);
    for (const i of x.personnes) s.add(i);
    return s;
  }
  function parQuoi(aut, ini) {   // pourquoi cette personne voit ce rapport
    const x = dr(aut), p = personne(ini), r = [];
    if (!p) return r;
    for (const g of p.groupes) if (x.groupes.has(g)) r.push(g);
    if (x.personnes.has(ini)) r.push("à titre personnel");
    return r;
  }
  const nbRapports = (ini) => M.rapports.filter((r) => parQuoi(r.automatisation, ini).length).length;

  // ------------------------------------------------------------ les gestes, ecrits par l'API
  let t0;
  function note(texte, defaire) {   // la trace d'un geste en bas de l'ecran, et « Annuler »
    const n = $("dr-note") || document.body.appendChild(el("div", "dr-note"));
    n.id = "dr-note";
    n.setAttribute("role", "status");
    n.replaceChildren(texte);
    if (defaire) {
      const a = bouton("dr-annuler", "Annuler");
      a.addEventListener("click", () => { n.classList.remove("on"); defaire(); });
      n.append(" · ", a);
    }
    n.classList.add("on");
    clearTimeout(t0);
    t0 = setTimeout(() => n.classList.remove("on"), defaire ? 6000 : 3500);
  }
  async function ecrire(geste) {   // le geste part ; null si refuse, la raison dite
    if (occupe) { note("Un réglage est en cours d'écriture : réessayez dans un instant."); return null; }
    occupe = true;
    document.body.classList.add("dr-occupe");
    try {
      const r = await appeler("POST", "/api/admin/droits", geste);
      if (r.statut === 401) { sessionPerdue(); return null; }
      if (r.statut !== 200 || !r.donnees || !r.donnees.resultat) {
        note("Non enregistré : " + ((r.donnees && r.donnees.erreur) || "service indisponible") + ".");
        return null;
      }
      return r.donnees.resultat;
    } finally {
      occupe = false;
      document.body.classList.remove("dr-occupe");
    }
  }
  function exporter() {   // le modele sous la forme de l'API, pour le garder dans le navigateur
    const droits = {};
    for (const [k, v] of Object.entries(M.droits)) droits[k] = { groupes: Array.from(v.groupes), personnes: Array.from(v.personnes) };
    return { groupes: M.groupes, personnes: M.personnes, droits, rapports: M.rapports,
             caches_par_l_oeil: Array.from(M.caches), courriels: M.courriels, passages: M.passages };
  }
  const garder = () => { if (M && typeof moi !== "undefined" && moi) stocker(moi.adresse + ":/api/admin/droits", exporter()); };
  const redessiner = () => { garder(); for (const f of vues) f(); };
  async function membre(ini, g, dedans, annulable = true) {
    if (!(await ecrire({ geste: "membre", initiales: ini, groupe: g, dedans }))) return;
    const p = personne(ini), x = groupe(g);
    if (p && x) {
      p.groupes = p.groupes.filter((y) => y !== g).concat(dedans ? [g] : []);
      x.membres = x.membres.filter((y) => y !== ini).concat(dedans ? [ini] : []);
    }
    redessiner();
    note((p ? p.nom : ini) + (dedans ? " entre dans " : " sort de ") + g, annulable ? () => membre(ini, g, !dedans, false) : null);
  }
  async function droit(aut, colonne, donne, sujet, annulable = true) {
    if (!(await ecrire({ geste: "droit", automatisation: aut, colonne, donne }))) return;
    const x = dr(aut), cible = personne(colonne) ? x.personnes : x.groupes;
    if (donne) cible.add(colonne); else cible.delete(colonne);
    redessiner();
    const qui = personne(colonne) ? personne(colonne).nom : colonne;
    note(qui + (donne ? " voit " : " ne voit plus ") + "« " + sujet + " »", annulable ? () => droit(aut, colonne, !donne, sujet, false) : null);
  }
  async function affichage(aut, affiche, annulable = true) {
    if (!(await ecrire({ geste: "affichage", automatisation: aut, affiche }))) return;
    if (affiche) M.caches.delete(aut); else M.caches.add(aut);
    redessiner();
    note(affiche ? "Affiché pour tout le monde" : "Masqué pour tout le monde", annulable ? () => affichage(aut, !affiche, false) : null);
  }
  async function nouvellePersonne(nom, adresse, groupes) {
    const r = await ecrire({ geste: "personne", nom, adresse, groupes });
    if (!r) return null;
    const p = { ini: r.initiales, adresse: r.adresse, nom: r.nom, org: "", groupes: r.groupes.slice(), portail: true };
    M.personnes.push(p);
    for (const g of p.groupes) { const x = groupe(g); if (x) x.membres.push(p.ini); }
    redessiner();
    note(p.nom + " ajouté" + (p.groupes.length ? " au groupe " + p.groupes.join(", ") : ""));
    return p;
  }
  async function nouveauGroupe(nom) {
    const r = await ecrire({ geste: "groupe", nom });
    if (!r) return null;
    M.groupes.push({ nom: r.groupe, membres: [] });
    redessiner();
    note("Groupe " + r.groupe + " créé");
    return r.groupe;
  }

  // ------------------------------------------------------------ les pieces
  const SVG = {
    oeil: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    barre: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    gens: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.2 4 1.9 4.5 4.4"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  };
  function svg(n) { const s = el("span", "dr-ico"); s.innerHTML = SVG[n]; return s; }   // balisage constant, jamais une donnee
  function oeil(aut, classe) {   // affiche pour tous, ou masque pour tous (« Affiché dans portail »)
    const b = bouton("dr-oeil" + (classe ? " " + classe : ""));
    const m = M.caches.has(aut);
    b.innerHTML = m ? SVG.barre : SVG.oeil;
    b.classList.toggle("off", m);
    b.title = m ? "Masqué pour tout le monde : cliquer pour l'afficher" : "Affiché pour tout le monde : cliquer pour le masquer";
    b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", String(m));
    b.addEventListener("click", (e) => { e.stopPropagation(); affichage(aut, M.caches.has(aut)); });
    return b;
  }
  function cherche(texte, quand) {   // le champ de recherche des listes du portail
    const l = el("label", "cherche"), i = el("input");
    i.type = "search";
    i.placeholder = texte;
    l.append(el("span", "sr", texte), i);
    i.addEventListener("input", () => quand(i.value.trim().toLowerCase()));
    return l;
  }
  function filtres(defs, quand) {   // les filtres rapides, dans chacun des trois onglets (PCP049-1122-l)
    const fb = el("div", "gb-barre dr-fb");
    for (const [v, nom] of defs) {
      const b = bouton("gb-o", nom);
      b.setAttribute("aria-pressed", String(v === ""));
      b.addEventListener("click", () => { for (const y of fb.children) y.setAttribute("aria-pressed", String(y === b)); quand(v); });
      fb.append(b);
    }
    return fb;
  }
  function deuxVolets() { const c = el("div", "d-a"), g = el("div", "d-g"), d = el("div", "d-d"); c.append(g, d); return [c, g, d]; }
  function ligneListe(on, titre, sous, choisir) {
    const b = bouton("d-p" + (on ? " on" : ""));
    b.append(el("b", null, titre), el("span", null, sous));
    b.addEventListener("click", choisir);
    return b;
  }
  const trie = () => M.rapports.slice().sort((a, b) => a.sujet.localeCompare(b.sujet, "fr"));

  // ------------------------------------------------------------ la fenetre, en trois onglets
  let fen = null;
  function fermer() {
    if (!fen) return;
    fen.voile.remove();
    document.removeEventListener("keydown", fen.echap);
    vues.delete(fen.rendre);
    fen = null;
  }
  function ouvrir(onglet, ini) {
    fermer();
    const voile = el("div", "doc-voile");
    voile.setAttribute("role", "dialog");
    voile.setAttribute("aria-modal", "true");
    voile.setAttribute("aria-labelledby", "dr-titre");
    const f = el("div", "doc-fen dr-fen");
    const x = bouton("doc-x", "×");
    x.setAttribute("aria-label", "Fermer");
    x.addEventListener("click", fermer);
    const titre = el("h2", null, "Utilisateurs et groupes");
    titre.id = "dr-titre";
    const tete = el("div", "dr-t"), barre = el("div", "gb-barre"), zone = el("div", "dr-z");
    const action = bouton("btn btn-s dr-act");
    let courant = onglet || "u", rendre = null;
    for (const [v, nom] of [["u", "Utilisateurs"], ["g", "Groupes"], ["e", "Emails"]]) {
      const b = bouton("gb-o", nom);
      b.dataset.v = v;
      b.addEventListener("click", () => montrer(v));
      barre.append(b);
    }
    tete.append(barre, el("span", "dr-sp"), action);
    function montrer(v, i) {
      courant = v;
      for (const b of barre.querySelectorAll(".gb-o")) b.setAttribute("aria-pressed", String(b.dataset.v === v));
      const vue = { u: annuaire, g: groupes, e: emails }[v](i);
      zone.replaceChildren(vue.el);
      rendre = vue.rendre;
      fen.rendre = () => rendre && rendre();
      vues.add(fen.rendre);
      action.hidden = !vue.action;
      if (vue.action) { action.replaceChildren(svg("plus"), vue.action[0]); action.onclick = vue.action[1]; }
    }
    f.append(x, titre, tete, zone);
    voile.append(f);
    voile.addEventListener("click", (e) => { if (e.target === voile) fermer(); });
    const echap = (e) => { if (e.key === "Escape") fermer(); };
    document.addEventListener("keydown", echap);
    document.body.append(voile);
    fen = { voile, echap, rendre: null };
    montrer(courant, ini);
    x.focus();
  }

  // l'onglet Utilisateurs : la liste a gauche, la fiche a droite (ses groupes, ses rapports)
  function annuaire(ini) {
    const [cadre, gauche, droite] = deuxVolets();
    const ul = el("div", "d-l");
    let q = "", filtre = "", choisi = ini || (M.personnes.slice().sort(parNom)[0] || {}).ini;
    gauche.append(cherche("Rechercher un utilisateur…", (v) => { q = v; liste(); }),
                  filtres([["", "Tous"], ["sans", "Sans groupe"], ["horsportail", "Sans accès"]], (v) => { filtre = v; liste(); }), ul);
    function liste() {
      ul.replaceChildren(...M.personnes.slice().sort(parNom).filter((p) => {
        if (filtre === "sans" && p.groupes.length) return false;
        if (filtre === "horsportail" && p.portail) return false;
        return !q || (p.nom + " " + p.adresse + " " + p.groupes.join(" ")).toLowerCase().includes(q);
      }).map((p) => ligneListe(p.ini === choisi, p.nom, (p.groupes.join(", ") || "sans groupe") + " · " + nbRapports(p.ini) + " rapports",
                                () => { choisi = p.ini; liste(); fiche(); })));
    }
    function fiche() {
      const p = personne(choisi);
      droite.replaceChildren();
      if (!p) return;
      droite.append(el("h3", "d-t", p.nom), el("p", "dr-c-s", p.adresse + (p.portail ? "" : " · sans accès au portail")));
      droite.append(el("h3", "dr-h", "Groupes"));
      const gs = el("div", "dr-chips");
      for (const g of M.groupes) {
        const dedans = p.groupes.includes(g.nom), b = bouton("d-gc" + (dedans ? " on" : ""), g.nom);
        b.setAttribute("aria-pressed", String(dedans));
        b.addEventListener("click", () => membre(p.ini, g.nom, !dedans));
        gs.append(b);
      }
      droite.append(gs, el("h3", "dr-h", "Rapports · " + nbRapports(p.ini) + " sur " + M.rapports.length));
      const t = el("div", "d-r");
      for (const r of trie()) {
        const raisons = parQuoi(r.automatisation, p.ini), x = dr(r.automatisation);
        const perso = x.personnes.has(p.ini), parGroupe = raisons.filter((y) => y !== "à titre personnel");
        const l = el("label", "d-rl" + (raisons.length ? "" : " non")), i = el("input");
        i.type = "checkbox";
        i.checked = raisons.length > 0;
        i.disabled = parGroupe.length > 0 && !perso;
        if (i.disabled) l.title = "Donné par " + parGroupe.join(", ") + " : retirez-le du groupe pour le lui retirer";
        i.addEventListener("change", () => { const c = i.checked; i.checked = !c; droit(r.automatisation, p.ini, c, r.sujet); });
        l.append(i, el("span", null, r.sujet), el("span", "dr-c-s", parGroupe.length ? "par " + parGroupe.join(", ") : (perso ? "à titre personnel" : "")));
        t.append(l);
      }
      droite.append(t);
    }
    function nouveau() {
      const f = el("form", "dr-nv");
      const n = el("input"); n.placeholder = "Nom et prénom"; n.required = true; n.autocomplete = "off";
      const a = el("input"); a.type = "email"; a.placeholder = "Adresse email"; a.required = true; a.autocomplete = "off";
      const s = el("select"); s.append(new Option("Sans groupe", ""));
      for (const g of M.groupes) s.append(new Option(g.nom, g.nom));
      const c = el("select"); c.append(new Option("Copier les groupes de…", ""));
      for (const p of M.personnes.slice().sort(parNom)) c.append(new Option(p.nom + (p.groupes.length ? " (" + p.groupes.join(", ") + ")" : ""), p.ini));
      const copie = { groupes: null };
      c.addEventListener("change", () => { const p = personne(c.value); copie.groupes = p ? p.groupes.slice() : null; if (p && p.groupes[0]) s.value = p.groupes[0]; });
      const ok = bouton("btn btn-s", "Ajouter"); ok.type = "submit";
      const msg = el("p", "message");
      f.append(n, a, s, c, ok, msg);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!n.value.trim() || !a.checkValidity()) { msg.className = "message erreur"; msg.textContent = "Un nom et une adresse email lisibles."; return; }
        const gs = copie.groupes && copie.groupes[0] === s.value ? copie.groupes : (s.value ? [s.value] : []);
        const p = await nouvellePersonne(n.value.trim(), a.value.trim(), gs);
        if (p) { choisi = p.ini; liste(); fiche(); }
      });
      droite.replaceChildren(el("h3", "d-t", "Nouvel utilisateur"), f);
      n.focus();
    }
    liste();
    fiche();
    return { el: cadre, action: ["Nouvel utilisateur", nouveau], rendre: () => { liste(); fiche(); } };
  }

  // l'onglet Groupes, en miroir : ses membres en pastilles sous le choix « + membre » (2B), ses rapports
  function groupes() {
    const [cadre, gauche, droite] = deuxVolets();
    const ul = el("div", "d-l");
    let q = "", filtre = "", choisi = (M.groupes[0] || {}).nom;
    gauche.append(cherche("Rechercher un groupe…", (v) => { q = v; liste(); }),
                  filtres([["", "Tous"], ["vide", "Sans membre"], ["inutile", "Sans rapport"]], (v) => { filtre = v; liste(); }), ul);
    const nbR = (g) => M.rapports.filter((r) => dr(r.automatisation).groupes.has(g.nom)).length;
    function liste() {
      ul.replaceChildren(...M.groupes.filter((g) => (filtre !== "vide" || !g.membres.length) && (filtre !== "inutile" || !nbR(g))
                                                    && (!q || g.nom.toLowerCase().includes(q))).map((g) =>
        ligneListe(g.nom === choisi, g.nom, g.membres.length + (g.membres.length > 1 ? " membres" : " membre") + " · " + nbR(g) + " rapports",
                   () => { choisi = g.nom; liste(); fiche(); })));
    }
    function fiche() {
      const g = groupe(choisi);
      droite.replaceChildren();
      if (!g) return;
      droite.append(el("h3", "d-t", g.nom), el("h3", "dr-h", "Membres · " + g.membres.length));
      const s = el("select", "dr-add");
      s.setAttribute("aria-label", "Ajouter un membre à " + g.nom);
      s.append(new Option("+ membre", ""));
      for (const p of M.personnes.slice().sort(parNom)) if (!g.membres.includes(p.ini)) s.append(new Option(p.nom, p.ini));
      s.addEventListener("change", () => { if (s.value) membre(s.value, g.nom, true); });
      const c = el("div", "dr-chips");
      for (const i of g.membres) {
        const p = personne(i) || { nom: i }, ch = el("span", "dr-chip", p.nom), x = bouton("dr-chip-x", "×");
        x.title = "Retirer " + p.nom + " de " + g.nom;
        x.setAttribute("aria-label", x.title);
        x.addEventListener("click", () => membre(i, g.nom, false));
        ch.append(x);
        c.append(ch);
      }
      droite.append(s, c, el("h3", "dr-h", "Rapports · " + nbR(g) + " sur " + M.rapports.length));
      const t = el("div", "d-r");
      for (const r of trie()) {
        const x = dr(r.automatisation), on = x.groupes.has(g.nom);
        const l = el("label", "d-rl" + (on ? "" : " non")), i = el("input");
        i.type = "checkbox";
        i.checked = on;
        i.addEventListener("change", () => { i.checked = on; droit(r.automatisation, g.nom, !on, r.sujet); });
        l.append(i, el("span", null, r.sujet), el("span", "dr-c-s", qui(r.automatisation).size + " pers."));
        t.append(l);
      }
      droite.append(t);
    }
    function nouveau() {
      const f = el("form", "dr-ng"), n = el("input");
      n.placeholder = "Nom du groupe"; n.required = true; n.autocomplete = "off";
      const ok = bouton("btn btn-s", "Créer"); ok.type = "submit";
      f.append(n, ok);
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!n.value.trim()) return;
        const nom = await nouveauGroupe(n.value.trim());
        if (nom) { choisi = nom; liste(); fiche(); }
      });
      droite.replaceChildren(el("h3", "d-t", "Nouveau groupe"), f,
                             el("p", "dr-c-s", "Un groupe sans membre ne peut pas encore recevoir de rapport : ajoutez-lui d'abord ses membres."));
      n.focus();
    }
    liste();
    fiche();
    return { el: cadre, action: ["Nouveau groupe", nouveau], rendre: () => { liste(); fiche(); } };
  }

  // l'onglet Emails (1B, PCP049-1122-l) : ce que chacun recoit par email, rapport par rapport, et ses jours ;
  // l'administrateur coche a sa place (geste « courriel » de BRQ_00377, Parametres rapports)
  const JOURS = [["lun", "LU"], ["mar", "MA"], ["mer", "ME"], ["jeu", "JE"], ["ven", "VE"], ["sam", "SA"], ["dim", "DI"]];
  const OUVRES = ["lun", "mar", "mer", "jeu", "ven"];
  const joursDe = (aut, ini) => (M.courriels[aut] || {})[ini] || [];
  const nbEmails = (ini) => Object.keys(M.courriels).filter((a) => joursDe(a, ini).length).length;
  async function courriel(aut, ini, jours, texte, annulable = true) {
    const avant = joursDe(aut, ini).slice();
    const r = await ecrire({ geste: "courriel", automatisation: aut, initiales: ini, jours });
    if (!r) return;
    M.courriels[aut] = M.courriels[aut] || {};
    if (r.jours && r.jours.length) M.courriels[aut][ini] = r.jours.slice(); else delete M.courriels[aut][ini];
    redessiner();
    note(texte, annulable ? () => courriel(aut, ini, avant, "Annulé : " + texte, false) : null);
  }
  function emails(ini) {
    const [cadre, gauche, droite] = deuxVolets();
    const ul = el("div", "d-l");
    let q = "", filtre = "", choisi = ini || (M.personnes.slice().sort(parNom)[0] || {}).ini;
    gauche.append(cherche("Rechercher un utilisateur…", (v) => { q = v; liste(); }),
                  filtres([["", "Tous"], ["avec", "Avec email"], ["sans", "Sans email"]], (v) => { filtre = v; liste(); }), ul);
    function liste() {
      ul.replaceChildren(...M.personnes.slice().sort(parNom).filter((p) => {
        if (filtre === "avec" && !nbEmails(p.ini)) return false;
        if (filtre === "sans" && nbEmails(p.ini)) return false;
        return !q || (p.nom + " " + p.adresse).toLowerCase().includes(q);
      }).map((p) => { const n = nbEmails(p.ini);
        return ligneListe(p.ini === choisi, p.nom, n ? n + (n > 1 ? " emails" : " email") : "aucun email", () => { choisi = p.ini; liste(); fiche(); }); }));
    }
    function fiche() {
      const p = personne(choisi);
      droite.replaceChildren();
      if (!p) return;
      const auts = {};
      for (const r of trie()) if (parQuoi(r.automatisation, p.ini).length) (auts[r.automatisation] = auts[r.automatisation] || []).push(r.sujet);
      const ids = Object.keys(auts);
      droite.append(el("h3", "d-t", p.nom), el("p", "dr-c-s", p.adresse), el("h3", "dr-h", "Emails · " + nbEmails(p.ini) + " sur " + ids.length + " rapports"));
      const t = el("div", "d-r");
      for (const a of ids) {
        const jours = joursDe(a, p.ini), passe = M.passages[a] && M.passages[a].length ? M.passages[a] : OUVRES, nom = auts[a][0];
        const l = el("div", "dr-el" + (jours.length ? "" : " non"));
        const sw = el("label", "dr-sw2"), i = el("input");
        i.type = "checkbox";
        i.checked = jours.length > 0;
        i.setAttribute("aria-label", (jours.length ? "Arrêter l'email de « " : "Envoyer l'email de « ") + nom + " » à " + p.nom);
        sw.title = jours.length ? "Reçoit l'email : cliquer pour l'arrêter" : "Ne reçoit pas l'email : cliquer pour l'envoyer";
        sw.append(i, el("i"));
        i.addEventListener("change", () => {
          i.checked = jours.length > 0;
          courriel(a, p.ini, jours.length ? [] : passe.filter((x) => OUVRES.includes(x)),
                   p.nom + (jours.length ? " ne reçoit plus " : " reçoit ") + "« " + nom + " »");
        });
        const js = el("span", "dr-js");
        for (const [code, court] of JOURS) {
          const on = jours.includes(code), ok = passe.includes(code), b = bouton("dr-j1" + (on ? " on" : ""), court);
          b.disabled = !ok || !jours.length;
          b.setAttribute("aria-pressed", String(on));
          if (!ok) b.title = "Pas de passage ce jour-là";
          b.addEventListener("click", () => courriel(a, p.ini, on ? jours.filter((x) => x !== code) : jours.concat([code]),
                                                     p.nom + " : « " + nom + " » " + (on ? "sans le " : "aussi le ") + court));
          js.append(b);
        }
        l.append(sw, el("span", "dr-en", auts[a].join(" · ")), js);
        t.append(l);
      }
      if (!ids.length) t.append(el("p", "vide", "Aucun rapport : donnez-lui d'abord un groupe ou un rapport."));
      droite.append(t);
    }
    liste();
    fiche();
    return { el: cadre, action: null, rendre: () => { liste(); fiche(); } };
  }

  // ------------------------------------------------------------ le bandeau, et les lignes des listes
  const administre = () => localStorage.getItem(CLE_ADMIN) !== "0";   // allume par defaut, garde d'une page a l'autre
  function poserBandeau() {
    const av = $("avatar");
    if (!av || document.querySelector(".dr-sw")) return;
    const sw = el("label", "dr-sw"), i = el("input");
    i.type = "checkbox";
    i.checked = administre();
    i.addEventListener("change", () => {
      localStorage.setItem(CLE_ADMIN, i.checked ? "1" : "0");
      document.body.classList.toggle("dr-admin", i.checked);
      note(i.checked ? "Administration : vous voyez tout, et vous seul ces boutons" : "Vous voyez le portail comme vos utilisateurs");
    });
    sw.append(i, el("i"), el("span", null, "Administrer"));
    const u = bouton("comme-o dr-haut dr-adm");
    u.append(svg("gens"), "Utilisateurs");
    u.addEventListener("click", () => ouvrir("u"));
    const o = document.querySelector(".comme-o");
    (o || av).before(sw, u);
    document.body.classList.add("dr-on");
    document.body.classList.toggle("dr-admin", administre());
  }
  function compte(aut, sujet) {   // le nombre de personnes qui voient un rapport, et la fenetre de qui
    const n = bouton("d-n");
    const poser = () => { n.textContent = qui(aut).size + " pers."; };
    poser();
    vues.add(poser);
    n.addEventListener("click", (e) => {
      e.stopPropagation();
      const s = qui(aut);
      const corps = el("div", "dr-ed");
      corps.append(el("p", "dr-tot", s.size + (s.size > 1 ? " personnes voient ce rapport" : " personne voit ce rapport")));
      for (const p of Array.from(s).map(personne).filter(Boolean).sort(parNom)) {
        corps.append(ligneListe(false, p.nom, parQuoi(aut, p.ini).join(", "), () => { fermerQui(); ouvrir("u", p.ini); }));
      }
      const voile = el("div", "doc-voile"), f = el("div", "doc-fen dr-fen-qui"), x = bouton("doc-x", "×");
      voile.setAttribute("role", "dialog");
      voile.setAttribute("aria-modal", "true");
      x.setAttribute("aria-label", "Fermer");
      const fermerQui = () => voile.remove();
      x.addEventListener("click", fermerQui);
      voile.addEventListener("click", (e2) => { if (e2.target === voile) fermerQui(); });
      f.append(x, el("h2", null, "Qui voit « " + sujet + " »"), corps);
      voile.append(f);
      document.body.append(voile);
      x.focus();
    });
    return n;
  }
  function poserLignes() {
    for (const tr of document.querySelectorAll("tr[data-aut]")) {
      if (tr.dataset.dr || !tr.dataset.aut) continue;
      const aut = tr.dataset.aut, th = tr.querySelector("th");
      const r = M.rapports.find((y) => y.automatisation === aut);
      if (!th || !r) continue;
      tr.dataset.dr = "1";
      const g = el("span", "dr-g2 dr-adm");
      const o = el("span", "dr-oeil-p");
      const poser = () => { o.replaceChildren(oeil(aut)); tr.classList.toggle("dr-masque", M.caches.has(aut)); };
      poser();
      vues.add(poser);
      g.append(o, compte(aut, th.textContent.trim() || r.sujet));
      th.prepend(g);
    }
    for (const row of document.querySelectorAll(".tiroir-l[data-auto], .tiroir-l[data-agent]")) {
      if (row.dataset.dr) continue;
      row.dataset.dr = "1";
      const aut = row.dataset.auto || row.dataset.agent, w = el("div", "dr-w"), o = el("span", "dr-oeil-p dr-adm");
      const poser = () => { o.replaceChildren(oeil(aut)); row.classList.toggle("dr-masque-l", M.caches.has(aut)); };
      poser();
      vues.add(poser);
      row.parentNode.insertBefore(w, row);
      w.append(o, row);
    }
  }

  // ------------------------------------------------------------ l'allumage
  // Comme le reste du portail (commun.js, « le cache ») : le modele garde dans le navigateur s'affiche tout de suite,
  // puis se revalide en reseau et ne se redessine que s'il a change. Sans lui, le bandeau attendait la reponse a
  // chaque onglet (Antoine, le 2026-11-23 : « un délai de quelques ms avant que la partie admin s'affiche »).
  // Efface a la deconnexion avec tout le cache du client (viderCache).
  let demande = false, allume = false;
  function allumer(d) {
    charger(d);
    if (allume) { for (const f of vues) f(); return; }
    allume = true;
    poserBandeau();
    poserLignes();
    new MutationObserver(() => { poserBandeau(); poserLignes(); }).observe(document.body, { childList: true, subtree: true });
  }
  async function demarrer() {
    if (demande || typeof moi === "undefined" || !moi || !moi.voir_comme || moi.comme) return;
    demande = true;
    const cle = moi.adresse + ":/api/admin/droits", garde = relire(cle);
    if (garde && Array.isArray(garde.personnes)) allumer(garde);
    const r = await appeler("GET", "/api/admin/droits");
    if (r.statut !== 200 || !r.donnees || !Array.isArray(r.donnees.personnes)) {   // non branche, ou pas l'administrateur
      if (garde && (r.statut === 403 || r.statut === 503)) { oublier(cle); location.reload(); }   // le droit retire ne survit pas au cache
      return;
    }
    stocker(cle, r.donnees);
    if (occupe || (garde && JSON.stringify(garde) === JSON.stringify(r.donnees))) return;
    allumer(r.donnees);
  }
  const guet = new MutationObserver(() => { if ($("avatar") && $("avatar").textContent) { guet.disconnect(); demarrer(); } });
  document.addEventListener("DOMContentLoaded", () => {
    if ($("avatar") && $("avatar").textContent) demarrer();
    else guet.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  return { ouvrir };
})();
