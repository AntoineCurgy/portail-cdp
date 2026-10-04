// La page du portail. Elle ne decide de rien : l'API refuse, la page affiche.
// L'adresse de l'API est publique ; aucun secret ne vit ici.
"use strict";

// En local, page et API sur `localhost` : meme site, donc le cookie strict passe
// (127.0.0.1 et localhost sont deux sites differents pour le navigateur).
const API = location.hostname === "localhost"
  ? "http://localhost:8790"
  : "https://api-" + location.hostname;   // portail-cdp.88systems.io -> api-portail-cdp.88systems.io
const DELAI = 15000;

const $ = (id) => document.getElementById(id);
let adresse = "";

function dire(texte, erreur = false) {
  const m = $("message");
  m.textContent = texte;
  m.className = erreur ? "erreur" : "discret";
}

function montrer(etape) {
  for (const id of ["etape-adresse", "etape-code", "etape-liste"]) $(id).hidden = id !== etape;
  const premier = $(etape).querySelector("input, button");
  if (premier) premier.focus();
}

async function appeler(methode, chemin, corps) {
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), DELAI);
  try {
    const r = await fetch(API + chemin, {
      method: methode, credentials: "include", signal: controle.signal,
      headers: corps ? { "Content-Type": "application/json" } : {},
      body: corps ? JSON.stringify(corps) : undefined,
    });
    let donnees = null;
    try { donnees = await r.json(); } catch (_) { donnees = null; }
    return { statut: r.status, donnees };
  } catch (_) {
    return { statut: 0, donnees: null };
  } finally {
    clearTimeout(minuteur);
  }
}

function taille(octets) {
  if (octets < 1024) return octets + " o";
  if (octets < 1024 * 1024) return Math.round(octets / 1024) + " Ko";
  return (octets / 1024 / 1024).toFixed(1).replace(".", ",") + " Mo";
}

function quand(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;   // jamais d'omission : la valeur brute plutot que rien
  return d.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }) + " (heure de Paris)";
}

async function charger() {
  const { statut, donnees } = await appeler("GET", "/api/rapports");
  if (statut === 401) return montrer("etape-adresse");
  if (statut !== 200 || !donnees || !Array.isArray(donnees.rapports)) {
    dire("Le service ne répond pas pour l'instant. Réessayez dans quelques minutes.", true);
    return montrer("etape-adresse");
  }
  const liste = $("rapports");
  liste.replaceChildren();
  for (const r of donnees.rapports) {
    const li = document.createElement("li");
    const texte = document.createElement("div");
    const titre = document.createElement("p");
    titre.textContent = r.sujet || r.nom || r.id;
    const detail = document.createElement("p");
    detail.className = "discret";
    detail.textContent = quand(r.produit_le) + " · " + taille(r.taille);
    texte.append(titre, detail);
    let action;
    if (r.telechargeable) {
      action = document.createElement("a");
      action.href = API + "/api/rapports/" + encodeURIComponent(r.id);
    } else {
      // Decision d'Antoine du 2026-10-03 : un passage interrompu ne se telecharge pas,
      // et l'utilisateur qui essaie recoit un message, pas une erreur.
      action = document.createElement("button");
      action.type = "button";
      action.className = "bouton indisponible";
      action.setAttribute("aria-disabled", "true");
      action.addEventListener("click", () => dire(
        "« " + titre.textContent + " » : le dernier passage n'a pas abouti, il n'y a rien à télécharger. " +
        "Le rapport reviendra au prochain passage réussi.", true));
      detail.textContent = quand(r.produit_le) + " · dernier passage interrompu";
    }
    action.classList.add("bouton");
    action.textContent = "Télécharger";
    action.setAttribute("aria-label", "Télécharger " + titre.textContent);
    li.append(texte, action);
    liste.append(li);
  }
  dire(donnees.rapports.length ? "" : "Aucun rapport n'est disponible pour votre adresse.");
  montrer("etape-liste");
}

$("etape-adresse").addEventListener("submit", async (e) => {
  e.preventDefault();
  adresse = $("adresse").value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
    $("adresse").setAttribute("aria-invalid", "true");
    return dire("Saisissez une adresse complète, par exemple prenom.nom@entreprise.fr.", true);
  }
  $("adresse").removeAttribute("aria-invalid");
  const { statut, donnees } = await appeler("POST", "/api/connexion", { adresse });
  if (statut !== 200) return dire("Le service ne répond pas pour l'instant. Réessayez dans quelques minutes.", true);
  if (donnees && donnees.inconnue) {
    // Decision d'Antoine du 2026-10-04 : une adresse sans compte ne recoit pas de code,
    // et on lui dit a qui ecrire pour etre ajoutee.
    return dire("Cette adresse n'a pas encore de compte. Écrivez à " + (donnees.contact || "votre administrateur") +
                " pour que l'administrateur vous ajoute.", true);
  }
  dire("Un code vient d'être envoyé à " + adresse + ". Il est valable dix minutes.");
  montrer("etape-code");
});

$("etape-code").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("code").value.trim();
  const { statut } = await appeler("POST", "/api/session", { adresse, code });
  if (statut === 401) return dire("Ce code n'est pas valable, ou il a expiré. Demandez-en un nouveau.", true);
  if (statut !== 200) return dire("Le service ne répond pas pour l'instant. Réessayez dans quelques minutes.", true);
  $("code").value = "";
  dire("");
  charger();
});

$("changer-adresse").addEventListener("click", () => { dire(""); montrer("etape-adresse"); });

$("deconnexion").addEventListener("click", async () => {
  await appeler("POST", "/api/deconnexion", {});
  dire("Vous êtes déconnecté.");
  montrer("etape-adresse");
});

charger();
