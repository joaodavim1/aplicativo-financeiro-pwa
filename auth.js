import { bootFinanceiroApp } from "./app.js?v=20260405d";

const runtimeConfig = window.FINANCEIRO_SUPABASE_CONFIG || null;
const authOptions = {
  requireLogin: false,
  ...window.FINANCEIRO_AUTH_OPTIONS
};
const SESSION_STORAGE_KEY = "financeiro-pwa-supabase-session-v1";
const SETTINGS_LIST_SEPARATOR = "|||";
const GOOGLE_BUTTON_WIDTH = 280;
const BUDGET_COLORS = ["#145c4c", "#6bc5a4", "#f08a24", "#d9604c", "#256d5a"];
const INSTALL_HELP_TEXT = [
  "Adicionar a Tela de Inicio:",
  "1. Abra este endereco no Safari.",
  "2. Toque em Compartilhar.",
  "3. Escolha Adicionar a Tela de Inicio.",
  "4. Confirme a adicao."
].join("\n");

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
  menuOpenExtratoButton: document.querySelector("#menuOpenExtratoButton"),
  menuOpenLancamentosButton: document.querySelector("#menuOpenLancamentosButton"),
  menuOpenQuadroButton: document.querySelector("#menuOpenQuadroButton"),
  menuOpenSettingsButton: document.querySelector("#menuOpenSettingsButton"),
  menuLoginButton: document.querySelector("#menuLoginButton"),
  menuInstallButton: document.querySelector("#menuInstallButton"),
  menuLogoutButton: document.querySelector("#menuLogoutButton"),
  installDialog: document.querySelector("#installDialog"),
  openInstallModalButton: document.querySelector("#openInstallModalButton"),
  closeInstallModalButton: document.querySelector("#closeInstallModalButton"),
  installHelpButton: document.querySelector("#installHelpButton"),
  settingsLoginButton: document.querySelector("#settingsLoginButton"),
  settingsInstallButton: document.querySelector("#settingsInstallButton"),
  settingsLogoutButton: document.querySelector("#settingsLogoutButton")
};

let currentSession = null;

bootstrap();

async function bootstrap() {
  bindEvents();

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
    await mountGoogleButton();
  } catch (error) {
    nodes.authStatusMessage.textContent = formatAuthError(error);
  }

  const restoredSession = await restoreSession();
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
}

function bindEvents() {
  nodes.continueDemoButton.addEventListener("click", openDemoMode);
  nodes.logoutButton.addEventListener("click", handleLogout);
  nodes.menuButton?.addEventListener("click", () => nodes.menuDialog?.showModal());
  nodes.closeMenuButton?.addEventListener("click", () => nodes.menuDialog?.close());
  nodes.menuOpenExtratoButton?.addEventListener("click", () => openScreenFromMenu("EXTRATO"));
  nodes.menuOpenLancamentosButton?.addEventListener("click", () => openScreenFromMenu("LANCAMENTOS"));
  nodes.menuOpenQuadroButton?.addEventListener("click", () => openScreenFromMenu("QUADRO"));
  nodes.menuOpenSettingsButton?.addEventListener("click", () => {
    nodes.menuDialog?.close();
    openSettingsScreen();
  });
  nodes.menuLoginButton?.addEventListener("click", async () => {
    nodes.menuDialog?.close();
    await handleAccountAccess();
  });
  nodes.menuInstallButton?.addEventListener("click", () => openInstallHelp({ closeMenu: true }));
  nodes.menuLogoutButton?.addEventListener("click", async () => {
    nodes.menuDialog?.close();
    await handleLogout();
  });
  nodes.installHelpButton?.addEventListener("click", () => openInstallHelp());
  nodes.openInstallModalButton?.addEventListener("click", () => openInstallHelp());
  nodes.closeInstallModalButton?.addEventListener("click", closeInstallHelp);
  nodes.settingsLoginButton?.addEventListener("click", handleAccountAccess);
  nodes.settingsInstallButton?.addEventListener("click", () => openInstallHelp());
  nodes.settingsLogoutButton?.addEventListener("click", handleLogout);
  bindDialogBackdrop(nodes.menuDialog);
  bindDialogBackdrop(nodes.installDialog);
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
      dialog.close();
    }
  });
}

function openInstallHelp(options = {}) {
  const { closeMenu = false } = options;

  if (closeMenu) {
    nodes.menuDialog?.close();
  }

  window.setTimeout(() => {
    const dialog = nodes.installDialog;
    if (!dialog) {
      window.alert(INSTALL_HELP_TEXT);
      return;
    }

    try {
      if (typeof dialog.showModal === "function") {
        if (!dialog.open) {
          dialog.showModal();
        }
        return;
      }
    } catch (error) {
      console.warn("Falha ao abrir orientacao de instalacao:", error);
    }

    dialog.setAttribute("open", "open");
  }, closeMenu ? 120 : 0);
}

function closeInstallHelp() {
  const dialog = nodes.installDialog;
  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
    return;
  }

  dialog.removeAttribute("open");
}

function openSettingsScreen() {
  if (typeof window.financeiroNavigateToScreen === "function") {
    window.financeiroNavigateToScreen("CONFIG");
  } else {
    const button = document.querySelector('.screen-tab[data-screen="CONFIG"]');
    button?.click();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openScreenFromMenu(screen) {
  nodes.menuDialog?.close();
  if (typeof window.financeiroNavigateToScreen === "function") {
    window.financeiroNavigateToScreen(screen);
  } else {
    const button = document.querySelector(`.screen-tab[data-screen="${screen}"]`);
    button?.click();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
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
    nodes.menuLogoutButton.textContent = isLoggedIn ? "Sair" : "Limpar acesso";
    nodes.menuLogoutButton.classList.remove("hidden");
  }
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
    defaultPaymentMethod: "Pix"
  };

  return {
    async loadState() {
      const session = await ensureSessionFn();
      if (!session?.accessToken) {
        throw new Error("Faca login novamente para carregar os dados.");
      }

      const [people, transactions, accountSettings, appSettings] = await Promise.all([
        fetchPeople(session.accessToken),
        fetchTransactions(session.accessToken),
        fetchAccountSettings(session.accessToken),
        fetchAppSettings(session.accessToken)
      ]);

      const activeAccount = selectActiveAccount(people, transactions);
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
      context.defaultPaymentMethod = decodeStringList(activeSettings?.payment_methods || "")[0] || "Pix";

      return buildStateFromRemote({
        activeAccount,
        transactions: filteredTransactions,
        settings: activeSettings,
        appSettings: Array.isArray(appSettings) ? appSettings[0] || null : null
      });
    },
    async saveState(state) {
      const session = await ensureSessionFn();
      if (!session?.accessToken) {
        throw new Error("Faca login novamente para salvar os dados.");
      }
      if (!context.activeAccountId) {
        throw new Error("Nao encontrei uma conta ativa para salvar a transacao.");
      }

      const payload = state.transactions.map((transaction) =>
        toSupabaseTransaction(transaction, {
          accountId: context.activeAccountId,
          ownerId: session.user.uid,
          defaultPaymentMethod: context.defaultPaymentMethod
        })
      );

      const settingsPayload = toSupabaseAccountSettings(state, {
        accountId: context.activeAccountId,
        ownerId: session.user.uid,
        activeSettings: context.activeSettings
      });

      await Promise.all([
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
        })
      ]);

      context.activeSettings = {
        ...(context.activeSettings || {}),
        expense_categories: settingsPayload.expense_categories,
        income_categories: settingsPayload.income_categories,
        payment_methods: settingsPayload.payment_methods,
        expense_category_limits: settingsPayload.expense_category_limits,
        payment_method_card_configs: settingsPayload.payment_method_card_configs,
        multi_launch_expense_category_amounts: settingsPayload.multi_launch_expense_category_amounts,
        multi_launch_income_category_amounts: settingsPayload.multi_launch_income_category_amounts
      };
      context.defaultPaymentMethod = decodeStringList(settingsPayload.payment_methods)[0] || "Pix";
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
      select: "id,visualizacao_modo,screen_order,updated_at",
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

function selectActiveAccount(people, transactions) {
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

function buildStateFromRemote({ activeAccount, transactions, settings, appSettings }) {
  const sortedTransactions = [...transactions].sort((left, right) => Number(right.date_millis || 0) - Number(left.date_millis || 0));
  const budgets = buildBudgets(settings?.expense_category_limits || "");
  const expenseCategories = decodeStringList(settings?.expense_categories || "");
  const incomeCategories = decodeStringList(settings?.income_categories || "");
  const allowedScreens = ["EXTRATO", "LANCAMENTOS", "QUADRO"];
  const rawScreenOrder = decodeStringList(appSettings?.screen_order || "EXTRATO|||LANCAMENTOS|||QUADRO")
    .filter((screen) => allowedScreens.includes(screen));
  const screenOrder = rawScreenOrder.length > 0 ? rawScreenOrder : [...allowedScreens];
  if (!screenOrder.includes("CONFIG")) {
    screenOrder.push("CONFIG");
  }

  return {
    monthLabel: activeAccount?.name ? `Conta ${activeAccount.name}` : "Conta",
    transactions: sortedTransactions.map((transaction) => ({
      id: Number(transaction.id),
      title: transaction.title || "Sem titulo",
      category: transaction.category || "Sem categoria",
      type: transaction.type === "RECEITA" ? "income" : "expense",
      amount: Number(transaction.amount || 0),
      dateMillis: Number(transaction.date_millis || Date.now()),
      dateLabel: formatRelativeDate(Number(transaction.date_millis || Date.now())),
      paymentMethod: transaction.payment_method || "",
      notes: transaction.notes || ""
    })),
    goals: [],
    budgets,
    catalog: {
      expenseCategories,
      incomeCategories
    },
    ui: {
      screenOrder
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

function toSupabaseTransaction(transaction, context) {
  const amount = Number(transaction.amount || 0);
  const dateMillis = Number(transaction.dateMillis || Date.now());

  return {
    id: Number(transaction.id),
    owner_id: context.ownerId,
    account_id: context.accountId,
    title: String(transaction.title || "Sem titulo").trim() || "Sem titulo",
    amount,
    type: transaction.type === "income" ? "RECEITA" : "DESPESA",
    category: String(transaction.category || "Sem categoria").trim() || "Sem categoria",
    payment_method: String(transaction.paymentMethod || context.defaultPaymentMethod || "Pix").trim() || "Pix",
    installments: 1,
    installment_number: 1,
    original_total_amount: amount,
    card_payment_date_millis: null,
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
    payment_method_card_configs: context.activeSettings?.payment_method_card_configs || "",
    expense_category_limits: context.activeSettings?.expense_category_limits || "",
    multi_launch_expense_category_amounts: context.activeSettings?.multi_launch_expense_category_amounts || "",
    multi_launch_income_category_amounts: context.activeSettings?.multi_launch_income_category_amounts || ""
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
