import React, { createContext, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileBarChart,
  Gem,
  Grid2X2,
  HelpCircle,
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Store,
  Users,
  Wallet,
  X,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Download,
  Check,
  CalendarDays,
} from "lucide-react";
import "./styles.css";
import {
  localRepository,
  money,
  nextId,
  transactionRows,
} from "./data/repository";

const navItems = [
  { label: "Dashboard", icon: Grid2X2, path: "/" },
  { label: "Transactions", icon: CircleDollarSign, path: "/transactions" },
  { label: "Dealers", icon: Users, path: "/dealers" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Earnings", icon: BarChart3, path: "/earnings" },
  { label: "Reports", icon: FileBarChart, path: "/reports" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const DataContext = createContext(null);
function useData() {
  return useContext(DataContext);
}

function routeName() {
  const path = window.location.pathname;
  return path === "/"
    ? "Dashboard"
    : path
        .slice(1)
        .split("-")
        .map((x) => x[0].toUpperCase() + x.slice(1))
        .join(" ");
}
function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}
function downloadCsv(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function App() {
  const [current, setCurrent] = useState(routeName());
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(null);
  const [data, setData] = useState(() => localRepository().load());
  const repository = localRepository();
  const updateData = (updater) =>
    setData((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  const addTransaction = (transaction) =>
    updateData((previous) => ({
      ...previous,
      transactions: [...previous.transactions, transaction],
    }));
  const addPayment = (payment) =>
    updateData((previous) => ({
      ...previous,
      payments: [...previous.payments, payment],
    }));
  React.useEffect(() => {
    const fn = () => setCurrent(routeName());
    const escape = (event) => {
      if (event.key === "Escape") {
        setDrawer(false);
        setMenu(null);
      }
    };
    window.addEventListener("popstate", fn);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("popstate", fn);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  React.useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);
  const go = (path) => {
    navigate(path);
    setDrawer(false);
    setMenu(null);
  };
  return (
    <DataContext.Provider
      value={{ data, addTransaction, addPayment, updateData }}
    >
      <div className="app-shell">
        <Sidebar
          current={current}
          onNavigate={go}
          open={drawer}
          onClose={() => setDrawer(false)}
        />
        <main className="main-area">
          <header className="topbar">
            <button
              className="icon-btn mobile-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="mobile-brand">
              <div className="brand-mark">
                <Gem size={16} />
              </div>
              <span>Diamond Finance</span>
            </div>
            <div className="crumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{current}</strong>
            </div>
            <div className="top-actions">
              <button
                className="icon-btn"
                aria-label="Help"
                onClick={() => setMenu(menu === "help" ? null : "help")}
              >
                <HelpCircle size={19} />
              </button>
              <button
                className="icon-btn notification"
                aria-label="Notifications"
                onClick={() =>
                  setMenu(menu === "notifications" ? null : "notifications")
                }
              >
                <Bell size={19} />
                <i />
              </button>
              <button
                className="avatar"
                aria-label="Open profile"
                onClick={() => setMenu(menu === "profile" ? null : "profile")}
              >
                JD
              </button>
              <button
                className="profile-name"
                onClick={() => setMenu(menu === "profile" ? null : "profile")}
              >
                Jordan Davis <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="top-menu">
                  {menu === "help" && (
                    <>
                      <b>Help center</b>
                      <span>Support is available for your workspace.</span>
                    </>
                  )}
                  {menu === "notifications" && (
                    <>
                      <b>Notifications</b>
                      <span>No new notifications.</span>
                    </>
                  )}
                  {menu === "profile" && (
                    <>
                      <b>Jordan Davis</b>
                      <button onClick={() => go("/settings")}>
                        Account settings
                      </button>
                      <button onClick={() => setMenu(null)}>Sign out</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </header>
          <div
            className={
              "content page-" + current.toLowerCase().replaceAll(" ", "-")
            }
          >
            <Page current={current} onNavigate={go} />
          </div>
        </main>
      </div>
    </DataContext.Provider>
  );
}

function Sidebar({ current, onNavigate, open, onClose }) {
  return (
    <>
      {open && <div className="scrim" onClick={onClose} />}
      <aside className={"sidebar " + (open ? "open" : "")}>
        <div className="brand">
          <div className="brand-mark">
            <Gem size={20} />
          </div>
          <span>Diamond Finance</span>
          <button
            className="icon-btn close-menu"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <div className="workspace-icon">DB</div>
          <div>
            <b>Diamond Broker</b>
            <small>Business account</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <nav>
          <small className="nav-label">MAIN MENU</small>
          {navItems.map((item) => {
            const Icon = item.icon;
            const related =
              (item.label === "Transactions" &&
                ["Transaction Details", "New Transaction"].includes(current)) ||
              (item.label === "Dealers" && current === "Dealer Profile");
            return (
              <button
                key={item.path}
                className={
                  "nav-item " +
                  (current === item.label || related ? "active" : "")
                }
                onClick={() => onNavigate(item.path)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-row">
            <div className="avatar">JD</div>
            <div>
              <b>Jordan Davis</b>
              <small>jordan@diamond.com</small>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>
    </>
  );
}

function Page({ current, onNavigate }) {
  if (current === "Dashboard") return <Dashboard onNavigate={onNavigate} />;
  if (current === "Transactions")
    return <Transactions onNavigate={onNavigate} />;
  if (current === "Transaction Details")
    return <TransactionDetails onNavigate={onNavigate} />;
  if (current === "New Transaction")
    return <NewTransaction onNavigate={onNavigate} />;
  if (current === "Dealer Profile")
    return <DealerProfile onNavigate={onNavigate} />;
  if (current === "Dealers") return <Dealers onNavigate={onNavigate} />;
  if (current === "Payments") return <Payments onNavigate={onNavigate} />;
  if (current === "Earnings") return <Earnings />;
  if (current === "Reports") return <Reports />;
  if (current === "Settings") return <SettingsPage />;
  return <Transactions onNavigate={onNavigate} />;
}

function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
function Button({
  children,
  secondary,
  onClick,
  icon: Icon = Plus,
  type = "button",
  disabled = false,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={"button " + (secondary ? "secondary" : "")}
      onClick={onClick}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
function Panel({ title, action, children, className = "" }) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Status({ children }) {
  return (
    <span className={"status " + children.toLowerCase()}>
      <i />
      {children}
    </span>
  );
}
function Stat({ label, value, change, positive = true, icon: Icon }) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <div className="stat-icon">
          <Icon size={17} />
        </div>
      </div>
      <strong>{value}</strong>
      <small className={positive ? "up" : "down"}>
        {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {change} <em>vs last month</em>
      </small>
    </div>
  );
}
function formatChartAmount(value) {
  if (!value) return "\u20b90";
  const lakhs = value / 100000;
  const rounded = Math.round(lakhs * 10) / 10;
  return `\u20b9${rounded}L`;
}
function MiniChart() {
  const chartData = [
    ["Apr", 2500000, 34],
    ["May", 3600000, 48],
    ["Jun", 3150000, 42],
    ["Jul", 4700000, 63],
    ["Aug", 4100000, 55],
    ["Sep", 6570050, 88],
    ["Oct", 5050000, 68],
  ];
  return (
    <div className="chart">
      <div className="chart-y">
        {[5000000, 4000000, 3000000, 2000000, 1000000, 0].map((value) => (
          <span key={value}>{formatChartAmount(value)}</span>
        ))}
      </div>
      <div className="chart-area bar-chart">
        <div className="grid-lines">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="bars" aria-label="Monthly revenue bar chart">
          {chartData.map(([month, value, height], index) => (
            <span
              className={index === 5 ? "current" : ""}
              style={{ height: height + "%" }}
              title={`${month}\nRevenue\n${formatChartAmount(value)}`}
              aria-label={`${month} Revenue ${formatChartAmount(value)}`}
              key={month}
            />
          ))}
        </div>
        <div className="chart-x">
          {chartData.map(([month]) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }) {
  const { data } = useData();
  const revenue = data.transactions.reduce((sum, item) => sum + item.amount, 0);
  const pending = data.transactions
    .filter((item) => item.status === "Pending")
    .reduce((sum, item) => sum + item.amount, 0);
  const active = data.dealers.filter((item) => item.status === "Active").length;
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Good morning, Jordan"
        description="Here's what's happening with your business today."
        action={
          <Button onClick={() => onNavigate("/new-transaction")}>
            New transaction
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Total revenue"
          value={money(revenue)}
          change="12.5%"
          icon={CircleDollarSign}
        />
        <Stat
          label="Total transactions"
          value={data.transactions.length.toLocaleString()}
          change="8.2%"
          icon={CreditCard}
        />
        <Stat
          label="Active dealers"
          value={active}
          change="4.6%"
          icon={Users}
        />
        <Stat
          label="Pending payments"
          value={money(pending)}
          change="2.4%"
          positive={false}
          icon={Wallet}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Revenue overview"
          action={
            <select
              className="select"
              aria-label="Revenue range"
              defaultValue="6"
            >
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </select>
          }
          className="revenue-panel"
        >
          <div className="revenue-total">
            <strong>{money(revenue)}</strong>
            <span className="up">
              <ArrowUpRight size={13} /> 12.5%
            </span>
          </div>
          <MiniChart />
        </Panel>
        <Panel
          title="Transaction summary"
          action={
            <button
              className="link-btn"
              onClick={() => onNavigate("/transactions")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          }
        >
          <div className="donut-wrap">
            <div className="donut">
              <div>
                <b>{data.transactions.length}</b>
                <span>Transactions</span>
              </div>
            </div>
            <div className="legend">
              <span>
                <i className="blue" />
                Completed{" "}
                <b>
                  {data.transactions.length
                    ? Math.round(
                        (data.transactions.filter(
                          (item) => item.status === "Completed",
                        ).length /
                          data.transactions.length) *
                          100,
                      )
                    : 0}
                  %
                </b>
              </span>
              <span>
                <i className="yellow" />
                Pending{" "}
                <b>
                  {data.transactions.length
                    ? Math.round(
                        (data.transactions.filter(
                          (item) => item.status === "Pending",
                        ).length /
                          data.transactions.length) *
                          100,
                      )
                    : 0}
                  %
                </b>
              </span>
              <span>
                <i className="gray" />
                Other <b>10%</b>
              </span>
            </div>
          </div>
        </Panel>
      </div>
      <div className="dashboard-grid bottom-grid">
        <Panel
          title="Recent transactions"
          action={
            <button
              className="link-btn"
              onClick={() => onNavigate("/transactions")}
            >
              View all <ArrowUpRight size={14} />
            </button>
          }
          className="table-panel"
        >
          <TransactionTable
            rows={transactionRows(data).slice(0, 4)}
            onRowClick={(id) => onNavigate("/transaction-details?id=" + id)}
          />
        </Panel>
        <Panel
          title="Top dealers"
          action={
            <button className="link-btn" onClick={() => onNavigate("/dealers")}>
              View all <ArrowUpRight size={14} />
            </button>
          }
        >
          <div className="dealer-list">
            {data.dealers.slice(0, 4).map((dealer) => (
              <div
                className="dealer-row"
                key={dealer.id}
                onClick={() => onNavigate("/dealer-profile?id=" + dealer.id)}
              >
                <div className="dealer-avatar">{dealer.name.slice(0, 2)}</div>
                <div>
                  <b>{dealer.name}</b>
                  <small>{dealer.location}</small>
                </div>
                <strong>
                  {money(
                    data.transactions
                      .filter((item) => item.dealerId === dealer.id)
                      .reduce((sum, item) => sum + item.amount, 0),
                  )}
                </strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function TransactionTable({ rows, onRowClick }) {
  if (!rows.length)
    return (
      <div className="empty-state">
        <Search size={20} />
        <b>No transactions found</b>
        <span>Try clearing your search or filters.</span>
      </div>
    );
  return (
    <>
      <div className="table-scroll desktop-data-table">
        <table>
          <thead>
            <tr>
              <th>Transaction</th>
              <th>Dealer</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row[0]}
                onClick={() => onRowClick?.(row[0])}
                onKeyDown={(event) =>
                  event.key === "Enter" && onRowClick?.(row[0])
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={onRowClick ? "clickable-row" : ""}
              >
                <td>
                  <b>{row[5] || row[0]}</b>
                  <small className="table-id">{row[5] ? row[0] : ""}</small>
                </td>
                <td>{row[1]}</td>
                <td>{row[2]}</td>
                <td>
                  <b>{row[3]}</b>
                </td>
                <td>
                  <Status>{row[4]}</Status>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-data-list">
        {rows.map((row) => (
          <button
            key={row[0]}
            type="button"
            className="mobile-card-item"
            onClick={() => onRowClick?.(row[0])}
          >
            <div className="mobile-card-main">
              <div className="mobile-card-copy">
                <b>{row[5] || row[0]}</b>
                <span>{row[1]}</span>
              </div>
              <div className="mobile-card-amount">{row[3]}</div>
            </div>
            <div className="mobile-card-meta">
              <span>{row[2]}</span>
              <Status>{row[4]}</Status>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
function Transactions({ onNavigate }) {
  const { data } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const rows = transactionRows(data);
  const filtered = rows.filter(
    (row) =>
      row.join(" ").toLowerCase().includes(query.toLowerCase()) &&
      (status === "All" || row[4] === status),
  );
  const openDetails = (id) => onNavigate("/transaction-details?id=" + id);
  const exportRows = filtered.map((row) => row.slice(0, 5));
  return (
    <>
      <PageHeader
        eyebrow="Manage"
        title="Transactions"
        description="Track and manage all your diamond transactions."
        action={
          <Button onClick={() => onNavigate("/new-transaction")}>
            New transaction
          </Button>
        }
      />
      <Panel
        title="All transactions"
        action={
          <div className="panel-actions">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search transactions..."
            />
            <select
              className="filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter transaction status"
            >
              <option>All</option>
              <option>Completed</option>
              <option>Pending</option>
              <option>Processing</option>
            </select>
            <button
              className="icon-btn bordered"
              aria-label="Export transactions"
              onClick={() =>
                downloadCsv(
                  "transactions.csv",
                  ["Transaction", "Dealer", "Date", "Amount", "Status"],
                  exportRows,
                )
              }
            >
              <Download size={16} />
            </button>
          </div>
        }
      >
        <TransactionTable rows={filtered} onRowClick={openDetails} />
        <div className="pagination">
          <span>
            Showing {filtered.length ? 1 : 0} to {filtered.length} of{" "}
            {data.transactions.length} results
          </span>
          <div>
            <button
              className="icon-btn bordered"
              aria-label="Previous page"
              disabled
            >
              <ChevronLeft size={16} />
            </button>
            <button className="page-current">1</button>
            <button
              className="icon-btn bordered"
              aria-label="Next page"
              disabled
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Panel>
    </>
  );
}
function TransactionDetails({ onNavigate }) {
  const { data } = useData();
  const id =
    new URLSearchParams(window.location.search).get("id") ||
    data.transactions[0]?.id;
  const transaction =
    data.transactions.find((item) => item.id === id) || data.transactions[0];
  const dealer = data.dealers.find((item) => item.id === transaction?.dealerId);
  if (!transaction)
    return (
      <Panel title="Transaction not found">
        <Button onClick={() => onNavigate("/transactions")}>
          Back to transactions
        </Button>
      </Panel>
    );
  return (
    <>
      <PageHeader
        eyebrow="Transactions"
        title={transaction.name}
        description="Transaction details and payment timeline."
        action={
          <div className="header-actions">
            <Button
              secondary
              onClick={() => onNavigate("/transactions")}
              icon={ChevronLeft}
            >
              Back
            </Button>
            <Button
              secondary
              onClick={() =>
                downloadCsv(
                  `${transaction.id}.csv`,
                  ["ID", "Name", "Date", "Amount", "Status"],
                  [
                    [
                      transaction.id,
                      transaction.name,
                      transaction.date,
                      money(transaction.amount),
                      transaction.status,
                    ],
                  ],
                )
              }
              icon={Download}
            >
              Export
            </Button>
          </div>
        }
      />
      <div className="detail-layout">
        <Panel title="Financial summary" className="detail-summary">
          <div className="detail-amount">
            <span>Total amount</span>
            <strong>{money(transaction.amount)}</strong>
            <Status>{transaction.status}</Status>
          </div>
          <div className="detail-grid">
            <Detail label="Transaction ID" value={transaction.id} />
            <Detail label="Transaction date" value={transaction.date} />
            <Detail label="Payment method" value={transaction.paymentMethod} />
            <Detail
              label="Brokerage rate"
              value={`${transaction.brokerageRate}%`}
            />
          </div>
        </Panel>
        <Panel title="Transaction flow">
          <div className="profile-card">
            <div className="dealer-avatar large">
              {dealer?.name.slice(0, 2)}
            </div>
            <div>
              <b>{dealer?.name}</b>
              <small>{dealer?.location}</small>
              <button
                className="link-btn"
                onClick={() => onNavigate("/dealer-profile?id=" + dealer?.id)}
              >
                View dealer profile <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          <div className="detail-grid single">
            <Detail
              label="Notes"
              value={transaction.notes || "No notes added"}
            />
          </div>
        </Panel>
        <Panel title="Payment timeline" className="items-panel">
          <div className="item-row">
            <div className="gem-icon">
              <Check size={18} />
            </div>
            <div>
              <b>{transaction.status}</b>
              <small>
                {transaction.date} Â· {transaction.paymentMethod}
              </small>
            </div>
            <strong>{money(transaction.amount)}</strong>
          </div>
        </Panel>
      </div>
    </>
  );
}
function Detail({ label, value }) {
  return (
    <div className="detail">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function NewTransaction({ onNavigate }) {
  const { data, addTransaction } = useData();
  const [form, setForm] = useState({
    name: "",
    date: "2024-09-03",
    amount: "",
    seller: "",
    buyer: "",
    brokerageRate: "5",
    paymentMethod: "Bank transfer",
    notes: "",
  });
  const [error, setError] = useState("");
  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  const submit = (event) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.]/g, ""));
    if (
      !form.name ||
      !form.date ||
      !form.amount ||
      !form.seller ||
      !form.buyer ||
      !amount
    )
      return setError("Complete the required fields with a valid amount.");
    const dealer =
      data.dealers.find((item) => item.name === form.seller) || data.dealers[0];
    const transaction = {
      id: nextId("TRX", data.transactions),
      name: form.name,
      date: form.date,
      amount,
      dealerId: dealer.id,
      brokerageRate: Number(form.brokerageRate) || 0,
      paymentMethod: form.paymentMethod,
      notes: form.notes,
      status: "Pending",
    };
    addTransaction(transaction);
    onNavigate("/transaction-details?id=" + transaction.id);
  };
  return (
    <>
      <PageHeader
        eyebrow="Transactions"
        title="New transaction"
        description="Add a new diamond transaction to your records."
      />
      <form className="grouped-form" onSubmit={submit}>
        <Panel title="Deal details" className="form-panel">
          <div className="form-grid">
            <label>
              Lot / transaction name
              <input
                name="name"
                value={form.name}
                onChange={set}
                placeholder="e.g. Mumbai Lot #102"
                required
              />
            </label>
            <label>
              Transaction date
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={set}
                required
              />
            </label>
            <label className="full">
              Total amount
              <input
                name="amount"
                value={form.amount}
                onChange={set}
                placeholder="â‚¹ 0.00"
                required
              />
            </label>
          </div>
        </Panel>
        <Panel title="Parties involved" className="form-panel">
          <div className="form-grid">
            <label>
              Seller
              <select name="seller" value={form.seller} onChange={set} required>
                <option value="">Select seller</option>
                {data.dealers.map((dealer) => (
                  <option key={dealer.id}>{dealer.name}</option>
                ))}
              </select>
            </label>
            <label>
              Buyer
              <select name="buyer" value={form.buyer} onChange={set} required>
                <option value="">Select buyer</option>
                <option>Diamond Broker</option>
              </select>
            </label>
          </div>
        </Panel>
        <Panel title="Brokerage" className="form-panel">
          <div className="form-grid">
            <label>
              Brokerage rate
              <input
                name="brokerageRate"
                value={form.brokerageRate}
                onChange={set}
                placeholder="5.00%"
              />
            </label>
            <label>
              Payment method
              <select
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={set}
              >
                <option>Bank transfer</option>
                <option>Credit card</option>
                <option>Cash</option>
              </select>
            </label>
            <label className="full">
              Notes
              <textarea
                name="notes"
                value={form.notes}
                onChange={set}
                placeholder="Add notes about this transaction"
              />
            </label>
          </div>
        </Panel>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <Button
            secondary
            onClick={() => onNavigate("/transactions")}
            icon={null}
          >
            Cancel
          </Button>
          <Button type="submit">Create transaction</Button>
        </div>
      </form>
    </>
  );
}
function DealerProfile({ onNavigate }) {
  const { data } = useData();
  const id =
    new URLSearchParams(window.location.search).get("id") || "dealer-abc";
  const dealer = data.dealers.find((item) => item.id === id) || data.dealers[0];
  const dealerTransactions = data.transactions.filter(
    (item) => item.dealerId === dealer.id,
  );
  return (
    <>
      <PageHeader
        eyebrow="Dealers"
        title={dealer.name}
        description="Dealer profile and transaction history."
        action={
          <Button
            secondary
            onClick={() =>
              downloadCsv(
                `${dealer.id}-transactions.csv`,
                ["ID", "Dealer", "Date", "Amount", "Status"],
                transactionRows({
                  ...data,
                  transactions: dealerTransactions,
                }).map((row) => row.slice(0, 5)),
              )
            }
            icon={Download}
          >
            Export history
          </Button>
        }
      />
      <Panel className="dealer-profile-head">
        <div className="profile-card">
          <div className="dealer-avatar profile">{dealer.name.slice(0, 2)}</div>
          <div>
            <h2>{dealer.name}</h2>
            <small>
              {dealer.location} Â· {dealer.contact}
            </small>
            <Status>{dealer.status}</Status>
          </div>
        </div>
        <button
          className="link-btn"
          onClick={() => onNavigate("/transactions")}
        >
          View all transactions <ArrowUpRight size={14} />
        </button>
      </Panel>
      <div className="stats-grid three">
        <Stat
          label="Total transactions"
          value={dealerTransactions.length}
          change="12.5%"
          icon={CreditCard}
        />
        <Stat
          label="Total volume"
          value={money(
            dealerTransactions.reduce((sum, item) => sum + item.amount, 0),
          )}
          change="8.2%"
          icon={CircleDollarSign}
        />
        <Stat
          label="Avg. transaction"
          value={money(
            dealerTransactions.length
              ? dealerTransactions.reduce((sum, item) => sum + item.amount, 0) /
                  dealerTransactions.length
              : 0,
          )}
          change="3.1%"
          icon={BarChart3}
        />
      </div>
      <Panel title="Transaction history">
        <TransactionTable
          rows={transactionRows({ ...data, transactions: dealerTransactions })}
          onRowClick={(id) => onNavigate("/transaction-details?id=" + id)}
        />
      </Panel>
    </>
  );
}
function DesktopDealers({ onNavigate }) {
  const { data } = useData();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const list = data.dealers.filter((dealer) =>
    `${dealer.name} ${dealer.location}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="Manage"
        title="Dealers"
        description="Manage your network of diamond dealers."
        action={
          <Button
            onClick={() =>
              setNotice(
                "Dealer invitations are available when a workspace email is connected.",
              )
            }
          >
            Invite dealer
          </Button>
        }
      />
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <div className="stats-grid three">
        <Stat
          label="Total dealers"
          value={data.dealers.length}
          change="6.4%"
          icon={Users}
        />
        <Stat
          label="Active dealers"
          value={data.dealers.filter((item) => item.status === "Active").length}
          change="4.6%"
          icon={Store}
        />
        <Stat
          label="Total volume"
          value={money(
            data.transactions.reduce((sum, item) => sum + item.amount, 0),
          )}
          change="14.8%"
          icon={CircleDollarSign}
        />
      </div>
      <Panel
        title="All dealers"
        action={
          <div className="panel-actions">
            <div className="search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dealers..."
              />
            </div>
            <button className="filter">
              <SlidersHorizontal size={15} /> Filters
            </button>
          </div>
        }
      >
        {list.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Dealer</th>
                  <th>Location</th>
                  <th>Transactions</th>
                  <th>Total volume</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((dealer) => {
                  const volume = data.transactions
                    .filter((item) => item.dealerId === dealer.id)
                    .reduce((sum, item) => sum + item.amount, 0);
                  return (
                    <tr
                      key={dealer.id}
                      onClick={() =>
                        onNavigate("/dealer-profile?id=" + dealer.id)
                      }
                      className="clickable-row"
                    >
                      <td>
                        <div className="table-person">
                          <div className="dealer-avatar">
                            {dealer.name.slice(0, 2)}
                          </div>
                          <b>{dealer.name}</b>
                        </div>
                      </td>
                      <td>{dealer.location}</td>
                      <td>
                        {
                          data.transactions.filter(
                            (item) => item.dealerId === dealer.id,
                          ).length
                        }
                      </td>
                      <td>
                        <b>{money(volume)}</b>
                      </td>
                      <td>
                        <Status>{dealer.status}</Status>
                      </td>
                      <td>
                        <button
                          className="icon-btn"
                          aria-label={`View actions for ${dealer.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onNavigate("/dealer-profile?id=" + dealer.id);
                          }}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Search size={20} />
            <b>No dealers found</b>
            <span>Try a different search term.</span>
          </div>
        )}
      </Panel>
    </>
  );
}
function MobilePaymentCards({ items }) {
  return <div className="mobile-data-list">{items.map(item => <div className="mobile-card-item" key={item.id}><div className="mobile-card-main"><div className="mobile-card-copy"><b>{item.title}</b><span>{item.subtitle}</span></div><div className="mobile-card-amount">{item.amount}</div></div><div className="mobile-card-meta"><span>{item.meta}</span><Status>{item.status}</Status></div></div>)}</div>;
}

function DesktopPayments() {
  const { data, addPayment } = useData();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    transactionId: data.transactions[0]?.id || "",
    amount: "",
    method: "Bank transfer",
  });
  const [error, setError] = useState("");
  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  const submit = (event) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(/[^0-9.]/g, ""));
    if (!form.transactionId || !amount)
      return setError("Select a transaction and enter a valid amount.");
    const transaction = data.transactions.find(
      (item) => item.id === form.transactionId,
    );
    addPayment({
      id: nextId("PAY", data.payments),
      transactionId: transaction.id,
      dealerId: transaction.dealerId,
      date: new Date().toISOString().slice(0, 10),
      amount,
      method: form.method,
      status: "Completed",
    });
    setOpen(false);
    setForm((previous) => ({ ...previous, amount: "" }));
    setError("");
  };
  const paymentItems = data.payments.map((payment) => {
    const dealer = data.dealers.find((item) => item.id === payment.dealerId);
    const transaction = data.transactions.find(
      (item) => item.id === payment.transactionId,
    );
    return {
      id: payment.id,
      title: transaction?.name || payment.transactionId,
      subtitle: dealer?.name || "Unknown dealer",
      meta: payment.date,
      amount: money(payment.amount),
      status: payment.status,
      details: [
        ["Payment ID", payment.id],
        ["Transaction", payment.transactionId],
        ["Dealer", dealer?.name],
        ["Method", payment.method],
        ["Date", payment.date],
        ["Amount", money(payment.amount)],
        ["Status", payment.status],
      ],
    };
  });
  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Review incoming and outgoing payments."
        action={
          <button
            type="button"
            className="button"
            onClick={() => setOpen(true)}
          >
            <Plus size={16} />
            Add payment
          </button>
        }
      />
      {open && (
        <form className="payment-form panel" onSubmit={submit}>
          <div className="panel-head">
            <h2>Add payment</h2>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
          </div>
          <div className="form-grid">
            <label>
              Transaction
              <select
                name="transactionId"
                value={form.transactionId}
                onChange={set}
              >
                {data.transactions.map((item) => (
                  <option key={item.id}>{item.id}</option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                name="amount"
                value={form.amount}
                onChange={set}
                placeholder="â‚¹ 0.00"
              />
            </label>
            <label>
              Payment method
              <select name="method" value={form.method} onChange={set}>
                <option>Bank transfer</option>
                <option>Cash</option>
                <option>Credit card</option>
              </select>
            </label>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button
              secondary
              type="button"
              onClick={() => setOpen(false)}
              icon={null}
            >
              Cancel
            </Button>
            <Button type="submit">Add payment</Button>
          </div>
        </form>
      )}
      <Panel
        title="Payment history"
        action={
          <button className="select">
            All payments <ChevronDown size={14} />
          </button>
        }
      >
        <div className="table-scroll desktop-data-table">
          <table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Dealer</th>
                <th>Method</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((payment) => {
                const dealer = data.dealers.find(
                  (item) => item.id === payment.dealerId,
                );
                return (
                  <tr key={payment.id}>
                    <td>
                      <b>{payment.id}</b>
                    </td>
                    <td>{dealer?.name}</td>
                    <td>{payment.method}</td>
                    <td>{payment.date}</td>
                    <td>
                      <b>{money(payment.amount)}</b>
                    </td>
                    <td>
                      <Status>{payment.status}</Status>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MobilePaymentCards items={paymentItems} />
      </Panel>
    </>
  );
}
function DesktopEarnings() {
  const { data } = useData();
  const total = data.transactions.reduce(
    (sum, item) => sum + (item.amount * item.brokerageRate) / 100,
    0,
  );
  const pending = data.transactions
    .filter((item) => item.status !== "Completed")
    .reduce((sum, item) => sum + (item.amount * item.brokerageRate) / 100, 0);
  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Earnings overview"
        description="Track your brokerage income and performance."
        action={
          <button className="select">
            <CalendarDays size={15} /> This month <ChevronDown size={14} />
          </button>
        }
      />
      <div className="earnings-support">
        <div className="panel support-card">
          <div>
            <span>Total earnings</span>
            <strong>{money(total)}</strong>
            <small>â†— Shared transaction data</small>
          </div>
          <div className="stat-icon">
            <CircleDollarSign size={17} />
          </div>
        </div>
        <div className="panel support-card">
          <div>
            <span>Pending earnings</span>
            <strong>{money(pending)}</strong>
            <small>
              {
                data.transactions.filter((item) => item.status !== "Completed")
                  .length
              }{" "}
              pending transactions
            </small>
          </div>
          <div className="stat-icon">
            <Wallet size={17} />
          </div>
        </div>
      </div>
      <Panel
        title="Earnings trend"
        action={
          <button className="select">
            This month <ChevronDown size={14} />
          </button>
        }
        className="revenue-panel large-chart"
      >
        <MiniChart />
      </Panel>
      <Panel title="Earnings breakdown" className="breakdown-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Dealer</th>
                <th>Date</th>
                <th>Gross amount</th>
                <th>Rate</th>
                <th>Earnings</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.slice(0, 10).map((item) => {
                const dealer = data.dealers.find(
                  (entry) => entry.id === item.dealerId,
                );
                return (
                  <tr key={item.id}>
                    <td>
                      <b>{item.id}</b>
                    </td>
                    <td>{dealer?.name}</td>
                    <td>{item.date}</td>
                    <td>{money(item.amount)}</td>
                    <td>{item.brokerageRate}%</td>
                    <td>
                      <b>{money((item.amount * item.brokerageRate) / 100)}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
function Reports() {
  const { data } = useData();
  const sales = data.transactions.reduce((sum, item) => sum + item.amount, 0);
  const pending = data.transactions
    .filter((item) => item.status !== "Completed")
    .reduce((sum, item) => sum + item.amount, 0);
  const earnings = data.transactions.reduce(
    (sum, item) => sum + (item.amount * item.brokerageRate) / 100,
    0,
  );
  const completed = data.transactions.filter(
    (item) => item.status === "Completed",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Reports"
        description="Understand your business performance across sales, activity and dealer results."
        action={
          <Button
            onClick={() =>
              downloadCsv(
                "diamond-finance-report.csv",
                ["Metric", "Value"],
                [
                  ["Total revenue", money(sales)],
                  ["Pending payments", money(pending)],
                  ["Net earnings", money(earnings)],
                ],
              )
            }
            icon={Download}
          >
            Export report
          </Button>
        }
      />
      <div className="report-summary">
        <div className="stat">
          <span className="stat-top">Total revenue</span>
          <strong>{money(sales)}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Transactions</span>
          <strong>{data.transactions.length}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Average transaction</span>
          <strong>
            {money(sales / Math.max(data.transactions.length, 1))}
          </strong>
        </div>
        <div className="stat">
          <span className="stat-top">Pending payments</span>
          <strong>{money(pending)}</strong>
        </div>
      </div>
      <div className="report-layout">
        <Panel title="Revenue trend" className="report-panel">
          <div className="report-card-body">
            <MiniChart />
          </div>
        </Panel>
        <Panel title="Transaction activity" className="report-panel">
          <div className="report-activity-list">
            <div>
              <span>Completed</span>
              <strong>{completed}</strong>
              <small>
                {data.transactions.length
                  ? Math.round((completed / data.transactions.length) * 100)
                  : 0}
                % of all transactions
              </small>
            </div>
            <div>
              <span>Pending</span>
              <strong>
                {
                  data.transactions.filter((item) => item.status === "Pending")
                    .length
                }
              </strong>
              <small>{money(pending)}</small>
            </div>
            <div>
              <span>Processing</span>
              <strong>
                {
                  data.transactions.filter(
                    (item) => item.status === "Processing",
                  ).length
                }
              </strong>
              <small>Awaiting review</small>
            </div>
          </div>
        </Panel>
        <Panel
          title="Dealer performance"
          className="report-panel full-width-panel"
        >
          <div className="dealer-rankings">
            {data.dealers.map((dealer, index) => {
              const volume = data.transactions
                .filter((item) => item.dealerId === dealer.id)
                .reduce((sum, item) => sum + item.amount, 0);
              return (
                <div className="dealer-rank-row" key={dealer.id}>
                  <div className="dealer-rank-badge">#{index + 1}</div>
                  <div className="dealer-rank-copy">
                    <strong>{dealer.name}</strong>
                    <small>{dealer.location}</small>
                  </div>
                  <div className="dealer-rank-value">
                    <b>{money(volume)}</b>
                    <span>
                      {
                        data.transactions.filter(
                          (item) => item.dealerId === dealer.id,
                        ).length
                      }{" "}
                      transactions
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Dealers({ onNavigate }) {
  const { data } = useData();
  const [query, setQuery] = useState("");
  const list = data.dealers.filter((dealer) =>
    `${dealer.name} ${dealer.location}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const items = list.map((dealer) => {
    const records = data.transactions.filter(
      (item) => item.dealerId === dealer.id,
    );
    const volume = records.reduce((sum, item) => sum + item.amount, 0);
    return {
      id: dealer.id,
      title: dealer.name,
      subtitle: dealer.location,
      meta: `${records.length} transactions`,
      amount: money(volume),
      status: dealer.status,
    };
  });
  return (
    <>
      <div className="desktop-dealers">
        <DesktopDealers onNavigate={onNavigate} />
      </div>
      <div className="mobile-dealers">
        <PageHeader
          eyebrow="Manage"
          title="Dealers"
          description="Manage your network of diamond dealers."
        />
        <Panel
          title="All dealers"
          action={
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search dealers..."
            />
          }
        >
          <div className="mobile-card-list">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="mobile-card-item"
                onClick={() => onNavigate("/dealer-profile?id=" + item.id)}
              >
                <div className="mobile-card-main">
                  <div className="mobile-card-copy">
                    <b>{item.title}</b>
                    <span>{item.subtitle}</span>
                  </div>
                  <div className="mobile-card-amount">{item.amount}</div>
                </div>
                <div className="mobile-card-meta">
                  <span>{item.meta}</span>
                  <Status>{item.status}</Status>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
function Payments({ onNavigate }) {
  return (
    <>
      <div className="desktop-payments">
        <DesktopPayments />
      </div>
      <div className="mobile-payments">
        <MobilePayments onNavigate={onNavigate} />
      </div>
    </>
  );
}
function MobilePayments({ onNavigate }) {
  const { data } = useData();
  const items = data.payments.map((payment) => {
    const dealer = data.dealers.find((item) => item.id === payment.dealerId);
    const transaction = data.transactions.find(
      (item) => item.id === payment.transactionId,
    );
    return {
      id: payment.id,
      title: transaction?.name || payment.transactionId,
      subtitle: dealer?.name || "Unknown dealer",
      amount: money(payment.amount),
      meta: payment.date,
      status: payment.status,
      transactionId: transaction?.id || payment.transactionId,
    };
  });
  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Payments"
        description="Review incoming and outgoing payments."
      />
      <Panel title="Payment history">
        <div className="mobile-card-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="mobile-card-item"
              onClick={() =>
                onNavigate("/transaction-details?id=" + item.transactionId)
              }
            >
              <div className="mobile-card-main">
                <div className="mobile-card-copy">
                  <b>{item.title}</b>
                  <span>{item.subtitle}</span>
                </div>
                <div className="mobile-card-amount">{item.amount}</div>
              </div>
              <div className="mobile-card-meta">
                <span>{item.meta}</span>
                <Status>{item.status}</Status>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
function Earnings() {
  return (
    <>
      <div className="desktop-earnings">
        <DesktopEarnings />
      </div>
      <div className="mobile-earnings">
        <MobileEarnings />
      </div>
    </>
  );
}
function MobileEarnings() {
  const { data } = useData();
  const total = data.transactions.reduce(
    (sum, item) => sum + (item.amount * item.brokerageRate) / 100,
    0,
  );
  const pending = data.transactions
    .filter((item) => item.status !== "Completed")
    .reduce((sum, item) => sum + (item.amount * item.brokerageRate) / 100, 0);
  const items = data.transactions.map((item) => {
    const dealer = data.dealers.find((entry) => entry.id === item.dealerId);
    return {
      id: item.id,
      title: dealer?.name || "Unknown dealer",
      amount: money((item.amount * item.brokerageRate) / 100),
    };
  });
  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Earnings overview"
        description="Track your brokerage income and performance."
      />
      <div className="earnings-support">
        <div className="panel support-card">
          <div>
            <span>Total earnings</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="stat-icon">
            <CircleDollarSign size={17} />
          </div>
        </div>
        <div className="panel support-card">
          <div>
            <span>Pending earnings</span>
            <strong>{money(pending)}</strong>
          </div>
          <div className="stat-icon">
            <Wallet size={17} />
          </div>
        </div>
      </div>
      <Panel title="Earnings trend" className="revenue-panel">
        <MiniChart />
      </Panel>
      <Panel title="Earnings breakdown">
        <div className="mobile-card-list simple-list">
          {items.map((item) => (
            <div key={item.id} className="mobile-card-item simple-item">
              <div className="mobile-card-copy">
                <b>{item.title}</b>
              </div>
              <div className="mobile-card-amount">{item.amount}</div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage your account, business details and operating preferences."
        action={<Button>Save changes</Button>}
      />

      <div className="settings-page">
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Account</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Full name</span>
              <input defaultValue="Jordan Davis" />
              <small>Used across your finance workspace.</small>
            </label>
            <label className="settings-field">
              <span>Business email</span>
              <input defaultValue="jordan@diamond.com" />
              <small>Primary contact for alerts and exports.</small>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Business</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Business name</span>
              <input defaultValue="Diamond Broker" />
              <small>Displayed on reports and exports.</small>
            </label>
            <label className="settings-field">
              <span>Default currency</span>
              <select defaultValue="INR">
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
              </select>
              <small>Used for all new transactions.</small>
            </label>
            <label className="settings-field full-width-field">
              <span>Business address</span>
              <input defaultValue="Bandra West, Mumbai, India" />
              <small>Optional detail for dealer records.</small>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Notifications</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-toggle">
              <div>
                <span>Payment reminders</span>
                <small>Notify me when a payment or payout is pending.</small>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
            <label className="settings-toggle">
              <div>
                <span>Transaction alerts</span>
                <small>
                  Alert me when new activity is added to the workspace.
                </small>
              </div>
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Preferences</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Time zone</span>
              <select defaultValue="Asia/Kolkata">
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="America/New_York">America/New_York</option>
              </select>
              <small>Controls date display in the dashboard.</small>
            </label>
            <label className="settings-field">
              <span>Default view</span>
              <select defaultValue="Dashboard">
                <option>Dashboard</option>
                <option>Transactions</option>
                <option>Reports</option>
              </select>
              <small>Opened after login for the workspace.</small>
            </label>
          </div>
        </section>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
