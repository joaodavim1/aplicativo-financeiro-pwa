import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { bootFinanceiroApp } from "./app.js";

const runtimeConfig = window.FINANCEIRO_FIREBASE_CONFIG || null;
const authOptions = {
  requireLogin: false,
  ...window.FINANCEIRO_AUTH_OPTIONS
};

const nodes = {
  authGate: document.querySelector("#authGate"),
  protectedApp: document.querySelector("#protectedApp"),
  authDescription: document.querySelector("#authDescription"),
  authStatusMessage: document.querySelector("#authStatusMessage"),
  googleLoginButton: document.querySelector("#googleLoginButton"),
  continueDemoButton: document.querySelector("#continueDemoButton"),
  logoutButton: document.querySelector("#logoutButton")
};

let auth = null;
let db = null;

bootstrap();

function bootstrap() {
  nodes.googleLoginButton.addEventListener("click", handleGoogleLogin);
  nodes.continueDemoButton.addEventListener("click", openDemoMode);
  nodes.logoutButton.addEventListener("click", handleLogout);

  if (!isFirebaseConfigured(runtimeConfig)) {
    nodes.authGate.classList.remove("hidden");
    nodes.protectedApp.classList.remove("hidden");
    nodes.authDescription.textContent =
      "O login Google esta preparado, mas falta preencher o arquivo firebase-config.js com as credenciais do Firebase.";
    nodes.authStatusMessage.textContent =
      "Enquanto isso, voce pode usar o app em modo demo local.";
    openDemoMode();
    return;
  }

  const app = initializeApp(runtimeConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  nodes.authDescription.textContent =
    "Entre com sua conta Google para manter uma area separada dentro do app.";
  nodes.authStatusMessage.textContent =
    "Se quiser testar sem login, o modo demo continua disponivel.";

  onAuthStateChanged(auth, (user) => {
    if (user) {
      nodes.authGate.classList.add("hidden");
      nodes.protectedApp.classList.remove("hidden");
      nodes.logoutButton.classList.remove("hidden");
      nodes.authStatusMessage.textContent = "Conta Google conectada.";
      bootFinanceiroApp({
        mode: "google",
        user,
        persistence: createFirestorePersistence(user)
      });
      return;
    }

    nodes.logoutButton.classList.add("hidden");

    if (authOptions.requireLogin) {
      nodes.authGate.classList.remove("hidden");
      nodes.protectedApp.classList.add("hidden");
      nodes.authStatusMessage.textContent = "Use sua conta Google para entrar.";
      return;
    }

    nodes.authGate.classList.remove("hidden");
    nodes.protectedApp.classList.remove("hidden");
    bootFinanceiroApp({ mode: "demo" });
  });

  nodes.googleLoginButton.dataset.authReady = "true";

  if (authOptions.requireLogin) {
    nodes.continueDemoButton.classList.add("hidden");
  }
}

function openDemoMode() {
  nodes.protectedApp.classList.remove("hidden");
  nodes.authGate.classList.remove("hidden");
  nodes.logoutButton.classList.add("hidden");
  bootFinanceiroApp({ mode: "demo" });
}

async function handleGoogleLogin() {
  if (!auth) {
    nodes.authStatusMessage.textContent =
      "Preencha o firebase-config.js para ativar o login Google.";
    return;
  }

  try {
    nodes.authStatusMessage.textContent = "Abrindo login Google...";
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch (error) {
    const code = error?.code || "";

    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      try {
        nodes.authStatusMessage.textContent = "Popup bloqueado. Tentando redirecionar...";
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirectError) {
        nodes.authStatusMessage.textContent = formatAuthError(redirectError);
        return;
      }
    }

    nodes.authStatusMessage.textContent = formatAuthError(error);
  }
}

async function handleLogout() {
  if (!auth) return;

  try {
    await signOut(auth);
    nodes.authStatusMessage.textContent = "Voce saiu da conta Google.";
  } catch (error) {
    nodes.authStatusMessage.textContent = formatAuthError(error);
  }
}

function isFirebaseConfigured(config) {
  if (!config || typeof config !== "object") return false;

  const requiredKeys = ["apiKey", "authDomain", "projectId", "appId"];
  return requiredKeys.every((key) => typeof config[key] === "string" && config[key].trim().length > 0);
}

function formatAuthError(error) {
  const code = error?.code || "erro-desconhecido";
  return `Falha no login Google (${code}).`;
}

function createFirestorePersistence(user) {
  const documentRef = doc(db, "users", user.uid, "apps", "financeiro");

  return {
    async loadState() {
      const snapshot = await getDoc(documentRef);
      if (!snapshot.exists()) {
        return null;
      }

      return snapshot.data()?.state ?? null;
    },
    async saveState(state) {
      await setDoc(
        documentRef,
        {
          state,
          profile: {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || ""
          },
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  };
}
