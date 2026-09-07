const STORAGE_KEY = 'diamond-finance-data-v1';

export const seedData = {
  transactions: [
    { id: 'TRX-20481', name: 'Mumbai Lot #102', dealerId: 'dealer-abc', date: '2024-09-03', amount: 1250000, brokerageRate: 5, status: 'Completed', paymentMethod: 'Bank transfer', notes: 'Round brilliant diamond lot.' },
    { id: 'TRX-20480', name: 'Delhi Lot #88', dealerId: 'dealer-golden', date: '2024-09-02', amount: 928050, brokerageRate: 5, status: 'Pending', paymentMethod: 'Bank transfer', notes: '' },
    { id: 'TRX-20479', name: 'Chicago Lot #31', dealerId: 'dealer-gem', date: '2024-09-01', amount: 2467000, brokerageRate: 5, status: 'Completed', paymentMethod: 'Bank transfer', notes: '' },
    { id: 'TRX-20478', name: 'LA Lot #14', dealerId: 'dealer-district', date: '2024-08-30', amount: 695000, brokerageRate: 5, status: 'Processing', paymentMethod: 'Bank transfer', notes: '' },
    { id: 'TRX-20477', name: 'Jaipur Lot #9', dealerId: 'dealer-elite', date: '2024-08-29', amount: 1230000, brokerageRate: 5, status: 'Completed', paymentMethod: 'Bank transfer', notes: '' }
  ],
  dealers: [
    { id: 'dealer-abc', name: 'ABC Diamonds', location: 'Mumbai, India', contact: 'Alex Brown', email: 'alex@abcdiamonds.com', phone: '+91 22 5550 0198', status: 'Active' },
    { id: 'dealer-golden', name: 'Golden Carats', location: 'Delhi, India', contact: 'Maya Shah', email: 'maya@goldencarats.com', phone: '+91 11 5550 0186', status: 'Active' },
    { id: 'dealer-gem', name: 'The Gem House', location: 'Chicago, IL', contact: 'Sam Lee', email: 'sam@gemhouse.com', phone: '+1 312 555 0163', status: 'Active' },
    { id: 'dealer-district', name: 'Diamond District', location: 'Los Angeles, CA', contact: 'Nina Patel', email: 'nina@diamonddistrict.com', phone: '+1 213 555 0098', status: 'Inactive' },
    { id: 'dealer-elite', name: 'Elite Stones', location: 'Jaipur, India', contact: 'Ravi Mehta', email: 'ravi@elitestones.com', phone: '+91 141 555 0123', status: 'Active' }
  ],
  payments: [
    { id: 'PAY-8300', transactionId: 'TRX-20481', dealerId: 'dealer-abc', date: '2024-09-03', amount: 1250000, method: 'Bank transfer', status: 'Completed' },
    { id: 'PAY-8301', transactionId: 'TRX-20480', dealerId: 'dealer-golden', date: '2024-09-02', amount: 928050, method: 'Bank transfer', status: 'Pending' },
    { id: 'PAY-8302', transactionId: 'TRX-20479', dealerId: 'dealer-gem', date: '2024-09-01', amount: 2467000, method: 'Bank transfer', status: 'Completed' }
  ]
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
export function localRepository() {
  return {
    load() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return clone(seedData);
        const data = JSON.parse(stored);
        if (!Array.isArray(data.transactions) || !Array.isArray(data.dealers) || !Array.isArray(data.payments)) throw new Error('Invalid data');
        return data;
      } catch { return clone(seedData); }
    },
    save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  };
}
export function money(value) { return `\u20b9${Math.round(value || 0).toLocaleString('en-IN')}`; }
export function transactionRows(data) { return data.transactions.map(item => { const dealer = data.dealers.find(entry => entry.id === item.dealerId); return [item.id, dealer?.name || 'Unknown dealer', new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }), money(item.amount), item.status, item.name]; }); }
export function nextId(prefix, items) { return `${prefix}-${String(Math.max(0, ...items.map(item => Number(item.id.split('-').pop()) || 0)) + 1).padStart(4, '0')}`; }
