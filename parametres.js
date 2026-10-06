// La page des parametres : recevoir les rapports par courriel, et quels jours.
// Une revalidation ne redessine jamais une page ou l'utilisateur a deja coche quelque
// chose : sa saisie passe avant des donnees fraiches qu'il n'a pas demandees.
"use strict";

const JOURS = { lun: ["Lun.", "Lundi"], mar: ["Mar.", "Mardi"], mer: ["Mer.", "Mercredi"], jeu: ["Jeu.", "Jeudi"],
                ven: ["Ven.", "Vendredi"], sam: ["Sam.", "Samedi"], dim: ["Dim.", "Dimanche"] };
let suivies = [];   // [ligne de l'API, interrupteur, cases par jour, etat d'origine]

function etatLigne(s) {
  return JSON.stringify([s.inter.checked, Object.entries(s.casesJ).filter(([, c]) => c.checked).map(([j]) => j)]);
}

const modifiee = () => suivies.some((s) => etatLigne(s) !== s.origine);

function vueParametres([donnees]) {
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
  suivies = [];

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
    oublier(cleDe(SOURCES.parametres));   // la prochaine visite relit la feuille
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

demarrer(() => suivre([SOURCES.parametres], (d, premier) => {
  if (!premier && modifiee()) return;   // une saisie en cours n'est jamais ecrasee
  poser(vueParametres(d), premier);
}));
