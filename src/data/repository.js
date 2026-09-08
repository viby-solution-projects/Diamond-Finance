import { supabase, isSupabaseConfigured } from './supabaseClient.js';

const STORAGE_KEY = 'diamond-finance-data-v4';
const SETTINGS_KEY = 'diamond-finance-settings-v1';

export const seedData = {
  transactions: [
    {
      id: 'TRX-20481',
      name: 'Mumbai Lot #102',
      dealerId: 'dealer-abc',
      sellerId: 'dealer-abc',
      buyerId: 'dealer-golden',
      date: '2024-09-03',
      diamondCarat: 10,
      perCaratRate: 50000,
      totalRate: 500000,
      amount: 500000,
      terms: 2,
      dueDays: 30,
      sellType: 'Self',
      otherSellType: '',
      brokerageRate: 5,
      brokerageEarned: 25000,
      status: 'Completed',
      paymentMethod: 'Bank transfer',
      notes: 'Round brilliant diamond lot.'
    },
    {
      id: 'TRX-20480',
      name: 'Delhi Lot #88',
      dealerId: 'dealer-golden',
      sellerId: 'dealer-golden',
      buyerId: 'dealer-abc',
      date: '2024-09-02',
      diamondCarat: 12.5,
      perCaratRate: 80000,
      totalRate: 1000000,
      amount: 1000000,
      terms: 2.5,
      dueDays: 45,
      sellType: 'Other',
      otherSellType: 'Wholesale',
      brokerageRate: 5,
      brokerageEarned: 50000,
      status: 'Pending',
      paymentMethod: 'Bank transfer',
      notes: 'Fancy cut diamond parcel.'
    }
  ],
  dealers: [
    { id: 'dealer-abc', name: 'ABC Diamonds', location: 'Mumbai, India', contact: 'Alex Brown', email: 'alex@abcdiamonds.com', phone: '+91 22 5550 0198', status: 'Active', type: 'both' },
    { id: 'dealer-golden', name: 'Golden Carats', location: 'Delhi, India', contact: 'Maya Shah', email: 'maya@goldencarats.com', phone: '+91 11 5550 0186', status: 'Active', type: 'both' }
  ],
  payments: [
    { id: 'PAY-8300', transactionId: 'TRX-20481', dealerId: 'dealer-abc', date: '2024-09-03', amount: 500000, method: 'Bank transfer', status: 'Completed' },
    { id: 'PAY-8301', transactionId: 'TRX-20480', dealerId: 'dealer-golden', date: '2024-09-02', amount: 1000000, method: 'Bank transfer', status: 'Pending' }
  ]
};

export function dealerTypeLabel(type) {
  const t = String(type || 'both').toLowerCase();
  if (t === 'buyer') return 'Buyer';
  if (t === 'seller') return 'Seller';
  return 'Buyer & Seller';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function localRepository() {
  return {
    load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
          return clone(seedData);
        }
        const data = JSON.parse(stored);
        if (!Array.isArray(data.transactions) || !Array.isArray(data.dealers) || !Array.isArray(data.payments)) {
          throw new Error('Invalid data');
        }
        data.dealers = data.dealers.map(d => ({
          ...d,
          type: (d.type || 'both').toLowerCase(),
        }));
        data.transactions = data.transactions.map(t => ({
          diamondCarat: t.diamondCarat ?? 0,
          perCaratRate: t.perCaratRate ?? 0,
          totalRate: t.totalRate ?? (t.amount || 0),
          terms: t.terms ?? 0,
          dueDays: t.dueDays ?? 0,
          sellType: t.sellType || 'Self',
          otherSellType: t.otherSellType || '',
          ...t,
        }));
        return data;
      } catch {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedData));
        return clone(seedData);
      }
    },
    save(data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  };
}

// Supabase Async Repository for Authenticated Finance Operations
export function supabaseRepository() {
  return {
    async loadAll() {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase database is not configured.');
      }

      const [dealersRes, transactionsRes, paymentsRes] = await Promise.all([
        supabase.from('dealers').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('payments').select('*').order('date', { ascending: false }),
      ]);

      if (dealersRes.error) {
        console.error('Supabase fetch dealers error:', dealersRes.error);
        throw new Error('Unable to load finance data. Please check your connection or database permissions.');
      }
      if (transactionsRes.error) {
        console.error('Supabase fetch transactions error:', transactionsRes.error);
        throw new Error('Unable to load finance data. Please check your connection or database permissions.');
      }
      if (paymentsRes.error) {
        console.error('Supabase fetch payments error:', paymentsRes.error);
        throw new Error('Unable to load finance data. Please check your connection or database permissions.');
      }

      const mapDealerFromDb = (d) => ({
        id: d.id,
        name: d.name,
        location: d.location,
        contact: d.contact || d.name,
        email: d.email || '',
        phone: d.phone || '',
        status: d.status || 'Active',
        type: (d.type || 'both').toLowerCase(),
      });

      const mapTrxFromDb = (t) => ({
        id: t.id,
        name: t.name,
        dealerId: t.dealer_id || t.seller_id,
        sellerId: t.seller_id || t.dealer_id,
        buyerId: t.buyer_id,
        date: t.date,
        diamondCarat: Number(t.diamond_carat) || 0,
        perCaratRate: Number(t.per_carat_rate) || 0,
        totalRate: Number(t.total_rate) || Number(t.amount) || 0,
        amount: Number(t.amount) || Number(t.total_rate) || 0,
        terms: Number(t.terms) || 0,
        dueDays: Number(t.due_days) || 0,
        sellType: t.sell_type || 'Self',
        otherSellType: t.other_sell_type || '',
        brokerageRate: Number(t.brokerage_rate) || 5,
        brokerageEarned: Number(t.brokerage_earned) || 0,
        status: t.status || 'Pending',
        paymentMethod: t.payment_method || 'Bank transfer',
        notes: t.notes || '',
      });

      const mapPayFromDb = (p) => ({
        id: p.id,
        transactionId: p.transaction_id,
        dealerId: p.dealer_id,
        date: p.date,
        amount: Number(p.amount) || 0,
        method: p.method || 'Bank transfer',
        status: p.status || 'Completed',
      });

      return {
        dealers: (dealersRes.data || []).map(mapDealerFromDb),
        transactions: (transactionsRes.data || []).map(mapTrxFromDb),
        payments: (paymentsRes.data || []).map(mapPayFromDb),
      };
    },

    async insertDealer(dealer) {
      if (!isSupabaseConfigured || !supabase) return;
      const { error } = await supabase.from('dealers').insert({
        id: dealer.id,
        name: dealer.name,
        location: dealer.location,
        type: dealer.type || 'both',
        contact: dealer.contact,
        email: dealer.email,
        phone: dealer.phone,
        status: dealer.status,
      });
      if (error) {
        console.error('Supabase insertDealer error:', error);
        throw new Error('Unable to create dealer. Please try again.');
      }
    },

    async updateDealer(id, updated) {
      if (!isSupabaseConfigured || !supabase) return;
      const { error } = await supabase.from('dealers').update({
        name: updated.name,
        location: updated.location,
        type: updated.type,
        contact: updated.contact,
        email: updated.email,
        phone: updated.phone,
        status: updated.status,
      }).eq('id', id);
      if (error) {
        console.error('Supabase updateDealer error:', error);
        throw new Error('Unable to update dealer. Please try again.');
      }
    },

    async deleteDealer(id) {
      if (!isSupabaseConfigured || !supabase) return;
      const { error } = await supabase.from('dealers').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteDealer error:', error);
        throw new Error('Unable to delete dealer. Please try again.');
      }
    },

    async insertTransaction(trx) {
      if (!isSupabaseConfigured || !supabase) return;
      const { error } = await supabase.from('transactions').insert({
        id: trx.id,
        name: trx.name,
        dealer_id: trx.dealerId || trx.sellerId,
        seller_id: trx.sellerId || trx.dealerId,
        buyer_id: trx.buyerId,
        date: trx.date,
        diamond_carat: trx.diamondCarat,
        per_carat_rate: trx.perCaratRate,
        total_rate: trx.totalRate,
        amount: trx.amount || trx.totalRate,
        terms: trx.terms,
        due_days: trx.dueDays,
        sell_type: trx.sellType,
        other_sell_type: trx.otherSellType,
        brokerage_rate: trx.brokerageRate,
        brokerage_earned: trx.brokerageEarned,
        status: trx.status,
        payment_method: trx.paymentMethod,
        notes: trx.notes,
      });
      if (error) {
        console.error('Supabase insertTransaction error:', error);
        throw new Error('Unable to create transaction. Please try again.');
      }
    },

    async insertPayment(payment) {
      if (!isSupabaseConfigured || !supabase) return;
      const { error } = await supabase.from('payments').insert({
        id: payment.id,
        transaction_id: payment.transactionId,
        dealer_id: payment.dealerId,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
      });
      if (error) {
        console.error('Supabase insertPayment error:', error);
        throw new Error('Unable to record payment. Please try again.');
      }
    },
  };
}

export const defaultSettings = {
  fullName: 'Jordan Davis',
  email: 'jordan@diamond.com',
  businessName: 'Diamond Broker',
  currency: 'INR',
  address: 'Bandra West, Mumbai, India',
  paymentReminders: true,
  transactionAlerts: true,
  timeZone: 'Asia/Kolkata',
  defaultView: 'Dashboard',
};

export function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '\u20b90';
  return `\u20b9${Math.round(num).toLocaleString('en-IN')}`;
}

export function formatChartAmount(value) {
  const num = Number(value);
  if (!num || !Number.isFinite(num)) return '\u20b90';
  if (num >= 10000000) {
    const cr = num / 10000000;
    const rounded = Math.round(cr * 10) / 10;
    return `\u20b9${rounded}Cr`;
  }
  if (num >= 100000) {
    const lakhs = num / 100000;
    const rounded = Math.round(lakhs * 10) / 10;
    return `\u20b9${rounded}L`;
  }
  if (num >= 1000) {
    const k = num / 1000;
    const rounded = Math.round(k * 10) / 10;
    return `\u20b9${rounded}K`;
  }
  return `\u20b9${Math.round(num)}`;
}

export function transactionRows(data) {
  return (data?.transactions || []).map(item => {
    const dealer = (data?.dealers || []).find(entry => entry.id === (item.dealerId || item.sellerId));
    return [
      item.id,
      dealer?.name || 'Unknown dealer',
      new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      money(item.totalRate || item.amount),
      item.status,
      item.name
    ];
  });
}

export function nextId(prefix, items = []) {
  return `${prefix}-${String(Math.max(0, ...items.map(item => Number(item.id?.split('-')?.pop()) || 0)) + 1).padStart(4, '0')}`;
}

// Comprehensive Analytics Calculation Engine
export function calculateAnalytics(transactions = [], payments = [], period = 'Monthly') {
  const parseDate = (d) => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const validTrx = (transactions || []).map(t => ({
    ...t,
    _date: parseDate(t.date || t.created_at) || new Date()
  }));

  const validPayments = (payments || []).map(p => ({
    ...p,
    _date: parseDate(p.date || p.created_at) || new Date()
  }));

  let buckets = [];
  let periodRevenue = 0;
  let periodTrxCount = 0;
  let periodEarnings = 0;
  let periodPaymentsTotal = 0;

  // Determine date bounds from actual transactions or fallback to recent timeframe
  const dates = validTrx.map(t => t._date.getTime());
  const maxDate = dates.length ? new Date(Math.max(...dates)) : new Date();

  if (period === 'Weekly') {
    // Generate 6 chronological weekly buckets ending on the week of latest activity
    const weeks = [];
    const ref = new Date(maxDate);
    const day = ref.getDay();
    const diffToMonday = ref.getDate() - day + (day === 0 ? -6 : 1);
    const latestMonday = new Date(ref.setDate(diffToMonday));
    latestMonday.setHours(0, 0, 0, 0);

    for (let i = 5; i >= 0; i--) {
      const start = new Date(latestMonday);
      start.setDate(start.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weeks.push({
        id: `week-${i}`,
        label,
        start,
        end,
        revenue: 0,
        transactions: 0,
        earnings: 0,
        payments: 0,
      });
    }

    validTrx.forEach(t => {
      weeks.forEach(w => {
        if (t._date >= w.start && t._date <= w.end) {
          const rev = Number(t.totalRate || t.amount) || 0;
          const rate = Number(t.brokerageRate) || 0;
          const earned = t.brokerageEarned != null ? Number(t.brokerageEarned) : (rev * rate) / 100;
          w.revenue += rev;
          w.transactions += 1;
          w.earnings += earned;
        }
      });
    });

    validPayments.forEach(p => {
      weeks.forEach(w => {
        if (p._date >= w.start && p._date <= w.end) {
          w.payments += Number(p.amount) || 0;
        }
      });
    });

    buckets = weeks.map(w => ({
      label: w.label,
      value: w.revenue,
      transactions: w.transactions,
      earnings: w.earnings,
      payments: w.payments,
    }));

    periodRevenue = weeks.reduce((sum, w) => sum + w.revenue, 0);
    periodTrxCount = weeks.reduce((sum, w) => sum + w.transactions, 0);
    periodEarnings = weeks.reduce((sum, w) => sum + w.earnings, 0);
    periodPaymentsTotal = weeks.reduce((sum, w) => sum + w.payments, 0);

  } else if (period === 'Quarterly') {
    // Standard Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
    const quarters = [
      { label: 'Q1', months: [0, 1, 2], revenue: 0, transactions: 0, earnings: 0, payments: 0 },
      { label: 'Q2', months: [3, 4, 5], revenue: 0, transactions: 0, earnings: 0, payments: 0 },
      { label: 'Q3', months: [6, 7, 8], revenue: 0, transactions: 0, earnings: 0, payments: 0 },
      { label: 'Q4', months: [9, 10, 11], revenue: 0, transactions: 0, earnings: 0, payments: 0 },
    ];

    validTrx.forEach(t => {
      const m = t._date.getMonth();
      const q = quarters.find(item => item.months.includes(m));
      if (q) {
        const rev = Number(t.totalRate || t.amount) || 0;
        const rate = Number(t.brokerageRate) || 0;
        const earned = t.brokerageEarned != null ? Number(t.brokerageEarned) : (rev * rate) / 100;
        q.revenue += rev;
        q.transactions += 1;
        q.earnings += earned;
      }
    });

    validPayments.forEach(p => {
      const m = p._date.getMonth();
      const q = quarters.find(item => item.months.includes(m));
      if (q) {
        q.payments += Number(p.amount) || 0;
      }
    });

    buckets = quarters.map(q => ({
      label: q.label,
      value: q.revenue,
      transactions: q.transactions,
      earnings: q.earnings,
      payments: q.payments,
    }));

    periodRevenue = quarters.reduce((sum, q) => sum + q.revenue, 0);
    periodTrxCount = quarters.reduce((sum, q) => sum + q.transactions, 0);
    periodEarnings = quarters.reduce((sum, q) => sum + q.earnings, 0);
    periodPaymentsTotal = quarters.reduce((sum, q) => sum + q.payments, 0);

  } else {
    // Monthly period
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const months = monthNames.map((name, index) => ({
      monthIndex: index,
      label: name,
      revenue: 0,
      transactions: 0,
      earnings: 0,
      payments: 0,
    }));

    validTrx.forEach(t => {
      const m = t._date.getMonth();
      const target = months[m];
      if (target) {
        const rev = Number(t.totalRate || t.amount) || 0;
        const rate = Number(t.brokerageRate) || 0;
        const earned = t.brokerageEarned != null ? Number(t.brokerageEarned) : (rev * rate) / 100;
        target.revenue += rev;
        target.transactions += 1;
        target.earnings += earned;
      }
    });

    validPayments.forEach(p => {
      const m = p._date.getMonth();
      const target = months[m];
      if (target) {
        target.payments += Number(p.amount) || 0;
      }
    });

    // Display standard 7-month window (Apr - Oct) or months containing activity
    buckets = months.filter((m, idx) => idx >= 3 && idx <= 9).map(m => ({
      label: m.label,
      value: m.revenue,
      transactions: m.transactions,
      earnings: m.earnings,
      payments: m.payments,
    }));

    periodRevenue = months.reduce((sum, m) => sum + m.revenue, 0);
    periodTrxCount = months.reduce((sum, m) => sum + m.transactions, 0);
    periodEarnings = months.reduce((sum, m) => sum + m.earnings, 0);
    periodPaymentsTotal = months.reduce((sum, m) => sum + m.payments, 0);
  }

  const maxVal = Math.max(...buckets.map(b => b.value), 0);
  const chartMax = maxVal > 0 ? Math.ceil((maxVal * 1.25) / 100000) * 100000 : 500000;

  const chartData = buckets.map(b => ({
    ...b,
    heightPercent: chartMax > 0 && b.value > 0 ? Math.max(10, Math.min(100, Math.round((b.value / chartMax) * 100))) : 0,
  }));

  const yTicks = [
    chartMax,
    Math.round(chartMax * 0.8),
    Math.round(chartMax * 0.6),
    Math.round(chartMax * 0.4),
    Math.round(chartMax * 0.2),
    0
  ];

  const allTimeRevenue = validTrx.reduce((sum, t) => sum + (Number(t.totalRate || t.amount) || 0), 0);
  const allTimeTrxCount = validTrx.length;
  const allTimeEarnings = validTrx.reduce((sum, t) => {
    const rev = Number(t.totalRate || t.amount) || 0;
    const rate = Number(t.brokerageRate) || 0;
    const earned = t.brokerageEarned != null ? Number(t.brokerageEarned) : (rev * rate) / 100;
    return sum + (Number.isFinite(earned) ? earned : 0);
  }, 0);
  const allTimePayments = validPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return {
    period,
    revenue: periodRevenue,
    transactionsCount: periodTrxCount,
    earnings: periodEarnings,
    paymentsTotal: periodPaymentsTotal,
    totalRevenue: allTimeRevenue,
    totalTransactionsCount: allTimeTrxCount,
    totalEarnings: allTimeEarnings,
    totalPayments: allTimePayments,
    hasData: periodTrxCount > 0 || periodRevenue > 0,
    chartData,
    yTicks,
    chartMax,
  };
}

