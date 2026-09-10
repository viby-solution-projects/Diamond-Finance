import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileBarChart,
  Gem,
  Grid2X2,
  Menu,
  Plus,
  Search,
  Settings,
  Store,
  Users,
  Wallet,
  X,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeft,
  Download,
  Check,
  CalendarDays,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import "./styles.css";
import {
  supabase,
  authSignIn,
  authSignOut,
  authGetSession,
  authResetPasswordForEmail,
  authUpdatePassword,
  updateProfile,
} from "./data/supabaseClient";
import {
  dealerTypeLabel,
  supabaseRepository,
  loadSettings,
  money,
  formatChartAmount,
  calculateAnalytics,
  nextId,
  saveSettings,
  transactionRows,
} from "./data/repository";

const navItems = [
  { label: "Dashboard", icon: Grid2X2, path: "/" },
  { label: "Deals", icon: CircleDollarSign, path: "/transactions" },
  { label: "Dealers", icon: Users, path: "/dealers" },
  { label: "Payments", icon: CreditCard, path: "/payments" },
  { label: "Analytics", icon: FileBarChart, path: "/analytics" },
  { label: "Bookkeeping", icon: Wallet, path: "/bookkeeping" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

const DataContext = createContext(null);
function useData() {
  return useContext(DataContext);
}

function routeName() {
  const path = window.location.pathname;
  if (path === "/login") return "Login";
  if (path === "/" || path === "") return "Dashboard";
  if (path === "/transactions" || path === "/deals") return "Deals";
  if (path === "/transaction-details" || path === "/deal-details") return "Deal Details";
  if (path === "/new-transaction" || path === "/new-deal") return "New Deal";
  if (path === "/dealers") return "Dealers";
  if (path === "/dealer-profile") return "Dealer Profile";
  if (path === "/payments") return "Payments";
  if (path === "/analytics" || path === "/reports" || path === "/earnings") return "Analytics";
  if (path === "/bookkeeping") return "Bookkeeping";
  if (path === "/settings") return "Settings";
  if (path === "/profile") return "Profile";

  return path
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

function formatIndianNumber(value) {
  if (value === "" || value == null) return "";
  const clean = String(value).replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  const intPart = parts[0];
  const decPart = parts.length > 1 ? "." + parts.slice(1).join("") : "";
  if (!intPart) return decPart ? "0" + decPart : "";
  const formattedInt = Number(intPart).toLocaleString("en-IN");
  return formattedInt + decPart;
}

function App() {
  const [current, setCurrent] = useState(routeName());
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(null);
  const [data, setData] = useState({ transactions: [], dealers: [], payments: [], bookkeeping: [] });
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const profileMenuRef = useRef(null);

  const supabaseRepo = supabaseRepository();

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrent(routeName());
    };
    window.addEventListener("popstate", handleLocationChange);
    return () => window.removeEventListener("popstate", handleLocationChange);
  }, []);

  useEffect(() => {
    let authSubscription = null;

    authGetSession().then((session) => {
      if (session?.user) {
        setUser(session.user);
        setProfile(session.profile);
      } else {
        setUser(null);
        setProfile(null);
      }
      setAuthLoading(false);
    });

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_OUT" || !session?.user) {
          setUser(null);
          setProfile(null);
          setData({ transactions: [], dealers: [], payments: [], bookkeeping: [] });
          if (window.location.pathname !== "/login") {
            navigate("/login");
          }
        } else if (session?.user) {
          setUser(session.user);
          const restored = await authGetSession();
          if (restored?.profile) {
            setProfile(restored.profile);
          }
        }
      });
      authSubscription = subscription;
    }

    return () => {
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    if (!user) return;
    setDataLoading(true);
    setDataError("");
    try {
      const remoteData = await supabaseRepo.loadAll();
      if (remoteData) {
        setData(remoteData);
      }
    } catch (err) {
      console.error("Data load failed:", err);
      setDataError(err?.message || "Unable to load finance data. Please try again.");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    } else {
      setData({ transactions: [], dealers: [], payments: [], bookkeeping: [] });
    }
  }, [user?.id]);

  const handleLogout = async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
    setData({ transactions: [], dealers: [], payments: [], bookkeeping: [] });
    setMenu(null);
    navigate("/login");
  };

  const handleLoginSuccess = ({ user: authenticatedUser, profile: userProfile }) => {
    setUser(authenticatedUser);
    setProfile(userProfile);
    navigate("/");
  };

  const addTransaction = async (transaction) => {
    try {
      await supabaseRepo.insertTransaction(transaction);
      setData((prev) => ({
        ...prev,
        transactions: [transaction, ...prev.transactions],
      }));
    } catch (err) {
      console.error("addTransaction error:", err);
      alert(err.message || "Failed to create deal.");
      throw err;
    }
  };

  const updateTransaction = async (id, updated) => {
    try {
      await supabaseRepo.updateTransaction(id, updated);
      setData((prev) => ({
        ...prev,
        transactions: prev.transactions.map((t) =>
          t.id === id ? { ...t, ...updated } : t
        ),
      }));
    } catch (err) {
      console.error("updateTransaction error:", err);
      alert(err.message || "Failed to update deal.");
      throw err;
    }
  };

  const deleteTransaction = async (id) => {
    try {
      await supabaseRepo.deleteTransaction(id);
      setData((prev) => ({
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
        payments: prev.payments.filter((p) => p.transactionId !== id),
      }));
      return { success: true };
    } catch (err) {
      console.error("deleteTransaction error:", err);
      return { success: false, reason: err.message || "Failed to delete deal." };
    }
  };

  const addPayment = async (payment) => {
    try {
      await supabaseRepo.insertPayment(payment);
      setData((prev) => ({
        ...prev,
        payments: [payment, ...prev.payments],
      }));
    } catch (err) {
      console.error("addPayment error:", err);
      throw err;
    }
  };

  const addBookkeepingEntry = async (entry) => {
    await supabaseRepo.insertBookkeepingEntry(entry);
    setData((prev) => ({ ...prev, bookkeeping: [entry, ...(prev.bookkeeping || [])] }));
  };

  const updateBookkeepingEntry = async (id, updated) => {
    await supabaseRepo.updateBookkeepingEntry(id, updated);
    setData((prev) => ({
      ...prev,
      bookkeeping: (prev.bookkeeping || []).map((entry) => entry.id === id ? { ...entry, ...updated } : entry),
    }));
  };

  const deleteBookkeepingEntry = async (id) => {
    await supabaseRepo.deleteBookkeepingEntry(id);
    setData((prev) => ({ ...prev, bookkeeping: (prev.bookkeeping || []).filter((entry) => entry.id !== id) }));
  };

  const addDealer = async (dealer) => {
    const id = nextId("dealer", data.dealers);
    const item = {
      id,
      name: dealer.name.trim(),
      location: dealer.location.trim(),
      type: (dealer.type || "both").toLowerCase(),
      phone: (dealer.phone || "").trim(),
      email: (dealer.email || "").trim(),
      contact: (dealer.contact || dealer.name).trim(),
      status: dealer.status || "Active",
    };
    try {
      await supabaseRepo.insertDealer(item);
      setData((prev) => ({
        ...prev,
        dealers: [...prev.dealers, item],
      }));
      return item;
    } catch (err) {
      console.error("addDealer error:", err);
      alert(err.message || "Failed to add dealer.");
      throw err;
    }
  };

  const updateDealer = async (id, updated) => {
    const cleanUpdated = {
      ...updated,
      name: updated.name !== undefined ? updated.name.trim() : undefined,
      location: updated.location !== undefined ? updated.location.trim() : undefined,
      type: updated.type !== undefined ? (updated.type || "both").toLowerCase() : undefined,
      phone: updated.phone !== undefined ? updated.phone.trim() : undefined,
      email: updated.email !== undefined ? updated.email.trim() : undefined,
      contact: updated.contact !== undefined ? updated.contact.trim() : (updated.name ? updated.name.trim() : undefined),
      status: updated.status,
    };
    try {
      await supabaseRepo.updateDealer(id, cleanUpdated);
      setData((prev) => ({
        ...prev,
        dealers: prev.dealers.map((d) =>
          d.id === id ? { ...d, ...cleanUpdated } : d
        ),
      }));
    } catch (err) {
      console.error("updateDealer error:", err);
      alert(err.message || "Failed to update dealer.");
      throw err;
    }
  };

  const deleteDealer = async (id) => {
    const isUsed =
      data.transactions.some(
        (t) => t.dealerId === id || t.sellerId === id || t.buyerId === id
      ) || data.payments.some((p) => p.dealerId === id);

    if (isUsed) {
      return {
        success: false,
        reason: "This dealer is linked to an existing deal or payment record.",
      };
    }
    try {
      await supabaseRepo.deleteDealer(id);
      setData((prev) => ({
        ...prev,
        dealers: prev.dealers.filter((d) => d.id !== id),
      }));
      return { success: true };
    } catch (err) {
      console.error("deleteDealer error:", err);
      return { success: false, reason: err.message || "Failed to delete dealer." };
    }
  };

  useEffect(() => {
    const escape = (event) => {
      if (event.key === "Escape") {
        setDrawer(false);
        setMenu(null);
      }
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  useEffect(() => {
    if (menu !== "profile") return undefined;
    const handleOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setMenu(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menu]);

  const go = (path) => {
    navigate(path);
    setDrawer(false);
    setMenu(null);
  };

  if (authLoading) {
    return (
      <div className="login-shell">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "var(--muted)", fontSize: "13px" }}>
          <div className="brand-mark" style={{ width: "40px", height: "40px", borderRadius: "10px" }}>
            <Gem size={22} />
          </div>
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!user || current === "Login") {
    if (window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
    }
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (window.location.pathname === "/login") {
    window.history.replaceState({}, "", "/");
  }

  const userName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "User");
  const userInitials = (userName || "U")
    .split(/\s+|@/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <DataContext.Provider
      value={{
        data,
        user,
        profile,
        setProfile,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addPayment,
        addBookkeepingEntry,
        updateBookkeepingEntry,
        deleteBookkeepingEntry,
        addDealer,
        updateDealer,
        deleteDealer,
        dataLoading,
        dataError,
        refreshData: loadData,
      }}
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
            <div
              className="mobile-brand"
              onClick={() => go("/")}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go("/")}
            >
              <div className="brand-mark">
                <Gem size={16} />
              </div>
              <span>Diamond Finance</span>
            </div>
            <div className="crumb">
              <button
                type="button"
                className="crumb-btn"
                onClick={() => go("/")}
              >
                Workspace
              </button>
              <ChevronRight size={14} />
              {current === "Deal Details" || current === "New Deal" ? (
                <>
                  <button
                    type="button"
                    className="crumb-btn"
                    onClick={() => go("/transactions")}
                  >
                    Deals
                  </button>
                  <ChevronRight size={14} />
                </>
              ) : current === "Dealer Profile" ? (
                <>
                  <button
                    type="button"
                    className="crumb-btn"
                    onClick={() => go("/dealers")}
                  >
                    Dealers
                  </button>
                  <ChevronRight size={14} />
                </>
              ) : null}
              <strong>{current}</strong>
            </div>
            <div className="top-actions" ref={profileMenuRef}>
              <button
                className="avatar"
                aria-label="Open profile"
                onClick={() => setMenu(menu === "profile" ? null : "profile")}
              >
                {userInitials}
              </button>
              <button
                className="profile-name"
                onClick={() => setMenu(menu === "profile" ? null : "profile")}
              >
                {userName} <ChevronDown size={14} />
              </button>
              {menu === "profile" && (
                <div className="top-menu">
                  <b>{userName}</b>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>{user?.email}</span>
                  <button onClick={() => go("/profile")}>
                    Account / Profile
                  </button>
                  <button onClick={() => go("/settings")}>Settings</button>
                  <button onClick={handleLogout}>Log out</button>
                </div>
              )}
            </div>
          </header>
          <div
            className={
              "content page-" + current.toLowerCase().replaceAll(" ", "-")
            }
          >
            {dataError && (
              <div className="login-error-banner" style={{ marginBottom: "18px", justifyContent: "space-between" }} role="alert">
                <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  <AlertCircle size={16} />
                  <span>{dataError}</span>
                </div>
                <button
                  type="button"
                  className="button"
                  style={{ height: "30px", fontSize: "11.5px", padding: "0 10px" }}
                  onClick={loadData}
                >
                  Retry
                </button>
              </div>
            )}
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
        <div
          className="brand"
          onClick={() => onNavigate("/")}
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && onNavigate("/")
          }
        >
          <div className="brand-mark">
            <Gem size={20} />
          </div>
          <span>Diamond Finance</span>
          <button
            className="icon-btn close-menu"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-identity">
          <div className="workspace-icon">DB</div>
          <div>
            <b>Diamond Broker</b>
            <small>Finance workspace</small>
          </div>
        </div>
        <nav>
          <small className="nav-label">MAIN MENU</small>
          {navItems.map((item) => {
            const Icon = item.icon;
            const related =
              (item.label === "Deals" &&
                ["Deals", "Deal Details", "New Deal", "Transactions", "Transaction Details", "New Transaction"].includes(current)) ||
              (item.label === "Dealers" && current === "Dealer Profile") ||
              (item.label === "Analytics" && ["Reports", "Earnings"].includes(current));
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
      </aside>
    </>
  );
}

function Page({ current, onNavigate }) {
  if (current === "Dashboard") return <Dashboard onNavigate={onNavigate} />;
  if (current === "Deals" || current === "Transactions")
    return <Deals onNavigate={onNavigate} />;
  if (current === "Deal Details" || current === "Transaction Details")
    return <DealDetails onNavigate={onNavigate} />;
  if (current === "New Deal" || current === "New Transaction")
    return <NewDeal onNavigate={onNavigate} />;
  if (current === "Dealer Profile")
    return <DealerProfile onNavigate={onNavigate} />;
  if (current === "Dealers") return <Dealers onNavigate={onNavigate} />;
  if (current === "Payments") return <Payments onNavigate={onNavigate} />;
  if (current === "Analytics" || current === "Reports" || current === "Earnings")
    return <Analytics onNavigate={onNavigate} />;
  if (current === "Bookkeeping") return <Bookkeeping onNavigate={onNavigate} />;
  if (current === "Settings") return <SettingsPage onNavigate={onNavigate} />;
  if (current === "Profile") return <ProfilePage onNavigate={onNavigate} />;
  return <Deals onNavigate={onNavigate} />;
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
  backTo,
  backLabel,
  onNavigate,
}) {
  return (
    <div className="page-header">
      <div>
        {backTo && onNavigate && (
          <button
            type="button"
            className="back-link"
            onClick={() => onNavigate(backTo)}
            aria-label={backLabel || "Back to Dashboard"}
          >
            <ChevronLeft size={14} />
            <span>{backLabel || "Back to Dashboard"}</span>
          </button>
        )}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
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
  const norm = String(children || "").toLowerCase().replace(/\s+/g, "-");
  return (
    <span className={"status " + norm}>
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
      {change ? (
        <small className={positive ? "up" : "down"}>
          {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {change} <em>vs last month</em>
        </small>
      ) : null}
    </div>
  );
}

function DynamicBarChart({ chartData, yTicks = [] }) {
  if (!chartData || !chartData.length) return null;

  return (
    <div className="chart">
      <div className="chart-y">
        {yTicks.map((value, idx) => (
          <span key={idx}>{formatChartAmount(value)}</span>
        ))}
      </div>
      <div className="chart-area bar-chart">
        <div className="grid-lines">
          {yTicks.slice(0, 5).map((_, i) => (
            <i key={i} />
          ))}
        </div>
        <div className="bars" aria-label="Revenue bar chart">
          {chartData.map((item, index) => (
            <span
              className={index === chartData.length - 1 ? "current" : ""}
              style={{ height: `${item.heightPercent}%` }}
              title={`${item.label}\nRevenue: ${money(item.value)}\nDeals: ${item.transactions || 0}`}
              aria-label={`${item.label} Revenue ${money(item.value)}`}
              key={item.label}
            />
          ))}
        </div>
        <div className="chart-x">
          {chartData.map((item) => (
            <span key={item.label}>{item.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniChart({ transactions, payments, period = "Monthly", monthCount = 6 }) {
  const { data } = useData();
  const trx = transactions && transactions.length ? transactions : (data?.transactions || []);
  const pay = payments && payments.length ? payments : (data?.payments || []);
  const analytics = calculateAnalytics(trx, pay, period, monthCount);

  return <DynamicBarChart chartData={analytics.chartData} yTicks={analytics.yTicks} />;
}

function Dashboard({ onNavigate }) {
  const { data, user, profile } = useData();
  const [revenueRange, setRevenueRange] = useState("6");
  const userName = profile?.full_name || user?.user_metadata?.full_name || (user?.email ? user.email.split("@")[0] : "User");
  const greetingName = (userName || "User").split(" ")[0] || "User";
  const revenue = data.transactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
  
  // Calculate real pending amount from deals with pending payments
  const totalPaidSum = data.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalRemainingSum = Math.max(0, revenue - totalPaidSum);

  const active = data.dealers.filter((item) => item.status === "Active").length;
  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good day, ${greetingName}`}
        description="Here's what's happening with your business today."
        action={
          <Button onClick={() => onNavigate("/new-transaction")}>
            New deal
          </Button>
        }
      />
      <div className="stats-grid">
        <Stat
          label="Total volume"
          value={money(revenue)}
          change="12.5%"
          icon={CircleDollarSign}
        />
        <Stat
          label="Total deals"
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
          value={money(totalRemainingSum)}
          change="2.4%"
          positive={false}
          icon={Wallet}
        />
      </div>
      <div className="dashboard-grid revenue-grid">
        <Panel
          title="Revenue overview"
          action={
            <select
              className="select"
              aria-label="Revenue range"
              value={revenueRange}
              onChange={(event) => setRevenueRange(event.target.value)}
            >
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="9">Last 9 months</option>
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
          <MiniChart period="Monthly" monthCount={Number(revenueRange)} />
        </Panel>
      </div>
      <div className="dashboard-grid bottom-grid">
        <Panel
          title="Recent deals"
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
          <DealTable
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
                      .filter((item) => item.dealerId === dealer.id || item.sellerId === dealer.id)
                      .reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0),
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

function DealTable({ rows, onRowClick }) {
  if (!rows.length)
    return (
      <div className="empty-state">
        <Search size={20} />
        <b>No deals found</b>
        <span>Try clearing your search or filters.</span>
      </div>
    );
  return (
    <>
      <div className="table-scroll desktop-data-table">
        <table>
          <thead>
            <tr>
              <th>Deal</th>
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
                  (event.key === "Enter" || event.key === " ") &&
                  onRowClick?.(row[0])
                }
                role={onRowClick ? "button" : undefined}
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

function AddDealPaymentModal({ open, onClose, deal, onPaymentSaved }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank Transfer");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && deal) {
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setMethod("Bank Transfer");
      setError("");
      setSubmitting(false);
    }
  }, [open, deal]);

  if (!open || !deal) return null;

  const dealName = deal.deal?.name || deal.name || "Deal";
  const remaining = Number(deal.remaining) || 0;
  const numAmount = Number(String(amount).replace(/,/g, "")) || 0;

  const handleAmountChange = (event) => {
    const raw = event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    setAmount(raw ? formatIndianNumber(raw) : "");
    const parsed = Number(raw) || 0;
    if (parsed > remaining) {
      setError("Payment cannot be more than the remaining amount.");
    } else if (parsed <= 0 && raw !== "") {
      setError("Enter a valid payment amount.");
    } else {
      setError("");
    }
  };

  const isInvalid = !numAmount || numAmount <= 0 || numAmount > remaining;

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!numAmount || numAmount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    if (numAmount > remaining) {
      setError("Payment cannot be more than the remaining amount.");
      return;
    }

    try {
      setSubmitting(true);
      await onPaymentSaved({
        transactionId: deal.deal?.id || deal.id,
        dealerId: deal.deal?.dealerId || deal.deal?.sellerId || deal.dealerId || deal.sellerId || null,
        amount: numAmount,
        date: date || new Date().toISOString().slice(0, 10),
        method: method || "Bank Transfer",
      });
      onClose();
    } catch (err) {
      console.error("Payment save error:", err);
      setError(err?.message || "Failed to save payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="payment-sheet-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="payment-sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="payment-sheet-header">
          <button type="button" className="payment-back-btn" onClick={onClose} aria-label="Go back">
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <h3 className="payment-sheet-title">Add Payment</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div className="payment-sheet-body">
            <div className="payment-deal-info">
              <span className="payment-deal-label">Deal</span>
              <div className="payment-deal-name">{dealName}</div>
            </div>

            <div className="payment-remaining-card">
              <span className="payment-remaining-label">Remaining amount</span>
              <div className="payment-remaining-val">{money(remaining)}</div>
            </div>

            <div className="payment-field-group">
              <label htmlFor="payment-amount-input" className="payment-field-label">
                Payment amount
              </label>
              <div className={`payment-amount-input-box ${error ? "has-error" : ""}`}>
                <span className="payment-currency-sym">₹</span>
                <input
                  id="payment-amount-input"
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="0"
                  autoFocus
                  required
                  className="payment-amount-input"
                />
              </div>
              <div className="payment-amount-helper">Maximum {money(remaining)}</div>
              {error && (
                <div className="payment-inline-error" role="alert">
                  {error}
                </div>
              )}
            </div>

            <div className="payment-field-group">
              <label htmlFor="payment-method-select" className="payment-field-label">
                Payment method
              </label>
              <select
                id="payment-method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="payment-control-input"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="payment-field-group">
              <label htmlFor="payment-date-input" className="payment-field-label">
                Payment date
              </label>
              <input
                id="payment-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="payment-control-input"
              />
            </div>
          </div>

          <div className="payment-sheet-actions">
            <button
              type="submit"
              className="payment-submit-btn"
              disabled={isInvalid || submitting}
            >
              {submitting ? "Saving..." : "Save Payment"}
            </button>
            <button
              type="button"
              className="payment-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Deals({ onNavigate }) {
  const { data, addPayment } = useData();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [selectedDealForPayment, setSelectedDealForPayment] = useState(null);

  const dealItems = (data.transactions || []).map((deal) => {
    const dealer = (data.dealers || []).find(
      (entry) => entry.id === (deal.dealerId || deal.sellerId)
    );
    const payments = (data.payments || []).filter((p) => p.transactionId === deal.id);
    const original = Number(deal.totalRate || deal.amount) || 0;
    const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = Math.max(0, original - paid);
    const paymentStatus = paid <= 0 ? "Pending" : remaining <= 0 ? "Paid" : "Partially Paid";
    const formattedDate = new Date(deal.date).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

    return {
      deal,
      dealer,
      payments,
      original,
      paid,
      remaining,
      status: paymentStatus,
      formattedDate,
    };
  });

  const filteredDeals = dealItems.filter((item) => {
    const searchTarget = `${item.deal.id} ${item.deal.name} ${item.dealer?.name || ""}`.toLowerCase();
    const matchesQuery = !query || searchTarget.includes(query.toLowerCase());
    const matchesStatus = status === "All" || item.status === status;
    return matchesQuery && matchesStatus;
  });

  const openDetails = (id) => onNavigate("/transaction-details?id=" + id);

  const handleSavePayment = async ({ transactionId, dealerId, amount, date, method }) => {
    const newPayment = {
      id: nextId("PAY", data.payments),
      transactionId,
      dealerId,
      date,
      amount,
      method,
      status: "Completed",
      notes: "",
    };

    await addPayment(newPayment);
  };

  const exportRows = filteredDeals.map((item) => [
    item.deal.id,
    item.deal.name,
    item.dealer?.name || "Unknown dealer",
    item.formattedDate,
    money(item.original),
    money(item.paid),
    money(item.remaining),
    item.status,
  ]);

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Manage"
        title="Deals"
        description="Track and manage all your diamond deals."
        action={
          <Button onClick={() => onNavigate("/new-transaction")}>
            New deal
          </Button>
        }
      />
      <Panel
        title="All deals"
        action={
          <div className="panel-actions">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search deals..."
            />
            <select
              className="filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter deal status"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
            <button
              className="icon-btn bordered"
              aria-label="Export deals"
              onClick={() =>
                downloadCsv(
                  "deals.csv",
                  ["Deal ID", "Name", "Dealer", "Date", "Original Amount", "Paid", "Remaining", "Status"],
                  exportRows,
                )
              }
            >
              <Download size={16} />
            </button>
          </div>
        }
      >
        {!filteredDeals.length ? (
          <div className="empty-state">
            <Search size={20} />
            <b>No deals found</b>
            <span>Try clearing your search or filters.</span>
          </div>
        ) : (
          <>
            <div className="table-scroll desktop-data-table">
              <table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Dealer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Paid / Remaining</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((item) => (
                    <tr
                      key={item.deal.id}
                      onClick={() => openDetails(item.deal.id)}
                      className="clickable-row"
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <b>{item.deal.name}</b>
                        <small className="table-id">{item.deal.id}</small>
                      </td>
                      <td>{item.dealer?.name || "Unknown dealer"}</td>
                      <td>{item.formattedDate}</td>
                      <td>
                        <b>{money(item.original)}</b>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontSize: "11px", color: "var(--green)", fontWeight: 600 }}>
                            Paid {money(item.paid)}
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              color: item.remaining > 0 ? "var(--ink)" : "var(--muted)",
                              fontWeight: item.remaining > 0 ? 600 : 400,
                            }}
                          >
                            Remaining {money(item.remaining)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Status>{item.status}</Status>
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        {item.remaining > 0 ? (
                          <button
                            type="button"
                            className="btn-action-primary"
                            onClick={() => setSelectedDealForPayment(item)}
                          >
                            <Plus size={13} />
                            Add Payment
                          </button>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              color: "var(--green)",
                              padding: "4px 8px",
                              borderRadius: "5px",
                              background: "var(--green-soft)",
                            }}
                          >
                            <Check size={13} /> Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-data-list">
              {filteredDeals.map((item) => (
                <div
                  key={item.deal.id}
                  className="mobile-card-item"
                  onClick={() => openDetails(item.deal.id)}
                >
                  <div className="mobile-card-main">
                    <div className="mobile-card-copy">
                      <b>{item.deal.name}</b>
                      <span>{item.dealer?.name || "Unknown dealer"} • {item.formattedDate}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      <div className="mobile-card-amount">{money(item.original)}</div>
                      <Status>{item.status}</Status>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "8px",
                      padding: "8px 10px",
                      background: "#f8fafc",
                      borderRadius: "6px",
                      fontSize: "11px",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>Paid</span>
                      <strong style={{ color: "var(--green)" }}>{money(item.paid)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>Remaining</span>
                      <strong style={{ color: item.remaining > 0 ? "var(--ink)" : "var(--muted)" }}>
                        {money(item.remaining)}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      marginTop: "2px",
                    }}
                  >
                    <button
                      type="button"
                      className="link-btn-subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetails(item.deal.id);
                      }}
                    >
                      View Details <ArrowUpRight size={12} />
                    </button>

                    {item.remaining > 0 ? (
                      <button
                        type="button"
                        className="btn-action-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDealForPayment(item);
                        }}
                      >
                        <Plus size={13} />
                        Add Payment
                      </button>
                    ) : (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "var(--green)",
                          padding: "3px 8px",
                          borderRadius: "5px",
                          background: "var(--green-soft)",
                        }}
                      >
                        <Check size={13} /> Paid
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="pagination">
          <span>
            Showing {filteredDeals.length ? 1 : 0} to {filteredDeals.length} of{" "}
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

      <AddDealPaymentModal
        open={Boolean(selectedDealForPayment)}
        onClose={() => setSelectedDealForPayment(null)}
        deal={selectedDealForPayment}
        onPaymentSaved={handleSavePayment}
      />
    </>
  );
}

function DealDetails({ onNavigate }) {
  const { data, updateTransaction, addPayment } = useData();
  const [editModal, setEditModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const id =
    new URLSearchParams(window.location.search).get("id") ||
    data.transactions[0]?.id;
  const deal =
    data.transactions.find((item) => item.id === id) || data.transactions[0];
  const dealer = data.dealers.find((item) => item.id === (deal?.sellerId || deal?.dealerId));
  const buyer = data.dealers.find((item) => item.id === deal?.buyerId);

  if (!deal)
    return (
      <Panel title="Deal not found">
        <Button onClick={() => onNavigate("/transactions")}>
          Back to deals
        </Button>
      </Panel>
    );

  const dealPayments = data.payments.filter((p) => p.transactionId === deal.id);
  const originalAmount = Number(deal.totalRate || deal.amount) || 0;
  const totalPaid = dealPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingAmount = Math.max(0, originalAmount - totalPaid);
  const paymentStatus = totalPaid <= 0 ? "Pending" : remainingAmount <= 0 ? "Paid" : "Partially Paid";

  const handleSaveDeal = async (updatedData) => {
    await updateTransaction(deal.id, updatedData);
  };

  return (
    <>
      <PageHeader
        backTo="/transactions"
        backLabel="Back to Deals"
        onNavigate={onNavigate}
        eyebrow="Deals"
        title={deal.name}
        description="Deal details, financials, and payment history."
        action={
          <div className="header-actions">
            <Button
              secondary
              onClick={() => setEditModal(true)}
              icon={Pencil}
            >
              Edit deal
            </Button>
            <Button
              secondary
              onClick={() =>
                downloadCsv(
                  `${deal.id}.csv`,
                  ["Deal ID", "Name", "Date", "Original Amount", "Paid", "Remaining", "Status"],
                  [
                    [
                      deal.id,
                      deal.name,
                      deal.date,
                      money(originalAmount),
                      money(totalPaid),
                      money(remainingAmount),
                      paymentStatus,
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
            <span>Original Deal Amount</span>
            <strong>{money(originalAmount)}</strong>
            <Status>{paymentStatus}</Status>
          </div>
          <div className="detail-grid">
            <Detail label="Deal ID" value={deal.id} />
            <Detail label="Deal Date" value={deal.date} />
            {deal.diamondCarat ? (
              <Detail label="Diamond Carat" value={`${deal.diamondCarat} ct`} />
            ) : null}
            {deal.perCaratRate ? (
              <Detail label="Per Carat Rate" value={money(deal.perCaratRate)} />
            ) : null}
            {deal.totalRate ? (
              <Detail label="Total Rate" value={money(deal.totalRate)} />
            ) : null}
            {deal.terms != null && deal.terms !== "" ? (
              <Detail
                label={`Terms (${deal.terms}%)`}
                value={deal.termsAmount ? `-${money(deal.termsAmount)}` : `${deal.terms}%`}
              />
            ) : null}
            {deal.amountAfterTerms ? (
              <Detail label="Amount After Terms" value={money(deal.amountAfterTerms)} />
            ) : null}
            {deal.cvd ? (
              <Detail label="CVD" value={`-${money(deal.cvd)}`} />
            ) : null}
            {deal.finalNet ? (
              <Detail label="Final Net" value={money(deal.finalNet)} />
            ) : null}
            {deal.dueDays != null && deal.dueDays !== "" ? (
              <Detail label="Due Days" value={`${deal.dueDays} days`} />
            ) : null}
            {deal.sellType ? (
              <Detail
                label="Sell Type"
                value={
                  deal.sellType === "Other" && deal.otherSellType
                    ? `Other (${deal.otherSellType})`
                    : deal.sellType
                }
              />
            ) : null}
            <Detail label="Payment Method" value={deal.paymentMethod || "Bank transfer"} />
            <Detail label="Seller Dealer" value={dealer?.name || "Not selected"} />
            <Detail label="Buyer Dealer" value={buyer?.name || "Not selected"} />
            <Detail
              label="Brokerage Rate"
              value={`${deal.brokerageRate ?? 5}%`}
            />
            <Detail
              label="Brokerage Earned"
              value={money(
                deal.brokerageEarned ??
                  (((deal.totalRate || deal.amount || 0) * (deal.brokerageRate || 0)) / 100)
              )}
            />
          </div>
        </Panel>
        <Panel title="Parties & Notes">
          <div className="profile-card">
            <div className="dealer-avatar large">
              {dealer?.name.slice(0, 2) || "D"}
            </div>
            <div>
              <b>{dealer?.name || "Unassigned"}</b>
              <small>{dealer?.location || "No location"}</small>
              {dealer?.id && (
                <button
                  className="link-btn"
                  onClick={() => onNavigate("/dealer-profile?id=" + dealer.id)}
                >
                  View dealer profile <ArrowUpRight size={13} />
                </button>
              )}
            </div>
          </div>
          <div className="detail-grid single">
            <Detail
              label="Description / Notes"
              value={deal.notes || "No description added"}
            />
          </div>
        </Panel>
        <Panel title="Payment settlement & history" className="items-panel">
          <div className="payment-settlement-summary" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", padding: "18px 20px", background: "#fbfcfd", borderBottom: "1px solid var(--line)" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Original Amount</span>
              <strong style={{ display: "block", fontSize: "18px", fontFamily: "Manrope", marginTop: "4px" }}>{money(originalAmount)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Total Paid</span>
              <strong style={{ display: "block", fontSize: "18px", fontFamily: "Manrope", marginTop: "4px", color: "var(--green)" }}>{money(totalPaid)}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>Remaining Balance</span>
              <strong style={{ display: "block", fontSize: "18px", fontFamily: "Manrope", marginTop: "4px", color: remainingAmount > 0 ? "var(--yellow)" : "var(--ink)" }}>{money(remainingAmount)}</strong>
            </div>
          </div>
          <div style={{ padding: "16px 20px" }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "13px" }}>Payment Records ({dealPayments.length})</h4>
            {dealPayments.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {dealPayments.map((p) => (
                  <div key={p.id} className="item-row" style={{ margin: 0, padding: "12px 14px", border: "1px solid var(--line)", borderRadius: "8px", background: "#fff" }}>
                    <div className="gem-icon">
                      <Check size={16} />
                    </div>
                    <div>
                      <b>{p.method} — {money(p.amount)}</b>
                      <small>{p.date} {p.notes ? `• ${p.notes}` : ""}</small>
                    </div>
                    <strong style={{ color: "var(--green)" }}>{money(p.amount)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ minHeight: "90px" }}>
                <span>No payments recorded for this deal yet.</span>
              </div>
            )}
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              {remainingAmount > 0 && (
                <Button
                  icon={Plus}
                  onClick={() => setPaymentModal(true)}
                >
                  Add Payment
                </Button>
              )}
              <Button secondary onClick={() => onNavigate("/payments")}>
                Go to Payments
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <EditDealModal
        open={editModal}
        onClose={() => setEditModal(false)}
        transaction={deal}
        onSave={handleSaveDeal}
      />

      <AddDealPaymentModal
        open={paymentModal}
        onClose={() => setPaymentModal(false)}
        deal={{ deal, remaining: remainingAmount }}
        onPaymentSaved={async (paymentInfo) => {
          const newPayment = {
            id: nextId("PAY", data.payments),
            transactionId: deal.id,
            dealerId: deal.dealerId || deal.sellerId || null,
            date: paymentInfo.date,
            amount: paymentInfo.amount,
            method: paymentInfo.method,
            status: "Completed",
            notes: "",
          };

          await addPayment(newPayment);
        }}
      />
    </>
  );
}

function EditDealModal({ open, onClose, transaction, onSave }) {
  const { data } = useData();
  const sellerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "seller" || d.type === "both"
  );
  const buyerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "buyer" || d.type === "both"
  );
  const [form, setForm] = useState({
    name: "",
    date: "",
    diamondCarat: "",
    perCaratRate: "",
    terms: "2",
    cvd: "0",
    dueDays: "30",
    sellType: "Self",
    otherSellType: "",
    sellerId: "",
    buyerId: "",
    brokerageRate: "5",
    paymentMethod: "Bank transfer",
    status: "Pending",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (transaction && open) {
      setForm({
        name: transaction.name || "",
        date: transaction.date || new Date().toISOString().split("T")[0],
        diamondCarat: String(transaction.diamondCarat ?? ""),
        perCaratRate: transaction.perCaratRate ? formatIndianNumber(transaction.perCaratRate) : "",
        terms: String(transaction.terms ?? 2),
        cvd: transaction.cvd != null && transaction.cvd !== "" ? formatIndianNumber(transaction.cvd) : "0",
        dueDays: String(transaction.dueDays ?? 30),
        sellType: transaction.sellType || "Self",
        otherSellType: transaction.otherSellType || "",
        sellerId: transaction.sellerId || transaction.dealerId || "",
        buyerId: transaction.buyerId || "",
        brokerageRate: String(transaction.brokerageRate ?? 5),
        paymentMethod: transaction.paymentMethod || "Bank transfer",
        status: transaction.status || "Pending",
        notes: transaction.notes || "",
      });
      setError("");
    }
  }, [transaction, open]);

  if (!open || !transaction) return null;

  const caratValue = parseFloat(form.diamondCarat) || 0;
  const perCaratRateValue = parseFloat(String(form.perCaratRate).replace(/,/g, "")) || 0;
  const totalRateValue =
    caratValue > 0 && perCaratRateValue > 0
      ? Math.round(caratValue * perCaratRateValue * 100) / 100
      : 0;

  const termsPercentValue = parseFloat(form.terms) || 0;
  const termsAmountValue =
    totalRateValue > 0 && termsPercentValue > 0
      ? Math.round(((totalRateValue * termsPercentValue) / 100) * 100) / 100
      : 0;

  const amountAfterTermsValue = Math.round((totalRateValue - termsAmountValue) * 100) / 100;
  const cvdValue = parseFloat(String(form.cvd || "0").replace(/,/g, "")) || 0;
  const finalNetValue = Math.round((amountAfterTermsValue - cvdValue) * 100) / 100;

  const brokerageRateValue = Number(form.brokerageRate) || 0;
  const brokerageEarned = (totalRateValue * (Number.isFinite(brokerageRateValue) ? brokerageRateValue : 5)) / 100;

  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    const carat = Number(form.diamondCarat);
    const rate = Number(String(form.perCaratRate).replace(/,/g, ""));
    const terms = Number(form.terms);
    const cvd = form.cvd ? Number(String(form.cvd).replace(/,/g, "")) : 0;
    const dueDays = Number(form.dueDays);
    const brokerageRate = Number(form.brokerageRate);

    if (!form.name.trim()) return setError("Please enter a deal name.");
    if (!form.date) return setError("Please select a deal date.");
    if (!form.diamondCarat || !Number.isFinite(carat) || carat <= 0) {
      return setError("Diamond carat must be a valid number greater than 0.");
    }
    if (!form.perCaratRate || !Number.isFinite(rate) || rate <= 0) {
      return setError("Per carat rate must be a valid amount greater than 0.");
    }
    if (form.terms === "" || !Number.isFinite(terms) || terms < 0) {
      return setError("Terms (%) must be 0 or greater.");
    }
    if (!Number.isFinite(cvd) || cvd < 0) {
      return setError("CVD must be 0 or greater.");
    }
    if (form.dueDays === "" || !Number.isFinite(dueDays) || dueDays < 0) {
      return setError("Due days must be 0 or greater.");
    }
    if (form.sellType === "Other" && !form.otherSellType.trim()) {
      return setError("Please specify the other sell type.");
    }
    if (!form.sellerId) return setError("Please select a seller dealer.");
    if (!form.buyerId) return setError("Please select a buyer dealer.");
    if (form.sellerId === form.buyerId) {
      return setError("Seller and buyer must be different dealers.");
    }

    const totalRate = Math.round(carat * rate * 100) / 100;
    const termsAmount = Math.round(((totalRate * terms) / 100) * 100) / 100;
    const amountAfterTerms = Math.round((totalRate - termsAmount) * 100) / 100;
    const finalNet = Math.round((amountAfterTerms - cvd) * 100) / 100;
    const earned = Math.round(((totalRate * (Number.isFinite(brokerageRate) ? brokerageRate : 5)) / 100) * 100) / 100;

    try {
      await onSave({
        name: form.name.trim(),
        date: form.date,
        diamondCarat: carat,
        perCaratRate: rate,
        totalRate,
        amount: totalRate,
        terms,
        termsAmount,
        amountAfterTerms,
        cvd,
        finalNet,
        dueDays,
        sellType: form.sellType,
        otherSellType: form.sellType === "Other" ? form.otherSellType.trim() : "",
        sellerId: form.sellerId,
        dealerId: form.sellerId,
        buyerId: form.buyerId,
        brokerageRate: Number.isFinite(brokerageRate) ? brokerageRate : 5,
        brokerageEarned: earned,
        paymentMethod: form.paymentMethod || "Bank transfer",
        notes: form.notes.trim(),
        status: form.status || "Pending",
      });
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to update deal.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: "660px" }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Edit deal — {transaction.id}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="form-grid" style={{ padding: 0 }}>
              <label className="field-group">
                <span className="field-title">Deal Name</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={set}
                  placeholder="e.g. Mumbai Lot #102"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Deal Date</span>
                <input
                  name="date"
                  type="date"
                  value={form.date}
                  onChange={set}
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Diamond Carat</span>
                <input
                  name="diamondCarat"
                  type="text"
                  inputMode="decimal"
                  value={form.diamondCarat}
                  onChange={(event) => {
                    const raw = event.target.value.replace(/[^0-9.]/g, "");
                    const parts = raw.split(".");
                    let clean = parts[0];
                    if (parts.length > 1) {
                      clean = parts[0] + "." + parts.slice(1).join("").slice(0, 2);
                    }
                    setForm((p) => ({ ...p, diamondCarat: clean }));
                  }}
                  placeholder="e.g. 10.50"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Per Carat Rate</span>
                <div className="input-with-symbol">
                  <span className="input-symbol">₹</span>
                  <input
                    name="perCaratRate"
                    type="text"
                    inputMode="numeric"
                    value={form.perCaratRate}
                    onChange={(event) => {
                      const raw = event.target.value
                        .replace(/[^0-9.]/g, "")
                        .replace(/(\..*)\./g, "$1");
                      setForm((p) => ({
                        ...p,
                        perCaratRate: raw ? formatIndianNumber(raw) : "",
                      }));
                    }}
                    placeholder="e.g. 50,000"
                    required
                  />
                </div>
              </label>
              <div className="field-group calculated-cell">
                <div className="calculated-field-card">
                  <div className="calc-header">
                    <span className="field-title">Total Rate</span>
                    <span className="calc-badge">Auto Calculated</span>
                  </div>
                  <div className="calc-value">{money(totalRateValue)}</div>
                  <span className="calc-formula">Carat × Per Carat Rate</span>
                </div>
              </div>
              <label className="field-group">
                <span className="field-title">Terms (%)</span>
                <input
                  name="terms"
                  type="text"
                  inputMode="decimal"
                  value={form.terms}
                  onChange={(event) =>
                    setForm((p) => ({
                      ...p,
                      terms: event.target.value
                        .replace(/[^0-9.]/g, "")
                        .replace(/(\..*)\./g, "$1"),
                    }))
                  }
                  placeholder="e.g. 2"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">Due Days</span>
                <input
                  name="dueDays"
                  type="text"
                  inputMode="numeric"
                  value={form.dueDays}
                  onChange={(event) =>
                    setForm((p) => ({
                      ...p,
                      dueDays: event.target.value.replace(/[^0-9]/g, ""),
                    }))
                  }
                  placeholder="e.g. 30"
                  required
                />
              </label>
              <label className="field-group">
                <span className="field-title">CVD Amount</span>
                <div className="input-with-symbol">
                  <span className="input-symbol">₹</span>
                  <input
                    name="cvd"
                    type="text"
                    inputMode="decimal"
                    value={form.cvd}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      setForm((p) => ({
                        ...p,
                        cvd: raw ? formatIndianNumber(raw) : "",
                      }));
                    }}
                    placeholder="0"
                  />
                </div>
              </label>
              <div className="field-group">
                <span className="field-title">Sell Type</span>
                <div className="segmented-control" role="radiogroup" aria-label="Sell Type">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.sellType === "Self"}
                    className={`segmented-btn ${form.sellType === "Self" ? "active" : ""}`}
                    onClick={() => setForm((prev) => ({ ...prev, sellType: "Self" }))}
                  >
                    Self
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.sellType === "Other"}
                    className={`segmented-btn ${form.sellType === "Other" ? "active" : ""}`}
                    onClick={() => setForm((prev) => ({ ...prev, sellType: "Other" }))}
                  >
                    Other
                  </button>
                </div>
                {form.sellType === "Other" && (
                  <div className="other-sell-field">
                    <label className="field-group subfield-margin">
                      <span className="field-title">Other Sell Type</span>
                      <input
                        name="otherSellType"
                        type="text"
                        value={form.otherSellType}
                        onChange={set}
                        placeholder="Enter sell type (e.g. Wholesale)"
                        required
                      />
                    </label>
                  </div>
                )}
              </div>
              <label className="field-group">
                <span className="field-title">Seller</span>
                <select name="sellerId" value={form.sellerId} onChange={set} required>
                  <option value="">Select seller</option>
                  {sellerDealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="field-title">Buyer</span>
                <select name="buyerId" value={form.buyerId} onChange={set} required>
                  <option value="">Select buyer</option>
                  {buyerDealers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span className="field-title">Brokerage (%)</span>
                <input
                  name="brokerageRate"
                  type="text"
                  inputMode="decimal"
                  value={form.brokerageRate}
                  onChange={(event) =>
                    setForm((p) => ({
                      ...p,
                      brokerageRate: event.target.value
                        .replace(/[^0-9.]/g, "")
                        .replace(/(\..*)\./g, "$1"),
                    }))
                  }
                  placeholder="1.00"
                  required
                />
              </label>
              <div className="earned-field">
                <span>Brokerage earned</span>
                <strong>{money(brokerageEarned)}</strong>
              </div>
              <label className="field-group">
                <span className="field-title">Status</span>
                <select name="status" value={form.status} onChange={set} required>
                  <option>Pending</option>
                  <option>Processing</option>
                  <option>Completed</option>
                </select>
              </label>
              <label className="field-group">
                <span className="field-title">Payment method</span>
                <select name="paymentMethod" value={form.paymentMethod} onChange={set}>
                  <option>Bank transfer</option>
                  <option>Credit card</option>
                  <option>Cash</option>
                </select>
              </label>
              <label className="field-group full">
                <span className="field-title">Description</span>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={set}
                  placeholder="Enter a description..."
                />
              </label>
            </div>
          </div>
          <div className="modal-actions">
            <Button secondary type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
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

function NewDeal({ onNavigate }) {
  const { data, addTransaction } = useData();
  const sellerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "seller" || d.type === "both"
  );
  const buyerDealers = data.dealers.filter(
    (d) => !d.type || d.type === "buyer" || d.type === "both"
  );
  const [form, setForm] = useState({
    name: "",
    date: new Date().toISOString().split("T")[0],
    diamondCarat: "",
    perCaratRate: "",
    terms: "2",
    cvd: "0",
    dueDays: "30",
    sellType: "Self",
    otherSellType: "",
    sellerId: "",
    buyerId: "",
    brokerageRate: "5",
    paymentMethod: "Bank transfer",
    status: "Pending",
    notes: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const caratValue = parseFloat(form.diamondCarat) || 0;
  const perCaratRateValue = parseFloat(String(form.perCaratRate).replace(/,/g, "")) || 0;
  const totalRateValue =
    caratValue > 0 && perCaratRateValue > 0
      ? Math.round(caratValue * perCaratRateValue * 100) / 100
      : 0;

  const termsPercentValue = parseFloat(form.terms) || 0;
  const termsAmountValue =
    totalRateValue > 0 && termsPercentValue > 0
      ? Math.round(((totalRateValue * termsPercentValue) / 100) * 100) / 100
      : 0;

  const amountAfterTermsValue = Math.round((totalRateValue - termsAmountValue) * 100) / 100;
  const cvdValue = parseFloat(String(form.cvd || "0").replace(/,/g, "")) || 0;
  const finalNetValue = Math.round((amountAfterTermsValue - cvdValue) * 100) / 100;

  const brokerageRateValue = Number(form.brokerageRate) || 0;
  const brokerageEarned = (totalRateValue * (Number.isFinite(brokerageRateValue) ? brokerageRateValue : 5)) / 100;

  const set = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const carat = Number(form.diamondCarat);
    const rate = Number(String(form.perCaratRate).replace(/,/g, ""));
    const terms = Number(form.terms);
    const cvd = form.cvd ? Number(String(form.cvd).replace(/,/g, "")) : 0;
    const dueDays = Number(form.dueDays);
    const brokerageRate = Number(form.brokerageRate);

    if (!form.name.trim()) return setError("Please enter a deal name.");
    if (!form.date) return setError("Please select a deal date.");
    if (!form.diamondCarat || !Number.isFinite(carat) || carat <= 0) {
      return setError("Diamond carat must be a valid number greater than 0.");
    }
    if (!form.perCaratRate || !Number.isFinite(rate) || rate <= 0) {
      return setError("Per carat rate must be a valid amount greater than 0.");
    }
    if (form.terms === "" || !Number.isFinite(terms) || terms < 0) {
      return setError("Terms (%) must be 0 or greater.");
    }
    if (!Number.isFinite(cvd) || cvd < 0) {
      return setError("CVD must be 0 or greater.");
    }
    if (form.dueDays === "" || !Number.isFinite(dueDays) || dueDays < 0) {
      return setError("Due days must be 0 or greater.");
    }
    if (form.sellType === "Other" && !form.otherSellType.trim()) {
      return setError("Please specify the other sell type.");
    }
    if (!form.sellerId) return setError("Please select a seller dealer.");
    if (!form.buyerId) return setError("Please select a buyer dealer.");
    if (form.sellerId === form.buyerId) {
      return setError("Seller and buyer must be different dealers.");
    }

    const totalRate = Math.round(carat * rate * 100) / 100;
    const termsAmount = Math.round(((totalRate * terms) / 100) * 100) / 100;
    const amountAfterTerms = Math.round((totalRate - termsAmount) * 100) / 100;
    const finalNet = Math.round((amountAfterTerms - cvd) * 100) / 100;
    const earned = Math.round(((totalRate * (Number.isFinite(brokerageRate) ? brokerageRate : 5)) / 100) * 100) / 100;

    const deal = {
      id: nextId("TRX", data.transactions),
      name: form.name.trim(),
      date: form.date,
      diamondCarat: carat,
      perCaratRate: rate,
      totalRate,
      amount: totalRate,
      terms,
      termsAmount,
      amountAfterTerms,
      cvd,
      finalNet,
      dueDays,
      sellType: form.sellType,
      otherSellType: form.sellType === "Other" ? form.otherSellType.trim() : "",
      sellerId: form.sellerId,
      dealerId: form.sellerId,
      buyerId: form.buyerId,
      brokerageRate: Number.isFinite(brokerageRate) ? brokerageRate : 5,
      brokerageEarned: earned,
      paymentMethod: form.paymentMethod || "Bank transfer",
      notes: form.notes.trim(),
      status: form.status || "Pending",
    };

    setSubmitting(true);
    try {
      await addTransaction(deal);
      onNavigate("/transaction-details?id=" + deal.id);
    } catch (err) {
      setError(err?.message || "Failed to create deal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        backTo="/transactions"
        backLabel="Back to Deals"
        onNavigate={onNavigate}
        eyebrow="Deals"
        title="New deal"
        description="Add a new diamond deal to your records."
      />
      <form className="grouped-form" onSubmit={submit}>
        <Panel title="Deal details" className="form-panel">
          <div className="form-grid">
            <label className="field-group">
              <span className="field-title">Deal Name</span>
              <input
                name="name"
                value={form.name}
                onChange={set}
                placeholder="e.g. Mumbai Lot #102"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Deal Date</span>
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={set}
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Diamond Carat</span>
              <input
                name="diamondCarat"
                type="text"
                inputMode="decimal"
                value={form.diamondCarat}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^0-9.]/g, "");
                  const parts = raw.split(".");
                  let clean = parts[0];
                  if (parts.length > 1) {
                    clean = parts[0] + "." + parts.slice(1).join("").slice(0, 2);
                  }
                  setForm((previous) => ({
                    ...previous,
                    diamondCarat: clean,
                  }));
                }}
                placeholder="e.g. 10.50"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Per Carat Rate</span>
              <div className="input-with-symbol">
                <span className="input-symbol">₹</span>
                <input
                  name="perCaratRate"
                  type="text"
                  inputMode="numeric"
                  value={form.perCaratRate}
                  onChange={(event) => {
                    const raw = event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1");
                    setForm((previous) => ({
                      ...previous,
                      perCaratRate: raw ? formatIndianNumber(raw) : "",
                    }));
                  }}
                  placeholder="e.g. 50,000"
                  required
                />
              </div>
            </label>

            <div className="field-group calculated-cell">
              <div className="calculated-field-card">
                <div className="calc-header">
                  <span className="field-title">Total Rate</span>
                  <span className="calc-badge">Auto Calculated</span>
                </div>
                <div className="calc-value">{money(totalRateValue)}</div>
                <span className="calc-formula">Carat × Per Carat Rate</span>
              </div>
            </div>

            <label className="field-group">
              <span className="field-title">Terms (%)</span>
              <input
                name="terms"
                type="text"
                inputMode="decimal"
                value={form.terms}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    terms: event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1"),
                  }))
                }
                placeholder="e.g. 2"
                required
              />
            </label>

            <label className="field-group">
              <span className="field-title">Due Days</span>
              <input
                name="dueDays"
                type="text"
                inputMode="numeric"
                value={form.dueDays}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    dueDays: event.target.value.replace(/[^0-9]/g, ""),
                  }))
                }
                placeholder="e.g. 30"
                required
              />
            </label>
            <label className="field-group">
              <span className="field-title">CVD Amount</span>
              <div className="input-with-symbol">
                <span className="input-symbol">₹</span>
                <input
                  name="cvd"
                  type="text"
                  inputMode="decimal"
                  value={form.cvd}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                    setForm((p) => ({
                      ...p,
                      cvd: raw ? formatIndianNumber(raw) : "",
                    }));
                  }}
                  placeholder="0"
                />
              </div>
            </label>

            <div className="field-group">
              <span className="field-title">Sell Type</span>
              <div className="segmented-control" role="radiogroup" aria-label="Sell Type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.sellType === "Self"}
                  className={`segmented-btn ${form.sellType === "Self" ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, sellType: "Self" }))}
                >
                  Self
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.sellType === "Other"}
                  className={`segmented-btn ${form.sellType === "Other" ? "active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, sellType: "Other" }))}
                >
                  Other
                </button>
              </div>
              {form.sellType === "Other" && (
                <div className="other-sell-field">
                  <label className="field-group subfield-margin">
                    <span className="field-title">Other Sell Type</span>
                    <input
                      name="otherSellType"
                      type="text"
                      value={form.otherSellType}
                      onChange={set}
                      placeholder="Enter sell type (e.g. Wholesale)"
                      required
                    />
                  </label>
                </div>
              )}
            </div>

            <label className="field-group full">
              <span className="field-title">Description</span>
              <textarea
                name="notes"
                value={form.notes}
                onChange={set}
                placeholder="Enter a description..."
              />
            </label>
          </div>
        </Panel>

        <Panel title="Amount Summary" className="form-panel amount-summary-panel">
          <div className="amount-summary-card">
            <div className="summary-row">
              <div className="summary-label">
                <span>Total Rate</span>
                <small className="summary-hint">Carat × Per Carat Rate</small>
              </div>
              <div className="summary-value">{money(totalRateValue)}</div>
            </div>

            <div className="summary-row">
              <div className="summary-label">
                <span>Terms ({termsPercentValue}%)</span>
                <small className="summary-hint">Deduction</small>
              </div>
              <div className="summary-value deduction">
                {termsAmountValue > 0 ? `-${money(termsAmountValue)}` : money(0)}
              </div>
            </div>

            <div className="summary-row">
              <div className="summary-label">
                <span>Amount After Terms</span>
                <small className="summary-hint">Total Rate − Terms</small>
              </div>
              <div className="summary-value">{money(amountAfterTermsValue)}</div>
            </div>

            <div className="summary-row cvd-row">
              <div className="summary-label">
                <span className="cvd-label-text">CVD</span>
              </div>
              <div className="summary-value deduction">{cvdValue > 0 ? `-${money(cvdValue)}` : money(0)}</div>
            </div>

            <div className="summary-divider" />

            <div className="summary-row final-net-row">
              <div className="summary-label">
                <span className="final-net-title">Final Net</span>
                <small className="summary-hint">Amount After Terms − CVD</small>
              </div>
              <div className="final-net-value">{money(finalNetValue)}</div>
            </div>
          </div>
        </Panel>

        <Panel title="Parties involved" className="form-panel">
          <div className="party-flow">
            <label className="field-group">
              <span className="field-title">Seller</span>
              <select name="sellerId" value={form.sellerId} onChange={set} required>
                <option value="">Select seller dealer</option>
                {sellerDealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                ))}
              </select>
            </label>
            <div className="party-connector" aria-hidden="true"><span>→</span><b>BROKERAGE</b><span>→</span></div>
            <label className="field-group">
              <span className="field-title">Buyer</span>
              <select name="buyerId" value={form.buyerId} onChange={set} required>
                <option value="">Select buyer dealer</option>
                {buyerDealers.map((dealer) => (
                  <option key={dealer.id} value={dealer.id}>{dealer.name}</option>
                ))}
              </select>
            </label>
          </div>
        </Panel>

        <Panel title="Brokerage" className="form-panel">
          <div className="form-grid">
            <label className="field-group">
              <span className="field-title">Brokerage (%)</span>
              <input
                name="brokerageRate"
                type="text"
                inputMode="decimal"
                value={form.brokerageRate}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    brokerageRate: event.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/(\..*)\./g, "$1"),
                  }))
                }
                placeholder="1.00"
                required
              />
            </label>
            <div className="earned-field">
              <span>Brokerage earned</span>
              <strong>{money(brokerageEarned)}</strong>
            </div>
            <label className="field-group full">
              <span className="field-title">Payment method</span>
              <select name="paymentMethod" value={form.paymentMethod} onChange={set}>
                <option>Bank transfer</option>
                <option>Credit card</option>
                <option>Cash</option>
              </select>
            </label>
          </div>
        </Panel>

        <Panel title="Deal status" className="form-panel">
          <div className="form-grid">
            <label className="field-group">
              <span className="field-title">Status</span>
              <select name="status" value={form.status} onChange={set} required>
                <option>Pending</option>
                <option>Processing</option>
                <option>Completed</option>
              </select>
            </label>
          </div>
        </Panel>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <div className="form-actions">
          <Button secondary type="button" onClick={() => onNavigate("/transactions")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create deal"}
          </Button>
        </div>
      </form>
    </>
  );
}

function DealerProfile({ onNavigate }) {
  const { data, updateDealer } = useData();
  const [editModal, setEditModal] = useState(false);
  const id =
    new URLSearchParams(window.location.search).get("id") || data.dealers[0]?.id || "dealer-abc";
  const dealer = data.dealers.find((item) => item.id === id) || data.dealers[0];
  const dealerTransactions = dealer
    ? data.transactions.filter(
        (item) => item.dealerId === dealer.id || item.sellerId === dealer.id,
      )
    : [];

  if (!dealer) {
    return (
      <Panel title="Dealer not found">
        <div style={{ padding: "20px" }}>
          <Button onClick={() => onNavigate("/dealers")}>Back to dealers</Button>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        backTo="/dealers"
        backLabel="Back to Dealers"
        onNavigate={onNavigate}
        eyebrow="Dealers"
        title={dealer.name}
        description="Dealer profile and deal history."
        action={
          <div className="header-actions">
            <Button secondary onClick={() => setEditModal(true)} icon={Pencil}>
              Edit dealer
            </Button>
            <Button
              secondary
              onClick={() =>
                downloadCsv(
                  `${dealer.id}-deals.csv`,
                  ["Deal ID", "Dealer", "Date", "Amount", "Status"],
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
          </div>
        }
      />
      <Panel className="dealer-profile-head">
        <div className="profile-card">
          <div className="dealer-avatar profile">{dealer.name.slice(0, 2)}</div>
          <div>
            <h2>{dealer.name}</h2>
            <small>
              {dealer.location}
              {dealer.phone ? ` • ${dealer.phone}` : ""}
              {dealer.email ? ` • ${dealer.email}` : ""}
            </small>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
              <span className="dealer-role-tag">{dealerTypeLabel(dealer.type)}</span>
              <Status>{dealer.status}</Status>
            </div>
          </div>
        </div>
        <button
          className="link-btn"
          onClick={() => onNavigate("/transactions")}
        >
          View all deals <ArrowUpRight size={14} />
        </button>
      </Panel>
      <div className="stats-grid three">
        <Stat
          label="Total deals"
          value={dealerTransactions.length}
          change="12.5%"
          icon={CreditCard}
        />
        <Stat
          label="Total volume"
          value={money(
            dealerTransactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0),
          )}
          change="8.2%"
          icon={CircleDollarSign}
        />
        <Stat
          label="Avg. deal volume"
          value={money(
            dealerTransactions.length
              ? dealerTransactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0) /
                  dealerTransactions.length
              : 0,
          )}
          change="3.1%"
          icon={BarChart3}
        />
      </div>
      <Panel title="Deal history">
        <DealTable
          rows={transactionRows({ ...data, transactions: dealerTransactions })}
          onRowClick={(rowId) => onNavigate("/transaction-details?id=" + rowId)}
        />
      </Panel>

      <DealerModal
        open={editModal}
        onClose={() => setEditModal(false)}
        dealer={dealer}
        onSave={(updated) => updateDealer(dealer.id, updated)}
      />
    </>
  );
}

function DealerModal({ open, onClose, dealer, onSave }) {
  const [form, setForm] = useState({
    name: "",
    location: "",
    type: "both",
    phone: "",
    email: "",
    status: "Active",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (dealer && dealer.id) {
      setForm({
        name: dealer.name || "",
        location: dealer.location || "",
        type: dealer.type || "both",
        phone: dealer.phone || "",
        email: dealer.email || "",
        status: dealer.status || "Active",
      });
    } else {
      setForm({
        name: "",
        location: "",
        type: "both",
        phone: "",
        email: "",
        status: "Active",
      });
    }
    setError("");
  }, [dealer, open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Please enter a dealer name.");
    if (!form.location.trim()) return setError("Please enter a location.");

    onSave({
      name: form.name.trim(),
      location: form.location.trim(),
      type: form.type || "both",
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
    });
    onClose();
  };

  const isEdit = Boolean(dealer && dealer.id);

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? "Edit dealer" : "Add dealer"}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <label className="field-group">
              <span className="field-title">Dealer Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. ABC Diamonds"
                required
              />
            </label>
            <label className="field-group">
              <span className="field-title">Location</span>
              <input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="e.g. Mumbai, India"
                required
              />
            </label>
            <div className="field-group">
              <span className="field-title">Dealer Type</span>
              <div className="segmented-control" role="radiogroup" aria-label="Dealer Type">
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.type === "buyer"}
                  className={`segmented-btn ${form.type === "buyer" ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, type: "buyer" }))}
                >
                  Buyer
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.type === "seller"}
                  className={`segmented-btn ${form.type === "seller" ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, type: "seller" }))}
                >
                  Seller
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={form.type === "both"}
                  className={`segmented-btn ${form.type === "both" ? "active" : ""}`}
                  onClick={() => setForm((p) => ({ ...p, type: "both" }))}
                >
                  Both
                </button>
              </div>
            </div>
            <label className="field-group">
              <span className="field-title">Phone (Optional)</span>
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+91 22 5550 0198"
              />
            </label>
            <label className="field-group">
              <span className="field-title">Email (Optional)</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="alex@abcdiamonds.com"
              />
            </label>
            {isEdit && (
              <label className="field-group">
                <span className="field-title">Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            )}
          </div>
          <div className="modal-actions">
            <Button secondary type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? "Save changes" : "Add Dealer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteDealerModal({ dealer, onClose, onConfirm, isUsed }) {
  if (!dealer) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Remove {dealer.name}?</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {isUsed ? (
            <div className="delete-warning-box">
              This dealer is linked to an existing deal or payment record.
            </div>
          ) : (
            <p className="delete-confirm-text">
              Are you sure you want to remove <b>{dealer.name}</b>?
            </p>
          )}
        </div>
        <div className="modal-actions">
          <Button secondary type="button" onClick={onClose}>
            Cancel
          </Button>
          {!isUsed && (
            <button
              type="button"
              className="button danger"
              onClick={() => onConfirm(dealer.id)}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Dealers({ onNavigate }) {
  const { data, addDealer, updateDealer, deleteDealer } = useData();
  const [modalDealer, setModalDealer] = useState(null);
  const [deletingDealer, setDeletingDealer] = useState(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const list = data.dealers.filter((dealer) =>
    `${dealer.name} ${dealer.location}`
      .toLowerCase()
      .includes(query.toLowerCase()) &&
    (status === "All" || dealer.status === status),
  );

  const handleSave = (dealerData) => {
    if (modalDealer && modalDealer.id) {
      updateDealer(modalDealer.id, dealerData);
    } else {
      addDealer(dealerData);
    }
  };

  const isDeletingUsed = Boolean(
    deletingDealer &&
      (data.transactions.some(
        (t) =>
          t.dealerId === deletingDealer.id ||
          t.sellerId === deletingDealer.id ||
          t.buyerId === deletingDealer.id,
      ) ||
        data.payments.some((p) => p.dealerId === deletingDealer.id)),
  );

  const handleConfirmDelete = (id) => {
    const res = deleteDealer(id);
    if (res.success) {
      setDeletingDealer(null);
    }
  };

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Manage"
        title="Dealers"
        description="Manage your network of diamond dealers."
        action={
          <Button onClick={() => setModalDealer({})} icon={Plus}>
            Add dealer
          </Button>
        }
      />
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
            data.transactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0),
          )}
          change="14.8%"
          icon={CircleDollarSign}
        />
      </div>
      <Panel
        title="All dealers"
        action={
          <div className="panel-actions">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search dealers..."
            />
            <select
              className="filter"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter dealers by status"
            >
              <option value="All">All dealers</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        }
      >
        {list.length ? (
          <>
            <div className="table-scroll desktop-data-table">
              <table>
                <thead>
                  <tr>
                    <th>Dealer</th>
                    <th>Location</th>
                    <th>Deals</th>
                    <th>Total volume</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((dealer) => {
                    const volume = data.transactions
                      .filter((item) => item.dealerId === dealer.id || item.sellerId === dealer.id)
                      .reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
                    const count = data.transactions.filter(
                      (item) => item.dealerId === dealer.id || item.sellerId === dealer.id,
                    ).length;
                    return (
                      <tr
                        key={dealer.id}
                        onClick={() =>
                          onNavigate("/dealer-profile?id=" + dealer.id)
                        }
                        onKeyDown={(event) =>
                          (event.key === "Enter" || event.key === " ") &&
                          onNavigate("/dealer-profile?id=" + dealer.id)
                        }
                        tabIndex={0}
                        role="button"
                        className="clickable-row"
                      >
                        <td>
                          <div className="table-person">
                            <div className="dealer-avatar">
                              {dealer.name.slice(0, 2)}
                            </div>
                            <div>
                              <b>{dealer.name}</b>
                              <small style={{ display: "block", color: "var(--muted)", fontSize: "10px", marginTop: "2px" }}>
                                {dealerTypeLabel(dealer.type)}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>{dealer.location}</td>
                        <td>{count}</td>
                        <td>
                          <b>{money(volume)}</b>
                        </td>
                        <td>
                          <Status>{dealer.status}</Status>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="btn-action"
                              aria-label={`Edit ${dealer.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setModalDealer(dealer);
                              }}
                            >
                              <Pencil size={13} /> Edit
                            </button>
                            <button
                              type="button"
                              className="btn-action danger"
                              aria-label={`Remove ${dealer.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeletingDealer(dealer);
                              }}
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-data-list">
              {list.map((dealer) => {
                const records = data.transactions.filter(
                  (item) => item.dealerId === dealer.id || item.sellerId === dealer.id,
                );
                const volume = records.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
                return (
                  <div
                    key={dealer.id}
                    className="mobile-card-item"
                    onClick={() => onNavigate("/dealer-profile?id=" + dealer.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="mobile-card-main">
                      <div className="mobile-card-copy">
                        <b>{dealer.name}</b>
                        <span>{dealer.location} • {dealerTypeLabel(dealer.type)}</span>
                      </div>
                      <div className="mobile-card-amount">{money(volume)}</div>
                    </div>
                    <div className="mobile-card-meta">
                      <span>{records.length} deals</span>
                      <Status>{dealer.status}</Status>
                    </div>
                    <div className="mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="link-btn-subtle"
                        onClick={() => setModalDealer(dealer)}
                      >
                        Edit
                      </button>
                      <span className="dot-sep">•</span>
                      <button
                        type="button"
                        className="link-btn-subtle danger"
                        onClick={() => setDeletingDealer(dealer)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Search size={20} />
            <b>No dealers found</b>
            <span>Try adding a new dealer or a different search term.</span>
          </div>
        )}
      </Panel>

      <DealerModal
        open={Boolean(modalDealer)}
        onClose={() => setModalDealer(null)}
        dealer={modalDealer}
        onSave={handleSave}
      />

      <DeleteDealerModal
        dealer={deletingDealer}
        onClose={() => setDeletingDealer(null)}
        onConfirm={handleConfirmDelete}
        isUsed={isDeletingUsed}
      />
    </>
  );
}

function Payments({ onNavigate }) {
  const { data, addPayment } = useData();
  const [open, setOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [form, setForm] = useState({
    transactionId: "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    method: "Bank transfer",
    notes: "",
  });

  // Calculate real deal payment aggregates
  const dealRows = data.transactions.map((deal) => {
    const payments = data.payments.filter((p) => p.transactionId === deal.id);
    const original = Number(deal.totalRate || deal.amount) || 0;
    const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const remaining = Math.max(0, original - paid);
    const status = paid <= 0 ? "Pending" : remaining <= 0 ? "Paid" : "Partially Paid";
    const lastPayment = payments.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const dealer = data.dealers.find((item) => item.id === (deal.dealerId || deal.sellerId));

    return {
      deal,
      dealer,
      payments,
      original,
      paid,
      remaining,
      status,
      lastPayment,
    };
  });

  // Top summary totals calculated strictly from DB data
  const totalDue = dealRows.reduce((sum, row) => sum + row.original, 0);
  const totalPaid = dealRows.reduce((sum, row) => sum + Math.min(row.original, row.paid), 0);
  const totalRemaining = dealRows.reduce((sum, row) => sum + row.remaining, 0);

  const selectedDealRow = dealRows.find((row) => row.deal.id === form.transactionId);
  const paymentAmountNum = Number(String(form.amount).replace(/,/g, "")) || 0;
  const remainingAfterPayment = selectedDealRow
    ? Math.max(0, selectedDealRow.remaining - paymentAmountNum)
    : 0;

  const setField = (event) => {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  };

  const openAddPaymentForDeal = (dealId = "") => {
    setForm({
      transactionId: dealId || (dealRows.find((r) => r.remaining > 0)?.deal.id || ""),
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      method: "Bank transfer",
      notes: "",
    });
    setError("");
    setOpen(true);
  };

  const closeForm = () => {
    setOpen(false);
    setError("");
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    setError("");

    if (!selectedDealRow) {
      return setError("Please select a deal.");
    }

    if (!paymentAmountNum || paymentAmountNum <= 0) {
      return setError("Please enter a valid payment amount greater than 0.");
    }

    // Strict validation: blocked if payment exceeds remaining
    if (paymentAmountNum > selectedDealRow.remaining) {
      return setError(
        `Payment amount (${money(paymentAmountNum)}) cannot exceed the remaining balance of ${money(selectedDealRow.remaining)}.`
      );
    }

    try {
      const newPayment = {
        id: nextId("PAY", data.payments),
        transactionId: selectedDealRow.deal.id,
        dealerId: selectedDealRow.deal.dealerId || selectedDealRow.deal.sellerId,
        date: form.date,
        amount: paymentAmountNum,
        method: form.method,
        status: "Completed",
        notes: form.notes.trim(),
      };

      await addPayment(newPayment);
      closeForm();
    } catch (err) {
      console.error("Payment creation error:", err);
      setError(err?.message || "Unable to record payment. Please try again.");
    }
  };

  const filteredDeals = dealRows.filter((row) => {
    if (filterStatus === "All") return true;
    return row.status === filterStatus;
  });

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Finance"
        title="Payments"
        description="Track and record partial and full payments against your deals."
        action={
          <Button onClick={() => openAddPaymentForDeal()} icon={Plus}>
            Add Payment
          </Button>
        }
      />

      <div className="payment-summary">
        <div className="stat">
          <div className="stat-top">
            <span>Total Due</span>
            <div className="stat-icon">
              <CircleDollarSign size={16} />
            </div>
          </div>
          <strong>{money(totalDue)}</strong>
          <small>Original deal volume</small>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span>Total Paid</span>
            <div className="stat-icon" style={{ background: "var(--green-soft)", color: "var(--green)" }}>
              <Check size={16} />
            </div>
          </div>
          <strong>{money(totalPaid)}</strong>
          <small className="up">Collected payments</small>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span>Total Remaining</span>
            <div className="stat-icon" style={{ background: "var(--yellow-soft)", color: "var(--yellow)" }}>
              <Wallet size={16} />
            </div>
          </div>
          <strong>{money(totalRemaining)}</strong>
          <small className="down">Outstanding balance</small>
        </div>
      </div>

      {open && (
        <div className="modal-overlay" onClick={closeForm} role="dialog" aria-modal="true">
          <div className="modal-card" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Record Deal Payment</h3>
              <button className="icon-btn" onClick={closeForm} aria-label="Close form">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={submitPayment}>
              <div className="modal-body">
                {error && <div className="form-error" role="alert">{error}</div>}
                
                <label className="field-group">
                  <span className="field-title">Select Deal</span>
                  <select
                    name="transactionId"
                    value={form.transactionId}
                    onChange={setField}
                    required
                  >
                    <option value="">-- Choose a Deal --</option>
                    {dealRows.map((row) => (
                      <option key={row.deal.id} value={row.deal.id}>
                        {row.deal.name} ({money(row.original)}) — Remaining: {money(row.remaining)}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedDealRow && (
                  <div className="payment-live-details">
                    <Detail label="Original Deal Amount" value={money(selectedDealRow.original)} />
                    <Detail label="Total Already Paid" value={money(selectedDealRow.paid)} />
                    <Detail label="Remaining Before Payment" value={money(selectedDealRow.remaining)} />
                  </div>
                )}

                <div className="form-grid" style={{ padding: 0, marginTop: "12px" }}>
                  <label className="field-group">
                    <span className="field-title">Payment Amount</span>
                    <div className="input-with-symbol">
                      <span className="input-symbol">₹</span>
                      <input
                        name="amount"
                        value={form.amount}
                        onChange={(event) => {
                          const raw = event.target.value
                            .replace(/[^0-9.]/g, "")
                            .replace(/(\..*)\./g, "$1");
                          setForm((previous) => ({
                            ...previous,
                            amount: raw ? formatIndianNumber(raw) : "",
                          }));
                        }}
                        inputMode="decimal"
                        placeholder="e.g. 3,00,000"
                        required
                      />
                    </div>
                  </label>

                  <label className="field-group">
                    <span className="field-title">Payment Date</span>
                    <input
                      name="date"
                      type="date"
                      value={form.date}
                      onChange={setField}
                      required
                    />
                  </label>

                  <label className="field-group">
                    <span className="field-title">Payment Method</span>
                    <select name="method" value={form.method} onChange={setField}>
                      <option>Bank transfer</option>
                      <option>UPI</option>
                      <option>Cash</option>
                      <option>Cheque</option>
                      <option>Other</option>
                    </select>
                  </label>

                  {selectedDealRow && (
                    <div className="field-group calculated-cell">
                      <div className="calculated-field-card">
                        <div className="calc-header">
                          <span className="field-title">Remaining After Payment</span>
                        </div>
                        <div className="calc-value">{money(remainingAfterPayment)}</div>
                        <span className="calc-formula">Balance remaining on deal</span>
                      </div>
                    </div>
                  )}

                  <label className="field-group full">
                    <span className="field-title">Reference / Notes</span>
                    <textarea
                      name="notes"
                      value={form.notes}
                      onChange={setField}
                      placeholder="Transaction reference, UTR, check number..."
                      rows={2}
                    />
                  </label>
                </div>
              </div>

              <div className="modal-actions">
                <Button secondary type="button" onClick={closeForm}>
                  Cancel
                </Button>
                <Button type="submit">
                  Record Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Panel
        title="Deal Payments"
        action={
          <div className="panel-actions">
            <select
              className="filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              aria-label="Filter by payment status"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        }
      >
        {filteredDeals.length ? (
          <>
            {/* Desktop Table View */}
            <div className="table-scroll desktop-data-table">
              <table>
                <thead>
                  <tr>
                    <th>Deal</th>
                    <th>Dealer</th>
                    <th>Original Amount</th>
                    <th>Paid</th>
                    <th>Remaining</th>
                    <th>Status</th>
                    <th>Last Payment</th>
                    <th style={{ textAlign: "right", paddingRight: "20px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((row) => (
                    <React.Fragment key={row.deal.id}>
                      <tr>
                        <td>
                          <b>{row.deal.name}</b>
                          <small className="table-id">{row.deal.id}</small>
                        </td>
                        <td>{row.dealer?.name || "Dealer not linked"}</td>
                        <td><b>{money(row.original)}</b></td>
                        <td style={{ color: "var(--green)", fontWeight: 600 }}>{money(row.paid)}</td>
                        <td style={{ color: row.remaining > 0 ? "var(--yellow)" : "var(--muted)", fontWeight: 600 }}>
                          {money(row.remaining)}
                        </td>
                        <td><Status>{row.status}</Status></td>
                        <td>
                          {row.lastPayment ? (
                            <div>
                              <span>{row.lastPayment.date}</span>
                              <small className="table-id">{money(row.lastPayment.amount)}</small>
                            </div>
                          ) : (
                            <span style={{ color: "var(--muted)" }}>No payments</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn-action"
                              onClick={() =>
                                setSelectedHistoryId(selectedHistoryId === row.deal.id ? null : row.deal.id)
                              }
                            >
                              {selectedHistoryId === row.deal.id ? "Hide history" : "History"} ({row.payments.length})
                            </button>
                            {row.remaining > 0 && (
                              <button
                                type="button"
                                className="button secondary"
                                style={{ height: "30px", fontSize: "11px", padding: "0 10px" }}
                                onClick={() => openAddPaymentForDeal(row.deal.id)}
                              >
                                <Plus size={13} /> Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {selectedHistoryId === row.deal.id && (
                        <tr>
                          <td colSpan={8} style={{ background: "#f8fafd", padding: "16px 20px" }}>
                            <div className="payment-history-box" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px 18px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
                                <strong>Payment History for {row.deal.name}</strong>
                                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                                  Total Paid: <b style={{ color: "var(--green)" }}>{money(row.paid)}</b> of {money(row.original)}
                                </span>
                              </div>
                              {row.payments.length ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {row.payments.map((payment) => (
                                    <div
                                      key={payment.id}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "8px 12px",
                                        background: "#fafcff",
                                        borderRadius: "6px",
                                        border: "1px solid #edf2fa",
                                        fontSize: "12px",
                                      }}
                                    >
                                      <div>
                                        <b style={{ marginRight: "12px" }}>{payment.date}</b>
                                        <span style={{ color: "var(--muted)", marginRight: "12px" }}>Method: {payment.method}</span>
                                        {payment.notes && <span style={{ color: "var(--ink)", fontStyle: "italic" }}>"{payment.notes}"</span>}
                                      </div>
                                      <strong style={{ color: "var(--green)", fontFamily: "Manrope" }}>
                                        +{money(payment.amount)}
                                      </strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: "12px", color: "var(--muted)" }}>No payments recorded yet.</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card-Based Payments (Zero horizontal scrolling) */}
            <div className="mobile-data-list">
              {filteredDeals.map((row) => (
                <article className="mobile-card-item" key={row.deal.id} style={{ cursor: "default" }}>
                  <div className="mobile-card-main">
                    <div className="mobile-card-copy">
                      <b>{row.deal.name}</b>
                      <span>{row.dealer?.name || "Dealer not linked"}</span>
                    </div>
                    <div className="mobile-card-amount">{money(row.original)}</div>
                  </div>

                  <div className="payment-deal-values" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", margin: "8px 0", padding: "10px 0", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                    <Detail label="Original" value={money(row.original)} />
                    <Detail label="Paid" value={money(row.paid)} />
                    <Detail label="Remaining" value={money(row.remaining)} />
                  </div>

                  <div className="mobile-card-meta">
                    <span>Last: {row.lastPayment?.date || "None"}</span>
                    <Status>{row.status}</Status>
                  </div>

                  <div className="mobile-card-actions" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                    <button
                      type="button"
                      className="link-btn-subtle"
                      onClick={() => setSelectedHistoryId(selectedHistoryId === row.deal.id ? null : row.deal.id)}
                    >
                      {selectedHistoryId === row.deal.id ? "Hide History" : `History (${row.payments.length})`}
                    </button>
                    {row.remaining > 0 && (
                      <button
                        type="button"
                        className="button secondary"
                        style={{ height: "32px", fontSize: "11px", padding: "0 12px" }}
                        onClick={() => openAddPaymentForDeal(row.deal.id)}
                      >
                        <Plus size={13} /> Record Payment
                      </button>
                    )}
                  </div>

                  {selectedHistoryId === row.deal.id && (
                    <div className="payment-history" style={{ marginTop: "12px", padding: "12px", borderRadius: "8px", background: "#f8fafd", border: "1px solid var(--line)" }}>
                      <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px" }}>Payment Records</strong>
                      {row.payments.length ? (
                        row.payments.map((p) => (
                          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "4px 0", borderBottom: "1px dashed #e2e8f0" }}>
                            <span>{p.date} · {p.method} {p.notes ? `(${p.notes})` : ""}</span>
                            <b style={{ color: "var(--green)" }}>{money(p.amount)}</b>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>No payments recorded.</span>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Search size={20} />
            <b>No deals found</b>
            <span>Create a deal or change your filter to see payment records.</span>
          </div>
        )}
      </Panel>
    </>
  );
}

function Analytics({ onNavigate }) {
  const { data } = useData();
  const [period, setPeriod] = useState("Monthly");

  const analytics = calculateAnalytics(data.transactions, data.payments, period);

  // Additional unified earnings and deals calculations
  const totalDealsVolume = data.transactions.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
  const totalBrokerage = data.transactions.reduce((sum, item) => {
    const rev = Number(item.totalRate || item.amount) || 0;
    const rate = Number(item.brokerageRate) || 0;
    return sum + (item.brokerageEarned != null ? Number(item.brokerageEarned) : (rev * rate) / 100);
  }, 0);

  const pendingBrokerage = data.transactions
    .filter((item) => item.status !== "Completed")
    .reduce((sum, item) => {
      const rev = Number(item.totalRate || item.amount) || 0;
      const rate = Number(item.brokerageRate) || 0;
      return sum + (item.brokerageEarned != null ? Number(item.brokerageEarned) : (rev * rate) / 100);
    }, 0);

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Performance & Earnings"
        title="Analytics"
        description="Comprehensive finance intelligence across sales volume, brokerage earnings, dealer metrics, and settlement activity."
        action={
          <div className="analytics-header-actions">
            <div className="segmented-control period-control" role="radiogroup" aria-label="Analytics Period">
              <button
                type="button"
                role="radio"
                aria-checked={period === "Weekly"}
                className={`segmented-btn ${period === "Weekly" ? "active" : ""}`}
                onClick={() => setPeriod("Weekly")}
              >
                Weekly
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "Monthly"}
                className={`segmented-btn ${period === "Monthly" ? "active" : ""}`}
                onClick={() => setPeriod("Monthly")}
              >
                Monthly
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={period === "Quarterly"}
                className={`segmented-btn ${period === "Quarterly" ? "active" : ""}`}
                onClick={() => setPeriod("Quarterly")}
              >
                Quarterly
              </button>
            </div>
            <Button
              onClick={() =>
                downloadCsv(
                  `diamond-finance-analytics-${period.toLowerCase()}.csv`,
                  ["Metric", "Value"],
                  [
                    ["Period", period],
                    ["Period Volume", money(analytics.revenue)],
                    ["Deals Count", String(analytics.transactionsCount)],
                    ["Period Brokerage / Earnings", money(analytics.earnings)],
                    ["Period Payments Collected", money(analytics.paymentsTotal)],
                    ["All-Time Total Volume", money(totalDealsVolume)],
                    ["All-Time Brokerage Earned", money(totalBrokerage)],
                    ["Pending Brokerage", money(pendingBrokerage)],
                  ],
                )
              }
              icon={Download}
            >
              Export Report
            </Button>
          </div>
        }
      />

      <div className="report-summary">
        <div className="stat">
          <span className="stat-top">Volume ({period})</span>
          <strong>{money(analytics.revenue)}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Deals ({period})</span>
          <strong>{analytics.transactionsCount}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Brokerage / Earnings ({period})</span>
          <strong style={{ color: "var(--green)" }}>{money(analytics.earnings)}</strong>
        </div>
        <div className="stat">
          <span className="stat-top">Payments Collected ({period})</span>
          <strong>{money(analytics.paymentsTotal)}</strong>
        </div>
      </div>

      <div className="earnings-support" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div className="panel support-card" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>All-Time Brokerage Earned</span>
            <strong style={{ fontFamily: "Manrope", fontSize: "20px", display: "block", marginTop: "4px" }}>{money(totalBrokerage)}</strong>
            <small style={{ fontSize: "10px", color: "var(--muted)" }}>Across all {data.transactions.length} deals</small>
          </div>
          <div className="stat-icon">
            <CircleDollarSign size={18} />
          </div>
        </div>

        <div className="panel support-card" style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>Pending Brokerage</span>
            <strong style={{ fontFamily: "Manrope", fontSize: "20px", display: "block", marginTop: "4px", color: "var(--yellow)" }}>{money(pendingBrokerage)}</strong>
            <small style={{ fontSize: "10px", color: "var(--muted)" }}>
              {data.transactions.filter((item) => item.status !== "Completed").length} pending deals
            </small>
          </div>
          <div className="stat-icon">
            <Wallet size={18} />
          </div>
        </div>
      </div>

      <div className="report-layout">
        <Panel title={`${period} Revenue Trend`} className="report-panel">
          <div className="report-card-body">
            {analytics.hasData ? (
              <DynamicBarChart chartData={analytics.chartData} yTicks={analytics.yTicks} />
            ) : (
              <div className="empty-state" style={{ minHeight: "220px" }}>
                <Search size={20} />
                <b>No deals recorded for this period</b>
                <span>Try selecting another timeframe or create a new deal.</span>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Deal Activity & Status" className="report-panel">
          <div className="report-activity-list">
            <div>
              <span>Completed Deals</span>
              <strong>
                {data.transactions.filter((item) => item.status === "Completed").length}
              </strong>
              <small>
                {data.transactions.length
                  ? Math.round((data.transactions.filter((item) => item.status === "Completed").length / data.transactions.length) * 100)
                  : 0}
                % of total portfolio
              </small>
            </div>
            <div>
              <span>Pending Deals</span>
              <strong>
                {data.transactions.filter((item) => item.status === "Pending").length}
              </strong>
              <small>
                {money(
                  data.transactions
                    .filter((item) => item.status === "Pending")
                    .reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0)
                )} volume
              </small>
            </div>
            <div>
              <span>Processing Deals</span>
              <strong>
                {data.transactions.filter((item) => item.status === "Processing").length}
              </strong>
              <small>Awaiting settlement review</small>
            </div>
          </div>
        </Panel>

        <Panel title="Top Dealer Rankings" className="report-panel full-width-panel">
          <div className="dealer-rankings">
            {data.dealers.map((dealer, index) => {
              const records = data.transactions.filter(
                (item) => item.dealerId === dealer.id || item.sellerId === dealer.id
              );
              const volume = records.reduce((sum, item) => sum + (item.totalRate || item.amount || 0), 0);
              return (
                <div className="dealer-rank-row" key={dealer.id}>
                  <div className="dealer-rank-badge">#{index + 1}</div>
                  <div className="dealer-rank-copy">
                    <strong>{dealer.name}</strong>
                    <small>{dealer.location} • {dealerTypeLabel(dealer.type)}</small>
                  </div>
                  <div className="dealer-rank-value">
                    <b>{money(volume)}</b>
                    <span>{records.length} deals</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Deals & Earnings Breakdown" className="report-panel full-width-panel">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Deal ID</th>
                  <th>Deal Name</th>
                  <th>Dealer</th>
                  <th>Date</th>
                  <th>Deal Volume</th>
                  <th>Brokerage Rate</th>
                  <th>Earned Brokerage</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.slice(0, 10).map((item) => {
                  const dealer = data.dealers.find((entry) => entry.id === (item.dealerId || item.sellerId));
                  const rev = Number(item.totalRate || item.amount) || 0;
                  const rate = Number(item.brokerageRate) || 0;
                  const earned = item.brokerageEarned != null ? Number(item.brokerageEarned) : (rev * rate) / 100;
                  return (
                    <tr key={item.id}>
                      <td><b>{item.id}</b></td>
                      <td>{item.name}</td>
                      <td>{dealer?.name || "Dealer not linked"}</td>
                      <td>{item.date}</td>
                      <td><b>{money(rev)}</b></td>
                      <td>{rate}%</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>{money(earned)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Bookkeeping({ onNavigate }) {
  const { data, user, addBookkeepingEntry, updateBookkeepingEntry, deleteBookkeepingEntry } = useData();
  const entries = data.bookkeeping || [];
  const [filter, setFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    entryType: "Expense",
    date: new Date().toISOString().slice(0, 10),
    category: "Dealer Payment",
    dealerId: "",
    transactionId: "",
    description: "",
    amount: "",
    paymentMethod: "Bank Transfer",
    notes: "",
  });

  const visibleEntries = entries.filter((entry) => filter === "All" || entry.entryType === filter);
  const totalIncome = visibleEntries.filter((entry) => entry.entryType === "Income").reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = visibleEntries.filter((entry) => entry.entryType === "Expense").reduce((sum, entry) => sum + entry.amount, 0);

  const resetForm = () => {
    setForm({
      entryType: "Expense",
      date: new Date().toISOString().slice(0, 10),
      category: "Dealer Payment",
      dealerId: "",
      transactionId: "",
      description: "",
      amount: "",
      paymentMethod: "Bank Transfer",
      notes: "",
    });
    setEditing(null);
    setFormOpen(false);
    setError("");
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({ ...entry, amount: String(entry.amount) });
    setFormOpen(true);
    setError("");
  };

  const categories = form.entryType === "Income"
    ? ["Diamond Sale", "Brokerage Income", "Dealer Payment Received", "Advance Received", "Other Income"]
    : ["Diamond Purchase", "Dealer Payment", "Brokerage Expense", "Office Expense", "Salary", "Rent", "Utilities", "Bank Charges", "Travel", "Other Expense"];

  const changeEntryType = (event) => {
    const entryType = event.target.value;
    setForm((previous) => ({
      ...previous,
      entryType,
      category: entryType === "Income" ? "Diamond Sale" : "Dealer Payment",
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    const amount = Number(String(form.amount).replace(/,/g, ""));
    if (!form.date || !form.category.trim() || !form.description.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError("Enter a date, category, description, and a positive amount.");
      return;
    }
    const entry = {
      ...form,
      id: editing?.id || crypto.randomUUID(),
      userId: user.id,
      category: form.category.trim(),
      description: form.description.trim(),
      amount,
      notes: form.notes.trim(),
    };
    try {
      if (editing) await updateBookkeepingEntry(editing.id, entry);
      else await addBookkeepingEntry(entry);
      resetForm();
    } catch (err) {
      setError(err?.message || "Unable to save bookkeeping entry. Please try again.");
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Delete "${entry.description}"?`)) return;
    try {
      await deleteBookkeepingEntry(entry.id);
    } catch (err) {
      setError(err?.message || "Unable to delete bookkeeping entry. Please try again.");
    }
  };

  const setField = (event) =>
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));

  useEffect(() => {
    if (!formOpen || typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formOpen]);

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Finance"
        title="Bookkeeping"
        description="Keep a simple record of business money coming in and going out."
        action={<Button onClick={() => { resetForm(); setFormOpen(true); }}>Add Entry</Button>}
      />
      <div className="bookkeeping-summary">
        <div className="stat"><span className="stat-top">Total income</span><strong>{money(totalIncome)}</strong></div>
        <div className="stat"><span className="stat-top">Total expenses</span><strong>{money(totalExpenses)}</strong></div>
        <div className="stat"><span className="stat-top">Net balance</span><strong>{money(totalIncome - totalExpenses)}</strong></div>
      </div>
      {formOpen && (
        <form className="panel bookkeeping-form" onSubmit={submit}>
          <div className="panel-head bookkeeping-form-head">
            <button type="button" className="bookkeeping-back" onClick={resetForm}><ChevronLeft size={16} /> Back</button>
            <h2>{editing ? "Edit bookkeeping entry" : "Add bookkeeping entry"}</h2>
            <button type="button" className="icon-btn bookkeeping-close" onClick={resetForm} aria-label="Close entry form"><X size={17} /></button>
          </div>
          <div className="form-grid">
            <label className="field-group"><span className="field-title">Entry Type</span><select name="entryType" value={form.entryType} onChange={changeEntryType}><option>Income</option><option>Expense</option></select></label>
            <label className="field-group"><span className="field-title">Date</span><input name="date" type="date" value={form.date} onChange={setField} required /></label>
            <label className="field-group"><span className="field-title">Category</span><select name="category" value={form.category} onChange={setField} required>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
            <label className="field-group"><span className="field-title">Amount</span><div className="input-with-symbol"><span className="input-symbol">₹</span><input name="amount" inputMode="decimal" value={form.amount} onChange={(event) => { const raw = event.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); setForm((previous) => ({ ...previous, amount: raw ? formatIndianNumber(raw) : "" })); }} required /></div></label>
            <label className="field-group"><span className="field-title">Dealer / Party</span><select name="dealerId" value={form.dealerId} onChange={setField}><option value="">None / Not linked</option>{data.dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.name}</option>)}</select></label>
            <label className="field-group"><span className="field-title">Deal</span><select name="transactionId" value={form.transactionId} onChange={setField}><option value="">None / Not linked</option>{data.transactions.map((transaction) => { const dealer = data.dealers.find((item) => item.id === (transaction.dealerId || transaction.sellerId)); return <option key={transaction.id} value={transaction.id}>{transaction.name}{dealer ? ` - ${dealer.name}` : ""}</option>; })}</select></label>
            <label className="field-group"><span className="field-title">Description</span><input name="description" value={form.description} onChange={setField} required /></label>
            <label className="field-group"><span className="field-title">Payment Method</span><select name="paymentMethod" value={form.paymentMethod} onChange={setField}><option>Bank Transfer</option><option>UPI</option><option>Cash</option><option>Cheque</option><option>Other</option></select></label>
            <label className="field-group full"><span className="field-title">Reference / Notes</span><textarea name="notes" value={form.notes} onChange={setField} /></label>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-actions"><Button secondary type="button" onClick={resetForm}>Cancel</Button><Button type="submit">Save Entry</Button></div>
        </form>
      )}
      {!formOpen && error && <div className="form-error" role="alert">{error}</div>}
      <Panel title="Entries" action={<div className="segmented-control bookkeeping-filter" role="radiogroup" aria-label="Filter bookkeeping entries">{["All", "Income", "Expense"].map((item) => <button key={item} type="button" role="radio" aria-checked={filter === item} className={`segmented-btn ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}</div>}>
        <div className="bookkeeping-list">
          {visibleEntries.length ? visibleEntries.map((entry) => (
            <article className={`bookkeeping-entry ${entry.entryType.toLowerCase()}`} key={entry.id}>
              <div className="bookkeeping-entry-main"><div><strong>{entry.description}</strong><span>{entry.category} · {new Date(entry.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span><small>{entry.paymentMethod}</small></div><strong className="bookkeeping-amount">{entry.entryType === "Income" ? "+" : "-"}{money(entry.amount)}</strong></div>
              <div className="bookkeeping-entry-footer"><span>{entry.entryType}</span><div><button type="button" className="link-btn-subtle" onClick={() => openEdit(entry)}>Edit</button><button type="button" className="link-btn-subtle danger" onClick={() => remove(entry)}>Delete</button></div></div>
            </article>
          )) : <div className="empty-state"><b>No bookkeeping entries yet</b><span>Add your first income or expense entry to get started.</span></div>}
        </div>
      </Panel>
    </>
  );
}

function ProfilePage({ onNavigate }) {
  const { user, profile, setProfile } = useData();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState("");
  const displayName = profile?.full_name || user?.email || "User";
  const initials = (profile?.full_name || user?.email || "U")
    .split(/\s+|@/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  useEffect(() => {
    setFullName(profile?.full_name || "");
  }, [profile?.full_name]);

  const handleSave = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const trimmedName = fullName.trim();
      if (!user?.id) throw new Error("Unable to identify the current account.");
      await updateProfile(user.id, { full_name: trimmedName });
      setProfile({ ...profile, full_name: trimmedName });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      console.error("Profile save failed:", err);
      setError(err?.message || "Unable to save profile changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Workspace"
        title="Profile"
        description="Manage your personal account information."
      />
      {savedNotice && (
        <div className="notice" role="status">
          <CheckCircle2 size={16} color="var(--green)" />
          <span>Profile saved successfully.</span>
        </div>
      )}
      {error && (
        <div className="login-error-banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      <div className="settings-page profile-page">
        <section className="settings-section">
          <div className="settings-section-head"><h2>Personal information</h2></div>
          <form className="settings-field-grid" onSubmit={handleSave}>
            <div className="profile-identity">
              <div className="avatar">{initials}</div>
              <div>
                <strong>{displayName}</strong>
                <small>{user?.email || "Not available"}</small>
              </div>
            </div>
            <label className="settings-field">
              <span>Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" />
            </label>
            <label className="settings-field">
              <span>Email address</span>
              <input value={user?.email || "Not available"} readOnly />
            </label>
            <div className="profile-form-actions">
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
            </div>
          </form>
        </section>
        <section className="settings-section">
          <div className="settings-section-head"><h2>Account</h2></div>
          <div className="settings-field-grid">
            <div className="settings-field"><span>Account email</span><strong>{user?.email || "Not available"}</strong></div>
            <div className="settings-field"><span>Account status</span><strong>{profile?.status || "active"}</strong></div>
          </div>
        </section>
      </div>
    </>
  );
}

function SettingsPage({ onNavigate }) {
  const [settings, setSettings] = useState(loadSettings);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const nextSettings = loadSettings();
    setSettings({
      ...nextSettings,
      businessName: nextSettings.businessName || "Diamond Broker",
      businessAddress: nextSettings.address || "",
      address: nextSettings.address || "",
    });
  }, []);

  const setField = (event) => {
    const { name, value, checked, type } = event.target;
    setSettings((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = () => {
    setError("");
    try {
      saveSettings({ ...settings, address: settings.address || settings.businessAddress || "" });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } catch (err) {
      console.error("Settings save failed:", err);
      setError(err?.message || "Unable to save workspace settings. Please try again.");
    }
  };

  return (
    <>
      <PageHeader
        backTo="/"
        backLabel="Back to Dashboard"
        onNavigate={onNavigate}
        eyebrow="Workspace"
        title="Settings"
        description="Manage your account, business details and operating preferences."
        action={<Button onClick={handleSave}>Save changes</Button>}
      />

      {savedNotice && (
        <div className="notice" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <CheckCircle2 size={16} color="var(--green)" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {error && (
        <div className="login-error-banner" style={{ marginBottom: "16px" }} role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="settings-page">
        <section className="settings-section">
          <div className="settings-section-head">
            <h2>Business</h2>
          </div>
          <div className="settings-field-grid">
            <label className="settings-field">
              <span>Business name</span>
              <input name="businessName" value={settings.businessName || "Diamond Broker"} onChange={setField} />
              <small>Displayed on reports and exports.</small>
            </label>
            <label className="settings-field">
              <span>Default currency</span>
              <select name="currency" value={settings.currency || "INR"} onChange={setField}>
                <option value="INR">INR - Indian Rupee</option>
                <option value="USD">USD - US Dollar</option>
              </select>
              <small>Used for all new deals.</small>
            </label>
            <label className="settings-field full-width-field">
              <span>Business address</span>
              <input name="address" value={settings.address || ""} onChange={setField} />
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
                <small>Notify when a payment or payout is pending.</small>
              </div>
              <input name="paymentReminders" type="checkbox" checked={Boolean(settings.paymentReminders)} onChange={setField} />
            </label>
            <label className="settings-toggle">
              <div>
                <span>Deal alerts</span>
                <small>Alert when new deal activity is recorded.</small>
              </div>
              <input name="transactionAlerts" type="checkbox" checked={Boolean(settings.transactionAlerts)} onChange={setField} />
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
              <select name="timeZone" value={settings.timeZone || "Asia/Kolkata"} onChange={setField}>
                <option value="Asia/Kolkata">Asia/Kolkata</option>
                <option value="America/New_York">America/New_York</option>
              </select>
              <small>Controls date display in the dashboard.</small>
            </label>
            <label className="settings-field">
              <span>Default view</span>
              <select name="defaultView" value={settings.defaultView || "Dashboard"} onChange={setField}>
                <option value="Dashboard">Dashboard</option>
                <option value="Deals">Deals</option>
                <option value="Analytics">Analytics</option>
              </select>
              <small>Opened after login for the workspace.</small>
            </label>
          </div>
        </section>
      </div>
    </>
  );
}

function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      const search = new URLSearchParams(window.location.search);
      const hash = window.location.hash || "";
      if (
        search.get("type") === "recovery" ||
        hash.includes("type=recovery") ||
        search.get("reset") === "true"
      ) {
        return "reset";
      }
    }
    return "login";
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          setMode("reset");
          setError("");
          setSuccessNotice("");
        }
      });
      return () => subscription?.unsubscribe();
    }
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessNotice("");

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await authSignIn(cleanEmail, cleanPassword);
      onLoginSuccess({ user: res.user, profile: res.profile });
    } catch (err) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessNotice("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await authResetPasswordForEmail(cleanEmail);
      setSuccessNotice(
        `Password reset instructions have been sent to ${cleanEmail}. Please check your inbox and click the reset link.`
      );
    } catch (err) {
      setError(err?.message || "Failed to send password reset instructions.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setSuccessNotice("");

    const cleanNewPassword = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanNewPassword || !cleanConfirm) {
      setError("Please fill in both password fields.");
      return;
    }

    if (cleanNewPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (cleanNewPassword !== cleanConfirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await authUpdatePassword(cleanNewPassword);
      setSuccessNotice("Your password has been updated successfully. You can now sign in.");
      setTimeout(() => {
        setMode("login");
        setPassword("");
        setNewPassword("");
        setConfirmPassword("");
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/login");
        }
      }, 2000);
    } catch (err) {
      setError(err?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-head">
          <div className="login-brand">
            <div className="brand-mark">
              <Gem size={20} />
            </div>
            <span>Diamond Finance</span>
          </div>
          <h1>
            {mode === "login"
              ? "Sign in to Diamond Finance"
              : mode === "forgot"
              ? "Reset your password"
              : "Set new password"}
          </h1>
          <p>
            {mode === "login"
              ? "Enter your credentials to access your finance workspace."
              : mode === "forgot"
              ? "Enter your account email to receive a secure password reset link."
              : "Create a secure new password for your account."}
          </p>
        </div>

        {error && (
          <div className="login-error-banner" role="alert">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successNotice && (
          <div className="notice" style={{ display: "flex", alignItems: "flex-start", gap: "8px", margin: 0 }}>
            <CheckCircle2 size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: "1px" }} />
            <span style={{ fontSize: "12px", lineHeight: "1.4" }}>{successNotice}</span>
          </div>
        )}

        {mode === "login" && (
          <form className="login-form" onSubmit={handleLoginSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. heyhkchag@gmail.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="login-password">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setSuccessNotice("");
                  }}
                  style={{
                    fontSize: "11px",
                    color: "var(--blue)",
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="login-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <span>Signing in...</span> : <span>Sign In</span>}
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form className="login-form" onSubmit={handleForgotPasswordSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="forgot-email">Account email address</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. heyhkchag@gmail.com"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <span>Sending Reset Link...</span> : <span>Send Reset Link</span>}
            </button>

            <button
              type="button"
              className="button secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessNotice("");
              }}
              disabled={loading}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {mode === "reset" && (
          <form className="login-form" onSubmit={handleResetPasswordSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="reset-new-password">New Password</label>
              <div className="login-password-wrap">
                <input
                  id="reset-new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete="new-password"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="reset-confirm-password">Confirm New Password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? <span>Updating Password...</span> : <span>Save New Password</span>}
            </button>

            <button
              type="button"
              className="button secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                setMode("login");
                setError("");
                setSuccessNotice("");
                if (typeof window !== "undefined") {
                  window.history.replaceState({}, "", "/login");
                }
              }}
              disabled={loading}
            >
              Back to Sign In
            </button>
          </form>
        )}

        <div className="login-security-note">
          <Lock size={12} />
          <span>Protected finance workspace • Diamond Finance</span>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
