// La page de connexion, publique : l'adresse, puis le code recu par courriel.
// Deja connecte, on part tout de suite vers la page demandee. `retour` ne peut nommer
// qu'une page du portail : jamais une adresse exterieure.
"use strict";

const demande = new URLSearchParams(location.search);
const MOTIFS = { perdue: "Votre session a pris fin. Reconnectez-vous pour continuer.", fin: "Vous êtes déconnecté." };

function retour() {
  const r = demande.get("retour") || "";
  const [page, requete = ""] = r.split("?");
  return PAGES.includes(page) ? page + (requete ? "?" + requete : "") : "index.html";
}

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
  viderCache();   // un nouveau compte ne voit jamais le cache d'un autre
  location.replace(retour());
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

// Deja connecte (cookie valide) : on ne redemande rien.
(async () => {
  const motif = MOTIFS[demande.get("motif")];
  direConnexion(motif || "");
  etape(1);
  if (motif) return;   // arrive ici parce que la session a pris fin : ne pas repartir tout seul
  const { statut } = await appeler("GET", "/api/moi");
  if (statut === 200) location.replace(retour());
})();
