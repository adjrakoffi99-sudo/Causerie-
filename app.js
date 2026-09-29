const API = window.location.origin;

// ===============================
// Éléments de l'interface
// ===============================

const statusEl = document.querySelector("header")?.querySelector("span:last-child");

const inputs = document.querySelectorAll("input");

const nameInput =
  document.querySelector('input[placeholder="Nom"]') ||
  document.querySelector('input[name="name"]');

const phoneInput =
  document.querySelector('input[placeholder="Numéro de téléphone"]') ||
  document.querySelector('input[name="phone"]');

const passwordInput =
  document.querySelector('input[placeholder="Mot de passe"]') ||
  document.querySelector('input[name="password"]');

const buttons = Array.from(document.querySelectorAll("button"));

const registerBtn = buttons.find(b =>
  b.textContent.trim().toLowerCase().includes("créer un compte")
);

const loginBtn = buttons.find(b =>
  b.textContent.trim().toLowerCase().includes("connexion")
);

// ===============================
// API
// ===============================

async function api(path, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(data.error || data.message || "Erreur serveur");
  }

  return data;
}

// ===============================
// Vérification connexion serveur
// ===============================

async function checkServer() {
  try {
    const data = await api("/api/health");

    console.log("Serveur connecté :", data);

    if (statusEl) {
      statusEl.textContent = "En ligne";
      statusEl.style.color = "#22c55e";
    }

    return true;
  } catch (error) {
    console.error("Serveur inaccessible :", error);

    if (statusEl) {
      statusEl.textContent = "Hors connexion";
      statusEl.style.color = "#ef4444";
    }

    return false;
  }
}

// ===============================
// Inscription
// ===============================

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const name = nameInput?.value.trim();
    const phone = phoneInput?.value.trim();
    const password = passwordInput?.value;

    if (!name || !phone || !password) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = "Création...";

    try {
      const result = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          password
        })
      });

      if (result.token) {
        localStorage.setItem("causerie_token", result.token);
      }

      alert("Compte créé avec succès !");

      window.location.reload();

    } catch (error) {
      alert(error.message);
    } finally {
      registerBtn.disabled = false;
      registerBtn.textContent = "Créer un compte";
    }
  });
}

// ===============================
// Connexion
// ===============================

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const phone = phoneInput?.value.trim();
    const password = passwordInput?.value;

    if (!phone || !password) {
      alert("Entrez votre numéro et votre mot de passe.");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Connexion...";

    try {
      const result = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          phone,
          password
        })
      });

      if (result.token) {
        localStorage.setItem("causerie_token", result.token);
      }

      alert("Connexion réussie !");

      window.location.reload();

    } catch (error) {
      alert(error.message);
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Connexion";
    }
  });
}

// ===============================
// Récupérer le profil connecté
// ===============================

async function getMe() {
  const token = localStorage.getItem("causerie_token");

  if (!token) return null;

  try {
    return await api("/api/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error("Session invalide :", error);
    localStorage.removeItem("causerie_token");
    return null;
  }
}

// ===============================
// Initialisation
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Causerie démarré");

  await checkServer();

  const user = await getMe();

  if (user) {
    console.log("Utilisateur connecté :", user);
  }
});
