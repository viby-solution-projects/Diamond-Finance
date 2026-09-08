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


function clone(value) { return JSON.parse(JSON.stringify(value)); }

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
    save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
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
  } catch { return { ...defaultSettings }; }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '\u20b90';
  return `\u20b9${Math.round(num).toLocaleString('en-IN')}`;
}

export function transactionRows(data) {
  return data.transactions.map(item => {
    const dealer = data.dealers.find(entry => entry.id === item.dealerId);
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

export function nextId(prefix, items) {
  return `${prefix}-${String(Math.max(0, ...items.map(item => Number(item.id.split('-').pop()) || 0)) + 1).padStart(4, '0')}`;
}

