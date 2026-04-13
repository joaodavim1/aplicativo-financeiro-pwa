const defaults = {
  monthLabel: "Abril de 2026",
  transactions: [
    { id: generateId(), title: "Salario", category: "Trabalho", type: "income", amount: 7800, dateMillis: Date.now(), dateLabel: "Hoje", paymentMethod: "Pix", notes: "" },
    { id: generateId(), title: "Pix cliente", category: "Trabalho", type: "income", amount: 1850, dateMillis: Date.now(), dateLabel: "Hoje", paymentMethod: "Pix", notes: "" },
    { id: generateId(), title: "Mercado do mes", category: "Mercado", type: "expense", amount: 428.72, dateMillis: Date.now() - 86400000, dateLabel: "Ontem", paymentMethod: "Cartao", notes: "" },
    { id: generateId(), title: "Internet fibra", category: "Casa", type: "expense", amount: 119.99, dateMillis: Date.now() - 2 * 86400000, dateLabel: "Segunda", paymentMethod: "Debito", notes: "" },
    { id: generateId(), title: "Combustivel", category: "Transporte", type: "expense", amount: 210, dateMillis: Date.now() - 2 * 86400000, dateLabel: "Segunda", paymentMethod: "Pix", notes: "" },
    { id: generateId(), title: "Cinema", category: "Lazer", type: "expense", amount: 74.5, dateMillis: Date.now() - 3 * 86400000, dateLabel: "Domingo", paymentMethod: "Credito", notes: "" },
    { id: generateId(), title: "Aporte automatico", category: "Investimentos", type: "expense", amount: 1200, dateMillis: Date.now() - 3 * 86400000, dateLabel: "Domingo", paymentMethod: "Transferencia", notes: "" }
  ],
  goals: [
    { name: "Reserva de emergencia", saved: 19200, target: 30000, note: "Meta principal" },
    { name: "Viagem de dezembro", saved: 4600, target: 8000, note: "Faltam 8 meses" },
    { name: "Novo notebook", saved: 3100, target: 6500, note: "Compra prevista para agosto" }
  ],
  budgets: [
    { name: "Casa", limit: 2600, color: "#145c4c" },
    { name: "Mercado", limit: 1600, color: "#6bc5a4" },
    { name: "Transporte", limit: 850, color: "#f08a24" },
    { name: "Lazer", limit: 900, color: "#d9604c" },
    { name: "Investimentos", limit: 1800, color: "#256d5a" }
  ],
  catalog: {
    expenseCategories: ["Casa", "Mercado", "Transporte", "Lazer", "Investimentos"],
    incomeCategories: ["Trabalho", "Pix", "Venda", "Servico", "Bonus"],
    paymentMethods: ["Pix", "Debito", "Credito", "Cartao", "Transferencia"],
    paymentMethodConfigs: {},
    multiLaunchExpenseCategoryAmounts: {},
    multiLaunchIncomeCategoryAmounts: {}
  }
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0
});

let currentFilter = "all";
let currentState = structuredClone(defaults);
let currentIdentity = null;
let currentPersistence = null;
let eventsBound = false;
let activeScreen = "EXTRATO";
let isCategoryManagerOpen = false;
let isPaymentManagerOpen = false;
let appToastTimer = null;
let categorySuggestionsOpen = false;
let appToastActionCleanup = null;
let remotePrintWatchTimer = null;
let knownPrintedTransactionIds = new Set();
let qzTrayActive = false;
let currentCategoryOptions = [];
let pendingMultiLaunchCategoryFocus = null;
let currentHistoryFilters = {
  startDate: "",
  endDate: "",
  type: "all",
  category: "",
  payment: ""
};
let currentFutureFilters = {
  startDate: "",
  endDate: "",
  type: "all",
  category: "",
  payment: ""
};
let selectedFutureIds = new Set();
let multiLaunchType = "expense";
let multiLaunchRows = [createMultiLaunchRow()];
let multiLaunchFinalizeOpen = false;
let editingTransactionId = null;

const nodes = {
  themeColorMeta: document.querySelector('meta[name="theme-color"]'),
  currentMonthLabel: document.querySelector("#currentMonthLabel"),
  balanceValue: document.querySelector("#balanceValue"),
  incomeValue: document.querySelector("#incomeValue"),
  expenseValue: document.querySelector("#expenseValue"),
  incomeCategoryBars: document.querySelector("#incomeCategoryBars"),
  expenseCategoryBars: document.querySelector("#expenseCategoryBars"),
  extratoAccountSnapshot: document.querySelector("#extratoAccountSnapshot"),
  historyStartDate: document.querySelector("#historyStartDate"),
  historyEndDate: document.querySelector("#historyEndDate"),
  historyTypeFilter: document.querySelector("#historyTypeFilter"),
  historyTypeToggle: document.querySelector("#historyTypeToggle"),
  historyTypeButtons: [...document.querySelectorAll("[data-history-type]")],
  historyCategoryGroup: document.querySelector("#historyCategoryGroup"),
  historyPaymentGroup: document.querySelector("#historyPaymentGroup"),
  historyCategoryFilter: document.querySelector("#historyCategoryFilter"),
  historyPaymentFilter: document.querySelector("#historyPaymentFilter"),
  clearHistoryFiltersButton: document.querySelector("#clearHistoryFiltersButton"),
  filteredTotalValue: document.querySelector("#filteredTotalValue"),
  extratoList: document.querySelector("#extratoList"),
  futureBalanceValue: document.querySelector("#futureBalanceValue"),
  futureIncomeValue: document.querySelector("#futureIncomeValue"),
  futureExpenseValue: document.querySelector("#futureExpenseValue"),
  futureTypeToggle: document.querySelector("#futureTypeToggle"),
  futureTypeButtons: [...document.querySelectorAll("[data-future-type]")],
  futureStartDate: document.querySelector("#futureStartDate"),
  futureEndDate: document.querySelector("#futureEndDate"),
  futureCategoryGroup: document.querySelector("#futureCategoryGroup"),
  futurePaymentGroup: document.querySelector("#futurePaymentGroup"),
  futureCategoryFilter: document.querySelector("#futureCategoryFilter"),
  futurePaymentFilter: document.querySelector("#futurePaymentFilter"),
  clearFutureFiltersButton: document.querySelector("#clearFutureFiltersButton"),
  futureFilteredTotalValue: document.querySelector("#futureFilteredTotalValue"),
  futureLaunchesList: document.querySelector("#futureLaunchesList"),
  selectAllFutureButton: document.querySelector("#selectAllFutureButton"),
  clearFutureSelectionButton: document.querySelector("#clearFutureSelectionButton"),
  completeSelectedFutureButton: document.querySelector("#completeSelectedFutureButton"),
  budgetList: document.querySelector("#budgetList"),
  transactionsList: document.querySelector("#transactionsList"),
  transactionForm: document.querySelector("#transactionForm"),
  filterTabs: [...document.querySelectorAll(".filter-tab")],
  screenTabs: document.querySelector("#screenTabs"),
  screenPanels: [...document.querySelectorAll(".screen-panel")],
  userBadge: document.querySelector("#userBadge"),
  appToast: document.querySelector("#appToast"),
  categoryInput: document.querySelector("#categoryInput"),
  categorySuggestions: document.querySelector("#categorySuggestions"),
  paymentMethodInput: document.querySelector("#paymentMethodInput"),
  manageCategoryToggleButton: document.querySelector("#manageCategoryToggleButton"),
  managePaymentToggleButton: document.querySelector("#managePaymentToggleButton"),
  manageExpenseCategoryCard: document.querySelector("#manageExpenseCategoryCard"),
  manageIncomeCategoryCard: document.querySelector("#manageIncomeCategoryCard"),
  managePaymentCard: document.querySelector("#managePaymentCard"),
  titleInput: document.querySelector("#titleInput"),
  dateInput: document.querySelector("#dateInput"),
  installmentsInput: document.querySelector("#installmentsInput"),
  typeInput: document.querySelector("#typeInput"),
  typeToggle: document.querySelector("#typeToggle"),
  typeToggleButtons: [...document.querySelectorAll(".type-toggle-button")],
  amountInput: document.querySelector("#amountInput"),
  settingsAccountName: document.querySelector("#settingsAccountName"),
  settingsDataSource: document.querySelector("#settingsDataSource"),
  settingsScreenOrder: document.querySelector("#settingsScreenOrder"),
  settingsThemeStatus: document.querySelector("#settingsThemeStatus"),
  settingsViewMode: document.querySelector("#settingsViewMode"),
  settingsVoiceAutoListen: document.querySelector("#settingsVoiceAutoListen"),
  settingsVoiceWakeWord: document.querySelector("#settingsVoiceWakeWord"),
  settingsVoiceWakeWordSave: document.querySelector("#settingsVoiceWakeWordSave"),
  settingsNotificationsEnabled: document.querySelector("#settingsNotificationsEnabled"),
  settingsNotificationTime: document.querySelector("#settingsNotificationTime"),
  settingsExpenseCategoriesList: document.querySelector("#settingsExpenseCategoriesList"),
  settingsIncomeCategoriesList: document.querySelector("#settingsIncomeCategoriesList"),
  settingsPaymentMethodsList: document.querySelector("#settingsPaymentMethodsList"),
  settingsThemeLightButton: document.querySelector("#settingsThemeLightButton"),
  settingsThemeDarkButton: document.querySelector("#settingsThemeDarkButton"),
  addExpenseCategoryInput: document.querySelector("#addExpenseCategoryInput"),
  addIncomeCategoryInput: document.querySelector("#addIncomeCategoryInput"),
  addPaymentMethodInput: document.querySelector("#addPaymentMethodInput"),
  addPaymentClosingDayInput: document.querySelector("#addPaymentClosingDayInput"),
  addPaymentDueDayInput: document.querySelector("#addPaymentDueDayInput"),
  addExpenseCategoryButton: document.querySelector("#addExpenseCategoryButton"),
  addIncomeCategoryButton: document.querySelector("#addIncomeCategoryButton"),
  addPaymentMethodButton: document.querySelector("#addPaymentMethodButton"),
  multiLaunchTypeInput: document.querySelector("#multiLaunchTypeInput"),
  multiLaunchTypeToggle: document.querySelector("#multiLaunchTypeToggle"),
  multiLaunchRows: document.querySelector("#multiLaunchRows"),
  multiLaunchAddRowButton: document.querySelector("#multiLaunchAddRowButton"),
  multiLaunchFinalizeButton: document.querySelector("#multiLaunchFinalizeButton"),
  multiLaunchFinalizeCard: document.querySelector("#multiLaunchFinalizeCard"),
  multiLaunchCountValue: document.querySelector("#multiLaunchCountValue"),
  multiLaunchPaymentMethodInput: document.querySelector("#multiLaunchPaymentMethodInput"),
  multiLaunchDateInput: document.querySelector("#multiLaunchDateInput"),
  multiLaunchTotalValue: document.querySelector("#multiLaunchTotalValue"),
  multiLaunchSaveButton: document.querySelector("#multiLaunchSaveButton")
};

export async function bootFinanceiroApp({ mode = "demo", user = null, persistence = null } = {}) {
  currentIdentity = { mode, user };
  currentPersistence = persistence || createLocalPersistence(mode, user);
  currentState = sanitizeState(await currentPersistence.loadState());
  applyTheme();

  updateUserBadge();

  if (!eventsBound) {
    bindEvents();
    registerServiceWorker();
    eventsBound = true;
  }

  initializePrintTracking();
  startRemotePrintWatch();
  initQZTray();
  render();
}

window.financeiroNavigateToScreen = navigateToScreen;
window.financeiroGetMenuState = getFinanceiroMenuState;
window.financeiroMoveMenuAction = moveMenuAction;
window.financeiroRunMenuAction = runMenuAction;
window.financeiroSetThemeMode = setThemeMode;

export function getFinanceiroMenuState() {
  const accounts = Array.isArray(currentState?.ui?.accounts) ? currentState.ui.accounts : [];
  const activeAccountId = currentState?.ui?.activeAccountId ?? null;
  const activeAccount = resolveActiveAccountRecord(accounts, activeAccountId);
  const screenOrder = Array.isArray(currentState?.ui?.screenOrder)
    ? currentState.ui.screenOrder
    : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"];
  const menuActionsOrder = Array.isArray(currentState?.ui?.menuActionsOrder)
    ? currentState.ui.menuActionsOrder
    : defaultMenuActionsOrder();

  return {
    accountName: activeAccount?.name || "Sem conta",
    accessLabel: currentIdentity?.mode === "google" ? "Conta ativa" : "Conta local",
    accountDetails: buildMenuAccountDetails(activeAccountId, accounts),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      phone: account.phone || "",
      email: account.email || "",
      isActive: Number(account.id) === Number(activeAccountId)
    })),
    screenOrder: screenOrder.filter((screen) => screen !== "CONFIG").map((screen) => screenLabel(screen)),
    screenOrderActions: screenOrder
      .filter((screen) => screen !== "CONFIG")
      .map((screen) => ({
        id: screen,
        label: screenLabel(screen)
      })),
    themeMode: currentState?.ui?.themeMode === "dark" ? "dark" : "light",
    menuActions: menuActionsOrder.map((actionId) => ({
      id: actionId,
      label: menuActionLabel(actionId)
    }))
  };
}

function bindEvents() {
  nodes.transactionForm.addEventListener("submit", handleSubmit);
  nodes.typeToggle?.addEventListener("click", handleTypeToggleClick);
  nodes.manageCategoryToggleButton?.addEventListener("click", toggleCategoryManager);
  nodes.managePaymentToggleButton?.addEventListener("click", togglePaymentManager);
  nodes.addExpenseCategoryButton?.addEventListener("click", () => handleAddCatalogItem("expense"));
  nodes.addIncomeCategoryButton?.addEventListener("click", () => handleAddCatalogItem("income"));
  nodes.addPaymentMethodButton?.addEventListener("click", () => handleAddCatalogItem("payment"));
  nodes.settingsThemeLightButton?.addEventListener("click", () => handleThemeChange("light"));
  nodes.settingsThemeDarkButton?.addEventListener("click", () => handleThemeChange("dark"));
  nodes.settingsExpenseCategoriesList?.addEventListener("click", handleCatalogListClick);
  nodes.settingsIncomeCategoriesList?.addEventListener("click", handleCatalogListClick);
  nodes.settingsPaymentMethodsList?.addEventListener("click", handleCatalogListClick);
  nodes.screenTabs.addEventListener("click", handleScreenTabClick);
  nodes.categoryInput?.addEventListener("focus", handleCategoryInputFocus);
  nodes.categoryInput?.addEventListener("input", handleCategoryInputInput);
  nodes.categorySuggestions?.addEventListener("click", handleCategorySuggestionsClick);
  document.addEventListener("click", handleDocumentClickCloseSuggestions);
  document.addEventListener("click", handleDocumentClickCloseMultiSuggestions);
  nodes.incomeCategoryBars?.addEventListener("click", handleCategoryBarClick);
  nodes.expenseCategoryBars?.addEventListener("click", handleCategoryBarClick);
  nodes.multiLaunchTypeToggle?.addEventListener("click", handleMultiLaunchTypeToggleClick);
  nodes.multiLaunchRows?.addEventListener("click", handleMultiLaunchRowsClick);
  nodes.multiLaunchRows?.addEventListener("input", handleMultiLaunchRowsInput);
  nodes.multiLaunchRows?.addEventListener("change", handleMultiLaunchRowsInput);
  nodes.multiLaunchRows?.addEventListener("focus", handleMultiLaunchRowsFocus, true);
  nodes.multiLaunchAddRowButton?.addEventListener("click", handleAddMultiLaunchRow);
  nodes.multiLaunchFinalizeButton?.addEventListener("click", handleToggleMultiLaunchFinalize);
  nodes.multiLaunchSaveButton?.addEventListener("click", handleSaveMultiLaunch);
  [
    nodes.historyStartDate,
    nodes.historyEndDate,
    nodes.historyCategoryFilter,
    nodes.historyPaymentFilter
  ].forEach((node) => {
    node?.addEventListener("change", handleHistoryFilterChange);
  });
  nodes.historyTypeToggle?.addEventListener("click", handleHistoryTypeToggleClick);
  nodes.clearHistoryFiltersButton?.addEventListener("click", clearHistoryFilters);
  nodes.futureTypeToggle?.addEventListener("click", handleFutureTypeToggleClick);
  [nodes.futureStartDate, nodes.futureEndDate, nodes.futureCategoryFilter, nodes.futurePaymentFilter]
    .forEach((node) => node?.addEventListener("change", handleFutureFilterChange));
  nodes.clearFutureFiltersButton?.addEventListener("click", clearFutureFilters);
  nodes.selectAllFutureButton?.addEventListener("click", handleSelectAllFuture);
  nodes.clearFutureSelectionButton?.addEventListener("click", handleClearFutureSelection);
  nodes.completeSelectedFutureButton?.addEventListener("click", handleCompleteSelectedFuture);
  nodes.futureLaunchesList?.addEventListener("click", handleFutureListClick);
  nodes.extratoList?.addEventListener("click", handleTransactionListClick);
  nodes.transactionsList?.addEventListener("click", handleTransactionListClick);
  nodes.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      currentFilter = tab.dataset.filter;
      nodes.filterTabs.forEach((item) => item.classList.toggle("active", item === tab));
      renderTransactions();
    });
  });
  nodes.settingsViewMode?.addEventListener("change", handleViewModeChange);
  nodes.settingsVoiceAutoListen?.addEventListener("change", handleVoiceAutoListenChange);
  nodes.settingsNotificationsEnabled?.addEventListener("change", handleNotificationsEnabledChange);
  nodes.settingsNotificationTime?.addEventListener("change", handleNotificationTimeChange);
  nodes.settingsVoiceWakeWordSave?.addEventListener("click", handleVoiceWakeWordSave);
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const description = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "Casa");
  const type = String(formData.get("type") || "expense");
  const paymentMethod = String(formData.get("paymentMethod") || preferredPaymentMethod() || "Dinheiro");
  const installments = Math.max(1, Number.parseInt(String(formData.get("installments") || "1"), 10) || 1);
  const dateValue = String(formData.get("date") || todayDateInputValue());
  const amount = Number(formData.get("amount"));

  if (!Number.isFinite(amount) || amount <= 0) return;

  const dateMillis = toStartOfDayMillis(dateValue);

  const transactionToSave = {
    id: editingTransactionId || generateId(),
    title: description,
    category,
    type,
    amount,
    dateMillis,
    dateLabel: formatRelativeDate(dateMillis),
    paymentMethod,
    installments,
    installmentNumber: 1,
    originalTotalAmount: amount * installments,
    cardPaymentDateMillis: resolveCardPaymentDateMillis(paymentMethod, dateMillis),
    notes: ""
  };

  const wasEditing = Number.isFinite(Number(editingTransactionId)) && editingTransactionId !== null;
  const previousTransactions = [...currentState.transactions];

  if (wasEditing) {
    currentState.transactions = currentState.transactions.map((transaction) =>
      transaction.id === editingTransactionId ? transactionToSave : transaction
    );
  } else {
    currentState.transactions.unshift(transactionToSave);
  }

  updateCatalogForTransaction(category, type, paymentMethod);
  const saved = await saveState();
  if (!saved) {
    currentState.transactions = previousTransactions;
    render();
    return;
  }
  clearTransactionForm();
  syncTypeToggle(selectDefaultTransactionType());
  renderCategoryOptions();
  renderPaymentMethodOptions();
  syncManagerSections();
  syncLaunchFormDefaults();
  render();
  if (wasEditing) {
    showAppToast("Lançamento atualizado.");
  } else {
    promptPrintTransactions([transactionToSave], "Lançamento salvo. Deseja imprimir?");
  }
  navigateToScreen("EXTRATO");
}

function createMultiLaunchRow() {
  return {
    id: generateId(),
    amount: "",
    quantity: "1",
    category: "",
    autoAmountFromCategory: false,
    categoryUnitAmount: null
  };
}

function renderMultiLaunchScreen() {
  if (nodes.multiLaunchTypeInput) {
    nodes.multiLaunchTypeInput.value = multiLaunchType;
  }

  if (nodes.multiLaunchTypeToggle) {
    nodes.multiLaunchTypeToggle
      .querySelectorAll("[data-multi-type]")
      .forEach((button) => {
        button.classList.toggle("active", button.dataset.multiType === multiLaunchType);
      });
  }

  if (nodes.multiLaunchFinalizeButton) {
    nodes.multiLaunchFinalizeButton.classList.toggle("active", multiLaunchFinalizeOpen);
  }

  if (nodes.multiLaunchRows) {
    const categoryOptions = deriveMultiLaunchCategoryOptions();
    nodes.multiLaunchRows.innerHTML = multiLaunchRows
      .map((row, index) => renderMultiLaunchRow(row, index, categoryOptions))
      .join("");
  }

  if (nodes.multiLaunchSaveButton) {
    nodes.multiLaunchSaveButton.textContent = "SALVAR TODOS";
  }

  if (nodes.multiLaunchPaymentMethodInput) {
    const paymentMethods = derivePaymentMethodOptions();
    const currentValue = nodes.multiLaunchPaymentMethodInput.value;
    nodes.multiLaunchPaymentMethodInput.innerHTML = [
      `<option value="">Pagamento único</option>`,
      ...paymentMethods.map((method) => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`)
    ].join("");
    if (paymentMethods.includes(currentValue)) {
      nodes.multiLaunchPaymentMethodInput.value = currentValue;
    } else {
      nodes.multiLaunchPaymentMethodInput.value = preferredPaymentMethod();
    }
  }

  if (nodes.multiLaunchTotalValue) {
    nodes.multiLaunchTotalValue.textContent = currency.format(computeMultiLaunchTotal());
  }

  if (nodes.multiLaunchDateInput && !nodes.multiLaunchDateInput.value) {
    nodes.multiLaunchDateInput.value = todayDateInputValue();
  }

  if (multiLaunchFinalizeOpen) {
    nodes.multiLaunchFinalizeCard?.classList.remove("hidden");
    nodes.multiLaunchFinalizeCard?.classList.add("is-focused");
  } else {
    nodes.multiLaunchFinalizeCard?.classList.add("hidden");
    nodes.multiLaunchFinalizeCard?.classList.remove("is-focused");
  }
}

function computeMultiLaunchTotal() {
  return multiLaunchRows.reduce((total, row) => {
    const amount = Number.parseFloat(String(row.amount || "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return total;
    return total + amount;
  }, 0);
}

function renderMultiLaunchRow(row, index, categoryOptions) {
  return `
    <article class="multi-launch-entry-card">
      <h3 class="multi-launch-entry-title">Lançamento ${index + 1}</h3>
      <label class="multi-launch-field multi-launch-money-field">
        <span class="multi-launch-field-legend">&nbsp;</span>
        <div class="multi-launch-field-shell">
          <span class="multi-launch-currency-symbol">$</span>
          <input
            data-multi-row-id="${row.id}"
            data-multi-field="amount"
            type="number"
            inputmode="decimal"
            min="0.01"
            step="0.01"
            placeholder="Valor"
            value="${escapeAttribute(row.amount)}"
          />
        </div>
      </label>
      <label class="multi-launch-field">
        <span class="multi-launch-field-legend">Quantidade</span>
        <input
          data-multi-row-id="${row.id}"
          data-multi-field="quantity"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          value="${escapeAttribute(row.quantity || "1")}"
        />
      </label>
      <label class="multi-launch-field">
        <span class="multi-launch-field-legend">Categoria</span>
        <div class="field-with-suggestions">
          <input
            data-multi-row-id="${row.id}"
            data-multi-field="category"
            data-multi-category-search="true"
            type="text"
            inputmode="text"
            placeholder="Categoria"
            autocomplete="off"
            autocapitalize="words"
            enterkeyhint="done"
            value="${escapeAttribute(row.category || "")}"
          />
          <div
            class="multi-launch-category-suggestions hidden"
            data-multi-category-suggestions="${row.id}"
            role="listbox"
            aria-label="Categorias encontradas"
          ></div>
        </div>
      </label>
      ${multiLaunchRows.length > 1 ? `
        <button
          class="ghost-button dark-ghost multi-launch-remove-button"
          data-multi-remove-row-id="${row.id}"
          type="button"
        >
          Remover lançamento
        </button>
      ` : ""}
    </article>
  `;
}

function deriveMultiLaunchCategoryOptions() {
  return multiLaunchType === "income"
    ? deriveCategoryOptions("income")
    : deriveCategoryOptions("expense");
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function getMultiLaunchCategorySuggestions(query, categoryOptions) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return categoryOptions
    .filter((option) => normalizeSearchText(option).startsWith(normalizedQuery))
    .slice(0, 8);
}

function applyMultiLaunchCategorySelection(row, categoryValue) {
  row.category = categoryValue;
  const defaultAmount = getMultiLaunchCategoryDefaultAmount(categoryValue);
  if ((String(row.amount || "").trim() === "" || row.autoAmountFromCategory) && Number.isFinite(Number(defaultAmount))) {
    row.amount = String(formatMultiLaunchAmount(Number(defaultAmount)));
  }
  row.autoAmountFromCategory = Number.isFinite(Number(defaultAmount));
  row.categoryUnitAmount = Number.isFinite(Number(defaultAmount)) ? Number(defaultAmount) : null;
}

function focusMultiLaunchCategoryField(rowId, selectionStart = null, selectionEnd = null) {
  window.requestAnimationFrame(() => {
    const input = nodes.multiLaunchRows?.querySelector(
      `[data-multi-row-id="${rowId}"][data-multi-field="category"]`
    );
    if (!input || typeof input.focus !== "function") return;

    input.focus({ preventScroll: true });

    if (
      typeof selectionStart === "number" &&
      typeof selectionEnd === "number" &&
      typeof input.setSelectionRange === "function"
    ) {
      input.setSelectionRange(selectionStart, selectionEnd);
      return;
    }

    const end = String(input.value || "").length;
    if (typeof input.setSelectionRange === "function") {
      input.setSelectionRange(end, end);
    }
  });
}

function updateMultiLaunchAmountField(rowId, amount) {
  const amountInput = nodes.multiLaunchRows?.querySelector(
    `[data-multi-row-id="${rowId}"][data-multi-field="amount"]`
  );
  if (!amountInput) return;
  amountInput.value = amount;
}

function renderMultiLaunchCategorySuggestions(rowId, query, keepOpen = false) {
  const suggestionsNode = nodes.multiLaunchRows?.querySelector(
    `[data-multi-category-suggestions="${rowId}"]`
  );
  if (!suggestionsNode) return;

  const categoryOptions = deriveMultiLaunchCategoryOptions();
  if (categoryOptions.length === 0) {
    suggestionsNode.innerHTML = "";
    suggestionsNode.classList.add("hidden");
    return;
  }

  if (keepOpen) {
    const q = String(query || "").trim();
    const filtered = q
      ? categoryOptions.filter((opt) => normalizeSearchText(opt).startsWith(normalizeSearchText(q)))
      : categoryOptions;

    if (filtered.length === 0) {
      suggestionsNode.innerHTML = "";
      suggestionsNode.classList.add("hidden");
      return;
    }

    suggestionsNode.innerHTML = filtered
      .map((option) => `<button class="multi-launch-category-option" data-multi-category-option="${escapeAttribute(option)}" data-multi-row-id="${rowId}" type="button">${escapeHtml(option)}</button>`)
      .join("");
    suggestionsNode.classList.remove("hidden");
    return;
  }

  suggestionsNode.innerHTML = "";
  suggestionsNode.classList.add("hidden");
}

let multiActiveRowId = null;

function handleMultiLaunchRowsFocus(event) {
  const field = event.target.closest("[data-multi-row-id][data-multi-field='category']");
  if (!field) return;
  const rowId = Number(field.dataset.multiRowId);
  multiActiveRowId = rowId;
  renderMultiLaunchCategorySuggestions(rowId, field.value, true);
}

function handleDocumentClickCloseMultiSuggestions(event) {
  if (multiActiveRowId === null) return;
  const wrapper = nodes.multiLaunchRows?.querySelector(
    `[data-multi-category-suggestions="${multiActiveRowId}"]`
  )?.closest(".field-with-suggestions");
  const activeInput = nodes.multiLaunchRows?.querySelector(
    `[data-multi-row-id="${multiActiveRowId}"][data-multi-field="category"]`
  );
  if ((wrapper && wrapper.contains(event.target)) || (activeInput && activeInput.contains(event.target))) return;
  const suggestionsNode = nodes.multiLaunchRows?.querySelector(
    `[data-multi-category-suggestions="${multiActiveRowId}"]`
  );
  if (suggestionsNode) {
    suggestionsNode.innerHTML = "";
    suggestionsNode.classList.add("hidden");
  }
  multiActiveRowId = null;
}

function handleMultiLaunchTypeToggleClick(event) {
  const button = event.target.closest("[data-multi-type]");
  if (!button) return;
  multiLaunchType = button.dataset.multiType === "income" ? "income" : "expense";
  multiLaunchFinalizeOpen = false;
  renderMultiLaunchScreen();
}

function handleMultiLaunchRowsInput(event) {
  const field = event.target.closest("[data-multi-row-id][data-multi-field]");
  if (!field) return;
  const rowId = Number(field.dataset.multiRowId);
  const row = multiLaunchRows.find((item) => item.id === rowId);
  if (!row) return;

  if (field.dataset.multiField === "amount") {
    row.amount = field.value;
    row.autoAmountFromCategory = false;
  } else if (field.dataset.multiField === "quantity") {
    row.quantity = field.value;
  } else if (field.dataset.multiField === "category") {
    applyMultiLaunchCategorySelection(row, field.value);
    renderMultiLaunchCategorySuggestions(rowId, field.value, true);
    if (row.autoAmountFromCategory) {
      updateMultiLaunchAmountField(rowId, row.amount);
    }
  }
}

function handleMultiLaunchRowsClick(event) {
  const removeButton = event.target.closest("[data-multi-remove-row-id]");
  if (removeButton) {
    const rowId = Number(removeButton.dataset.multiRemoveRowId);
    multiLaunchRows = multiLaunchRows.filter((row) => row.id !== rowId);
    if (!multiLaunchRows.length) {
      multiLaunchRows = [createMultiLaunchRow()];
    }
    renderMultiLaunchScreen();
    return;
  }

  const categoryOptionButton = event.target.closest("[data-multi-category-option][data-multi-row-id]");
  if (!categoryOptionButton) return;

  const rowId = Number(categoryOptionButton.dataset.multiRowId);
  const row = multiLaunchRows.find((item) => item.id === rowId);
  if (!row) return;

  applyMultiLaunchCategorySelection(row, categoryOptionButton.dataset.multiCategoryOption || "");
  const categoryInput = nodes.multiLaunchRows?.querySelector(
    `[data-multi-row-id="${rowId}"][data-multi-field="category"]`
  );
  if (categoryInput) {
    categoryInput.value = row.category;
  }
  multiActiveRowId = null;
  updateMultiLaunchAmountField(rowId, row.amount);
  renderMultiLaunchCategorySuggestions(rowId, "");
  focusMultiLaunchCategoryField(rowId);
}

function handleAddMultiLaunchRow() {
  multiLaunchRows.push(createMultiLaunchRow());
  multiLaunchFinalizeOpen = false;
  renderMultiLaunchScreen();
  showAppToast("Novo lançamento adicionado.");
  const lastCard = nodes.multiLaunchRows?.lastElementChild;
  const lastAmountInput = lastCard?.querySelector('[data-multi-field="amount"]');
  if (lastCard && typeof lastCard.scrollIntoView === "function") {
    lastCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (lastCard) {
    lastCard.classList.add("is-new");
    window.setTimeout(() => {
      lastCard.classList.remove("is-new");
    }, 1400);
  }
  if (lastAmountInput && typeof lastAmountInput.focus === "function") {
    window.setTimeout(() => lastAmountInput.focus(), 120);
  }
}

function handleToggleMultiLaunchFinalize() {
  multiLaunchFinalizeOpen = true;
  renderMultiLaunchScreen();
  const finalizeCard = nodes.multiLaunchFinalizeCard;
  if (finalizeCard && typeof finalizeCard.scrollIntoView === "function") {
    finalizeCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (nodes.multiLaunchPaymentMethodInput && typeof nodes.multiLaunchPaymentMethodInput.focus === "function") {
    nodes.multiLaunchPaymentMethodInput.focus();
  }
}

function render() {
  const income = sumByType("income");
  const expense = sumByType("expense");
  const balance = income - expense;

  nodes.currentMonthLabel.textContent = currentState.monthLabel;

  renderExtratoAccountSnapshot();
  renderHistoryFilterOptions();
  renderExtratoSummary();
  renderExtratoCategoryBars();
  renderExtratoList();
  renderFutureScreen(balance, income, expense);
  renderFutureFilterOptions();
  renderBudgets();
  renderTransactions();
  renderMultiLaunchScreen();
  syncTypeToggle(selectDefaultTransactionType());
  renderCategoryOptions();
  renderPaymentMethodOptions();
  syncManagerSections();
  syncLaunchFormDefaults();
  renderScreenTabs();
  renderScreenPanels();
  renderSettings();
  window.dispatchEvent(new CustomEvent("financeiro:menu-state", { detail: getFinanceiroMenuState() }));
}

function renderExtratoAccountSnapshot() {
  if (!nodes.extratoAccountSnapshot) return;

  const paymentMethods = uniqueCaseInsensitive(
    currentState.transactions.map((transaction) => transaction.paymentMethod).filter(Boolean)
  );

  const items = [
    {
      title: "Conta conectada",
      text: currentIdentity?.user?.displayName || currentIdentity?.user?.email || "Conta local"
    },
    {
      title: "Origem",
      text: currentIdentity?.mode === "google" ? "Conta ativa" : "Conta local"
    },
    {
      title: "Formas de pagamento",
      text: paymentMethods.length > 0 ? paymentMethods.join(", ") : "Nenhuma forma mapeada"
    }
  ];

  nodes.extratoAccountSnapshot.innerHTML = items
    .map(
      (item) => `
        <div class="insight-item">
          <strong>${escapeHtml(item.title)}</strong>
          <p class="muted">${escapeHtml(item.text)}</p>
        </div>
      `
    )
    .join("");
}

function renderExtratoCategoryBars() {
  renderCategoryBarsByType({
    node: nodes.incomeCategoryBars,
    type: "income",
    emptyMessage: "As receitas por categoria aparecem quando houver entradas no período.",
    fallbackColor: "#145c4c"
  });
  renderCategoryBarsByType({
    node: nodes.expenseCategoryBars,
    type: "expense",
    emptyMessage: "As despesas por categoria aparecem quando houver saídas no período.",
    fallbackColor: "#d9604c"
  });
}

function renderCategoryBarsByType({ node, type, emptyMessage, fallbackColor }) {
  if (!node) return;

  const totals = totalsByCategoryForFilters(type);
  const launchCounts = countsByCategoryForFilters(type);
  const entries = Object.entries(totals);
  const max = Math.max(...Object.values(totals), 1);

  if (entries.length === 0) {
    node.innerHTML = emptyStateHtml(emptyMessage);
    return;
  }

  node.innerHTML = entries
    .sort((left, right) => right[1] - left[1])
    .map(([name, total]) => {
      const budget = currentState.budgets.find((item) => item.name === name);
      const color = budget?.color || fallbackColor;
      const width = `${Math.max((total / max) * 100, 6)}%`;
      const launchCount = launchCounts[name] || 0;
      const isActive = currentHistoryFilters.type === type && currentHistoryFilters.category === name;

      return `
        <button class="bar-item category-bar-button ${isActive ? "active" : ""}" data-bar-type="${escapeAttribute(type)}" data-bar-category="${escapeAttribute(name)}" type="button">
          <div class="bar-head">
            <strong>${escapeHtml(`${name} (${launchCount})`)}</strong>
            <span>${currency.format(total)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}; background:${color};"></div>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderHistoryFilterOptions() {
  syncHistoryFilterInputs();

  const type = getActiveHistoryType();
  const categoryOptions = deriveHistoryCategoryOptions(type);
  const paymentOptions = deriveHistoryPaymentOptions();
  const previousCategory = currentHistoryFilters.category;
  const previousPayment = currentHistoryFilters.payment;
  const showDetailedFilters = type !== "all";

  nodes.historyCategoryGroup?.classList.toggle("hidden", !showDetailedFilters);
  nodes.historyPaymentGroup?.classList.toggle("hidden", !showDetailedFilters);

  if (!showDetailedFilters) {
    currentHistoryFilters.category = "";
    currentHistoryFilters.payment = "";
  }

  if (nodes.historyCategoryFilter) {
    nodes.historyCategoryFilter.innerHTML = ['<option value="">Todas</option>']
      .concat(categoryOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`))
      .join("");
    nodes.historyCategoryFilter.value = showDetailedFilters && categoryOptions.includes(previousCategory) ? previousCategory : "";
    currentHistoryFilters.category = nodes.historyCategoryFilter.value;
  }

  if (nodes.historyPaymentFilter) {
    nodes.historyPaymentFilter.innerHTML = ['<option value="">Todos</option>']
      .concat(paymentOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`))
      .join("");
    nodes.historyPaymentFilter.value = showDetailedFilters && paymentOptions.includes(previousPayment) ? previousPayment : "";
    currentHistoryFilters.payment = nodes.historyPaymentFilter.value;
  }
}

function getExtratoTransactionsBase() {
  const todayEnd = toEndOfDayMillis(todayDateInputValue());
  const activeFilters = getCurrentHistoryUiFilters();
  const startMillis = activeFilters.startDate
    ? toStartOfDayMillis(activeFilters.startDate)
    : null;
  const endMillis = activeFilters.endDate
    ? toEndOfDayMillis(activeFilters.endDate)
    : null;
  const includesFutureRange =
    (Number.isFinite(startMillis) && startMillis > todayEnd) ||
    (Number.isFinite(endMillis) && endMillis > todayEnd);

  if (includesFutureRange) {
    return currentState.transactions;
  }

  return currentState.transactions.filter((transaction) => resolveFutureDateMillis(transaction) <= todayEnd);
}

function renderExtratoList() {
  const filtered = getHistoryFilteredTransactions();
  const total = filtered.reduce(
    (accumulator, transaction) => accumulator + (resolveTransactionType(transaction) === "income" ? transaction.amount : -transaction.amount),
    0
  );

  if (nodes.filteredTotalValue) {
    nodes.filteredTotalValue.textContent = currency.format(total);
  }

  if (!nodes.extratoList) return;
  if (filtered.length === 0) {
    nodes.extratoList.innerHTML = emptyStateHtml("Sem lançamentos para o filtro selecionado.");
    return;
  }

  nodes.extratoList.innerHTML = filtered.map((transaction) => renderTransactionItem(transaction)).join("");
}

function renderExtratoSummary() {
  const filtered = getHistoryDateRangeTransactions();
  const income = filtered
    .filter((transaction) => resolveTransactionType(transaction) === "income")
    .reduce((accumulator, transaction) => accumulator + transaction.amount, 0);
  const expense = filtered
    .filter((transaction) => resolveTransactionType(transaction) === "expense")
    .reduce((accumulator, transaction) => accumulator + transaction.amount, 0);
  const balance = income - expense;

  if (nodes.balanceValue) nodes.balanceValue.textContent = currency.format(balance);
  if (nodes.incomeValue) nodes.incomeValue.textContent = currency.format(income);
  if (nodes.expenseValue) nodes.expenseValue.textContent = currency.format(expense);
}

function renderFutureScreen(balance, income, expense) {
  if (nodes.futureBalanceValue) nodes.futureBalanceValue.textContent = currency.format(balance);
  if (nodes.futureIncomeValue) nodes.futureIncomeValue.textContent = `+ ${currency.format(income)}`;
  if (nodes.futureExpenseValue) nodes.futureExpenseValue.textContent = `- ${currency.format(expense)}`;
  syncFutureFilterInputs();
  renderFutureList();
}

function renderBudgets() {
  if (!nodes.budgetList) return;

  const totals = totalsByCategoryForFilters("expense");

  if (currentState.budgets.length === 0) {
    nodes.budgetList.innerHTML = emptyStateHtml("Nenhum limite por categoria cadastrado.");
    return;
  }

  nodes.budgetList.innerHTML = currentState.budgets
    .map((budget) => {
      const spent = totals[budget.name] || 0;
      const progress = Math.min(spent / budget.limit, 1);
      const status = spent > budget.limit ? "Acima" : "No ritmo";
      const color = spent > budget.limit ? "#d9604c" : budget.color;

      return `
        <div class="budget-item">
          <div class="budget-row-head">
            <strong>${escapeHtml(budget.name)}</strong>
            <span class="status-badge" style="background:${hexToRgba(color, 0.14)}; color:${color};">${status}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${progress * 100}%; background:${color};"></div>
          </div>
          <div class="amount-strong">
            <span>${currency.format(spent)}</span>
            <span>limite ${currency.format(budget.limit)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTransactions() {
  const filtered = currentState.transactions.filter((transaction) => {
    if (currentFilter === "all") return true;
    return resolveTransactionType(transaction) === currentFilter;
  }).sort(compareLaunchDateNewestFirst);

  if (filtered.length === 0) {
    nodes.transactionsList.innerHTML = emptyStateHtml("Nenhuma transacao encontrada para este filtro.");
    return;
  }

  nodes.transactionsList.innerHTML = filtered.map((transaction) => renderTransactionItem(transaction)).join("");
}

function renderCategoryOptions() {
  if (!nodes.categoryInput || !nodes.typeInput) return;

  const type = nodes.typeInput.value === "income" ? "income" : "expense";
  const previousValue = nodes.categoryInput.value;
  const options = deriveCategoryOptions(type);
  currentCategoryOptions = options;

  if (previousValue && !options.includes(previousValue)) {
    nodes.categoryInput.value = options[0] || "";
  }
  renderSingleCategorySuggestions();
}

function renderSingleCategorySuggestions() {
  // Chamada pelo renderCategoryOptions — só atualiza se já estiver aberto
  if (!nodes.categorySuggestions) return;
  if (!categorySuggestionsOpen) return;
  showCategorySuggestions(nodes.categoryInput?.value?.trim() || "");
}

function showCategorySuggestions(query) {
  if (!nodes.categorySuggestions) return;
  const filtered = query
    ? currentCategoryOptions.filter((opt) => opt.toLowerCase().startsWith(query.toLowerCase()))
    : currentCategoryOptions;

  if (filtered.length === 0) {
    nodes.categorySuggestions.innerHTML = "<p style='padding:10px;opacity:0.5;font-size:13px'>Nenhuma categoria encontrada</p>";
  } else {
    nodes.categorySuggestions.innerHTML = filtered
      .map((option) => `<button class="category-suggestion-option" data-category-option="${escapeAttribute(option)}" type="button">${escapeHtml(option)}</button>`)
      .join("");
  }
  nodes.categorySuggestions.classList.remove("hidden");
  categorySuggestionsOpen = true;
}

function hideCategorySuggestions() {
  if (!nodes.categorySuggestions) return;
  nodes.categorySuggestions.innerHTML = "";
  nodes.categorySuggestions.classList.add("hidden");
  categorySuggestionsOpen = false;
}

function handleCategoryInputFocus() {
  showCategorySuggestions(nodes.categoryInput?.value?.trim() || "");
}

function handleCategoryInputInput() {
  showCategorySuggestions(nodes.categoryInput?.value?.trim() || "");
}

function handleCategorySuggestionsClick(event) {
  const button = event.target.closest("[data-category-option]");
  if (!button) return;
  if (nodes.categoryInput) nodes.categoryInput.value = button.dataset.categoryOption;
  hideCategorySuggestions();
  nodes.categoryInput?.focus();
}

function handleDocumentClickCloseSuggestions(event) {
  if (!categorySuggestionsOpen) return;
  const wrapper = nodes.categoryInput?.closest(".field-with-suggestions");
  if (wrapper && wrapper.contains(event.target)) return;
  hideCategorySuggestions();
}

function handleTypeToggleClick(event) {
  const button = event.target.closest(".type-toggle-button");
  if (!button) return;
  syncTypeToggle(button.dataset.type === "income" ? "income" : "expense");
  renderCategoryOptions();
  syncManagerSections();
}

function syncTypeToggle(type) {
  const resolvedType = type === "income" ? "income" : "expense";

  if (nodes.typeInput) {
    nodes.typeInput.value = resolvedType;
  }

  nodes.typeToggleButtons.forEach((button) => {
    const isActive = button.dataset.type === resolvedType;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function toggleCategoryManager() {
  isCategoryManagerOpen = !isCategoryManagerOpen;
  syncManagerSections();
}

function togglePaymentManager() {
  isPaymentManagerOpen = !isPaymentManagerOpen;
  syncManagerSections();
}

function syncManagerSections() {
  const currentLaunchType = nodes.typeInput?.value === "income" ? "income" : "expense";

  if (nodes.manageCategoryToggleButton) {
    nodes.manageCategoryToggleButton.textContent =
      currentLaunchType === "income" ? "Gerenciar categorias de receita" : "Gerenciar categorias de despesa";
  }

  nodes.manageExpenseCategoryCard?.classList.toggle(
    "hidden",
    !isCategoryManagerOpen || currentLaunchType !== "expense"
  );
  nodes.manageIncomeCategoryCard?.classList.toggle(
    "hidden",
    !isCategoryManagerOpen || currentLaunchType !== "income"
  );
  nodes.managePaymentCard?.classList.toggle("hidden", !isPaymentManagerOpen);
}

function renderPaymentMethodOptions() {
  if (!nodes.paymentMethodInput) return;

  const previousValue = nodes.paymentMethodInput.value;
  const options = derivePaymentMethodOptions();

  nodes.paymentMethodInput.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    .join("");

  if (options.includes(previousValue)) {
    nodes.paymentMethodInput.value = previousValue;
    return;
  }

  nodes.paymentMethodInput.value = preferredPaymentMethod();
}

function syncLaunchFormDefaults() {
  if (!editingTransactionId) {
    syncTypeToggle(selectDefaultTransactionType());
    renderCategoryOptions();
    syncManagerSections();
  }

  if (nodes.dateInput && !nodes.dateInput.value) {
    nodes.dateInput.value = todayDateInputValue();
  }

  if (nodes.installmentsInput && !nodes.installmentsInput.value) {
    nodes.installmentsInput.value = "1";
  }

  if (nodes.paymentMethodInput && !nodes.paymentMethodInput.value) {
    nodes.paymentMethodInput.value = preferredPaymentMethod();
  }
}

function clearTransactionForm() {
  nodes.transactionForm?.reset();
  editingTransactionId = null;
  if (nodes.titleInput) nodes.titleInput.value = "";
  if (nodes.amountInput) nodes.amountInput.value = "";
  if (nodes.dateInput) nodes.dateInput.value = todayDateInputValue();
  if (nodes.installmentsInput) nodes.installmentsInput.value = "1";
  isCategoryManagerOpen = false;
  isPaymentManagerOpen = false;
  syncTypeToggle(selectDefaultTransactionType());
  renderCategoryOptions();
  renderPaymentMethodOptions();
  syncManagerSections();
}

function startEditingTransaction(transaction) {
  if (!transaction) return;
  editingTransactionId = Number(transaction.id);
  navigateToScreen("LANCAMENTOS");
  syncTypeToggle(transaction.type);
  renderCategoryOptions();
  renderPaymentMethodOptions();
  if (nodes.amountInput) nodes.amountInput.value = String(transaction.amount);
  if (nodes.categoryInput) nodes.categoryInput.value = transaction.category;
  if (nodes.paymentMethodInput) nodes.paymentMethodInput.value = transaction.paymentMethod;
  if (nodes.titleInput) nodes.titleInput.value = transaction.title || transaction.notes || "";
  if (nodes.dateInput) nodes.dateInput.value = formatDateInputValue(transaction.dateMillis);
  if (nodes.installmentsInput) nodes.installmentsInput.value = String(transaction.installments || 1);
  showAppToast("Edite e salve o lançamento.");
}

function renderScreenTabs() {
  const order = currentState.ui.screenOrder;
  if (!order.includes(activeScreen)) {
    activeScreen = order[0];
  }

  nodes.screenTabs.innerHTML = order
    .filter((screen) => screen !== "CONFIG")
    .map(
      (screen) => `
        <button class="screen-tab ${screen === activeScreen ? "active" : ""}" data-screen="${screen}" type="button">
          ${escapeHtml(screenTabLabel(screen))}
        </button>
      `
    )
    .join("");
}

function renderScreenPanels() {
  nodes.screenPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.screen === activeScreen);
  });
}

function handleScreenTabClick(event) {
  const button = event.target.closest(".screen-tab");
  if (!button) return;
  navigateToScreen(button.dataset.screen);
}

function navigateToScreen(screen) {
  activeScreen = screen;
  renderScreenTabs();
  renderScreenPanels();
  if (screen === "LANCAMENTOS" && !editingTransactionId) {
    syncLaunchFormDefaults();
  }
}

async function moveMenuAction(actionId, direction) {
  const movableScreens = ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"];
  if (!movableScreens.includes(actionId)) return false;

  const currentOrder = Array.isArray(currentState?.ui?.screenOrder)
    ? currentState.ui.screenOrder
    : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO", "CONFIG"];
  const screensOnly = currentOrder.filter((screen) => movableScreens.includes(screen));
  const order = [...screensOnly];
  const index = order.indexOf(actionId);
  if (index === -1) return false;

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= order.length) return false;

  [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
  currentState.ui.screenOrder = [...order, "CONFIG"];
  persistUiPreferencesLocally();
  render();
  showAppToast("Ordem das telas atualizada.");
  await saveState();
  return true;
}

function persistUiPreferencesLocally() {
  const userId = currentIdentity?.user?.uid;
  if (!userId) return;

  try {
    localStorage.setItem(`financeiro-pwa-ui-prefs-${userId}`, JSON.stringify(currentState.ui || {}));
  } catch (error) {
    console.warn("Falha ao salvar a ordem localmente:", error);
  }
}

async function runMenuAction(actionId) {
  if (actionId === "EXTRATO") {
    navigateToScreen("EXTRATO");
    return;
  }
  if (actionId === "LANCAMENTOS") {
    navigateToScreen("LANCAMENTOS");
    return;
  }
  if (actionId === "QUADRO") {
    navigateToScreen("QUADRO");
    return;
  }
  if (actionId === "MULTIPLOS") {
    navigateToScreen("MULTIPLOS");
    return;
  }
  if (actionId === "EXPORT_CSV") {
    exportTransactionsCsv();
    return;
  }
  if (actionId === "EXPORT_EXCEL") {
    exportTransactionsExcel();
  }
}

function renderSettings() {
  if (!nodes.settingsAccountName) return;

  const activeAccount = resolveActiveAccountRecord(
    Array.isArray(currentState?.ui?.accounts) ? currentState.ui.accounts : [],
    currentState?.ui?.activeAccountId ?? null
  );
  const userName = activeAccount?.name || "Sem conta";
  const dataSource = currentIdentity?.mode === "google"
    ? "Conta ativa"
    : "Conta local";
  const orderLabel = currentState.ui.screenOrder.map((screen) => screenLabel(screen)).join(", ");

  nodes.settingsAccountName.textContent = userName;
  if (nodes.settingsDataSource) {
    nodes.settingsDataSource.textContent = dataSource;
  }
  if (nodes.settingsScreenOrder) {
    nodes.settingsScreenOrder.textContent = orderLabel;
  }
  if (nodes.settingsThemeStatus) {
    nodes.settingsThemeStatus.textContent = currentState.ui.themeMode === "dark" ? "Dark" : "Claro";
  }
  if (nodes.settingsViewMode) {
    nodes.settingsViewMode.value = currentState.ui.visualizacaoModo || "UMA_TELA";
  }
  if (nodes.settingsVoiceAutoListen) {
    nodes.settingsVoiceAutoListen.checked = Boolean(currentState.ui.voiceAutoListenEnabled);
  }
  if (nodes.settingsVoiceWakeWord) {
    nodes.settingsVoiceWakeWord.value = currentState.ui.voiceWakeWord || "financeiro";
  }
  if (nodes.settingsNotificationsEnabled) {
    nodes.settingsNotificationsEnabled.checked = Boolean(currentState.ui.notificationsEnabled);
  }
  if (nodes.settingsNotificationTime) {
    nodes.settingsNotificationTime.value = formatNotificationTime(
      currentState.ui.notificationHour,
      currentState.ui.notificationMinute
    );
    nodes.settingsNotificationTime.disabled = !currentState.ui.notificationsEnabled;
  }
  nodes.settingsThemeLightButton?.classList.toggle("primary-button", currentState.ui.themeMode !== "dark");
  nodes.settingsThemeLightButton?.classList.toggle("ghost-button", currentState.ui.themeMode === "dark");
  nodes.settingsThemeLightButton?.classList.toggle("dark-ghost", currentState.ui.themeMode === "dark");
  nodes.settingsThemeDarkButton?.classList.toggle("primary-button", currentState.ui.themeMode === "dark");
  nodes.settingsThemeDarkButton?.classList.toggle("ghost-button", currentState.ui.themeMode !== "dark");
  nodes.settingsThemeDarkButton?.classList.toggle("dark-ghost", currentState.ui.themeMode !== "dark");
  renderCatalogManagers();
}

async function handleThemeChange(nextTheme) {
  const normalizedTheme = nextTheme === "dark" ? "dark" : "light";
  if (currentState.ui.themeMode === normalizedTheme) return;
  currentState.ui.themeMode = normalizedTheme;
  applyTheme();
  await saveState();
  renderSettings();
  window.dispatchEvent(new CustomEvent("financeiro:menu-state", { detail: getFinanceiroMenuState() }));
  showAppToast(currentState.ui.themeMode === "dark" ? "Tema dark ativado." : "Tema claro ativado.");
}

async function setThemeMode(nextTheme) {
  await handleThemeChange(nextTheme);
}

async function handleViewModeChange() {
  currentState.ui.visualizacaoModo = nodes.settingsViewMode?.value === "DUAS_TELAS" ? "DUAS_TELAS" : "UMA_TELA";
  await saveState();
  showAppToast("Visualização do app atualizada.");
}

async function handleVoiceAutoListenChange() {
  currentState.ui.voiceAutoListenEnabled = Boolean(nodes.settingsVoiceAutoListen?.checked);
  await saveState();
  showAppToast("Ajuste de voz atualizado.");
}

async function handleVoiceWakeWordSave() {
  const sanitized = String(nodes.settingsVoiceWakeWord?.value || "").trim() || "financeiro";
  currentState.ui.voiceWakeWord = sanitized;
  if (nodes.settingsVoiceWakeWord) {
    nodes.settingsVoiceWakeWord.value = sanitized;
  }
  await saveState();
  showAppToast("Palavra de ativação salva.");
}

async function handleNotificationsEnabledChange() {
  currentState.ui.notificationsEnabled = Boolean(nodes.settingsNotificationsEnabled?.checked);
  if (nodes.settingsNotificationTime) {
    nodes.settingsNotificationTime.disabled = !currentState.ui.notificationsEnabled;
  }
  await saveState();
  showAppToast("Notificações atualizadas.");
}

async function handleNotificationTimeChange() {
  const [hourRaw, minuteRaw] = String(nodes.settingsNotificationTime?.value || "10:00").split(":");
  const hour = Number.parseInt(hourRaw || "10", 10);
  const minute = Number.parseInt(minuteRaw || "0", 10);
  currentState.ui.notificationHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, hour)) : 10;
  currentState.ui.notificationMinute = Number.isFinite(minute) ? Math.min(59, Math.max(0, minute)) : 0;
  await saveState();
  showAppToast("Hora da notificação salva.");
}

function formatNotificationTime(hour, minute) {
  const safeHour = Number.isFinite(Number(hour)) ? Math.min(23, Math.max(0, Number(hour))) : 10;
  const safeMinute = Number.isFinite(Number(minute)) ? Math.min(59, Math.max(0, Number(minute))) : 0;
  return `${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
}

function renderCatalogManagers() {
  renderCatalogManager({
    node: nodes.settingsExpenseCategoriesList,
    kind: "expense",
    items: currentState.catalog.expenseCategories,
    emptyMessage: "Nenhuma categoria de despesa cadastrada."
  });
  renderCatalogManager({
    node: nodes.settingsIncomeCategoriesList,
    kind: "income",
    items: currentState.catalog.incomeCategories,
    emptyMessage: "Nenhuma categoria de receita cadastrada."
  });
  renderCatalogManager({
    node: nodes.settingsPaymentMethodsList,
    kind: "payment",
    items: currentState.catalog.paymentMethods,
    emptyMessage: "Nenhuma forma de pagamento cadastrada."
  });
}

function renderCatalogManager({ node, kind, items, emptyMessage }) {
  if (!node) return;

  if (!items.length) {
    node.innerHTML = emptyStateHtml(emptyMessage);
    return;
  }

  node.innerHTML = items
    .map(
      (item) => `
        <div class="catalog-item">
          <div class="catalog-item-copy">
            <strong>${escapeHtml(item)}</strong>
            ${kind === "payment" ? renderPaymentConfigText(item) : ""}
          </div>
          <div class="catalog-item-actions">
            <button class="primary-button compact-button catalog-edit-button" data-action="edit" data-kind="${kind}" data-value="${escapeHtml(item)}" type="button">
              Editar
            </button>
            <button class="ghost-button dark-ghost compact-button catalog-delete-button" data-action="delete" data-kind="${kind}" data-value="${escapeHtml(item)}" type="button">
              Excluir
            </button>
          </div>
        </div>
      `
    )
    .join("");
}

function renderPaymentConfigText(method) {
  const config = currentState.catalog.paymentMethodConfigs?.[method];
  if (!config) return "";
  return `<p class="muted">Fechamento: ${escapeHtml(String(config.closingDay))} · Pagamento: ${escapeHtml(String(config.paymentDay))}</p>`;
}

function totalsByCategoryForFilters(type) {
  return getHistoryFilteredTransactions()
    .filter((item) => resolveTransactionType(item) === type)
    .reduce((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] || 0) + transaction.amount;
      return accumulator;
    }, {});
}

function countsByCategoryForFilters(type) {
  return getHistoryFilteredTransactions()
    .filter((item) => resolveTransactionType(item) === type)
    .reduce((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] || 0) + 1;
      return accumulator;
    }, {});
}

function getActiveHistoryType() {
  const activeButton = nodes.historyTypeButtons.find((button) => button.classList.contains("active"));
  const buttonType = activeButton?.dataset.historyType;
  if (buttonType === "income" || buttonType === "expense" || buttonType === "all") {
    return buttonType;
  }

  const currentType = currentHistoryFilters.type;
  if (currentType === "income" || currentType === "expense" || currentType === "all") {
    return currentType;
  }

  const hiddenType = nodes.historyTypeFilter?.value;
  if (hiddenType === "income" || hiddenType === "expense" || hiddenType === "all") {
    return hiddenType;
  }

  return "all";
}

function getCurrentHistoryUiFilters() {
  const type = getActiveHistoryType();
  const startDate = nodes.historyStartDate?.value || currentHistoryFilters.startDate || "";
  const endDate = nodes.historyEndDate?.value || currentHistoryFilters.endDate || "";
  const category = type === "all" ? "" : (nodes.historyCategoryFilter?.value || currentHistoryFilters.category || "");
  const payment = type === "all" ? "" : (nodes.historyPaymentFilter?.value || currentHistoryFilters.payment || "");

  return {
    startDate,
    endDate,
    type,
    category,
    payment
  };
}

function sumByType(type) {
  return currentState.transactions
    .filter((transaction) => resolveTransactionType(transaction) === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function handleHistoryFilterChange() {
  const nextType = getActiveHistoryType();
  currentHistoryFilters = {
    startDate: nodes.historyStartDate?.value || "",
    endDate: nodes.historyEndDate?.value || "",
    type: nextType,
    category: nextType === "all" ? "" : (nodes.historyCategoryFilter?.value || ""),
    payment: nextType === "all" ? "" : (nodes.historyPaymentFilter?.value || "")
  };

  renderHistoryFilterOptions();
  renderExtratoSummary();
  renderExtratoCategoryBars();
  renderExtratoList();
}

function handleHistoryTypeToggleClick(event) {
  const button = event.target.closest("[data-history-type]");
  if (!button) return;

  const nextType = button.dataset.historyType || "all";
  if (nextType === currentHistoryFilters.type) return;

  currentHistoryFilters.type = nextType;
  if (nextType === "all") {
    currentHistoryFilters.category = "";
    currentHistoryFilters.payment = "";
  }

  syncHistoryFilterInputs();
  renderHistoryFilterOptions();
  renderExtratoSummary();
  renderExtratoCategoryBars();
  renderExtratoList();
}

function handleCategoryBarClick(event) {
  const button = event.target.closest("[data-bar-type][data-bar-category]");
  if (!button) return;

  currentHistoryFilters.type = button.dataset.barType || "all";
  currentHistoryFilters.category = button.dataset.barCategory || "";
  currentHistoryFilters.payment = "";

  syncHistoryFilterInputs();
  renderHistoryFilterOptions();
  renderExtratoSummary();
  renderExtratoCategoryBars();
  renderExtratoList();
}

function clearHistoryFilters() {
  currentHistoryFilters = {
    startDate: "",
    endDate: "",
    type: "all",
    category: "",
    payment: ""
  };
  syncHistoryFilterInputs();
  renderHistoryFilterOptions();
  renderExtratoSummary();
  renderExtratoCategoryBars();
  renderExtratoList();
}

function handleFutureFilterChange() {
  currentFutureFilters = {
    ...currentFutureFilters,
    startDate: nodes.futureStartDate?.value || "",
    endDate: nodes.futureEndDate?.value || "",
    category: nodes.futureCategoryFilter?.value || "",
    payment: nodes.futurePaymentFilter?.value || ""
  };
  renderFutureList();
}

function handleFutureTypeToggleClick(event) {
  const button = event.target.closest("[data-future-type]");
  if (!button) return;
  currentFutureFilters.type = button.dataset.futureType || "all";
  if (currentFutureFilters.type === "all") {
    currentFutureFilters.category = "";
    currentFutureFilters.payment = "";
  }
  renderFutureFilterOptions();
  renderFutureList();
}

function clearFutureFilters() {
  currentFutureFilters = {
    startDate: "",
    endDate: "",
    type: "all",
    category: "",
    payment: ""
  };
  renderFutureFilterOptions();
  renderFutureList();
}

function syncFutureFilterInputs() {
  if (nodes.futureStartDate) nodes.futureStartDate.value = currentFutureFilters.startDate;
  if (nodes.futureEndDate) nodes.futureEndDate.value = currentFutureFilters.endDate;
  nodes.futureTypeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.futureType === currentFutureFilters.type);
  });
  const showDetailedFilters = currentFutureFilters.type !== "all";
  nodes.futureCategoryGroup?.classList.toggle("hidden", !showDetailedFilters);
  nodes.futurePaymentGroup?.classList.toggle("hidden", !showDetailedFilters);
  if (nodes.futureCategoryFilter) nodes.futureCategoryFilter.value = currentFutureFilters.category;
  if (nodes.futurePaymentFilter) nodes.futurePaymentFilter.value = currentFutureFilters.payment;
}

function deriveFutureCategoryOptions(type) {
  const filteredType = type === "all" ? null : type;
  return uniqueCaseInsensitive(
    currentState.transactions
      .filter((transaction) => !filteredType || transaction.type === filteredType)
      .map((transaction) => transaction.category)
  );
}

function deriveFuturePaymentOptions(type) {
  const filteredType = type === "all" ? null : type;
  return uniqueCaseInsensitive(
    [
      ...currentState.catalog.paymentMethods,
      ...currentState.transactions
        .filter((transaction) => !filteredType || transaction.type === filteredType)
        .map((transaction) => transaction.paymentMethod)
        .filter(Boolean)
    ]
  );
}

function renderFutureFilterOptions() {
  if (!nodes.futureCategoryFilter || !nodes.futurePaymentFilter) return;

  const categoryOptions = deriveFutureCategoryOptions(currentFutureFilters.type);
  const paymentOptions = deriveFuturePaymentOptions(currentFutureFilters.type);
  const currentCategory = currentFutureFilters.category;
  const currentPayment = currentFutureFilters.payment;

  nodes.futureCategoryFilter.innerHTML = [`<option value="">Todas</option>`, ...categoryOptions.map((option) =>
    `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`
  )].join("");

  nodes.futurePaymentFilter.innerHTML = [`<option value="">Todos</option>`, ...paymentOptions.map((option) =>
    `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`
  )].join("");

  if (categoryOptions.includes(currentCategory)) {
    nodes.futureCategoryFilter.value = currentCategory;
  } else {
    currentFutureFilters.category = "";
    nodes.futureCategoryFilter.value = "";
  }

  if (paymentOptions.includes(currentPayment)) {
    nodes.futurePaymentFilter.value = currentPayment;
  } else {
    currentFutureFilters.payment = "";
    nodes.futurePaymentFilter.value = "";
  }

  syncFutureFilterInputs();
}

function getFutureTransactions() {
  const todayEnd = toEndOfDayMillis(todayDateInputValue());
  return currentState.transactions.filter((transaction) => {
    const futureDateMillis = resolveFutureDateMillis(transaction);
    if (futureDateMillis <= todayEnd) return false;
    if (currentFutureFilters.type !== "all" && transaction.type !== currentFutureFilters.type) return false;
    if (currentFutureFilters.category && transaction.category !== currentFutureFilters.category) return false;
    if (currentFutureFilters.payment && transaction.paymentMethod !== currentFutureFilters.payment) return false;
    if (currentFutureFilters.startDate) {
      const startMillis = toStartOfDayMillis(currentFutureFilters.startDate);
      if (futureDateMillis < startMillis) return false;
    }
    if (currentFutureFilters.endDate) {
      const endMillis = toEndOfDayMillis(currentFutureFilters.endDate);
      if (futureDateMillis > endMillis) return false;
    }
    return true;
  }).sort(compareTransactionsNewestFirst);
}

function renderFutureList() {
  if (!nodes.futureLaunchesList) return;

  const filtered = getFutureTransactions();
  const total = filtered.reduce(
    (accumulator, transaction) => accumulator + (transaction.type === "income" ? transaction.amount : -transaction.amount),
    0
  );

  if (nodes.futureFilteredTotalValue) {
    nodes.futureFilteredTotalValue.textContent = currency.format(total);
  }

  if (nodes.completeSelectedFutureButton) {
    nodes.completeSelectedFutureButton.textContent = `Concluir selecionados (${selectedFutureIds.size})`;
    nodes.completeSelectedFutureButton.disabled = selectedFutureIds.size === 0;
  }
  if (nodes.clearFutureSelectionButton) {
    nodes.clearFutureSelectionButton.disabled = selectedFutureIds.size === 0;
  }

  if (filtered.length === 0) {
    nodes.futureLaunchesList.innerHTML = emptyStateHtml("Nenhum lançamento futuro para o filtro selecionado.");
    return;
  }

  const grouped = filtered.reduce((accumulator, transaction) => {
    const key = transaction.paymentMethod || "Sem pagamento";
    accumulator[key] ||= [];
    accumulator[key].push(transaction);
    return accumulator;
  }, {});

  nodes.futureLaunchesList.innerHTML = Object.entries(grouped)
    .map(([paymentMethod, items]) => {
      const sortedItems = [...items].sort(compareTransactionsNewestFirst);
      return `
        <section class="future-group">
          <article class="future-group-card">
            <strong>${escapeHtml(paymentMethod)}</strong>
            <p class="muted">${escapeHtml(`${sortedItems.length} lançamento(s) · mais recente primeiro`)}</p>
          </article>
          ${sortedItems.map((transaction) => renderFutureTransactionItem(transaction)).join("")}
        </section>
      `;
    })
    .join("");
}

function renderFutureTransactionItem(transaction) {
  const isSelected = selectedFutureIds.has(transaction.id);
  const dueDateMillis = resolveFutureDateMillis(transaction);
  const title = String(transaction.title || "").trim() || String(transaction.category || "").trim() || "Sem categoria";
  const notes = String(transaction.notes || "").trim();
  const paymentLine = [
    transaction.paymentMethod || "Sem pagamento",
    transaction.installments > 1 ? `Parcela ${transaction.installmentNumber}/${transaction.installments}` : null
  ].filter(Boolean).join(" • ");
  const launchLine = `Lanç: ${formatDateShort(transaction.dateMillis)}`;
  const dueLine = `Vencimento: ${formatDateShort(dueDateMillis)}`;

  return `
    <article class="future-transaction-card ${isSelected ? "selected" : ""}">
      <div class="future-transaction-row">
        <label class="future-checkbox-row">
          <input data-future-check="${transaction.id}" type="checkbox" ${isSelected ? "checked" : ""} />
          <strong>${escapeHtml(title)}</strong>
        </label>
        <strong class="transaction-amount ${transaction.type}">${transaction.type === "income" ? "+" : "-"}${currency.format(transaction.amount)}</strong>
      </div>
      <p class="transaction-meta">${escapeHtml(paymentLine)}</p>
      <p class="transaction-meta">${escapeHtml(`${launchLine} • ${dueLine}`)}</p>
      ${notes ? `<p class="muted">${escapeHtml(notes)}</p>` : ""}
      <div class="future-item-actions">
        <button class="ghost-button dark-ghost compact-icon-button action-edit-button" data-future-action="edit" data-id="${transaction.id}" type="button">✎</button>
        <button class="ghost-button dark-ghost compact-icon-button" data-future-action="delete" data-id="${transaction.id}" type="button">🗑</button>
        <button class="ghost-button dark-ghost compact-icon-button" data-future-action="complete" data-id="${transaction.id}" type="button">✓</button>
      </div>
    </article>
  `;
}

function handleSelectAllFuture() {
  selectedFutureIds = new Set(getFutureTransactions().map((transaction) => transaction.id));
  renderFutureList();
}

function handleClearFutureSelection() {
  selectedFutureIds = new Set();
  renderFutureList();
}

async function handleCompleteSelectedFuture() {
  if (selectedFutureIds.size === 0) return;
  const todayMillis = toStartOfDayMillis(todayDateInputValue());
  currentState.transactions = currentState.transactions.map((transaction) => {
    if (!selectedFutureIds.has(transaction.id)) return transaction;
    return {
      ...transaction,
      dateMillis: todayMillis,
      dateLabel: formatRelativeDate(todayMillis),
      cardPaymentDateMillis: null
    };
  });
  selectedFutureIds = new Set();
  await saveState();
  render();
  showAppToast("Lançamentos concluídos.");
}

async function handleFutureListClick(event) {
  const checkbox = event.target.closest("[data-future-check]");
  if (checkbox) {
    const id = Number(checkbox.getAttribute("data-future-check"));
    if (checkbox.checked) {
      selectedFutureIds.add(id);
    } else {
      selectedFutureIds.delete(id);
    }
    renderFutureList();
    return;
  }

  const button = event.target.closest("[data-future-action][data-id]");
  if (!button) return;
  const id = Number(button.getAttribute("data-id"));
  const action = button.getAttribute("data-future-action");
  if (!id || !action) return;

  if (action === "delete") {
    const previousTransactions = [...currentState.transactions];
    currentState.transactions = currentState.transactions.filter((transaction) => transaction.id !== id);
    selectedFutureIds.delete(id);
    const saved = await saveState();
    if (!saved) {
      currentState.transactions = previousTransactions;
      render();
      return;
    }
    render();
    showAppToast("Lançamento excluído.");
    return;
  }

  if (action === "complete") {
    if (selectedFutureIds.has(id)) {
      selectedFutureIds.delete(id);
      renderFutureList();
      showAppToast("Lançamento desmarcado.");
    } else {
      selectedFutureIds.add(id);
      renderFutureList();
      showAppToast("Lançamento marcado.");
    }
    return;
  }

  if (action === "edit") {
    const transaction = currentState.transactions.find((item) => item.id === id);
    if (!transaction) return;
    startEditingTransaction(transaction);
  }
}

function syncHistoryFilterInputs() {
  if (nodes.historyStartDate) nodes.historyStartDate.value = currentHistoryFilters.startDate;
  if (nodes.historyEndDate) nodes.historyEndDate.value = currentHistoryFilters.endDate;
  if (nodes.historyTypeFilter) nodes.historyTypeFilter.value = currentHistoryFilters.type;
  nodes.historyTypeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.historyType === currentHistoryFilters.type);
  });
}

function getHistoryFilteredTransactions() {
  const activeFilters = getCurrentHistoryUiFilters();
  return getExtratoTransactionsBase().filter((transaction) => {
    const effectiveDateMillis = resolveFutureDateMillis(transaction);
    if (activeFilters.type !== "all" && resolveTransactionType(transaction) !== activeFilters.type) {
      return false;
    }
    if (activeFilters.category && transaction.category !== activeFilters.category) {
      return false;
    }
    if (activeFilters.payment && transaction.paymentMethod !== activeFilters.payment) {
      return false;
    }
    if (activeFilters.startDate) {
      const startMillis = toStartOfDayMillis(activeFilters.startDate);
      if (effectiveDateMillis < startMillis) {
        return false;
      }
    }
    if (activeFilters.endDate) {
      const endMillis = toEndOfDayMillis(activeFilters.endDate);
      if (effectiveDateMillis > endMillis) {
        return false;
      }
    }
    return true;
  }).sort(compareExtratoTransactionsNewestFirst);
}

function getHistoryDateRangeTransactions() {
  const activeFilters = getCurrentHistoryUiFilters();
  return getExtratoTransactionsBase().filter((transaction) => {
    const effectiveDateMillis = resolveFutureDateMillis(transaction);
    if (activeFilters.startDate) {
      const startMillis = toStartOfDayMillis(activeFilters.startDate);
      if (effectiveDateMillis < startMillis) {
        return false;
      }
    }
    if (activeFilters.endDate) {
      const endMillis = toEndOfDayMillis(activeFilters.endDate);
      if (effectiveDateMillis > endMillis) {
        return false;
      }
    }
    return true;
  }).sort(compareExtratoTransactionsNewestFirst);
}

function deriveHistoryCategoryOptions(type) {
  const filteredType = type === "all" ? null : type;
  return uniqueCaseInsensitive(
    getExtratoTransactionsBase()
      .filter((transaction) => !filteredType || resolveTransactionType(transaction) === filteredType)
      .map((transaction) => transaction.category)
  );
}

function deriveHistoryPaymentOptions() {
  return uniqueCaseInsensitive(
    [...currentState.catalog.paymentMethods, ...getExtratoTransactionsBase().map((transaction) => transaction.paymentMethod).filter(Boolean)]
  );
}

function renderTransactionItem(transaction) {
  const resolvedType = resolveTransactionType(transaction);
  const sign = resolvedType === "income" ? "+" : "-";
  const transactionStatus = resolveTransactionStatus(transaction);
  const amountText = `${sign} ${currency.format(transaction.amount)}`;
  const effectiveDateMillis = resolveFutureDateMillis(transaction);
  const installmentText =
    transaction.installments > 1
      ? `Parcela ${transaction.installmentNumber}/${transaction.installments}`
      : "";
  const amountLine = transaction.originalTotalAmount ? currency.format(transaction.originalTotalAmount) : currency.format(transaction.amount);
  const dueText =
    effectiveDateMillis !== transaction.dateMillis
      ? `Venc: ${formatDateShort(effectiveDateMillis)}`
      : null;
  const details = [
    transaction.paymentMethod || null,
    installmentText || null,
    `de ${amountLine}`,
    `Lanc: ${formatDateShort(transaction.dateMillis)}`,
    dueText
  ].filter(Boolean).join(" • ");
  const title = String(transaction.title || "").trim() || String(transaction.category || "").trim() || "Sem categoria";
  const notes = String(transaction.notes || "").trim();
  const notesMarkup = notes
    ? `<div class="transaction-notes">${escapeHtml(notes)}</div>`
    : "";

  return `
    <div class="transaction-item">
      <div class="transaction-copy">
        <div class="transaction-title">${escapeHtml(title)}</div>
        <div class="transaction-meta">${escapeHtml(details)}</div>
        ${notesMarkup}
        <div class="transaction-status">Status: ${escapeHtml(transactionStatus)}</div>
      </div>
      <div class="transaction-side">
        <div class="transaction-amount ${resolvedType}">
          ${amountText}
        </div>
        <div class="transaction-item-actions">
          <button
            class="ghost-button dark-ghost compact-icon-button action-edit-button"
            data-transaction-action="edit"
            data-id="${transaction.id}"
            type="button"
            aria-label="Editar lançamento"
            title="Editar lançamento"
          >✏</button>
          <button
            class="ghost-button dark-ghost compact-icon-button action-delete-button"
            data-transaction-action="delete"
            data-id="${transaction.id}"
            type="button"
            aria-label="Excluir lançamento"
            title="Excluir lançamento"
          >🗑</button>
        </div>
      </div>
    </div>
  `;
}

async function handleTransactionListClick(event) {
  const button = event.target.closest("[data-transaction-action][data-id]");
  if (!button) return;

  const id = Number(button.getAttribute("data-id"));
  const action = button.getAttribute("data-transaction-action");
  if (!id || !action) return;

  if (action === "delete") {
    const confirmed = window.confirm("Deseja excluir este lançamento?");
    if (!confirmed) return;
    const previousTransactions = [...currentState.transactions];
    currentState.transactions = currentState.transactions.filter((transaction) => transaction.id !== id);
    selectedFutureIds.delete(id);
    const saved = await saveState();
    if (!saved) {
      currentState.transactions = previousTransactions;
      render();
      return;
    }
    render();
    showAppToast("Lançamento excluído.");
    return;
  }

  if (action === "edit") {
    const transaction = currentState.transactions.find((item) => item.id === id);
    if (!transaction) return;
    startEditingTransaction(transaction);
  }
}

async function handleSaveMultiLaunch() {
  const validRows = multiLaunchRows
    .map((row) => ({
      ...row,
      amountNumber: Number.parseFloat(String(row.amount || "").replace(",", ".")),
      quantityNumber: Math.max(1, Number.parseInt(String(row.quantity || "1"), 10) || 1),
      categoryValue: String(row.category || "").trim()
    }))
    .filter((row) => row.categoryValue || row.amountNumber);

  if (!validRows.length) {
    window.alert("Informe ao menos um lançamento.");
    return;
  }

  const invalidRow = validRows.find((row) => !Number.isFinite(row.amountNumber) || row.amountNumber <= 0 || !row.categoryValue);
  if (invalidRow) {
    window.alert("Revise os campos de valor, quantidade e categoria dos múltiplos lançamentos.");
    return;
  }

  const paymentMethod = String(nodes.multiLaunchPaymentMethodInput?.value || preferredPaymentMethod() || "Dinheiro").trim();
  const dateValue = String(nodes.multiLaunchDateInput?.value || todayDateInputValue());

  const dateMillis = toStartOfDayMillis(dateValue);
  const createdTransactions = [];

  for (const row of validRows) {
    for (let index = 0; index < row.quantityNumber; index += 1) {
      createdTransactions.push({
        id: generateId(),
        title: row.categoryValue,
        category: row.categoryValue,
        type: multiLaunchType,
        amount: row.amountNumber,
        dateMillis,
        dateLabel: formatRelativeDate(dateMillis),
        paymentMethod,
        installments: 1,
        installmentNumber: 1,
        originalTotalAmount: row.amountNumber,
        cardPaymentDateMillis: resolveCardPaymentDateMillis(paymentMethod, dateMillis),
        notes: ""
      });
    }
    updateCatalogForTransaction(row.categoryValue, multiLaunchType, paymentMethod);
  }

  const previousTransactions = [...currentState.transactions];
  currentState.transactions = [...createdTransactions, ...currentState.transactions]
    .sort((left, right) => right.dateMillis - left.dateMillis);
  const saved = await saveState();
  if (!saved) {
    currentState.transactions = previousTransactions;
    render();
    return;
  }
  multiLaunchRows = [createMultiLaunchRow()];
  multiLaunchFinalizeOpen = false;
  if (nodes.multiLaunchPaymentMethodInput) nodes.multiLaunchPaymentMethodInput.value = preferredPaymentMethod();
  if (nodes.multiLaunchDateInput) nodes.multiLaunchDateInput.value = todayDateInputValue();
  render();
  promptPrintTransactions(createdTransactions, "Lançamentos salvos. Deseja imprimir?");
  navigateToScreen("EXTRATO");
}

function splitAmountEvenly(totalAmount, quantity) {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / safeQuantity);
  const remainder = totalCents % safeQuantity;
  return Array.from({ length: safeQuantity }, (_, index) => {
    const cents = baseCents + (index < remainder ? 1 : 0);
    return cents / 100;
  });
}

function getMultiLaunchCategoryDefaultAmount(category) {
  const cleanCategory = String(category || "").trim();
  if (!cleanCategory) return null;
  const map = multiLaunchType === "income"
    ? currentState.catalog.multiLaunchIncomeCategoryAmounts
    : currentState.catalog.multiLaunchExpenseCategoryAmounts;
  const value = map?.[cleanCategory];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function formatMultiLaunchAmount(value) {
  return Number(value || 0).toFixed(2);
}

function clampDayOfMonth(date, day) {
  const safeDay = Math.max(1, Math.min(Number(day) || 1, getDaysInMonth(date.getFullYear(), date.getMonth())));
  return new Date(date.getFullYear(), date.getMonth(), safeDay);
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function computeCardPaymentDateMillis(dateMillis, closingDay, paymentDay) {
  const launchDate = new Date(dateMillis);
  const closeDate = clampDayOfMonth(launchDate, closingDay);
  const currentMonthPaymentDate = clampDayOfMonth(launchDate, paymentDay);

  let dueDate;
  if (launchDate.getTime() <= closeDate.getTime()) {
    dueDate = currentMonthPaymentDate.getTime() >= launchDate.getTime()
      ? currentMonthPaymentDate
      : clampDayOfMonth(new Date(launchDate.getFullYear(), launchDate.getMonth() + 1, 1), paymentDay);
  } else {
    dueDate = clampDayOfMonth(new Date(launchDate.getFullYear(), launchDate.getMonth() + 1, 1), paymentDay);
  }

  return toStartOfDayMillis(formatDateInputValue(dueDate.getTime()));
}

function resolveCardPaymentDateMillis(paymentMethod, dateMillis) {
  const config = currentState.catalog.paymentMethodConfigs?.[String(paymentMethod || "").trim()];
  if (!config) return null;
  return computeCardPaymentDateMillis(dateMillis, config.closingDay || 25, config.paymentDay || 5);
}

function exportTransactionsCsv() {
  const snapshot = buildExportSnapshot();
  const rows = [
    ["secao", "campo_1", "campo_2", "campo_3", "campo_4", "campo_5", "campo_6", "campo_7", "campo_8", "campo_9", "campo_10"],
    ["resumo", "conta", snapshot.accountName, "acesso", snapshot.accessLabel, "tema", snapshot.themeMode, "telas", snapshot.screenOrder.join(" | "), "", ""],
    ...snapshot.accounts.map((account) => [
      "conta",
      account.name,
      account.phone || "",
      account.email || "",
      account.isActive ? "Em uso" : "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]),
    ...currentState.transactions.map((transaction) => [
      "lancamento",
      transaction.title,
      transaction.category,
      transaction.type === "income" ? "Receita" : "Despesa",
      transaction.paymentMethod,
      new Date(transaction.dateMillis).toISOString().slice(0, 10),
      resolveFutureDateMillis(transaction) ? formatDateInputValue(resolveFutureDateMillis(transaction)) : "",
      String(transaction.installments || 1),
      String(transaction.amount).replace(".", ","),
      resolveTransactionStatus(transaction),
      transaction.notes || ""
    ]),
    ...currentState.budgets.map((budget) => [
      "orcamento",
      budget.name,
      String(budget.limit).replace(".", ","),
      budget.color || "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]),
    ...currentState.goals.map((goal) => [
      "meta",
      goal.name,
      String(goal.saved).replace(".", ","),
      String(goal.target).replace(".", ","),
      goal.note || "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]),
    ...currentState.catalog.expenseCategories.map((item) => ["categoria_despesa", item, "", "", "", "", "", "", "", "", ""]),
    ...currentState.catalog.incomeCategories.map((item) => ["categoria_receita", item, "", "", "", "", "", "", "", "", ""]),
    ...currentState.catalog.paymentMethods.map((item) => {
      const config = currentState.catalog.paymentMethodConfigs?.[item];
      return [
        "pagamento",
        item,
        config?.closingDay ? String(config.closingDay) : "",
        config?.paymentDay ? String(config.paymentDay) : "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ];
    })
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  triggerDownload("\uFEFF" + csv, "text/csv;charset=utf-8;", buildExportFileName("csv"));
}

function exportTransactionsExcel() {
  const snapshot = buildExportSnapshot();
  const transactionRows = currentState.transactions
    .map((transaction) => `
      <tr>
        <td>${escapeHtml(transaction.title)}</td>
        <td>${escapeHtml(transaction.category)}</td>
        <td>${escapeHtml(transaction.type === "income" ? "Receita" : "Despesa")}</td>
        <td>${escapeHtml(transaction.paymentMethod)}</td>
        <td>${escapeHtml(new Date(transaction.dateMillis).toLocaleDateString("pt-BR"))}</td>
        <td>${escapeHtml(formatDateShort(resolveFutureDateMillis(transaction)))}</td>
        <td>${escapeHtml(String(transaction.installments || 1))}</td>
        <td>${escapeHtml(currency.format(transaction.amount))}</td>
        <td>${escapeHtml(resolveTransactionStatus(transaction))}</td>
        <td>${escapeHtml(transaction.notes || "")}</td>
      </tr>
    `)
    .join("");

  const accountRows = snapshot.accounts
    .map((account) => `
      <tr>
        <td>${escapeHtml(account.name)}</td>
        <td>${escapeHtml(account.phone || "")}</td>
        <td>${escapeHtml(account.email || "")}</td>
        <td>${escapeHtml(account.isActive ? "Em uso" : "")}</td>
      </tr>
    `)
    .join("");

  const budgetRows = currentState.budgets
    .map((budget) => `
      <tr>
        <td>${escapeHtml(budget.name)}</td>
        <td>${escapeHtml(currency.format(budget.limit))}</td>
        <td>${escapeHtml(budget.color || "")}</td>
      </tr>
    `)
    .join("");

  const goalRows = currentState.goals
    .map((goal) => `
      <tr>
        <td>${escapeHtml(goal.name)}</td>
        <td>${escapeHtml(currency.format(goal.saved))}</td>
        <td>${escapeHtml(currency.format(goal.target))}</td>
        <td>${escapeHtml(goal.note || "")}</td>
      </tr>
    `)
    .join("");

  const expenseCategoryRows = currentState.catalog.expenseCategories
    .map((item) => `<tr><td>${escapeHtml(item)}</td></tr>`)
    .join("");
  const incomeCategoryRows = currentState.catalog.incomeCategories
    .map((item) => `<tr><td>${escapeHtml(item)}</td></tr>`)
    .join("");
  const paymentMethodRows = currentState.catalog.paymentMethods
    .map((item) => {
      const config = currentState.catalog.paymentMethodConfigs?.[item];
      return `
        <tr>
          <td>${escapeHtml(item)}</td>
          <td>${escapeHtml(config?.closingDay ? String(config.closingDay) : "")}</td>
          <td>${escapeHtml(config?.paymentDay ? String(config.paymentDay) : "")}</td>
        </tr>
      `;
    })
    .join("");

  const html = `
    <html>
      <head><meta charset="UTF-8" /></head>
      <body>
        <table border="1">
          <tr><th colspan="2">Resumo do app</th></tr>
          <tr><td>Conta em uso</td><td>${escapeHtml(snapshot.accountName)}</td></tr>
          <tr><td>Acesso</td><td>${escapeHtml(snapshot.accessLabel)}</td></tr>
          <tr><td>Tema</td><td>${escapeHtml(snapshot.themeMode)}</td></tr>
          <tr><td>Telas</td><td>${escapeHtml(snapshot.screenOrder.join(" | "))}</td></tr>
        </table>
        <br />
        <table border="1">
          <tr>
            <th>Conta</th>
            <th>Telefone</th>
            <th>Email</th>
            <th>Status</th>
          </tr>
          ${accountRows}
        </table>
        <br />
        <table border="1">
          <tr>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Movimento</th>
            <th>Pagamento</th>
            <th>Lançamento</th>
            <th>Vencimento</th>
            <th>Parcelas</th>
            <th>Valor</th>
            <th>Status</th>
            <th>Observações</th>
          </tr>
          ${transactionRows}
        </table>
        <br />
        <table border="1">
          <tr><th>Orçamento</th><th>Limite</th><th>Cor</th></tr>
          ${budgetRows}
        </table>
        <br />
        <table border="1">
          <tr><th>Meta</th><th>Salvo</th><th>Alvo</th><th>Observação</th></tr>
          ${goalRows}
        </table>
        <br />
        <table border="1">
          <tr><th>Categorias de despesa</th></tr>
          ${expenseCategoryRows}
        </table>
        <br />
        <table border="1">
          <tr><th>Categorias de receita</th></tr>
          ${incomeCategoryRows}
        </table>
        <br />
        <table border="1">
          <tr><th>Pagamento</th><th>Fechamento</th><th>Pagamento</th></tr>
          ${paymentMethodRows}
        </table>
      </body>
    </html>
  `;
  triggerDownload("\uFEFF" + html, "application/vnd.ms-excel;charset=utf-8;", buildExportFileName("xls"));
}

function buildExportSnapshot() {
  const menuState = getFinanceiroMenuState();
  return {
    accountName: menuState.accountName || "Sem conta",
    accessLabel: menuState.accessLabel || "Conta local",
    themeMode: currentState.ui.themeMode === "dark" ? "Dark" : "Claro",
    screenOrder: currentState.ui.screenOrder.map((screen) => screenLabel(screen)),
    accounts: Array.isArray(menuState.accounts) ? menuState.accounts : []
  };
}

function buildExportFileName(extension) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `financeiro-${stamp}.${extension}`;
}

function triggerDownload(content, mimeType, fileName) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function resolveFutureDateMillis(transaction) {
  const parsedCardDate = Number(transaction.cardPaymentDateMillis);
  return Number.isFinite(parsedCardDate) && parsedCardDate > 0
    ? parsedCardDate
    : Number(transaction.dateMillis || Date.now());
}

function compareTransactionsNewestFirst(left, right) {
  const leftEffectiveDate = resolveFutureDateMillis(left);
  const rightEffectiveDate = resolveFutureDateMillis(right);
  if (rightEffectiveDate !== leftEffectiveDate) {
    return rightEffectiveDate - leftEffectiveDate;
  }

  const leftAmount = Number(left?.amount || 0);
  const rightAmount = Number(right?.amount || 0);
  if (rightAmount !== leftAmount) {
    return rightAmount - leftAmount;
  }

  const leftCreatedDate = Number(left?.dateMillis || 0);
  const rightCreatedDate = Number(right?.dateMillis || 0);
  if (rightCreatedDate !== leftCreatedDate) {
    return rightCreatedDate - leftCreatedDate;
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
}

function compareExtratoTransactionsNewestFirst(left, right) {
  const leftLaunchDate = Number(left?.dateMillis || 0);
  const rightLaunchDate = Number(right?.dateMillis || 0);
  if (rightLaunchDate !== leftLaunchDate) {
    return rightLaunchDate - leftLaunchDate;
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
}

function compareLaunchDateNewestFirst(left, right) {
  const leftLaunchDate = Number(left?.dateMillis || 0);
  const rightLaunchDate = Number(right?.dateMillis || 0);
  if (rightLaunchDate !== leftLaunchDate) {
    return rightLaunchDate - leftLaunchDate;
  }

  return Number(right?.id || 0) - Number(left?.id || 0);
}

function resolveTransactionStatus(transaction) {
  const todayEnd = toEndOfDayMillis(todayDateInputValue());
  return resolveFutureDateMillis(transaction) <= todayEnd ? "Concluido" : "Pendente";
}

function clearAppToastState() {
  if (appToastTimer) {
    window.clearTimeout(appToastTimer);
    appToastTimer = null;
  }

  if (typeof appToastActionCleanup === "function") {
    appToastActionCleanup();
    appToastActionCleanup = null;
  }
}

function hideAppToast() {
  if (!nodes.appToast) return;

  clearAppToastState();
  nodes.appToast.classList.add("hidden");
  nodes.appToast.innerHTML = "";
}

function showAppToast(message) {
  if (!nodes.appToast) return;

  clearAppToastState();
  nodes.appToast.textContent = message;
  nodes.appToast.classList.remove("hidden");

  appToastTimer = window.setTimeout(() => {
    hideAppToast();
  }, 2200);
}

function showActionToast({ message, primaryLabel, secondaryLabel, onPrimary, onSecondary }) {
  if (!nodes.appToast) return;

  clearAppToastState();
  nodes.appToast.innerHTML = `
    <div class="app-toast__message">${escapeHtml(message)}</div>
    <div class="app-toast__actions">
      <button type="button" class="app-toast__button app-toast__button--secondary">${escapeHtml(secondaryLabel)}</button>
      <button type="button" class="app-toast__button app-toast__button--primary">${escapeHtml(primaryLabel)}</button>
    </div>
  `;
  nodes.appToast.classList.remove("hidden");

  const secondaryButton = nodes.appToast.querySelector(".app-toast__button--secondary");
  const primaryButton = nodes.appToast.querySelector(".app-toast__button--primary");

  const handleSecondary = () => {
    hideAppToast();
    onSecondary?.();
  };

  const handlePrimary = () => {
    hideAppToast();
    onPrimary?.();
  };

  secondaryButton?.addEventListener("click", handleSecondary);
  primaryButton?.addEventListener("click", handlePrimary);

  appToastActionCleanup = () => {
    secondaryButton?.removeEventListener("click", handleSecondary);
    primaryButton?.removeEventListener("click", handlePrimary);
  };
}

function promptPrintTransactions(transactions, message) {
  const printableTransactions = Array.isArray(transactions) ? transactions.filter(Boolean) : [];
  if (!printableTransactions.length) {
    showAppToast(message);
    return;
  }

  markTransactionsAsPrinted(printableTransactions);
  showActionToast({
    message,
    primaryLabel: "Imprimir",
    secondaryLabel: "Agora não",
    onPrimary: () => printTransactionsReceipt(printableTransactions),
    onSecondary: () => {}
  });
}

async function initQZTray() {
  if (typeof qz === "undefined") return;
  try {
    qz.security.setCertificatePromise((resolve) => resolve(""));
    qz.security.setSignaturePromise(() => (resolve) => resolve(""));
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 1, delay: 0 });
    }
    qzTrayActive = true;
  } catch {
    qzTrayActive = false;
  }
}

async function printViaQZTray(transactions) {
  const printableTransactions = Array.isArray(transactions) ? transactions.filter(Boolean) : [];
  if (!printableTransactions.length) return;

  try {
    const printers = await qz.printers.find();
    const printerList = Array.isArray(printers) ? printers : [printers];
    const bemaPrinter =
      printerList.find((p) =>
        String(p).toLowerCase().includes("bematech") ||
        String(p).toLowerCase().includes("mp-4200") ||
        String(p).toLowerCase().includes("mp4200")
      ) || printerList[0];

    if (!bemaPrinter) {
      showAppToast("Impressora não encontrada. Verifique o QZ Tray.");
      printTransactionsReceiptFallback(printableTransactions);
      return;
    }

    const account = resolveActiveAccountRecord(
      Array.isArray(currentState?.ui?.accounts) ? currentState.ui.accounts : [],
      currentState?.ui?.activeAccountId ?? null
    );
    const lines = buildReceiptLines(printableTransactions, account?.name || "Sem conta", new Date());
    const ESC = "\x1b";
    const GS = "\x1d";

    const rawData = [
      { type: "raw", format: "plain", data: ESC + "@" },
      { type: "raw", format: "plain", data: ESC + "a\x01" },
      ...lines.map((line) => ({ type: "raw", format: "plain", data: line + "\n" })),
      { type: "raw", format: "plain", data: "\n\n\n" },
      { type: "raw", format: "plain", data: GS + "V\x41\x03" }
    ];

    const config = qz.configs.create(bemaPrinter);
    await qz.print(config, rawData);
    showAppToast("Impresso com sucesso!");
  } catch (error) {
    console.error("Erro ao imprimir via QZ Tray:", error);
    qzTrayActive = false;
    printTransactionsReceiptFallback(printableTransactions);
  }
}

function printTransactionsReceipt(transactions) {
  if (qzTrayActive) {
    printViaQZTray(transactions);
    return;
  }
  printTransactionsReceiptFallback(transactions);
}

function printTransactionsReceiptFallback(transactions) {
  const printableTransactions = Array.isArray(transactions) ? transactions.filter(Boolean) : [];
  if (!printableTransactions.length) return;

  const receiptHtml = buildReceiptHtml(printableTransactions);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  document.body.appendChild(frame);

  const frameWindow = frame.contentWindow;
  if (!frameWindow) {
    frame.remove();
    showAppToast("Não foi possível abrir a impressão.");
    return;
  }

  frameWindow.document.open();
  frameWindow.document.write(receiptHtml);
  frameWindow.document.close();

  const cleanup = () => {
    window.setTimeout(() => {
      frame.remove();
    }, 800);
  };

  frameWindow.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (error) {
      cleanup();
      console.error("Falha ao imprimir:", error);
      showAppToast("Não foi possível enviar para impressão.");
    }
  }, 250);
}

function buildReceiptHtml(transactions) {
  const account = resolveActiveAccountRecord(
    Array.isArray(currentState?.ui?.accounts) ? currentState.ui.accounts : [],
    currentState?.ui?.activeAccountId ?? null
  );
  const printedAt = new Date();
  const receiptLines = buildReceiptLines(transactions, account?.name || "Sem conta", printedAt);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Impressão Financeiro</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      html, body { margin: 0; padding: 0; background: #fff; color: #000; }
      body { font-family: "Courier New", Courier, monospace; }
      .receipt { width: 72mm; margin: 0 auto; padding: 0; white-space: pre-wrap; font-size: 11px; line-height: 1.35; }
    </style>
  </head>
  <body>
    <pre class="receipt">${escapeHtml(receiptLines.join("\n"))}</pre>
    <script>
      window.addEventListener("load", () => {
        window.__receiptReady = true;
      });
    </script>
  </body>
</html>`;
}

function buildReceiptLines(transactions, accountName, printedAt) {
  const width = 40;
  const lines = [
    centerReceiptText("FINANCEIRO", width),
    centerReceiptText("COMPROVANTE", width),
    "-".repeat(width),
    ...wrapReceiptText(`Conta: ${accountName}`, width),
    ...wrapReceiptText(`Impresso: ${formatPrintDateTime(printedAt)}`, width),
    "-".repeat(width)
  ];

  transactions.forEach((transaction, index) => {
    const title = String(transaction.title || transaction.category || "Sem título").trim();
    const typeLabel = transaction.type === "income" ? "Receita" : "Despesa";
    const launchDate = formatDateInputValue(transaction.dateMillis || Date.now());
    const dueDate =
      Number.isFinite(Number(transaction.cardPaymentDateMillis)) && Number(transaction.cardPaymentDateMillis) > 0
        ? formatDateInputValue(Number(transaction.cardPaymentDateMillis))
        : "";

    lines.push(...wrapReceiptText(`${index + 1}. ${title}`, width));
    lines.push(...wrapReceiptText(`Categoria: ${transaction.category || "Sem categoria"}`, width));
    lines.push(...wrapReceiptText(`Tipo: ${typeLabel}`, width));
    lines.push(...wrapReceiptText(`Pagamento: ${transaction.paymentMethod || "Dinheiro"}`, width));
    lines.push(...wrapReceiptText(`Lançamento: ${launchDate}`, width));
    if (dueDate) {
      lines.push(...wrapReceiptText(`Vencimento: ${dueDate}`, width));
    }
    lines.push(...wrapReceiptText(`Valor: ${currency.format(Number(transaction.amount || 0))}`, width));
    lines.push("-".repeat(width));
  });

  const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  lines.push(...wrapReceiptText(`Qtd. lançamentos: ${transactions.length}`, width));
  lines.push(...wrapReceiptText(`Total: ${currency.format(total)}`, width));
  lines.push("-".repeat(width));
  lines.push(centerReceiptText("Desejamos boas vendas", width));

  return lines;
}

function centerReceiptText(text, width = 40) {
  const value = String(text || "").trim();
  if (value.length >= width) return value;
  const padding = Math.floor((width - value.length) / 2);
  return `${" ".repeat(padding)}${value}`;
}

function wrapReceiptText(text, width = 40) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return [""];

  const words = normalized.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > width && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function formatPrintDateTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

async function saveState() {
  try {
    await currentPersistence.saveState(stripRuntimeFields(currentState));
    if (currentPersistence?.loadState) {
      currentState = sanitizeState(await currentPersistence.loadState());
    }
    return true;
  } catch (error) {
    console.error("Falha ao salvar dados do app:", error);
    const message = String(error?.message || "").trim() || "Falha ao salvar no banco de dados.";
    showAppToast(message);
    return false;
  }
}

function createLocalPersistence(mode, user) {
  const storageKey = getStorageKey(mode, user);

  return {
    async loadState() {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return structuredClone(defaults);
        return JSON.parse(raw);
      } catch {
        return structuredClone(defaults);
      }
    },
    async saveState(state) {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  };
}

function getStorageKey(mode, user) {
  if (mode === "google" && user?.uid) {
    return `financeiro-pwa-state-google-${user.uid}`;
  }

  return "financeiro-pwa-state-demo";
}

function sanitizeState(state) {
  return {
    monthLabel: typeof state?.monthLabel === "string" ? state.monthLabel : defaults.monthLabel,
    transactions: Array.isArray(state?.transactions)
      ? state.transactions.map((item) => sanitizeTransaction(item)).sort((a, b) => b.dateMillis - a.dateMillis)
      : structuredClone(defaults.transactions),
    goals: Array.isArray(state?.goals)
      ? state.goals.map((goal) => sanitizeGoal(goal))
      : structuredClone(defaults.goals),
    budgets: Array.isArray(state?.budgets)
      ? state.budgets.map((budget, index) => sanitizeBudget(budget, index)).filter(Boolean)
      : structuredClone(defaults.budgets),
    catalog: sanitizeCatalog(state?.catalog),
    ui: sanitizeUi(state?.ui)
  };
}

function stripRuntimeFields(state) {
  const sanitized = sanitizeState(state);
  return {
    monthLabel: sanitized.monthLabel,
    transactions: sanitized.transactions,
    goals: sanitized.goals,
    budgets: sanitized.budgets,
    catalog: sanitized.catalog,
    ui: sanitized.ui
  };
}

function updateUserBadge() {
  if (!currentIdentity) {
    nodes.userBadge.classList.add("hidden");
    return;
  }

  const activeAccount = resolveActiveAccountRecord(
    Array.isArray(currentState?.ui?.accounts) ? currentState.ui.accounts : [],
    currentState?.ui?.activeAccountId ?? null
  );

  if (currentIdentity.mode === "google" && activeAccount?.name) {
    nodes.userBadge.textContent = `Conta: ${activeAccount.name}`;
    nodes.userBadge.classList.remove("hidden");
    return;
  }

  nodes.userBadge.textContent = "Conta local";
  nodes.userBadge.classList.remove("hidden");
}

function getPrintTrackingStorageKey() {
  const accountId = Number(currentState?.ui?.activeAccountId || 0);
  const userId = currentIdentity?.user?.uid;
  if (userId && accountId) {
    return `financeiro-pwa-printed-transactions-${userId}-${accountId}`;
  }
  return null;
}

function initializePrintTracking() {
  const storageKey = getPrintTrackingStorageKey();
  const currentIds = new Set(
    (Array.isArray(currentState?.transactions) ? currentState.transactions : [])
      .map((transaction) => Number(transaction.id))
      .filter((id) => Number.isFinite(id))
  );

  if (!storageKey) {
    knownPrintedTransactionIds = currentIds;
    return;
  }

  try {
    const raw = localStorage.getItem(storageKey);
    const storedIds = raw ? JSON.parse(raw) : [];
    knownPrintedTransactionIds = new Set(
      [...storedIds, ...currentIds]
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    );
    localStorage.setItem(storageKey, JSON.stringify([...knownPrintedTransactionIds]));
  } catch {
    knownPrintedTransactionIds = currentIds;
  }
}

function markTransactionsAsPrinted(transactions) {
  const ids = (Array.isArray(transactions) ? transactions : [])
    .map((transaction) => Number(transaction?.id))
    .filter((id) => Number.isFinite(id));
  if (!ids.length) return;

  ids.forEach((id) => knownPrintedTransactionIds.add(id));

  const storageKey = getPrintTrackingStorageKey();
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify([...knownPrintedTransactionIds]));
  } catch {}
}

function startRemotePrintWatch() {
  if (remotePrintWatchTimer) {
    window.clearInterval(remotePrintWatchTimer);
    remotePrintWatchTimer = null;
  }

  if (currentIdentity?.mode !== "google" || !currentPersistence?.loadState) {
    return;
  }

  remotePrintWatchTimer = window.setInterval(async () => {
    if (editingTransactionId !== null) return;

    try {
      const remoteState = sanitizeState(await currentPersistence.loadState());
      const remoteTransactions = Array.isArray(remoteState?.transactions) ? remoteState.transactions : [];
      const unseenTransactions = remoteTransactions.filter((transaction) => {
        const id = Number(transaction?.id);
        return Number.isFinite(id) && !knownPrintedTransactionIds.has(id);
      });

      currentState = remoteState;
      applyTheme();
      render();

      if (unseenTransactions.length > 0) {
        markTransactionsAsPrinted(unseenTransactions);
        showActionToast({
          message:
            unseenTransactions.length === 1
              ? "Novo lançamento recebido. Deseja imprimir?"
              : `${unseenTransactions.length} novos lançamentos recebidos. Deseja imprimir?`,
          primaryLabel: "Imprimir",
          secondaryLabel: "Agora não",
          onPrimary: () => printTransactionsReceipt(unseenTransactions),
          onSecondary: () => {}
        });
      }
    } catch (error) {
      console.warn("Falha ao verificar novos lançamentos para impressão:", error);
    }
  }, 7000);
}

function applyTheme() {
  const themeMode = currentState?.ui?.themeMode === "dark" ? "dark" : "light";
  document.body.dataset.theme = themeMode;
  if (nodes.themeColorMeta) {
    nodes.themeColorMeta.setAttribute("content", themeMode === "dark" ? "#0f1720" : "#145c4c");
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js");
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function generateId() {
  return Number(
    `${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`
  );
}

function deriveCategoryOptions(type) {
  const typeCatalog = type === "income" ? currentState.catalog.incomeCategories : currentState.catalog.expenseCategories;
  const transactionCategories = currentState.transactions
    .filter((transaction) => transaction.type === type)
    .map((transaction) => transaction.category);
  const budgetCategories = type === "expense" ? currentState.budgets.map((budget) => budget.name) : [];
  const fallback = type === "income" ? defaults.catalog.incomeCategories : defaults.catalog.expenseCategories;

  return uniqueCaseInsensitive([...typeCatalog, ...transactionCategories, ...budgetCategories, ...fallback]);
}

function derivePaymentMethodOptions() {
  return uniqueCaseInsensitive([
    ...currentState.catalog.paymentMethods,
    ...currentState.transactions.map((transaction) => transaction.paymentMethod).filter(Boolean),
    ...defaults.catalog.paymentMethods
  ]);
}

function preferredPaymentMethod() {
  const options = derivePaymentMethodOptions();
  const cashOption = options.find((option) => option.localeCompare("Dinheiro", "pt-BR", { sensitivity: "base" }) === 0);
  return cashOption || options[0] || "Dinheiro";
}

function selectDefaultTransactionType() {
  const incomeCount = currentState.transactions.filter((transaction) => transaction.type === "income").length;
  const expenseCount = currentState.transactions.filter((transaction) => transaction.type === "expense").length;
  return incomeCount > expenseCount ? "income" : "expense";
}

function updateCatalogForTransaction(category, type, paymentMethod = "") {
  const key = type === "income" ? "incomeCategories" : "expenseCategories";
  currentState.catalog[key] = uniqueCaseInsensitive([...currentState.catalog[key], category]);
  if (paymentMethod) {
    currentState.catalog.paymentMethods = uniqueCaseInsensitive([...currentState.catalog.paymentMethods, paymentMethod]);
  }
}

async function handleAddCatalogItem(kind) {
  const input = catalogInputForKind(kind);
  if (!input) return;

  const value = String(input.value || "").trim();
  if (!value) return;

  if (kind === "payment") {
    const config = readPaymentConfigInputs();
    if (config === "invalid") {
      window.alert("Fechamento e pagamento do cartao devem estar entre 1 e 31.");
      return;
    }
    if (config) {
      currentState.catalog.paymentMethodConfigs[value] = config;
    }
  }

  currentState.catalog[catalogKeyForKind(kind)] = uniqueCaseInsensitive([
    ...currentState.catalog[catalogKeyForKind(kind)],
    value
  ]);

  input.value = "";
  clearPaymentConfigInputs();
  await saveState();
  render();
}

async function handleCatalogListClick(event) {
  const button = event.target.closest("[data-action][data-kind][data-value]");
  if (!button) return;

  const action = button.dataset.action;
  const kind = button.dataset.kind;
  const value = button.dataset.value;
  if (!action || !kind || !value) return;

  if (action === "delete") {
    if (kind !== "payment" && currentState.transactions.some((item) => item.category === value)) {
      window.alert("Categoria com lançamentos não pode ser excluída.");
      return;
    }
    if (kind === "payment" && currentState.transactions.some((item) => item.paymentMethod === value)) {
      window.alert("Forma de pagamento com lançamentos não pode ser excluída.");
      return;
    }
    currentState.catalog[catalogKeyForKind(kind)] = currentState.catalog[catalogKeyForKind(kind)].filter((item) => item !== value);
    if (kind === "payment") {
      delete currentState.catalog.paymentMethodConfigs[value];
    }
    await saveState();
    render();
    return;
  }

  if (action === "edit") {
    const renamed = window.prompt(renamePromptForKind(kind), value);
    const nextValue = String(renamed || "").trim();
    if (!nextValue || nextValue === value) return;

    if (kind === "payment") {
      const existingConfig = currentState.catalog.paymentMethodConfigs?.[value] || null;
      const editedConfig = editPaymentConfig(value, existingConfig);
      if (editedConfig === "cancel") return;
      delete currentState.catalog.paymentMethodConfigs[value];
      if (editedConfig) {
        currentState.catalog.paymentMethodConfigs[nextValue] = editedConfig;
      }
    }

    currentState.catalog[catalogKeyForKind(kind)] = uniqueCaseInsensitive(
      currentState.catalog[catalogKeyForKind(kind)].map((item) => (item === value ? nextValue : item))
    );
    if (kind !== "payment") {
      currentState.transactions = currentState.transactions.map((item) =>
        item.category === value ? { ...item, category: nextValue } : item
      );
    } else {
      currentState.transactions = currentState.transactions.map((item) =>
        item.paymentMethod === value ? { ...item, paymentMethod: nextValue } : item
      );
    }
    await saveState();
    render();
  }
}

function catalogKeyForKind(kind) {
  if (kind === "income") return "incomeCategories";
  if (kind === "payment") return "paymentMethods";
  return "expenseCategories";
}

function catalogInputForKind(kind) {
  if (kind === "income") return nodes.addIncomeCategoryInput;
  if (kind === "payment") return nodes.addPaymentMethodInput;
  return nodes.addExpenseCategoryInput;
}

function renamePromptForKind(kind) {
  if (kind === "income") return "Alterar categoria de receita";
  if (kind === "payment") return "Alterar forma de pagamento";
  return "Alterar categoria de despesa";
}

function readPaymentConfigInputs() {
  const closingRaw = String(nodes.addPaymentClosingDayInput?.value || "").trim();
  const paymentRaw = String(nodes.addPaymentDueDayInput?.value || "").trim();
  if (!closingRaw && !paymentRaw) return null;

  const closingDay = Number.parseInt(closingRaw, 10);
  const paymentDay = Number.parseInt(paymentRaw, 10);
  if (closingDay < 1 || closingDay > 31 || paymentDay < 1 || paymentDay > 31) {
    return "invalid";
  }

  return { closingDay, paymentDay };
}

function clearPaymentConfigInputs() {
  if (nodes.addPaymentClosingDayInput) nodes.addPaymentClosingDayInput.value = "";
  if (nodes.addPaymentDueDayInput) nodes.addPaymentDueDayInput.value = "";
}

function editPaymentConfig(method, existingConfig) {
  const closingAnswer = window.prompt(
    `Dia de fechamento do cartao para ${method} (1 a 31, deixe vazio se nao for cartao)`,
    existingConfig ? String(existingConfig.closingDay) : ""
  );
  if (closingAnswer === null) return "cancel";

  const paymentAnswer = window.prompt(
    `Dia de pagamento do cartao para ${method} (1 a 31, deixe vazio se nao for cartao)`,
    existingConfig ? String(existingConfig.paymentDay) : ""
  );
  if (paymentAnswer === null) return "cancel";

  const closingRaw = String(closingAnswer).trim();
  const paymentRaw = String(paymentAnswer).trim();
  if (!closingRaw && !paymentRaw) return null;

  const closingDay = Number.parseInt(closingRaw, 10);
  const paymentDay = Number.parseInt(paymentRaw, 10);
  if (closingDay < 1 || closingDay > 31 || paymentDay < 1 || paymentDay > 31) {
    window.alert("Fechamento e pagamento do cartao devem estar entre 1 e 31.");
    return "cancel";
  }

  return { closingDay, paymentDay };
}

function sanitizeTransaction(transaction) {
  const dateMillis = Number.isFinite(Number(transaction?.dateMillis)) ? Number(transaction.dateMillis) : Date.now();
  const category = String(transaction?.category || "Sem categoria").trim() || "Sem categoria";
  const title = String(transaction?.title || "").trim();
  const parsedCardPaymentDateMillis = Number(transaction?.cardPaymentDateMillis ?? transaction?.card_payment_date_millis);

  return {
    id: normalizeTransactionId(transaction?.id),
    category,
    title,
    type: normalizeTransactionType(transaction?.type),
    amount: Number.isFinite(Number(transaction?.amount)) ? Number(transaction.amount) : 0,
    dateMillis,
    dateLabel: typeof transaction?.dateLabel === "string" && transaction.dateLabel.trim()
      ? transaction.dateLabel
      : formatRelativeDate(dateMillis),
    paymentMethod: String(transaction?.paymentMethod || "").trim(),
    installments: Math.max(1, Number.parseInt(String(transaction?.installments || "1"), 10) || 1),
    installmentNumber: Math.max(1, Number.parseInt(String(transaction?.installmentNumber || transaction?.installment_number || "1"), 10) || 1),
    originalTotalAmount: Number.isFinite(Number(transaction?.originalTotalAmount))
      ? Number(transaction.originalTotalAmount)
      : Number.isFinite(Number(transaction?.original_total_amount))
        ? Number(transaction.original_total_amount)
        : Number(transaction?.amount || 0),
    cardPaymentDateMillis:
      Number.isFinite(parsedCardPaymentDateMillis) && parsedCardPaymentDateMillis > 0
        ? parsedCardPaymentDateMillis
        : null,
    futureFlagged: Boolean(transaction?.futureFlagged ?? transaction?.future_flagged),
    notes: String(transaction?.notes || "").trim()
  };
}

function normalizeTransactionType(rawType) {
  const normalized = String(rawType || "").trim().toLowerCase();

  if (["income", "receita", "receitas", "entrada", "entradas"].includes(normalized)) {
    return "income";
  }

  if (["expense", "despesa", "despesas", "saida", "saída", "saidas", "saídas"].includes(normalized)) {
    return "expense";
  }

  return "expense";
}

function resolveTransactionType(transaction) {
  const normalizedType = normalizeTransactionType(transaction?.type);
  const category = String(transaction?.category || "").trim().toLowerCase();

  if (!category) return normalizedType;

  const incomeCategories = (currentState?.catalog?.incomeCategories || []).map((item) =>
    String(item || "").trim().toLowerCase()
  );
  const expenseCategories = (currentState?.catalog?.expenseCategories || []).map((item) =>
    String(item || "").trim().toLowerCase()
  );

  const isIncomeCategory = incomeCategories.includes(category);
  const isExpenseCategory = expenseCategories.includes(category);

  if (isIncomeCategory && !isExpenseCategory) return "income";
  if (isExpenseCategory && !isIncomeCategory) return "expense";

  return normalizedType;
}

function sanitizeGoal(goal) {
  return {
    name: String(goal?.name || "Meta").trim() || "Meta",
    saved: Number.isFinite(Number(goal?.saved)) ? Number(goal.saved) : 0,
    target: Number.isFinite(Number(goal?.target)) && Number(goal.target) > 0 ? Number(goal.target) : 1,
    note: String(goal?.note || "").trim()
  };
}

function sanitizeBudget(budget, index) {
  const limit = Number(budget?.limit);
  if (!Number.isFinite(limit) || limit <= 0) return null;

  return {
    name: String(budget?.name || `Categoria ${index + 1}`).trim() || `Categoria ${index + 1}`,
    limit,
    color: String(budget?.color || fallbackBudgetColor(index))
  };
}

function sanitizeCatalog(catalog) {
  return {
    expenseCategories: uniqueCaseInsensitive(
      Array.isArray(catalog?.expenseCategories) ? catalog.expenseCategories : defaults.catalog.expenseCategories
    ),
    incomeCategories: uniqueCaseInsensitive(
      Array.isArray(catalog?.incomeCategories) ? catalog.incomeCategories : defaults.catalog.incomeCategories
    ),
    paymentMethods: uniqueCaseInsensitive(
      Array.isArray(catalog?.paymentMethods) ? catalog.paymentMethods : defaults.catalog.paymentMethods
    ),
    paymentMethodConfigs: sanitizePaymentMethodConfigs(catalog?.paymentMethodConfigs),
    multiLaunchExpenseCategoryAmounts: sanitizeCategoryAmountConfigs(catalog?.multiLaunchExpenseCategoryAmounts),
    multiLaunchIncomeCategoryAmounts: sanitizeCategoryAmountConfigs(catalog?.multiLaunchIncomeCategoryAmounts)
  };
}

function sanitizePaymentMethodConfigs(configs) {
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) {
    return {};
  }

  return Object.entries(configs).reduce((accumulator, [method, value]) => {
    const cleanMethod = String(method || "").trim();
    const closingDay = Number.parseInt(String(value?.closingDay || ""), 10);
    const paymentDay = Number.parseInt(String(value?.paymentDay || ""), 10);
    if (!cleanMethod) return accumulator;
    if (closingDay < 1 || closingDay > 31 || paymentDay < 1 || paymentDay > 31) return accumulator;
    accumulator[cleanMethod] = { closingDay, paymentDay };
    return accumulator;
  }, {});
}

function sanitizeCategoryAmountConfigs(configs) {
  if (!configs || typeof configs !== "object" || Array.isArray(configs)) {
    return {};
  }

  return Object.entries(configs).reduce((accumulator, [category, value]) => {
    const cleanCategory = String(category || "").trim();
    const amount = Number(value);
    if (!cleanCategory || !Number.isFinite(amount) || amount <= 0) return accumulator;
    accumulator[cleanCategory] = amount;
    return accumulator;
  }, {});
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

function sanitizeUi(ui) {
  const allowed = ["MULTIPLOS", "EXTRATO", "LANCAMENTOS", "QUADRO", "CONFIG"];
  const rawOrder = Array.isArray(ui?.screenOrder) ? ui.screenOrder : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"];
  const baseScreens = rawOrder.filter((item) => allowed.includes(item) && item !== "CONFIG");
  const normalizedBase = baseScreens.length > 0 ? baseScreens : ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"];
  const screenOrder = [];

  for (const item of [...normalizedBase, "MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO"]) {
    if (item === "CONFIG" || screenOrder.includes(item)) continue;
    screenOrder.push(item);
  }

  if (!screenOrder.includes("CONFIG")) {
    screenOrder.push("CONFIG");
  }
  const menuActionsOrder = sanitizeMenuActionsOrder(ui?.menuActionsOrder);

  return {
    screenOrder,
    menuActionsOrder,
    themeMode: ui?.themeMode === "dark" ? "dark" : "light",
    visualizacaoModo: ui?.visualizacaoModo === "DUAS_TELAS" ? "DUAS_TELAS" : "UMA_TELA",
    voiceAutoListenEnabled: Boolean(ui?.voiceAutoListenEnabled),
    voiceWakeWord: String(ui?.voiceWakeWord || "financeiro").trim() || "financeiro",
    notificationsEnabled: ui?.notificationsEnabled !== false,
    notificationHour: Number.isFinite(Number(ui?.notificationHour)) ? Math.min(23, Math.max(0, Number(ui.notificationHour))) : 10,
    notificationMinute: Number.isFinite(Number(ui?.notificationMinute)) ? Math.min(59, Math.max(0, Number(ui.notificationMinute))) : 0,
    activeAccountId: Number(ui?.activeAccountId) || null,
    accounts: Array.isArray(ui?.accounts)
      ? ui.accounts
          .map((account) => ({
            id: Number(account?.id) || 0,
            name: String(account?.name || "").trim(),
            phone: String(account?.phone || "").trim(),
            email: String(account?.email || "").trim()
          }))
          .filter((account) => account.id > 0 && account.name)
      : []
  };
}

function sanitizeMenuActionsOrder(rawOrder) {
  const allowed = defaultMenuActionsOrder();
  const base = Array.isArray(rawOrder) ? rawOrder.filter((item) => allowed.includes(item)) : [];
  const seen = new Set();
  const normalized = [];

  for (const item of [...base, ...allowed]) {
    if (seen.has(item)) continue;
    seen.add(item);
    normalized.push(item);
  }

  return normalized;
}

function buildMenuAccountDetails(activeAccountId, accounts) {
  const activeAccount = resolveActiveAccountRecord(accounts, activeAccountId);
  if (!activeAccount) {
    return [{ label: "Acesso", value: currentIdentity?.mode === "google" ? "Conta ativa" : "Conta local" }];
  }

  return [
    { label: "Acesso", value: currentIdentity?.mode === "google" ? "Conta ativa" : "Conta local" },
    { label: "Nome", value: activeAccount.name || "Sem conta" },
    { label: "Telefone", value: activeAccount.phone || "Não informado" },
    { label: "Email", value: activeAccount.email || "Não informado" }
  ];
}

function resolveActiveAccountRecord(accounts, activeAccountId) {
  if (!Array.isArray(accounts)) return null;
  return accounts.find((account) => Number(account.id) === Number(activeAccountId)) || null;
}

function defaultMenuActionsOrder() {
  return ["MULTIPLOS", "LANCAMENTOS", "EXTRATO", "QUADRO", "EXPORT_CSV", "EXPORT_EXCEL"];
}

function menuActionLabel(actionId) {
  if (actionId === "MULTIPLOS") return "Múltiplos lançamentos";
  if (actionId === "LANCAMENTOS") return "Lançamentos";
  if (actionId === "EXTRATO") return "Extrato";
  if (actionId === "QUADRO") return "Futuro";
  if (actionId === "EXPORT_CSV") return "Exportar CSV";
  if (actionId === "EXPORT_EXCEL") return "Exportar Excel";
  return actionId;
}

function openDialogElement(dialog) {
  if (!dialog) return;
  try {
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
      return;
    }
  } catch {}
  dialog.setAttribute("open", "open");
}

function closeDialogElement(dialog) {
  if (!dialog) return;
  try {
    if (typeof dialog.close === "function" && dialog.open) {
      dialog.close();
      return;
    }
  } catch {}
  dialog.removeAttribute("open");
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

function normalizeTransactionId(id) {
  const numericId = Number(id);
  return Number.isFinite(numericId) && numericId > 0 ? Math.trunc(numericId) : generateId();
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

function formatDateShort(dateMillis) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(dateMillis));
}

function formatDateInputValue(dateMillis) {
  const date = new Date(dateMillis);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toStartOfDayMillis(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0).getTime();
}

function toEndOfDayMillis(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999).getTime();
}

function todayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fallbackBudgetColor(index) {
  const palette = ["#145c4c", "#6bc5a4", "#f08a24", "#d9604c", "#256d5a"];
  return palette[index % palette.length];
}

function emptyStateHtml(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function screenLabel(screen) {
  if (screen === "MULTIPLOS") return "Múltiplos";
  if (screen === "LANCAMENTOS") return "Lançamentos";
  if (screen === "QUADRO") return "Futuro";
  if (screen === "CONFIG") return "Configurações";
  return "Extrato";
}

function screenTabLabel(screen) {
  if (typeof window !== "undefined" && window.innerWidth <= 680) {
    if (screen === "MULTIPLOS") return "Múlt.";
    if (screen === "LANCAMENTOS") return "Lanç.";
  }
  return screenLabel(screen);
}
