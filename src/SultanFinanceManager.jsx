import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  orderBy,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend 
} from 'recharts';
import { 
  LayoutDashboard, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  PiggyBank, 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  LogOut, 
  Save,
  Activity,
  User,
  CheckCircle,
  XCircle,
  Filter,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

/**
 * FIREBASE CONFIGURATION (SULTAN FINANCE - TOTI ARDIANSYAH)
 */
const firebaseConfig = {
    apiKey: "AIzaSyBWzTjMHLzDuoCQVdgjOZORFkbzxijEh5E",
    authDomain: "sultanfinance.firebaseapp.com",
    projectId: "sultanfinance",
    storageBucket: "sultanfinance.firebasestorage.app",
    messagingSenderId: "894944147292",
    appId: "1:894944147292:web:300f17572e6efdfceb7399",
    measurementId: "G-FC9L8KL8P7"
};

// Initialize Firebase with explicit config
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * CONSTANTS
 */
const CATEGORIES = {
  LIVING: { id: 'LIVING', label: 'Biaya Hidup (40%)', color: '#10B981', pct: 0.4 },
  OPS: { id: 'OPS', label: 'Operasional/Skripsi (30%)', color: '#3B82F6', pct: 0.3 },
  SAVING: { id: 'SAVING', label: 'Tabungan (20%)', color: '#8B5CF6', pct: 0.2 },
  SOCIAL: { id: 'SOCIAL', label: 'Sosial/Main (10%)', color: '#F59E0B', pct: 0.1 },
  INCOME: { id: 'INCOME', label: 'Pemasukan', color: '#ffffff', pct: 0 }
};

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

const formatCurrency = (num) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

const formatDate = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
};

/**
 * MAIN COMPONENT
 */
export default function SultanFinanceManager() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savings, setSavings] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Error State
  const [permissionError, setPermissionError] = useState(false);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Realtime Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth & Data Fetching
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth Error:", err);
        // Jika auth gagal, permission error juga mungkin terjadi
        setPermissionError(true);
      }
    };
    initAuth();
    
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // --- DATA FETCHING (REALTIME) ---
        
        // Helper untuk handle error snapshot
        const handleSnapshotError = (err) => {
            console.error("Snapshot Error:", err);
            if (err.code === 'permission-denied') {
                setPermissionError(true);
                setLoading(false);
            }
        };

        // 1. Transactions
        const qTx = query(
          collection(db, 'users', currentUser.uid, 'transactions'),
          orderBy('date', 'desc') 
        );
        const unsubTx = onSnapshot(qTx, 
            (snapshot) => setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))), 
            handleSnapshotError
        );

        // 2. Debts
        const qDebt = query(
          collection(db, 'users', currentUser.uid, 'debts'),
          orderBy('createdAt', 'desc')
        );
        const unsubDebt = onSnapshot(qDebt, 
            (snapshot) => setDebts(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
            handleSnapshotError
        );

        // 3. Savings
        const qSaving = query(
          collection(db, 'users', currentUser.uid, 'savings'),
          orderBy('date', 'desc')
        );
        const unsubSaving = onSnapshot(qSaving, 
            (snapshot) => {
                setSavings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            },
            handleSnapshotError
        );

        return () => {
          unsubTx();
          unsubDebt();
          unsubSaving();
        };
      } else {
        // Loading state handled in auth check or error
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // -- CALCULATIONS --

  // Filter Transactions by Month
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  // Financial Summaries
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    
    // Initialize Budgets
    const budgets = {
      LIVING: { limit: 0, used: 0, remaining: 0 },
      OPS: { limit: 0, used: 0, remaining: 0 },
      SAVING: { limit: 0, used: 0, remaining: 0 },
      SOCIAL: { limit: 0, used: 0, remaining: 0 }
    };

    filteredTransactions.forEach(t => {
      const amount = parseFloat(t.amount);
      
      if (t.type === 'in') {
        totalIncome += amount;
        budgets.LIVING.limit += amount * CATEGORIES.LIVING.pct;
        budgets.OPS.limit += amount * CATEGORIES.OPS.pct;
        budgets.SAVING.limit += amount * CATEGORIES.SAVING.pct;
        budgets.SOCIAL.limit += amount * CATEGORIES.SOCIAL.pct;
      } else {
        totalExpense += amount;
        if (budgets[t.category]) {
          budgets[t.category].used += amount;
        }
      }
    });

    Object.keys(budgets).forEach(key => {
      budgets[key].remaining = budgets[key].limit - budgets[key].used;
    });

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, budgets };
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    return [
      { name: 'Hidup', value: summary.budgets.LIVING.used, color: CATEGORIES.LIVING.color },
      { name: 'Ops/Skripsi', value: summary.budgets.OPS.used, color: CATEGORIES.OPS.color },
      { name: 'Tabungan', value: summary.budgets.SAVING.used, color: CATEGORIES.SAVING.color },
      { name: 'Sosial', value: summary.budgets.SOCIAL.used, color: CATEGORIES.SOCIAL.color },
    ].filter(i => i.value > 0);
  }, [summary]);

  // -- HANDLERS --

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const amount = parseFloat(form.amount.value);
    
    if (!amount || amount <= 0) return alert("Nominal harus diisi");

    const newTx = {
      amount: amount,
      type: form.type.value,
      category: form.type.value === 'in' ? 'INCOME' : form.category.value,
      date: form.date.value,
      desc: form.desc.value,
      method: form.method.value,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'users', user.uid, 'transactions'), newTx);
      form.reset();
      form.date.value = new Date().toISOString().split('T')[0];
    } catch (err) {
      console.error(err);
      alert("Gagal simpan: Cek koneksi atau izin database.");
    }
  };

  const handleAddSaving = async (e) => {
      e.preventDefault();
      if(!user) return;
      const form = e.target;
      const amount = parseFloat(form.amount.value);

      const newSaving = {
          amount: amount,
          location: form.location.value, // e.g. Bibit, Bank Jago
          date: form.date.value,
          note: form.note.value,
          createdAt: serverTimestamp()
      }

      try {
          await addDoc(collection(db, 'users', user.uid, 'savings'), newSaving);
          form.reset();
          form.date.value = new Date().toISOString().split('T')[0];
      } catch (err) {
          console.error(err);
      }
  }

  // Debt Handlers
  const handleAddDebt = async (e) => {
    e.preventDefault();
    if (!user) return;
    const form = e.target;
    const newDebt = {
      name: form.name.value,
      amount: parseFloat(form.amount.value),
      type: form.type.value,
      date: form.date.value,
      desc: form.desc.value,
      isPaid: false,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, 'users', user.uid, 'debts'), newDebt);
    form.reset();
  };
  
  const toggleDebtStatus = async (id, status) => {
    await updateDoc(doc(db, 'users', user.uid, 'debts', id), { isPaid: !status });
  };
  
  // Generic Delete
  const handleDelete = async (coll, id) => {
      if(confirm('Yakin mau hapus data ini?')) {
          await deleteDoc(doc(db, 'users', user.uid, coll, id));
      }
  }

  // -- RENDER ERROR STATE --
  if (permissionError) {
      return (
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 font-sans">
              <div className="bg-rose-900/20 border border-rose-500/50 p-8 rounded-2xl max-w-2xl w-full text-center space-y-6">
                  <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto text-rose-500">
                      <AlertTriangle size={40} />
                  </div>
                  <h1 className="text-2xl font-bold text-white">Database Terkunci (Permission Denied)</h1>
                  <p className="text-rose-200">
                      Aplikasi berhasil terhubung ke Project Firebase <span className="font-mono bg-rose-950 px-2 py-1 rounded">sultanfinance</span>, 
                      tetapi ditolak saat mencoba membaca/menulis data.
                  </p>
                  
                  <div className="text-left bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                      <h3 className="font-bold text-white border-b border-slate-700 pb-2">Cara Memperbaiki (Wajib dilakukan Pemilik):</h3>
                      <ol className="list-decimal list-inside text-slate-300 space-y-3 text-sm">
                          <li>Buka <a href="https://console.firebase.google.com/" target="_blank" className="text-emerald-400 hover:underline inline-flex items-center gap-1">Firebase Console <ExternalLink size={12}/></a> dan pilih project <b>sultanfinance</b>.</li>
                          <li>Masuk ke menu <b>Firestore Database</b> di sidebar kiri.</li>
                          <li>Pilih tab <b>Rules</b> (Aturan).</li>
                          <li>Hapus semua kode yang ada, dan ganti dengan kode berikut:</li>
                      </ol>
                      <div className="bg-black p-4 rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto">
                          <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // PERINGATAN: Ini mengizinkan semua orang membaca/menulis
      // Ganti nanti jika sudah production
      allow read, write: if true;
    }
  }
}`}</pre>
                      </div>
                      <ol start="5" className="list-decimal list-inside text-slate-300 space-y-3 text-sm">
                          <li>Klik tombol <b>Publish</b>.</li>
                          <li>Kembali ke sini dan refresh halaman ini.</li>
                      </ol>
                  </div>
                  <button onClick={() => window.location.reload()} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-xl transition-all">
                      Saya Sudah Ubah Rules, Refresh Sekarang
                  </button>
              </div>
          </div>
      )
  }
  
  // -- RENDER LOADING --
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-400 animate-pulse font-mono tracking-widest">CONNECTING TO SULTAN DB...</div>;

  // -- RENDER MAIN APP --
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* SIDEBAR */}
      <div className="fixed bottom-0 w-full md:w-64 md:h-screen md:left-0 bg-slate-900/90 backdrop-blur-md border-t md:border-t-0 md:border-r border-slate-800 z-50 flex md:flex-col justify-around md:justify-start md:p-6 shadow-2xl">
        <div className="hidden md:block mb-10">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Sultan<span className="font-light text-slate-400">Finance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-2">Personal Wealth Manager</p>
        </div>

        <NavButton active={activeTab} id="dashboard" icon={<LayoutDashboard size={20}/>} label="Dashboard" onClick={setActiveTab} />
        <NavButton active={activeTab} id="transactions" icon={<Activity size={20}/>} label="Transaksi" onClick={setActiveTab} />
        <NavButton active={activeTab} id="budget" icon={<Wallet size={20}/>} label="Anggaran" onClick={setActiveTab} />
        <NavButton active={activeTab} id="debt" icon={<CreditCard size={20}/>} label="Hutang" onClick={setActiveTab} />
        <NavButton active={activeTab} id="goals" icon={<PiggyBank size={20}/>} label="Tabungan" onClick={setActiveTab} />
        
        <div className="hidden md:block mt-auto pt-6 border-t border-slate-800">
           <div className="flex items-center gap-3 text-slate-400 text-sm">
             <div className="w-8 h-8 rounded-full bg-emerald-900/50 flex items-center justify-center border border-emerald-500/30">
               <User size={14} className="text-emerald-400"/>
             </div>
             <div>
               <p className="text-slate-200">Created by</p>
               <p className="text-xs font-bold text-emerald-400">TOTI ARDIANSYAH</p>
             </div>
           </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="md:ml-64 p-4 md:p-8 pb-24 md:pb-8">
        
        {/* TOP HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-white">
              {activeTab === 'dashboard' && 'Ringkasan Eksekutif'}
              {activeTab === 'transactions' && 'Input Transaksi'}
              {activeTab === 'budget' && 'Kontrol Anggaran'}
              {activeTab === 'debt' && 'Buku Hutang'}
              {activeTab === 'goals' && 'Portofolio Tabungan'}
            </h2>
            <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
              <Calendar size={14} /> {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-4">
             {/* DROPDOWN SELECTOR (Hanya di tab tertentu) */}
             {(activeTab === 'dashboard' || activeTab === 'transactions' || activeTab === 'budget') && (
                 <MonthYearSelector 
                    m={selectedMonth} 
                    y={selectedYear} 
                    setM={setSelectedMonth} 
                    setY={setSelectedYear} 
                 />
             )}
             
            <div className="hidden md:flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-full border border-slate-800">
                <Clock size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-mono font-bold">
                {currentTime.toLocaleTimeString('id-ID')}
                </span>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {activeTab === 'dashboard' && (
            <DashboardView 
              summary={summary} 
              chartData={chartData}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionView 
              onAdd={handleAddTransaction} 
              transactions={filteredTransactions} 
              onDelete={(id) => handleDelete('transactions', id)}
            />
          )}

          {activeTab === 'budget' && (
            <BudgetView 
               budgets={summary.budgets} 
            />
          )}

          {activeTab === 'debt' && (
            <DebtView 
              debts={debts} 
              onAdd={handleAddDebt} 
              onToggle={toggleDebtStatus}
              onDelete={(id) => handleDelete('debts', id)}
            />
          )}

          {activeTab === 'goals' && (
             <GoalsView 
                budgets={summary.budgets} 
                savings={savings}
                onAdd={handleAddSaving}
                onDelete={(id) => handleDelete('savings', id)}
             />
          )}

        </main>
      </div>
    </div>
  );
}

/**
 * REUSABLE COMPONENTS
 */

function MonthYearSelector({ m, y, setM, setY }) {
    return (
        <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <div className="relative">
                <select 
                    value={m} 
                    onChange={(e) => setM(parseInt(e.target.value))}
                    className="appearance-none bg-slate-800 text-white text-sm py-1.5 pl-3 pr-8 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                    {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                    <Filter size={12} />
                </div>
            </div>
            <div className="relative">
                <select 
                    value={y} 
                    onChange={(e) => setY(parseInt(e.target.value))}
                    className="appearance-none bg-slate-800 text-white text-sm py-1.5 pl-3 pr-8 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                    {YEARS.map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                    ))}
                </select>
            </div>
        </div>
    )
}

function NavButton({ active, id, icon, label, onClick }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => onClick(id)}
      className={`flex flex-col md:flex-row items-center md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all duration-300
      ${isActive 
        ? 'bg-emerald-500/10 text-emerald-400 md:translate-x-2' 
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
    >
      <div className={isActive ? 'drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : ''}>
        {icon}
      </div>
      <span className={`text-[10px] md:text-sm font-medium mt-1 md:mt-0 ${isActive ? 'font-bold' : ''}`}>
        {label}
      </span>
    </button>
  );
}

/**
 * VIEWS
 */

function DashboardView({ summary, chartData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <div className="lg:col-span-2 space-y-6">
        {/* Main Balance Card */}
        <div className="bg-gradient-to-br from-emerald-900 to-slate-900 p-6 rounded-3xl border border-emerald-500/20 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
          <div className="relative z-10">
            <p className="text-emerald-400/80 text-sm font-medium tracking-wider mb-1">SALDO REAL (CASHFLOW BULAN INI)</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              {formatCurrency(summary.balance)}
            </h2>
            <div className="mt-4 flex gap-2">
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <TrendingUp size={12}/> +{formatCurrency(summary.totalIncome)}
                </span>
                <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-1 rounded-full border border-rose-500/20 flex items-center gap-1">
                  <TrendingDown size={12}/> -{formatCurrency(summary.totalExpense)}
                </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Total Pengeluaran</p>
                <p className="text-xl font-bold text-white">{formatCurrency(summary.totalExpense)}</p>
              </div>
              <div className="w-10 h-10 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
                <LogOut size={20}/>
              </div>
          </div>
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Sisa Budget Hidup</p>
                <p className={`text-xl font-bold ${summary.budgets.LIVING.remaining < 0 ? 'text-rose-500' : 'text-emerald-400'}`}>
                  {formatCurrency(summary.budgets.LIVING.remaining)}
                </p>
              </div>
              <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                <Activity size={20}/>
              </div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col items-center justify-center min-h-[300px]">
        <h4 className="text-sm font-semibold text-slate-400 mb-4 self-start w-full border-b border-slate-800 pb-2">Komposisi Pengeluaran</h4>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip 
                contentStyle={{backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff', borderRadius: '8px'}}
                itemStyle={{color: '#fff'}}
                formatter={(value) => formatCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
           <div className="text-slate-600 text-sm italic">Belum ada data</div>
        )}
        <div className="w-full mt-4 space-y-2">
            {chartData.map((d, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div>{d.name}</span>
                <span className="text-slate-300 font-mono">{formatCurrency(d.value)}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function TransactionView({ onAdd, transactions, onDelete }) {
  const [type, setType] = useState('out');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Form Input */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit sticky top-8">
         <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
           <Plus className="text-emerald-400"/> Tambah Transaksi
         </h3>
         
         <form onSubmit={onAdd} className="space-y-4">
            <div className="flex bg-slate-800 p-1 rounded-lg mb-6">
              <button type="button" onClick={() => setType('out')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'out' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Pengeluaran</button>
              <button type="button" onClick={() => setType('in')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'in' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Pemasukan</button>
            </div>
            <input type="hidden" name="type" value={type} />

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Nominal (Rp)</label>
              <input name="amount" type="number" placeholder="0" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors text-lg font-mono" required />
            </div>

            {type === 'out' && (
              <div className="space-y-1">
                 <label className="text-xs text-slate-400 ml-1">Kategori</label>
                 <div className="grid grid-cols-1 gap-2">
                   {Object.keys(CATEGORIES).filter(k => k !== 'INCOME').map(key => (
                     <label key={key} className="flex items-center gap-3 p-3 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-500/10">
                       <input type="radio" name="category" value={key} className="accent-emerald-500" defaultChecked={key === 'LIVING'} />
                       <span className="text-sm text-slate-300">{CATEGORIES[key].label}</span>
                     </label>
                   ))}
                 </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs text-slate-400 ml-1">Keterangan</label>
              <input name="desc" type="text" placeholder="Nasi Padang / Gaji" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 ml-1">Metode</label>
                  <input name="method" type="text" placeholder="Cash/QRIS" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 ml-1">Tanggal</label>
                  <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
            </div>
            
            <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all mt-4">
              Simpan Transaksi
            </button>
         </form>
      </div>

      {/* History List */}
      <div className="lg:col-span-2">
        <h3 className="font-bold text-white mb-4">Riwayat Transaksi (Sesuai Bulan Terpilih)</h3>
        
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 border border-dashed border-slate-800 rounded-xl">Belum ada data.</div>
          ) : transactions.map(t => (
            <div key={t.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 hover:border-slate-600 transition-colors flex justify-between items-center group">
               <div className="flex items-center gap-4">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {t.type === 'in' ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}
                 </div>
                 <div>
                   <p className="font-medium text-white">{t.desc}</p>
                   <p className="text-xs text-slate-500 flex gap-2">
                      <span>{formatDate(t.date)}</span> • 
                      <span className="uppercase bg-slate-800 px-1 rounded text-[10px]">{t.method || 'CASH'}</span>
                   </p>
                 </div>
               </div>
               <div className="text-right">
                 <p className={`font-mono font-bold ${t.type === 'in' ? 'text-emerald-400' : 'text-slate-200'}`}>
                   {t.type === 'in' ? '+' : '-'}{formatCurrency(t.amount)}
                 </p>
                 <button onClick={() => onDelete(t.id)} className="text-xs text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Hapus</button>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BudgetView({ budgets }) {
  const list = ['LIVING', 'OPS', 'SAVING', 'SOCIAL'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {list.map(key => {
          const b = budgets[key];
          const percentUsed = b.limit > 0 ? (b.used / b.limit) * 100 : 0;
          const isOver = b.used > b.limit;

          return (
            <div key={key} className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
               <div className="flex justify-between items-start mb-4 relative z-10">
                 <div>
                   <h4 className="font-bold text-white flex items-center gap-2" style={{color: CATEGORIES[key].color}}>
                     {CATEGORIES[key].label}
                   </h4>
                   <p className="text-xs text-slate-500 mt-1">Budget Total: {formatCurrency(b.limit)}</p>
                 </div>
                 <div className="text-right">
                   <p className="text-sm text-slate-400">Sisa</p>
                   <p className={`text-xl font-bold font-mono ${b.remaining < 0 ? 'text-rose-500' : 'text-white'}`}>
                     {formatCurrency(b.remaining)}
                   </p>
                 </div>
               </div>
               <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden relative z-10">
                  <div 
                    className="h-full transition-all duration-1000 ease-out rounded-full"
                    style={{
                      width: `${Math.min(percentUsed, 100)}%`,
                      backgroundColor: isOver ? '#ef4444' : CATEGORIES[key].color
                    }}
                  ></div>
               </div>
               <p className="text-xs text-right mt-2 text-slate-500 relative z-10">
                 Terpakai: {percentUsed.toFixed(1)}% ({formatCurrency(b.used)})
               </p>
               <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-[50px] opacity-10 pointer-events-none" style={{backgroundColor: CATEGORIES[key].color}}></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DebtView({ debts, onAdd, onToggle, onDelete }) {
  const [tab, setTab] = useState('payable');
  const filtered = debts.filter(d => d.type === tab);
  const total = filtered.reduce((acc, curr) => curr.isPaid ? acc : acc + curr.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-fit">
          <h3 className="text-lg font-bold text-white mb-4">Catat Hutang Baru</h3>
          <form onSubmit={onAdd} className="space-y-4">
             <div>
                <div className="flex bg-slate-800 p-1 rounded-lg mt-1">
                  <button type="button" onClick={() => setTab('payable')} className={`flex-1 py-2 text-xs rounded font-bold ${tab === 'payable' ? 'bg-rose-500 text-white' : 'text-slate-400'}`}>Hutang Saya</button>
                  <button type="button" onClick={() => setTab('receivable')} className={`flex-1 py-2 text-xs rounded font-bold ${tab === 'receivable' ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>Piutang Teman</button>
                </div>
                <input type="hidden" name="type" value={tab} />
             </div>
             <input name="name" placeholder="Nama Orang" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" required />
             <input name="amount" type="number" placeholder="Nominal (Rp)" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" required />
             <input name="desc" placeholder="Keterangan" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" />
             <input name="date" type="date" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" required />
             <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl mt-2 transition-all">Simpan</button>
          </form>
       </div>

       <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-end border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-bold text-white">{tab === 'payable' ? 'Daftar Hutang' : 'Daftar Piutang'}</h3>
              <p className="text-xs text-slate-500">Total Belum Lunas</p>
            </div>
            <h2 className={`text-3xl font-mono font-bold ${tab === 'payable' ? 'text-rose-500' : 'text-emerald-400'}`}>{formatCurrency(total)}</h2>
          </div>
          <div className="space-y-3">
             {filtered.map(d => (
               <div key={d.id} className={`p-4 rounded-xl border transition-all ${d.isPaid ? 'bg-slate-900/50 border-slate-800 opacity-60' : 'bg-slate-900 border-slate-700'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                       <div className={`mt-1 w-2 h-2 rounded-full ${d.isPaid ? 'bg-emerald-500' : 'bg-slate-500'}`}></div>
                       <div>
                          <h4 className="font-bold text-white text-lg">{d.name}</h4>
                          <p className="text-sm text-slate-400">{d.desc} • {formatDate(d.date)}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="font-mono font-bold text-white mb-2">{formatCurrency(d.amount)}</p>
                       <div className="flex gap-2 justify-end">
                         <button onClick={() => onDelete(d.id)} className="p-2 hover:bg-slate-800 rounded-full text-rose-500"><Trash2 size={16}/></button>
                         <button onClick={() => onToggle(d.id, d.isPaid)} className={`px-3 py-1 rounded-full text-xs font-bold ${d.isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>{d.isPaid ? 'LUNAS' : 'TANDAI LUNAS'}</button>
                       </div>
                    </div>
                  </div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
}

function GoalsView({ budgets, savings, onAdd, onDelete }) {
  const totalSaved = savings.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
       {/* Info & Form */}
       <div className="space-y-6 h-fit">
          {/* Total Card */}
          <div className="bg-gradient-to-tr from-purple-900 to-indigo-900 p-6 rounded-3xl border border-purple-500/30 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
             <PiggyBank size={40} className="text-purple-300 mx-auto mb-4"/>
             <p className="text-purple-200 text-sm font-medium">TOTAL UANG TABUNGAN (ALL TIME)</p>
             <h2 className="text-3xl font-bold text-white font-mono mt-2">{formatCurrency(totalSaved)}</h2>
          </div>

          {/* Allocation Info */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
             <h4 className="font-bold text-slate-400 text-sm mb-2">Rekomendasi Tabungan Bulan Ini</h4>
             <p className="text-xs text-slate-500 mb-4">Berdasarkan 20% Pemasukan</p>
             <h2 className="text-2xl font-bold text-white font-mono">{formatCurrency(budgets.SAVING.limit)}</h2>
             <div className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300">
               <span className="font-bold">Tips:</span> Masukkan nominal ini ke form di bawah kalau kamu sudah benar-benar memindahkannya ke rekening tabungan.
             </div>
          </div>

          {/* Input Form */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
             <h4 className="font-bold text-white mb-4 flex items-center gap-2"><Plus size={16}/> Input Tabungan Real</h4>
             <form onSubmit={onAdd} className="space-y-4">
               <input name="amount" type="number" placeholder="Nominal (Rp)" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" required />
               <input name="location" type="text" placeholder="Disimpan dimana? (Bibit/Bank)" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" required />
               <input name="note" type="text" placeholder="Catatan (Opsional)" className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" />
               <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl outline-none" required />
               <button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all">
                 Tambah Saldo Tabungan
               </button>
             </form>
          </div>
       </div>

       {/* List History */}
       <div className="lg:col-span-2">
          <h3 className="font-bold text-white mb-4">Riwayat Menabung (All Time)</h3>
          <div className="space-y-3">
             {savings.length === 0 && <p className="text-slate-500 text-center italic py-10">Belum ada data tabungan.</p>}
             {savings.map(s => (
                <div key={s.id} className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center group hover:border-purple-500/50 transition-colors">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                         <Save size={18}/>
                      </div>
                      <div>
                         <p className="font-bold text-white">{s.location}</p>
                         <p className="text-xs text-slate-500">{formatDate(s.date)} {s.note ? `• ${s.note}` : ''}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="font-mono font-bold text-purple-400">+{formatCurrency(s.amount)}</p>
                      <button onClick={() => onDelete(s.id)} className="text-xs text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Hapus</button>
                   </div>
                </div>
             ))}
          </div>
       </div>
    </div>
  )
}
