const defaults = {
  monthLabel: "Abril de 2026",
  transactions: [
    { id: generateId(), title: "Salario", category: "Trabalho", type: "income", amount: 7800, dateLabel: "Hoje" },
    { id: generateId(), title: "Pix cliente", category: "Trabalho", type: "income", amount: 1850, dateLabel: "Hoje" },
    { id: generateId(), title: "Mercado do mes", category: "Mercado", type: "expense", amount: 428.72, dateLabel: "Ontem" },
    { id: generateId(), title: "Internet fibra", category: "Casa", type: "expense", amount: 119.99, dateLabel: "Segunda" },
    { id: generateId(), title: "Combustivel", category: "Transporte", type: "expense", amount: 210, dateLabel: "Segunda" },
    { id: generateId(), title: "Cinema", category: "Lazer", type: "expense", amount: 74.5, dateLabel: "Domingo" },
    { id: generateId(), title: "Aporte automatico", category: "Investimentos", type: "expense", amount: 1200, dateLabel: "Domingo" }
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
  ]
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
  userBadge: document.querySelector("#userBadge")
};

export async function bootFinanceiroApp({ mode = "demo", user = null, persistence = null } = {}) {
  currentIdentity = { mode, user };
  currentPersistence = persistence || createLocalPersistence(mode, user);
  currentState = await currentPersistence.loadState();
  currentState = sanitizeState(currentState);

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

  currentState.transactions.unshift({
    id: generateId(),
    title,
    category,
    type,
    amount,
    dateLabel: "Agora"
  });

  await saveState();
  event.currentTarget.reset();
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
}

function renderCategories() {
  const totals = totalsByCategory();
  const max = Math.max(...Object.values(totals), 1);

  nodes.categoryBars.innerHTML = Object.entries(totals)
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
      ? "Os dados desta tela estao vinculados a sua conta Google e sincronizados no Firestore."
      : "Voce esta em modo demo local. Entre com Google para sincronizar os dados da conta.";

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

        return {
          ...structuredClone(defaults),
          ...JSON.parse(raw)
        };
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
    transactions: Array.isArray(state?.transactions) ? state.transactions : structuredClone(defaults.transactions),
    goals: Array.isArray(state?.goals) ? state.goals : structuredClone(defaults.goals),
    budgets: Array.isArray(state?.budgets) ? state.budgets : structuredClone(defaults.budgets)
  };
}

function stripRuntimeFields(state) {
  return sanitizeState(state);
}

function updateUserBadge() {
  if (!currentIdentity) {
    nodes.userBadge.classList.add("hidden");
    return;
  }

  if (currentIdentity.mode === "google" && currentIdentity.user?.email) {
    const name = currentIdentity.user.displayName || currentIdentity.user.email;
    nodes.userBadge.textContent = `Google: ${name}`;
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
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
