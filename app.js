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
    incomeCategories: ["Trabalho", "Pix", "Venda", "Servico", "Bonus"]
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
let currentHistoryFilters = {
  startDate: "",
  endDate: "",
  type: "all",
  category: "",
  payment: ""
};

const nodes = {
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
  historyCategoryFilter: document.querySelector("#historyCategoryFilter"),
  historyPaymentFilter: document.querySelector("#historyPaymentFilter"),
  clearHistoryFiltersButton: document.querySelector("#clearHistoryFiltersButton"),
  filteredTotalValue: document.querySelector("#filteredTotalValue"),
  extratoList: document.querySelector("#extratoList"),
  insightsList: document.querySelector("#insightsList"),
  goalsList: document.querySelector("#goalsList"),
  budgetList: document.querySelector("#budgetList"),
  transactionsList: document.querySelector("#transactionsList"),
  transactionForm: document.querySelector("#transactionForm"),
  filterTabs: [...document.querySelectorAll(".filter-tab")],
  screenTabs: document.querySelector("#screenTabs"),
  screenPanels: [...document.querySelectorAll(".screen-panel")],
  userBadge: document.querySelector("#userBadge"),
  categoryInput: document.querySelector("#categoryInput"),
  typeInput: document.querySelector("#typeInput"),
  settingsAccountName: document.querySelector("#settingsAccountName"),
  settingsDataSource: document.querySelector("#settingsDataSource"),
  settingsScreenOrder: document.querySelector("#settingsScreenOrder")
};

export async function bootFinanceiroApp({ mode = "demo", user = null, persistence = null } = {}) {
  currentIdentity = { mode, user };
  currentPersistence = persistence || createLocalPersistence(mode, user);
  currentState = sanitizeState(await currentPersistence.loadState());

  updateUserBadge();

  if (!eventsBound) {
    bindEvents();
    registerServiceWorker();
    eventsBound = true;
  }

  render();
}

function bindEvents() {
  nodes.transactionForm.addEventListener("submit", handleSubmit);
  nodes.typeInput.addEventListener("change", renderCategoryOptions);
  nodes.screenTabs.addEventListener("click", handleScreenTabClick);
  [
    nodes.historyStartDate,
    nodes.historyEndDate,
    nodes.historyTypeFilter,
    nodes.historyCategoryFilter,
    nodes.historyPaymentFilter
  ].forEach((node) => {
    node?.addEventListener("change", handleHistoryFilterChange);
  });
  nodes.clearHistoryFiltersButton?.addEventListener("click", clearHistoryFilters);
  nodes.filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      currentFilter = tab.dataset.filter;
      nodes.filterTabs.forEach((item) => item.classList.toggle("active", item === tab));
      renderTransactions();
    });
  });
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "Casa");
  const type = String(formData.get("type") || "expense");
  const amount = Number(formData.get("amount"));

  if (!title || !Number.isFinite(amount) || amount <= 0) return;

  const now = Date.now();

  currentState.transactions.unshift({
    id: generateId(),
    title,
    category,
    type,
    amount,
    dateMillis: now,
    dateLabel: formatRelativeDate(now),
    paymentMethod: "",
    notes: ""
  });

  updateCatalogForTransaction(category, type);
  await saveState();
  event.currentTarget.reset();
  renderCategoryOptions();
  render();
}

function render() {
  const income = sumByType("income");
  const expense = sumByType("expense");
  const balance = income - expense;

  nodes.currentMonthLabel.textContent = currentState.monthLabel;
  nodes.balanceValue.textContent = currency.format(balance);
  nodes.incomeValue.textContent = currency.format(income);
  nodes.expenseValue.textContent = currency.format(expense);

  renderExtratoAccountSnapshot();
  renderHistoryFilterOptions();
  renderExtratoCategoryBars();
  renderExtratoList();
  renderInsights(balance, income, expense);
  renderGoals();
  renderBudgets();
  renderTransactions();
  renderCategoryOptions();
  renderScreenTabs();
  renderScreenPanels();
  renderSettings();
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

      return `
        <div class="bar-item">
          <div class="bar-head">
            <strong>${escapeHtml(name)}</strong>
            <span>${currency.format(total)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}; background:${color};"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderHistoryFilterOptions() {
  syncHistoryFilterInputs();

  const type = nodes.historyTypeFilter?.value || "all";
  const categoryOptions = deriveHistoryCategoryOptions(type);
  const paymentOptions = deriveHistoryPaymentOptions();
  const previousCategory = currentHistoryFilters.category;
  const previousPayment = currentHistoryFilters.payment;

  if (nodes.historyCategoryFilter) {
    nodes.historyCategoryFilter.innerHTML = ['<option value="">Todas</option>']
      .concat(categoryOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`))
      .join("");
    nodes.historyCategoryFilter.value = categoryOptions.includes(previousCategory) ? previousCategory : "";
    currentHistoryFilters.category = nodes.historyCategoryFilter.value;
  }

  if (nodes.historyPaymentFilter) {
    nodes.historyPaymentFilter.innerHTML = ['<option value="">Todos</option>']
      .concat(paymentOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`))
      .join("");
    nodes.historyPaymentFilter.value = paymentOptions.includes(previousPayment) ? previousPayment : "";
    currentHistoryFilters.payment = nodes.historyPaymentFilter.value;
  }
}

function renderExtratoList() {
  const filtered = getHistoryFilteredTransactions();
  const total = filtered.reduce(
    (accumulator, transaction) => accumulator + (transaction.type === "income" ? transaction.amount : -transaction.amount),
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

function renderInsights(balance, income, expense) {
  const savingsRate = income > 0 ? (income - expense) / income : 0;
  const topExpense = Object.entries(totalsByCategoryForFilters("expense"))[0];
  const syncText =
    currentIdentity?.mode === "google"
      ? "Os dados desta tela estao na conta atual."
      : "Esta e a versao local da conta.";

  const insights = [
    {
      title: balance >= 0 ? "Fluxo positivo" : "Fluxo pressionado",
      text:
        balance >= 0
          ? `Seu saldo do mes esta em ${currency.format(balance)}.`
          : `Voce passou ${currency.format(Math.abs(balance))} do que entrou.`
    },
    {
      title: "Taxa de sobra",
      text: `A reserva atual do mes esta em ${percent.format(Math.max(savingsRate, 0))}.`
    },
    {
      title: "Maior foco",
      text: topExpense ? `${topExpense[0]} lidera as saidas com ${currency.format(topExpense[1])}.` : "Sem gastos registrados."
    },
    {
      title: currentIdentity?.mode === "google" ? "Conta ativa" : "Conta local",
      text: syncText
    }
  ];

  nodes.insightsList.innerHTML = insights
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

function renderGoals() {
  if (currentState.goals.length === 0) {
    nodes.goalsList.innerHTML = emptyStateHtml("Nenhuma meta cadastrada.");
    return;
  }

  nodes.goalsList.innerHTML = currentState.goals
    .map((goal) => {
      const progress = Math.min(goal.saved / goal.target, 1);
      return `
        <div class="goal-item">
          <div class="goal-row-head">
            <strong>${escapeHtml(goal.name)}</strong>
            <span>${percent.format(progress)}</span>
          </div>
          <p class="muted">${escapeHtml(goal.note)}</p>
          <div class="progress-track">
            <div class="progress-fill" style="width:${progress * 100}%; background:linear-gradient(90deg, #145c4c, #f08a24);"></div>
          </div>
          <div class="amount-strong">
            <span>${currency.format(goal.saved)}</span>
            <span>${currency.format(goal.target)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBudgets() {
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
    return transaction.type === currentFilter;
  });

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

  nodes.categoryInput.innerHTML = options
    .map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`)
    .join("");

  if (options.includes(previousValue)) {
    nodes.categoryInput.value = previousValue;
  }
}

function renderScreenTabs() {
  const order = currentState.ui.screenOrder;
  if (!order.includes(activeScreen)) {
    activeScreen = order[0];
  }

  nodes.screenTabs.innerHTML = order
    .map(
      (screen) => `
        <button class="screen-tab ${screen === activeScreen ? "active" : ""}" data-screen="${screen}" type="button">
          ${escapeHtml(screenLabel(screen))}
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
  activeScreen = button.dataset.screen;
  renderScreenTabs();
  renderScreenPanels();
}

function renderSettings() {
  if (!nodes.settingsAccountName) return;

  const userName = currentIdentity?.mode === "google"
    ? currentIdentity?.user?.displayName || currentIdentity?.user?.email || "Conta"
    : "Conta local";
  const dataSource = currentIdentity?.mode === "google"
    ? "Conta ativa"
    : "Conta local";
  const orderLabel = currentState.ui.screenOrder.map((screen) => screenLabel(screen)).join(", ");

  nodes.settingsAccountName.textContent = userName;
  nodes.settingsDataSource.textContent = dataSource;
  nodes.settingsScreenOrder.textContent = orderLabel;
}

function totalsByCategoryForFilters(type) {
  return getHistoryFilteredTransactions()
    .filter((item) => item.type === type)
    .reduce((accumulator, transaction) => {
      accumulator[transaction.category] = (accumulator[transaction.category] || 0) + transaction.amount;
      return accumulator;
    }, {});
}

function sumByType(type) {
  return currentState.transactions
    .filter((transaction) => transaction.type === type)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function handleHistoryFilterChange() {
  currentHistoryFilters = {
    startDate: nodes.historyStartDate?.value || "",
    endDate: nodes.historyEndDate?.value || "",
    type: nodes.historyTypeFilter?.value || "all",
    category: nodes.historyCategoryFilter?.value || "",
    payment: nodes.historyPaymentFilter?.value || ""
  };

  renderHistoryFilterOptions();
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
  renderExtratoCategoryBars();
  renderExtratoList();
}

function syncHistoryFilterInputs() {
  if (nodes.historyStartDate) nodes.historyStartDate.value = currentHistoryFilters.startDate;
  if (nodes.historyEndDate) nodes.historyEndDate.value = currentHistoryFilters.endDate;
  if (nodes.historyTypeFilter) nodes.historyTypeFilter.value = currentHistoryFilters.type;
}

function getHistoryFilteredTransactions() {
  return currentState.transactions.filter((transaction) => {
    if (currentHistoryFilters.type !== "all" && transaction.type !== currentHistoryFilters.type) {
      return false;
    }
    if (currentHistoryFilters.category && transaction.category !== currentHistoryFilters.category) {
      return false;
    }
    if (currentHistoryFilters.payment && transaction.paymentMethod !== currentHistoryFilters.payment) {
      return false;
    }
    if (currentHistoryFilters.startDate) {
      const startMillis = toStartOfDayMillis(currentHistoryFilters.startDate);
      if (transaction.dateMillis < startMillis) {
        return false;
      }
    }
    if (currentHistoryFilters.endDate) {
      const endMillis = toEndOfDayMillis(currentHistoryFilters.endDate);
      if (transaction.dateMillis > endMillis) {
        return false;
      }
    }
    return true;
  });
}

function deriveHistoryCategoryOptions(type) {
  const filteredType = type === "all" ? null : type;
  return uniqueCaseInsensitive(
    currentState.transactions
      .filter((transaction) => !filteredType || transaction.type === filteredType)
      .map((transaction) => transaction.category)
  );
}

function deriveHistoryPaymentOptions() {
  return uniqueCaseInsensitive(
    currentState.transactions.map((transaction) => transaction.paymentMethod).filter(Boolean)
  );
}

function renderTransactionItem(transaction) {
  const sign = transaction.type === "income" ? "+" : "-";
  const details = [transaction.category, transaction.paymentMethod, transaction.dateLabel].filter(Boolean).join(" · ");
  const notes = transaction.notes ? `<div class="transaction-notes">${escapeHtml(transaction.notes)}</div>` : "";

  return `
    <div class="transaction-item">
      <div>
        <div class="transaction-title">${escapeHtml(transaction.title)}</div>
        <div class="transaction-meta">${escapeHtml(details)}</div>
        ${notes}
      </div>
      <div class="transaction-amount ${transaction.type}">
        ${sign}${currency.format(transaction.amount)}
      </div>
    </div>
  `;
}

async function saveState() {
  try {
    await currentPersistence.saveState(stripRuntimeFields(currentState));
  } catch (error) {
    console.error("Falha ao salvar dados do app:", error);
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

  if (currentIdentity.mode === "google" && currentIdentity.user?.email) {
    const name = currentIdentity.user.displayName || currentIdentity.user.email;
    nodes.userBadge.textContent = `Conta: ${name}`;
    nodes.userBadge.classList.remove("hidden");
    return;
  }

  nodes.userBadge.textContent = "Conta local";
  nodes.userBadge.classList.remove("hidden");
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

function updateCatalogForTransaction(category, type) {
  const key = type === "income" ? "incomeCategories" : "expenseCategories";
  currentState.catalog[key] = uniqueCaseInsensitive([...currentState.catalog[key], category]);
}

function sanitizeTransaction(transaction) {
  const dateMillis = Number.isFinite(Number(transaction?.dateMillis)) ? Number(transaction.dateMillis) : Date.now();

  return {
    id: normalizeTransactionId(transaction?.id),
    title: String(transaction?.title || "Sem titulo").trim() || "Sem titulo",
    category: String(transaction?.category || "Sem categoria").trim() || "Sem categoria",
    type: transaction?.type === "income" ? "income" : "expense",
    amount: Number.isFinite(Number(transaction?.amount)) ? Number(transaction.amount) : 0,
    dateMillis,
    dateLabel: typeof transaction?.dateLabel === "string" && transaction.dateLabel.trim()
      ? transaction.dateLabel
      : formatRelativeDate(dateMillis),
    paymentMethod: String(transaction?.paymentMethod || "").trim(),
    notes: String(transaction?.notes || "").trim()
  };
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
    )
  };
}

function sanitizeUi(ui) {
  const allowed = ["EXTRATO", "LANCAMENTOS", "QUADRO", "CONFIG"];
  const rawOrder = Array.isArray(ui?.screenOrder) ? ui.screenOrder : ["EXTRATO", "LANCAMENTOS", "QUADRO"];
  const baseScreens = rawOrder.filter((item) => allowed.includes(item) && item !== "CONFIG");
  const screenOrder = baseScreens.length > 0 ? baseScreens : ["EXTRATO", "LANCAMENTOS", "QUADRO"];
  if (!screenOrder.includes("CONFIG")) {
    screenOrder.push("CONFIG");
  }

  return {
    screenOrder
  };
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

function toStartOfDayMillis(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0).getTime();
}

function toEndOfDayMillis(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999).getTime();
}

function fallbackBudgetColor(index) {
  const palette = ["#145c4c", "#6bc5a4", "#f08a24", "#d9604c", "#256d5a"];
  return palette[index % palette.length];
}

function emptyStateHtml(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function screenLabel(screen) {
  if (screen === "LANCAMENTOS") return "Lançamentos";
  if (screen === "QUADRO") return "Futuro";
  if (screen === "CONFIG") return "Configurações";
  return "Extrato";
}
