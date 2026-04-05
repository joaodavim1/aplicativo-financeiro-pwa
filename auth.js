import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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

  nodes.authDescription.textContent =
    "Entre com sua conta Google para manter uma area separada dentro do app.";
  nodes.authStatusMessage.textContent =
    "Se quiser testar sem login, o modo demo continua disponivel.";

  onAuthStateChanged(auth, (user) => {
    if (user) {
      nodes.authGate.classList.add("hidden");
      nodes.protectedApp.classList.remove("hidden");
      nodes.logoutButton.classList.remove("hidden");
      bootFinanceiroApp({ mode: "google", user });
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
  bootFinanceiroApp({ mode: "demo" });
}

async function handleGoogleLogin() {
  if (!auth) {
    nodes.authStatusMessage.textContent =
      "Preencha o firebase-config.js para ativar o login Google.";
    return;
  }

  try {
    nodes.authStatusMessage.textContent = "Redirecionando para o Google...";
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithRedirect(auth, provider);
  } catch (error) {
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
