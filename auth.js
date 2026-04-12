import { bootFinanceiroApp, getFinanceiroMenuState } from "./app.js?v=20260411ah";

const IOS_APP_VERSION = "Versão atual: 1.14";
const IOS_SETTINGS_VERSION = "1.14";
const IOS_BUILD_TOKEN = "20260411ah";
const BUILD_STORAGE_KEY = "financeiro-pwa-build-token";

const runtimeConfig = window.FINANCEIRO_SUPABASE_CONFIG || null;
const authOptions = {
  requireLogin: false,
  ...window.FINANCEIRO_AUTH_OPTIONS
};
const SESSION_STORAGE_KEY = "financeiro-pwa-supabase-session-v1";
const UI_PREFS_STORAGE_KEY_PREFIX = "financeiro-pwa-ui-prefs-";
const SETTINGS_LIST_SEPARATOR = "|||";
const GOOGLE_BUTTON_WIDTH = 280;
const BUDGET_COLORS = ["#145c4c", "#6bc5a4", "#f08a24", "#d9604c", "#256d5a"];
const SESSION_TIMEOUT_MS = 4000;
const nodes = {
  authGate: document.querySelector("#authGate"),
  protectedApp: document.querySelector("#protectedApp"),
  authDescription: document.querySelector("#authDescription"),
  authStatusMessage: document.querySelector("#authStatusMessage"),
  googleLoginMount: document.querySelector("#googleLoginMount"),
  continueDemoButton: document.querySelector("#continueDemoButton"),
  menuButton: document.querySelector("#menuButton"),
  logoutButton: document.querySelector("#logoutButton"),
  menuDialog: document.querySelector("#menuDialog"),
  closeMenuButton: document.querySelector("#closeMenuButton"),
  menuCurrentAccountName: document.querySelector("#menuCurrentAccountName"),
  menuAccountsList: document.querySelector("#menuAccountsList"),
  menuAccountDetails: document.querySelector("#menuAccountDetails"),
  menuCurrentAccess: document.querySelector("#menuCurrentAccess"),
  menuActionButtons: document.querySelector("#menuActionButtons"),
  menuScreenOrder: document.querySelector("#menuScreenOrder"),
  menuScreenOrderList: document.querySelector("#menuScreenOrderList"),
  menuScreenOrderFeedback: document.querySelector("#menuScreenOrderFeedback"),
  menuUpdateButton: document.querySelector("#menuUpdateButton"),
  menuThemeLightButton: document.querySelector("#menuThemeLightButton"),
  menuThemeDarkButton: document.querySelector("#menuThemeDarkButton"),
  menuLoginButton: document.querySelector("#menuLoginButton"),
  menuLogoutButton: document.querySelector("#menuLogoutButton"),
  menuAppVersion: document.querySelector("#menuAppVersion"),
  installHelpButton: document.querySelector("#installHelpButton"),
  settingsLoginButton: document.querySelector("#settingsLoginButton"),
  settingsInstallButton: document.querySelector("#settingsInstallButton"),
  settingsLogoutButton: document.querySelector("#settingsLogoutButton"),
  settingsAppVersion: document.querySelector("#settingsAppVersion")
};

let currentSession = null;

ensureLatestBuild().then((ready) => {
  if (ready) {
    bootstrap();
  }
});

async function ensureLatestBuild() {
  try {
    const currentUrl = new URL(window.location.href);
    const currentBuild = currentUrl.searchParams.get("build");
    const storedBuild = window.localStorage.getItem(BUILD_STORAGE_KEY);

    if (storedBuild === IOS_BUILD_TOKEN && currentBuild === IOS_BUILD_TOKEN) {
      return true;
    }

    if (storedBuild !== IOS_BUILD_TOKEN || currentBuild !== IOS_BUILD_TOKEN) {
      window.localStorage.setItem(BUILD_STORAGE_KEY, IOS_BUILD_TOKEN);

      if ("serviceWorker" in navigator && typeof navigator.serviceWorker.getRegistrations === "function") {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ("caches" in window && typeof caches.keys === "function") {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      currentUrl.searchParams.set("build", IOS_BUILD_TOKEN);
      window.location.replace(currentUrl.toString());
      return false;
    }
  } catch (error) {
    console.warn("Falha ao preparar build atual:", error);
  }

  return true;
}

async function bootstrap() {
  try {
    bindEvents();
    syncVersionBadges();
    syncMenuState();

    if (!isSupabaseConfigured(runtimeConfig)) {
      nodes.authGate.classList.remove("hidden");
      nodes.protectedApp.classList.remove("hidden");
      nodes.authDescription.textContent =
        "Entre com sua conta para abrir os dados.";
      nodes.authStatusMessage.textContent =
        "Enquanto isso, voce pode abrir a versao local.";
      openDemoMode();
      return;
    }

    nodes.authDescription.textContent =
      "Entre com a mesma conta usada no Android.";
    nodes.authStatusMessage.textContent =
      "Os dados desta conta serao carregados ao entrar.";

    try {
      await withTimeout(mountGoogleButton(), SESSION_TIMEOUT_MS, "Tempo esgotado ao preparar o acesso.");
    } catch (error) {
      nodes.authStatusMessage.textContent = formatAuthError(error);
    }

    let restoredSession = null;
    try {
      restoredSession = await withTimeout(restoreSession(), SESSION_TIMEOUT_MS, "Tempo esgotado ao restaurar a conta.");
    } catch (error) {
      console.warn("Falha ao restaurar sessao:", error);
      currentSession = null;
      clearPersistedSession();
    }

    if (restoredSession) {
      await openSupabaseMode(restoredSession);
      return;
    }

    nodes.logoutButton.classList.add("hidden");

    if (authOptions.requireLogin) {
      nodes.authGate.classList.remove("hidden");
      nodes.protectedApp.classList.add("hidden");
      nodes.authStatusMessage.textContent = "Use sua conta para entrar.";
      return;
    }

    openDemoMode();
  } catch (error) {
    console.warn("Falha ao iniciar app:", error);
    nodes.authGate.classList.remove("hidden");
    nodes.protectedApp.classList.remove("hidden");
    nodes.authStatusMessage.textContent = "Versao local aberta.";
    openDemoMode({ statusMessage: "Versao local aberta." });
  }
}

function bindEvents() {
  nodes.continueDemoButton.addEventListener("click", openDemoMode);
  nodes.logoutButton.addEventListener("click", handleLogout);
  nodes.menuButton?.addEventListener("click", openMenuDialog);
  nodes.closeMenuButton?.addEventListener("click", closeMenuDialog);
  nodes.menuUpdateButton?.addEventListener("click", () => refreshAppVersion({ closeMenu: true }));
  nodes.menuThemeLightButton?.addEventListener("click", async () => {
    await window.financeiroSetThemeMode?.("light");
    syncMenuState(window.financeiroGetMenuState?.());
  });
  nodes.menuThemeDarkButton?.addEventListener("click", async () => {
    await window.financeiroSetThemeMode?.("dark");
    syncMenuState(window.financeiroGetMenuState?.());
  });
  nodes.menuLoginButton?.addEventListener("click", async () => {
    closeMenuDialog();
    await handleAccountAccess();
  });
  nodes.menuLogoutButton?.addEventListener("click", async () => {
    closeMenuDialog();
    await handleLogout();
  });
  nodes.installHelpButton?.addEventListener("click", () => refreshAppVersion());
  nodes.settingsLoginButton?.addEventListener("click", handleAccountAccess);
  nodes.settingsInstallButton?.addEventListener("click", () => refreshAppVersion());
  nodes.settingsLogoutButton?.addEventListener("click", handleLogout);
  nodes.menuActionButtons?.addEventListener("click", handleMenuActionButtonClick);
  nodes.menuScreenOrderList?.addEventListener("click", handleMenuOrderClick);
  bindDialogBackdrop(nodes.menuDialog);
  window.addEventListener("financeiro:menu-state", (event) => {
    syncMenuState(event.detail);
  });
}

function bindDialogBackdrop(dialog) {
  dialog?.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const clickedInside =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;

    if (!clickedInside) {
      closeDialog(dialog);
    }
  });
}

function openMenuDialog() {
  openDialog(nodes.menuDialog);
}

function closeMenuDialog() {
  closeDialog(nodes.menuDialog);
}

function openDialog(dialog) {
  if (!dialog) return;

  try {
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
  } catch (error) {
    console.warn("Falha ao abrir dialogo:", error);
  }

  dialog.setAttribute("open", "open");
}

function closeDialog(dialog) {
  if (!dialog) return;

  try {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
  } catch (error) {
    console.warn("Falha ao fechar dialogo:", error);
  }

  dialog.removeAttribute("open");
}

function refreshAppVersion(options = {}) {
  const { closeMenu = false } = options;

  if (closeMenu) {
    closeMenuDialog();
  }

  nodes.authStatusMessage.textContent = "Atualizando versao...";

  window.setTimeout(() => {
    try {
      if ("serviceWorker" in navigator && typeof navigator.serviceWorker.getRegistrations === "function") {
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
          .catch((error) => console.warn("Falha ao remover service worker:", error));
      }

      if ("caches" in window && typeof caches.keys === "function") {
        caches.keys()
          .then((cacheKeys) => Promise.all(cacheKeys.map((key) => caches.delete(key))))
          .catch((error) => console.warn("Falha ao limpar caches:", error));
      }
    } catch (error) {
      console.warn("Falha ao preparar atualizacao:", error);
    }

    const refreshUrl = new URL("https://joaodavim1.github.io/aplicativo-financeiro-pwa/");
    refreshUrl.searchParams.set("refresh", String(Date.now()));
    window.location.assign(refreshUrl.toString());
  }, closeMenu ? 120 : 0);
}

function openLoginArea() {
  nodes.authGate.classList.remove("hidden");
  nodes.protectedApp.classList.remove("hidden");
  nodes.authStatusMessage.textContent = "Escolha a conta para entrar.";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleAccountAccess() {
  if (currentSession?.accessToken) {
    await switchAccount();
    return;
  }
  openLoginArea();
}

async function switchAccount() {
  try {
    window.google?.accounts?.id?.disableAutoSelect?.();
  } catch (error) {
    console.warn("Falha ao desativar selecao automatica:", error);
  }

  await handleLogout({
    reopenLogin: true,
    statusMessage: "Escolha outra conta para entrar."
  });
}

async function mountGoogleButton() {
  if (!runtimeConfig.googleClientId) {
    throw new Error("Preencha googleClientId no supabase-config.js.");
  }

  const { googleClient, hashedNonce, nonce } = await createGoogleNonceClient();
  nodes.googleLoginMount.innerHTML = "";

  googleClient.accounts.id.initialize({
    client_id: runtimeConfig.googleClientId,
    callback: (response) => handleGoogleCredential(response, nonce),
    auto_select: false,
    itp_support: true,
    use_fedcm_for_prompt: true,
    nonce: hashedNonce
  });

  googleClient.accounts.id.renderButton(nodes.googleLoginMount, {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "signin_with",
    width: GOOGLE_BUTTON_WIDTH
  });
}

function openDemoMode(options = {}) {
  const { statusMessage = "Versao local aberta." } = options;
  nodes.protectedApp.classList.remove("hidden");
  nodes.authGate.classList.remove("hidden");
  nodes.logoutButton.classList.add("hidden");
  nodes.authStatusMessage.textContent = statusMessage;
  syncAccountActions(false);
  bootFinanceiroApp({ mode: "demo" });
}

async function handleGoogleCredential(response, nonce) {
  try {
    nodes.authStatusMessage.textContent = "Entrando na conta...";
    currentSession = await signInWithGoogleIdToken(response.credential, nonce);
    persistSession(currentSession);
    await openSupabaseMode(currentSession);
  } catch (error) {
    nodes.authStatusMessage.textContent = formatAuthError(error);
  }
}

async function handleLogout(options = {}) {
  const { reopenLogin = false, statusMessage = "Voce saiu da conta." } = options;
  try {
    const session = await ensureSession();
    if (session?.accessToken) {
      await requestSupabase({
        method: "POST",
        path: "/auth/v1/logout",
        bearerToken: session.accessToken
      });
    }
  } catch (error) {
    console.warn("Falha ao encerrar sessao:", error);
  }

  currentSession = null;
  clearPersistedSession();
  nodes.authStatusMessage.textContent = statusMessage;
  openDemoMode({ statusMessage });

  if (reopenLogin) {
    openLoginArea();
  }
}

async function openSupabaseMode(session) {
  const user = session.user || (await fetchCurrentUser(session.accessToken));
  currentSession = {
    ...session,
    user
  };
  persistSession(currentSession);
  nodes.authGate.classList.add("hidden");
  nodes.protectedApp.classList.remove("hidden");
  nodes.logoutButton.classList.remove("hidden");
  nodes.authStatusMessage.textContent = "Conta aberta.";
  syncAccountActions(true);

  try {
    await bootFinanceiroApp({
      mode: "google",
      user,
      persistence: createSupabasePersistence(ensureSession)
    });
  } catch (error) {
    nodes.authGate.classList.remove("hidden");
    nodes.authStatusMessage.textContent = formatAuthError(error);
    await bootFinanceiroApp({ mode: "demo" });
  }
}

function syncAccountActions(isLoggedIn) {
  syncMenuState(getFinanceiroMenuState());
  if (nodes.settingsLoginButton) {
    nodes.settingsLoginButton.textContent = isLoggedIn ? "Trocar conta" : "Entrar com Google";
    nodes.settingsLoginButton.classList.remove("hidden");
  }
  if (nodes.menuLoginButton) {
    nodes.menuLoginButton.textContent = isLoggedIn ? "Trocar conta" : "Entrar com Google";
    nodes.menuLoginButton.classList.remove("hidden");
  }
  if (nodes.settingsLogoutButton) {
    nodes.settingsLogoutButton.textContent = isLoggedIn ? "Sair da conta" : "Limpar acesso";
    nodes.settingsLogoutButton.classList.remove("hidden");
  }
  if (nodes.menuLogoutButton) {
    nodes.menuLogoutButton.textContent = isLoggedIn ? "Sair da conta" : "Limpar acesso";
    nodes.menuLogoutButton.classList.remove("hidden");
  }
}

function syncMenuState(menuState = null) {
  const snapshot = menuState || {
    accountName: currentIdentityLabel() || "Sem conta",
    accessLabel: currentSession?.accessToken ? "Conta ativa" : "Conta local",
    accountDetails: [{ label: "Acesso", value: currentSession?.accessToken ? "Conta ativa" : "Conta local" }],
    accounts: [
      {
        id: "local",
        name: currentIdentityLabel() || "Sem conta",
        phone: "",
        email: "",
        isActive: true
      }
    ],
    screenOrder: ["Múltiplos", "Lançamentos", "Extrato", "Futuro"],
    screenOrderActions: [
      { id: "MULTIPLOS", label: "Múltiplos" },
      { id: "LANCAMENTOS", label: "Lançamentos" },
      { id: "EXTRATO", label: "Extrato" },
      { id: "QUADRO", label: "Futuro" }
    ],
    themeMode: "light",
    menuActions: [
      { id: "EXPORT_CSV", label: "Exportar CSV" },
      { id: "EXPORT_EXCEL", label: "Exportar Excel" }
    ]
  };

  if (nodes.menuCurrentAccountName) {
    nodes.menuCurrentAccountName.textContent = snapshot.accountName || "Sem conta";
  }
  if (nodes.menuAccountsList) {
    nodes.menuAccountsList.innerHTML = renderMenuAccounts(snapshot.accounts || []);
  }
  if (nodes.menuAccountDetails) {
    nodes.menuAccountDetails.innerHTML = renderMenuDetails(snapshot.accountDetails || []);
  }
  if (nodes.menuActionButtons) {
    nodes.menuActionButtons.innerHTML = renderMenuActionButtons(snapshot.menuActions || []);
  }
  if (nodes.menuScreenOrderList) {
    nodes.menuScreenOrderList.innerHTML = renderMenuScreenOrder(snapshot.screenOrderActions || []);
  }
  const isDark = snapshot.themeMode === "dark";
  nodes.menuThemeLightButton?.classList.toggle("primary-button", !isDark);
  nodes.menuThemeLightButton?.classList.toggle("ghost-button", isDark);
  nodes.menuThemeLightButton?.classList.toggle("dark-ghost", isDark);
  nodes.menuThemeDarkButton?.classList.toggle("primary-button", isDark);
  nodes.menuThemeDarkButton?.classList.toggle("ghost-button", !isDark);
  nodes.menuThemeDarkButton?.classList.toggle("dark-ghost", !isDark);
}

function syncVersionBadges() {
  if (nodes.menuAppVersion) {
    nodes.menuAppVersion.textContent = IOS_APP_VERSION;
  }
  if (nodes.settingsAppVersion) {
    nodes.settingsAppVersion.textContent = IOS_SETTINGS_VERSION;
  }
}

async function handleMenuActionButtonClick(event) {
  const button = event.target.closest("[data-menu-action]");
  if (!button) return;
  closeMenuDialog();
  await window.financeiroRunMenuAction?.(button.dataset.menuAction);
}

async function handleMenuOrderClick(event) {
  const button = event.target.closest("[data-order-move][data-menu-action]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const changed = await window.financeiroMoveMenuAction?.(button.dataset.menuAction, button.dataset.orderMove);
  if (changed && nodes.menuScreenOrderFeedback) {
    nodes.menuScreenOrderFeedback.textContent = "Ordem das telas atualizada.";
    window.setTimeout(() => {
      if (nodes.menuScreenOrderFeedback?.textContent === "Ordem das telas atualizada.") {
        nodes.menuScreenOrderFeedback.textContent = "";
      }
    }, 2200);
  }
}

function renderMenuAccounts(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return `<div class="empty-state">Nenhuma conta encontrada.</div>`;
  }

  return accounts
    .map((account) => `
      <div class="menu-list-card">
        <div class="menu-list-card-header">
          <span class="menu-list-card-title">${escapeHtml(account.name || "Sem conta")}</span>
          ${account.isActive ? `<span class="menu-inline-badge">Em uso</span>` : ""}
        </div>
        <div class="menu-list-card-copy">
          <p class="muted">${escapeHtml(account.phone || "Telefone não informado")}</p>
          <p class="muted">${escapeHtml(account.email || "Email não informado")}</p>
        </div>
      </div>
    `)
    .join("");
}

function renderMenuDetails(details) {
  if (!Array.isArray(details) || details.length === 0) {
    return `<div class="empty-state">Sem dados da conta.</div>`;
  }

  return details
    .map((item) => `
      <div class="menu-detail-row">
        <strong>${escapeHtml(item.label || "")}</strong>
        <p class="muted">${escapeHtml(item.value || "")}</p>
      </div>
    `)
    .join("");
}

function renderMenuActionButtons(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return `<div class="empty-state">Sem atalhos configurados.</div>`;
  }

  return actions
    .map((action) => `
      <button class="${action.id === "EXPORT_CSV" || action.id === "EXPORT_EXCEL" ? "primary-button menu-action-button menu-export-button" : "ghost-button dark-ghost menu-dark menu-action-button"}" data-menu-action="${escapeHtml(action.id || "")}" type="button">
        ${escapeHtml(action.label || "")}
      </button>
    `)
    .join("");
}

function renderMenuScreenOrder(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return `<div class="empty-state">Sem itens configurados.</div>`;
  }

  return actions
    .map((action, index) => `
      <div class="menu-detail-row menu-order-row">
        <div class="menu-order-copy">
          <strong>${index + 1}. ${escapeHtml(action.label || "")}</strong>
          <p class="muted">Toque para mudar a posição no app.</p>
        </div>
        <div class="menu-order-actions">
          <button
            class="ghost-button dark-ghost compact-order-button"
            data-order-move="up"
            data-menu-action="${escapeHtml(action.id || "")}"
            type="button"
            ${index === 0 ? "disabled" : ""}
          >
            Subir
          </button>
          <button
            class="ghost-button dark-ghost compact-order-button"
            data-order-move="down"
            data-menu-action="${escapeHtml(action.id || "")}"
            type="button"
            ${index === actions.length - 1 ? "disabled" : ""}
          >
            Descer
          </button>
        </div>
      </div>
    `)
    .join("");
}

function currentIdentityLabel() {
  if (currentSession?.user?.displayName) return currentSession.user.displayName;
  if (currentSession?.user?.email) return currentSession.user.email;
  return "Conta local";
}

function isSupabaseConfigured(config) {
  if (!config || typeof config !== "object") return false;

  const requiredKeys = ["url", "anonKey", "googleClientId"];
  return requiredKeys.every((key) => typeof config[key] === "string" && config[key].trim().length > 0);
}

function formatAuthError(error) {
  const message = String(error?.message || error || "").trim();
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid client") || normalized.includes("invalid_client")) {
    return "Nao foi possivel abrir esta conta agora.";
  }
  if (normalized.includes("origin") || normalized.includes("audience")) {
    return "Esta conta ainda nao pode entrar neste acesso.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "Falha de rede ao abrir a conta.";
  }
  if (message) {
    return message;
  }
  return "Falha ao entrar na conta.";
}

function createSupabasePersistence(ensureSessionFn) {
  const context = {
    activeAccount: null,
    activeAccountId: null,
    activeSettings: null,
    activeAppSettings: null,
    defaultPaymentMethod: "Pix",
    remoteTransactionIds: []
  };

  return {
    async loadState() {
      const session = await ensureSessionFn();
      if (!session?.accessToken) {
        throw new Error("Faca login novamente para carregar os dados.");
      }

      const storedUiPreferences = readStoredUiPreferences(session.user.uid);

      const [people, transactions, accountSettings, appSettings] = await Promise.all([
        fetchPeople(session.accessToken),
        fetchTransactions(session.accessToken),
        fetchAccountSettings(session.accessToken),
        fetchAppSettings(session.accessToken)
      ]);

      const activeAccount = selectActiveAccount(
        people,
        transactions,
        Number(storedUiPreferences?.activeAccountId) || null
      );
      const activeAccountId = activeAccount?.id ?? (transactions[0]?.account_id ? Number(transactions[0].account_id) : null);
      const activeSettings =
        (activeAccountId == null
          ? accountSettings[0]
          : accountSettings.find((item) => Number(item.account_id) === Number(activeAccountId))) || null;
      const filteredTransactions =
        activeAccountId == null
          ? transactions
          : transactions.filter((item) => Number(item.account_id) === Number(activeAccountId));

      context.activeAccount = activeAccount;
      context.activeAccountId = activeAccountId;
      context.activeSettings = activeSettings;
      context.activeAppSettings = Array.isArray(appSettings) ? appSettings[0] || null : null;
      context.defaultPaymentMethod = decodeStringList(activeSettings?.payment_methods || "")[0] || "Pix";
      context.remoteTransactionIds = filteredTransactions
        .map((item) => Number(item.id))
        .filter((value) => Number.isFinite(value));

      const remoteState = buildStateFromRemote({
        people,
        activeAccount,
        activeAccountId,
        transactions: filteredTransactions,
        settings: activeSettings,
        appSettings: Array.isArray(appSettings) ? appSettings[0] || null : null
      });

      return mergeUiPreferences(remoteState, readStoredUiPreferences(session.user.uid));
    },
    async saveState(state) {
      const session = await ensureSessionFn();
      if (!session?.accessToken) {
        throw new Error("Faca login novamente para salvar os dados.");
      }
      const targetAccountId = Number(state?.ui?.activeAccountId) || Number(context.activeAccountId) || null;
      if (!targetAccountId) {
        throw new Error("Nao encontrei uma conta ativa para salvar a transacao.");
      }

      const payload = state.transactions.map((transaction) =>
        toSupabaseTransaction(transaction, {
          accountId: targetAccountId,
          ownerId: session.user.uid,
          defaultPaymentMethod: context.defaultPaymentMethod
        })
      );
      const localTransactionIds = payload
        .map((transaction) => Number(transaction.id))
        .filter((value) => Number.isFinite(value));
      const deletedTransactionIds = (Array.isArray(context.remoteTransactionIds) ? context.remoteTransactionIds : [])
        .filter((id) => Number.isFinite(Number(id)) && !localTransactionIds.includes(Number(id)));

      const settingsPayload = toSupabaseAccountSettings(state, {
        accountId: targetAccountId,
        ownerId: session.user.uid,
        activeSettings: context.activeSettings
      });
      const appSettingsPayload = toSupabaseAppSettings(state, {
        ownerId: session.user.uid,
        activeAppSettings: context.activeAppSettings
      });

      const requests = [
        requestSupabase({
          method: "POST",
          path: "/rest/v1/transactions",
          query: { on_conflict: "owner_id,id" },
          body: payload,
          bearerToken: session.accessToken,
          prefer: "resolution=merge-duplicates,return=minimal"
        }),
        requestSupabase({
          method: "POST",
          path: "/rest/v1/account_settings",
          query: { on_conflict: "owner_id,account_id" },
          body: [settingsPayload],
          bearerToken: session.accessToken,
          prefer: "resolution=merge-duplicates,return=minimal"
        }),
        requestSupabase({
          method: "POST",
          path: "/rest/v1/app_settings",
          query: { on_conflict: "owner_id,id" },
          body: [appSettingsPayload],
          bearerToken: session.accessToken,
          prefer: "resolution=merge-duplicates,return=minimal"
        })
      ];

      if (deletedTransactionIds.length > 0) {
        requests.push(
          requestSupabase({
            method: "DELETE",
            path: "/rest/v1/transactions",
            query: {
              owner_id: `eq.${session.user.uid}`,
              account_id: `eq.${targetAccountId}`,
              id: `in.(${deletedTransactionIds.join(",")})`
            },
            bearerToken: session.accessToken
          })
        );
      }

      await Promise.all(requests);

      context.activeSettings = {
        ...(context.activeSettings || {}),
        account_id: targetAccountId,
        expense_categories: settingsPayload.expense_categories,
        income_categories: settingsPayload.income_categories,
        payment_methods: settingsPayload.payment_methods,
        expense_category_limits: settingsPayload.expense_category_limits,
        payment_method_card_configs: settingsPayload.payment_method_card_configs,
        multi_launch_expense_category_amounts: settingsPayload.multi_launch_expense_category_amounts,
        multi_launch_income_category_amounts: settingsPayload.multi_launch_income_category_amounts
      };
      context.activeAppSettings = {
        ...(context.activeAppSettings || {}),
        id: appSettingsPayload.id,
        screen_order: appSettingsPayload.screen_order,
        updated_at: appSettingsPayload.updated_at
      };
      context.defaultPaymentMethod = decodeStringList(settingsPayload.payment_methods)[0] || "Pix";
      context.activeAccountId = targetAccountId;
      context.remoteTransactionIds = localTransactionIds;
      writeStoredUiPreferences(session.user.uid, state.ui);
    }
  };
}

async function restoreSession() {
  const stored = readPersistedSession();
  if (!stored) return null;

  currentSession = stored;
  const session = await ensureSession();
  if (!session) {
    clearPersistedSession();
  }
  return session;
}

async function ensureSession() {
  if (!currentSession) return null;
  if (!sessionNeedsRefresh(currentSession)) {
    return hydrateSessionUser(currentSession);
  }

  try {
    currentSession = await refreshSession(currentSession.refreshToken);
    persistSession(currentSession);
    return hydrateSessionUser(currentSession);
  } catch {
    currentSession = null;
    clearPersistedSession();
    return null;
  }
}

async function hydrateSessionUser(session) {
  if (session?.user?.uid) return session;
  if (!session?.accessToken) return session;

  const user = await fetchCurrentUser(session.accessToken);
  currentSession = { ...session, user };
  persistSession(currentSession);
  return currentSession;
}

function sessionNeedsRefresh(session) {
  const expiresAt = Number(session?.expiresAtEpochSeconds || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= 0) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expiresAt <= nowSeconds + 60;
}

async function signInWithGoogleIdToken(idToken, nonce) {
  const data = await requestSupabase({
    method: "POST",
    path: "/auth/v1/token",
    query: { grant_type: "id_token" },
    body: {
      provider: "google",
      id_token: idToken,
      nonce
    }
  });

  return normalizeSession(data);
}

async function refreshSession(refreshToken) {
  const data = await requestSupabase({
    method: "POST",
    path: "/auth/v1/token",
    query: { grant_type: "refresh_token" },
    body: {
      refresh_token: refreshToken
    }
  });

  return normalizeSession(data);
}

async function fetchCurrentUser(accessToken) {
  const data = await requestSupabase({
    method: "GET",
    path: "/auth/v1/user",
    bearerToken: accessToken
  });

  return normalizeUser(data);
}

async function fetchPeople(accessToken) {
  return requestSupabase({
    method: "GET",
    path: "/rest/v1/people",
    query: {
      select: "id,name,phone,email,is_active,updated_at",
      order: "is_active.desc,updated_at.desc,id.asc"
    },
    bearerToken: accessToken
  });
}

async function fetchTransactions(accessToken) {
  return requestSupabase({
    method: "GET",
    path: "/rest/v1/transactions",
    query: {
      select: "id,account_id,title,amount,type,category,payment_method,installments,installment_number,original_total_amount,card_payment_date_millis,notes,date_millis",
      order: "date_millis.desc,id.desc"
    },
    bearerToken: accessToken
  });
}

async function fetchAccountSettings(accessToken) {
  return requestSupabase({
    method: "GET",
    path: "/rest/v1/account_settings",
    query: {
      select: "account_id,expense_categories,income_categories,payment_methods,payment_method_card_configs,expense_category_limits,multi_launch_expense_category_amounts,multi_launch_income_category_amounts,updated_at",
      order: "account_id.asc"
    },
    bearerToken: accessToken
  });
}

async function fetchAppSettings(accessToken) {
  return requestSupabase({
    method: "GET",
    path: "/rest/v1/app_settings",
    query: {
      select: "id,dark_theme_enabled,visualizacao_modo,voice_auto_listen_enabled,voice_wake_word,notifications_enabled,notification_hour,notification_minute,screen_order,updated_at",
      order: "updated_at.desc,id.asc",
      limit: "1"
    },
    bearerToken: accessToken
  });
}

async function requestSupabase({ method, path, query = {}, body = null, bearerToken = null, prefer = null }) {
  const url = buildSupabaseUrl(path, query);
  const headers = {
    apikey: runtimeConfig.anonKey,
    Accept: "application/json"
  };

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  if (prefer) {
    headers.Prefer = prefer;
  }
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body)
  });

  const raw = await response.text();
  const payload = raw ? tryParseJson(raw) : null;

  if (!response.ok) {
    throw new Error(extractSupabaseError(payload, raw));
  }

  return payload ?? raw;
}

function buildSupabaseUrl(path, query) {
  const base = runtimeConfig.url.replace(/\/+$/, "");
  const search = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      search.set(key, String(value));
    }
  });

  const suffix = search.size ? `?${search.toString()}` : "";
  return `${base}${path}${suffix}`;
}

function normalizeSession(data) {
  const expiresAtEpochSeconds = Number(data.expires_at || 0) || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAtEpochSeconds,
    user: normalizeUser(data.user || {})
  };
}

function normalizeUser(user) {
  const metadata = user.user_metadata || {};
  return {
    uid: user.id || "",
    email: user.email || "",
    displayName: metadata.full_name || metadata.name || metadata.display_name || user.email || "Conta"
  };
}

function persistSession(session) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function readPersistedSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPersistedSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function mergeUiPreferences(state, uiPreferences) {
  if (!uiPreferences || typeof uiPreferences !== "object") return state;
  return {
    ...state,
    ui: {
      ...state.ui,
      ...uiPreferences,
      screenOrder: Array.isArray(uiPreferences?.screenOrder)
        ? uiPreferences.screenOrder
        : (Array.isArray(state.ui?.screenOrder) ? state.ui.screenOrder : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO", "CONFIG"])
    }
  };
}

function writeStoredUiPreferences(userId, ui) {
  if (!userId) return;
  try {
    localStorage.setItem(getUiPrefsStorageKey(userId), JSON.stringify(ui || {}));
  } catch (error) {
    console.warn("Falha ao salvar preferencias da interface:", error);
  }
}

function readStoredUiPreferences(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getUiPrefsStorageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getUiPrefsStorageKey(userId) {
  return `${UI_PREFS_STORAGE_KEY_PREFIX}${userId}`;
}

function selectActiveAccount(people, transactions, preferredAccountId = null) {
  if (preferredAccountId) {
    const preferredPerson = people.find((person) => Number(person.id) === Number(preferredAccountId));
    if (preferredPerson) return preferredPerson;
    const preferredTransaction = transactions.find((item) => Number(item.account_id) === Number(preferredAccountId));
    if (preferredTransaction) {
      return {
        id: Number(preferredTransaction.account_id),
        name: `Conta ${preferredTransaction.account_id}`
      };
    }
  }
  const active = people.find((person) => person.is_active);
  if (active) return active;
  if (people.length > 0) return people[0];
  if (transactions.length > 0) {
    return {
      id: Number(transactions[0].account_id),
      name: `Conta ${transactions[0].account_id}`
    };
  }
  return null;
}

function buildStateFromRemote({ people, activeAccount, activeAccountId, transactions, settings, appSettings }) {
  const sortedTransactions = [...transactions].sort((left, right) => Number(right.date_millis || 0) - Number(left.date_millis || 0));
  const budgets = buildBudgets(settings?.expense_category_limits || "");
  const expenseCategories = uniqueCaseInsensitive([
    ...decodeStringList(settings?.expense_categories || ""),
    ...sortedTransactions
      .filter((transaction) => transaction.type !== "RECEITA")
      .map((transaction) => transaction.category || "")
  ]);
  const incomeCategories = uniqueCaseInsensitive([
    ...decodeStringList(settings?.income_categories || ""),
    ...sortedTransactions
      .filter((transaction) => transaction.type === "RECEITA")
      .map((transaction) => transaction.category || "")
  ]);
  const paymentMethods = uniqueCaseInsensitive([
    ...decodeStringList(settings?.payment_methods || ""),
    ...sortedTransactions.map((transaction) => transaction.payment_method || "")
  ]);
  const paymentMethodConfigs = decodeCardPaymentConfigMap(settings?.payment_method_card_configs || "");
  const multiLaunchExpenseCategoryAmounts = decodeDoubleMap(settings?.multi_launch_expense_category_amounts || "");
  const multiLaunchIncomeCategoryAmounts = decodeDoubleMap(settings?.multi_launch_income_category_amounts || "");
  const allowedScreens = ["MULTIPLOS", "EXTRATO", "LANCAMENTOS", "QUADRO"];
  const rawScreenOrder = decodeStringList(appSettings?.screen_order || "MULTIPLOS|||LANCAMENTOS|||EXTRATO|||QUADRO")
    .filter((screen) => allowedScreens.includes(screen));
  const normalizedScreenOrder = rawScreenOrder.length > 0 ? rawScreenOrder : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"];
  const screenOrder = [];
  for (const screen of [...normalizedScreenOrder, "MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"]) {
    if (!screenOrder.includes(screen)) {
      screenOrder.push(screen);
    }
  }
  if (!screenOrder.includes("CONFIG")) {
    screenOrder.push("CONFIG");
  }

  return {
    monthLabel: activeAccount?.name ? `Conta ${activeAccount.name}` : "Conta",
    transactions: sortedTransactions.map((transaction) => ({
      id: Number(transaction.id),
      category: transaction.category || "Sem categoria",
      title: String(transaction.title || "").trim(),
      type: transaction.type === "RECEITA" ? "income" : "expense",
      amount: Number(transaction.amount || 0),
      dateMillis: Number(transaction.date_millis || Date.now()),
      dateLabel: formatRelativeDate(Number(transaction.date_millis || Date.now())),
      paymentMethod: transaction.payment_method || "",
      installments: Math.max(1, Number.parseInt(String(transaction.installments || "1"), 10) || 1),
      installmentNumber: Math.max(1, Number.parseInt(String(transaction.installment_number || "1"), 10) || 1),
      originalTotalAmount: Number(transaction.original_total_amount || transaction.amount || 0),
      cardPaymentDateMillis: Number.isFinite(Number(transaction.card_payment_date_millis))
        ? Number(transaction.card_payment_date_millis)
        : null,
      notes: transaction.notes || ""
    })),
    goals: [],
    budgets,
    catalog: {
      expenseCategories,
      incomeCategories,
      paymentMethods,
      paymentMethodConfigs,
      multiLaunchExpenseCategoryAmounts,
      multiLaunchIncomeCategoryAmounts
    },
    ui: {
      screenOrder,
      themeMode: appSettings?.dark_theme_enabled ? "dark" : "light",
      visualizacaoModo: appSettings?.visualizacao_modo === "DUAS_TELAS" ? "DUAS_TELAS" : "UMA_TELA",
      voiceAutoListenEnabled: Boolean(appSettings?.voice_auto_listen_enabled),
      voiceWakeWord: String(appSettings?.voice_wake_word || "financeiro").trim() || "financeiro",
      notificationsEnabled: appSettings?.notifications_enabled !== false,
      notificationHour: Number.isFinite(Number(appSettings?.notification_hour)) ? Number(appSettings.notification_hour) : 10,
      notificationMinute: Number.isFinite(Number(appSettings?.notification_minute)) ? Number(appSettings.notification_minute) : 0,
      activeAccountId,
      accounts: Array.isArray(people)
        ? people.map((person) => ({
            id: Number(person.id),
            name: person.name || `Conta ${person.id}`,
            phone: person.phone || "",
            email: person.email || ""
          }))
        : []
    }
  };
}

function buildBudgets(rawLimits) {
  const limits = decodeDoubleMap(rawLimits);
  return Object.entries(limits).map(([name, limit], index) => ({
    name,
    limit,
    color: BUDGET_COLORS[index % BUDGET_COLORS.length]
  }));
}

function decodeStringList(raw) {
  if (!raw) return [];
  return raw
    .split(SETTINGS_LIST_SEPARATOR)
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueCaseInsensitive(values) {
  const seen = new Set();

  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value) return false;
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.localeCompare(right, "pt-BR"));
}

function encodeStringList(values) {
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(SETTINGS_LIST_SEPARATOR);
}

function decodeDoubleMap(raw) {
  if (!raw) return {};

  return raw.split(SETTINGS_LIST_SEPARATOR).reduce((accumulator, entry) => {
    const [name, value] = entry.split("::", 2).map((item) => item?.trim() || "");
    const parsed = Number(value);
    if (name && Number.isFinite(parsed) && parsed > 0) {
      accumulator[name] = parsed;
    }
    return accumulator;
  }, {});
}

function decodeCardPaymentConfigMap(raw) {
  if (!raw) return {};

  return raw.split(SETTINGS_LIST_SEPARATOR).reduce((accumulator, entry) => {
    const parts = entry.split("::", 3).map((item) => item?.trim() || "");
    if (parts.length !== 3) return accumulator;
    const [method, closingText, paymentText] = parts;
    const closingDay = Number.parseInt(closingText, 10);
    const paymentDay = Number.parseInt(paymentText, 10);
    if (!method || closingDay < 1 || closingDay > 31 || paymentDay < 1 || paymentDay > 31) {
      return accumulator;
    }
    accumulator[method] = { closingDay, paymentDay };
    return accumulator;
  }, {});
}

function encodeCardPaymentConfigMap(values) {
  if (!values || typeof values !== "object") return "";

  return Object.entries(values)
    .filter(([method, config]) => {
      const cleanMethod = String(method || "").trim();
      const closingDay = Number.parseInt(String(config?.closingDay || ""), 10);
      const paymentDay = Number.parseInt(String(config?.paymentDay || ""), 10);
      return Boolean(cleanMethod) && closingDay >= 1 && closingDay <= 31 && paymentDay >= 1 && paymentDay <= 31;
    })
    .sort((left, right) => left[0].localeCompare(right[0], "pt-BR"))
    .map(([method, config]) => `${String(method).trim()}::${config.closingDay}::${config.paymentDay}`)
    .join(SETTINGS_LIST_SEPARATOR);
}

function toSupabaseTransaction(transaction, context) {
  const amount = Number(transaction.amount || 0);
  const dateMillis = Number(transaction.dateMillis || Date.now());
  const installments = Math.max(1, Number.parseInt(String(transaction.installments || "1"), 10) || 1);
  const installmentNumber = Math.max(1, Number.parseInt(String(transaction.installmentNumber || transaction.installment_number || "1"), 10) || 1);
  const originalTotalAmount = Number.isFinite(Number(transaction.originalTotalAmount))
    ? Number(transaction.originalTotalAmount)
    : amount * installments;
  const cardPaymentDateMillis = Number.isFinite(Number(transaction.cardPaymentDateMillis))
    ? Number(transaction.cardPaymentDateMillis)
    : null;

  return {
    id: Number(transaction.id),
    owner_id: context.ownerId,
    account_id: context.accountId,
    category: String(transaction.category || "Sem categoria").trim() || "Sem categoria",
    title: String(transaction.title || "").trim(),
    amount,
    type: transaction.type === "income" ? "RECEITA" : "DESPESA",
    payment_method: String(transaction.paymentMethod || context.defaultPaymentMethod || "Pix").trim() || "Pix",
    installments,
    installment_number: installmentNumber,
    original_total_amount: originalTotalAmount,
    card_payment_date_millis: cardPaymentDateMillis,
    notes: String(transaction.notes || "").trim(),
    date_millis: dateMillis
  };
}

function toSupabaseAccountSettings(state, context) {
  return {
    owner_id: context.ownerId,
    account_id: context.accountId,
    expense_categories: encodeStringList(state?.catalog?.expenseCategories || []),
    income_categories: encodeStringList(state?.catalog?.incomeCategories || []),
    payment_methods: encodeStringList(state?.catalog?.paymentMethods || []),
    payment_method_card_configs: encodeCardPaymentConfigMap(state?.catalog?.paymentMethodConfigs || {}),
    expense_category_limits: context.activeSettings?.expense_category_limits || "",
    multi_launch_expense_category_amounts: context.activeSettings?.multi_launch_expense_category_amounts || "",
    multi_launch_income_category_amounts: context.activeSettings?.multi_launch_income_category_amounts || ""
  };
}

function toSupabaseAppSettings(state, context) {
  const screenOrder = Array.isArray(state?.ui?.screenOrder)
    ? state.ui.screenOrder.filter((screen) => screen !== "CONFIG")
    : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"];

  return {
    owner_id: context.ownerId,
    id: Number(context.activeAppSettings?.id ?? 0),
    dark_theme_enabled: state?.ui?.themeMode === "dark",
    visualizacao_modo: state?.ui?.visualizacaoModo === "DUAS_TELAS" ? "DUAS_TELAS" : "UMA_TELA",
    voice_auto_listen_enabled: Boolean(state?.ui?.voiceAutoListenEnabled),
    voice_wake_word: String(state?.ui?.voiceWakeWord || "financeiro").trim() || "financeiro",
    notifications_enabled: state?.ui?.notificationsEnabled !== false,
    notification_hour: Number.isFinite(Number(state?.ui?.notificationHour)) ? Number(state.ui.notificationHour) : 10,
    notification_minute: Number.isFinite(Number(state?.ui?.notificationMinute)) ? Number(state.ui.notificationMinute) : 0,
    screen_order: encodeStringList(screenOrder),
    updated_at: Date.now()
  };
}

function formatRelativeDate(dateMillis) {
  const currentDate = new Date();
  const targetDate = new Date(dateMillis);
  const currentStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.round((currentStart - targetStart) / 86400000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(targetDate);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(targetDate);
}

async function createGoogleNonceClient() {
  const googleClient = await waitForGoogleClient();
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const encoder = new TextEncoder();
  const encodedNonce = encoder.encode(nonce);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encodedNonce);
  const hashedNonce = Array.from(new Uint8Array(hashBuffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

  return {
    googleClient,
    nonce,
    hashedNonce
  };
}

function waitForGoogleClient() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve(window.google);
        return;
      }
      if (attempts >= 60) {
        window.clearInterval(timer);
        reject(new Error("A biblioteca do Google nao carregou a tempo."));
      }
    }, 100);
  });
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractSupabaseError(payload, raw) {
  if (payload && typeof payload === "object") {
    return payload.msg || payload.message || payload.error_description || payload.error || raw || "Falha ao carregar os dados.";
  }
  return raw || "Falha ao carregar os dados.";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
