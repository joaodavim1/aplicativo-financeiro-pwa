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

const nodes = {
  currentMonthLabel: document.querySelector("#currentMonthLabel"),
  balanceValue: document.querySelector("#balanceValue"),
  incomeValue: document.querySelector("#incomeValue"),
  expenseValue: document.querySelector("#expenseValue"),
  categoryBars: document.querySelector("#categoryBars"),
  insightsList: document.querySelector("#insightsList"),
  goalsList: document.querySelector("#goalsList"),
  budgetList: document.querySelector("#budgetList"),
  transactionsList: document.querySelector("#transactionsList"),
  transactionForm: document.querySelector("#transactionForm"),
  filterTabs: [...document.querySelectorAll(".filter-tab")],
  userBadge: document.querySelector("#userBadge"),
  categoryInput: document.querySelector("#categoryInput"),
  typeInput: document.querySelector("#typeInput")
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

  renderCategories();
  renderInsights(balance, income, expense);
  renderGoals();
  renderBudgets();
  renderTransactions();
  renderCategoryOptions();
}

function renderCategories() {
  const totals = totalsByCategory();
  const entries = Object.entries(totals);
  const max = Math.max(...Object.values(totals), 1);

  if (entries.length === 0) {
    nodes.categoryBars.innerHTML = emptyStateHtml("As categorias aparecem assim que houver despesas sincronizadas.");
    return;
  }

  nodes.categoryBars.innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => {
      const budget = currentState.budgets.find((item) => item.name === name);
      const color = budget?.color || "#145c4c";
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

function renderInsights(balance, income, expense) {
  const savingsRate = income > 0 ? (income - expense) / income : 0;
  const topExpense = Object.entries(totalsByCategory())[0];
  const syncText =
    currentIdentity?.mode === "google"
      ? "Os dados desta tela usam o mesmo Supabase do Android e ficam separados pela sua conta Google."
      : "Voce esta em modo demo local. Entre com Google para puxar os dados reais do Supabase.";

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
      title: currentIdentity?.mode === "google" ? "Conta Google sincronizada" : "Modo demo",
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
    nodes.goalsList.innerHTML = emptyStateHtml("As metas ainda nao foram mapeadas nesta versao web.");
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
  const totals = totalsByCategory();

  if (currentState.budgets.length === 0) {
    nodes.budgetList.innerHTML = emptyStateHtml("Nenhum limite por categoria veio da conta sincronizada.");
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

  nodes.transactionsList.innerHTML = filtered
    .map((transaction) => {
      const sign = transaction.type === "income" ? "+" : "-";
      return `
        <div class="transaction-item">
          <div>
            <div class="transaction-title">${escapeHtml(transaction.title)}</div>
            <div class="transaction-meta">${escapeHtml(transaction.category)} · ${escapeHtml(transaction.dateLabel)}</div>
          </div>
          <div class="transaction-amount ${transaction.type}">
            ${sign}${currency.format(transaction.amount)}
          </div>
        </div>
      `;
    })
    .join("");
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

function totalsByCategory() {
  return currentState.transactions
    .filter((item) => item.type === "expense")
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
    catalog: sanitizeCatalog(state?.catalog)
  };
}

function stripRuntimeFields(state) {
  const sanitized = sanitizeState(state);
  return {
    monthLabel: sanitized.monthLabel,
    transactions: sanitized.transactions,
    goals: sanitized.goals,
    budgets: sanitized.budgets,
    catalog: sanitized.catalog
  };
}

function updateUserBadge() {
  if (!currentIdentity) {
    nodes.userBadge.classList.add("hidden");
    return;
  }

  if (currentIdentity.mode === "google" && currentIdentity.user?.email) {
    const name = currentIdentity.user.displayName || currentIdentity.user.email;
    nodes.userBadge.textContent = `Supabase: ${name}`;
    nodes.userBadge.classList.remove("hidden");
    return;
  }

  nodes.userBadge.textContent = "Modo demo local";
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

function fallbackBudgetColor(index) {
  const palette = ["#145c4c", "#6bc5a4", "#f08a24", "#d9604c", "#256d5a"];
  return palette[index % palette.length];
}

function emptyStateHtml(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}
