"use client";

import { useEffect, useState } from "react";

const categories = ["Хүнс", "Тээвэр", "Кафе/Хоол", "Шатахуун", "Утас/Интернэт", "Эрүүл мэнд", "Түрээс", "Бусад зарлага"];
const STORAGE_KEY = "mini_finance_gemini_proxy_v2";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function money(n) {
  return Number(n || 0).toLocaleString("mn-MN") + "₮";
}

function monthLabel(value) {
  if (!value) return "";
  const parts = value.split("-");
  return parts[0] + " оны " + Number(parts[1]) + "-р сар";
}

function shiftMonth(value, diff) {
  const parts = value.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + diff, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return y + "-" + m;
}

function resizeImage(file, maxSide = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (Math.max(width, height) > maxSide) {
        const ratio = maxSide / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      URL.revokeObjectURL(url);
      resolve({ dataUrl: dataUrl, base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function Page() {
  const [page, setPage] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);
  const [monthFilter, setMonthFilter] = useState(currentMonth());
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("Зураг оруулна уу");
  const [raw, setRaw] = useState("");
  const [edit, setEdit] = useState({
    id: "",
    type: "expense",
    amount: "",
    date: today(),
    merchant: "",
    category: "Бусад зарлага",
    description: ""
  });

  useEffect(() => {
    setTransactions(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const monthTransactions = transactions.filter(function (t) {
    return t.date && t.date.slice(0, 7) === monthFilter && !t.needsReview;
  });

  const income = monthTransactions
    .filter(function (t) { return t.type === "income"; })
    .reduce(function (s, t) { return s + Number(t.amount); }, 0);

  const expense = monthTransactions
    .filter(function (t) { return t.type === "expense"; })
    .reduce(function (s, t) { return s + Number(t.amount); }, 0);

  const filteredTransactions = transactions.filter(function (t) {
    const q = String((t.merchant || "") + " " + (t.category || "") + " " + (t.description || "")).toLowerCase();
    return (typeFilter === "all" || t.type === typeFilter) &&
      t.date &&
      t.date.slice(0, 7) === monthFilter &&
      (!search || q.includes(search.toLowerCase()));
  });

  function addTransaction(item) {
    setTransactions(function (prev) { return [item].concat(prev); });
    setEdit(item);
    setPage("receipt");
  }

  function saveEdit(e) {
    e.preventDefault();
    setTransactions(function (prev) {
      return prev.map(function (t) {
        if (t.id === edit.id) {
          return Object.assign({}, t, edit, { amount: Number(edit.amount), needsReview: false });
        }
        return t;
      });
    });
    setPage("transactions");
  }

  async function handleReceipt(file) {
    if (!file) return;
    setStatus("Зураг бэлдэж байна...");
    try {
      const image = await resizeImage(file);
      setPreview(image.dataUrl);
      setStatus("Gemini API уншиж байна...");
      const res = await fetch("/api/gemini-receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ base64: image.base64, mimeType: image.mimeType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gemini API алдаа");
      const j = data.json;
      setRaw(JSON.stringify(j, null, 2));
      const item = {
        id: "t_" + Date.now(),
        createdAt: new Date().toISOString(),
        type: j.type || "expense",
        amount: Number(j.amount || 0),
        date: j.date || today(),
        merchant: j.merchant || "",
        category: j.category || "Бусад зарлага",
        description: j.description || "Gemini auto",
        source: "gemini",
        imageData: image.dataUrl,
        needsReview: !j.amount || !j.date
      };
      addTransaction(item);
      setStatus(item.needsReview ? "Draft үүслээ. Мэдээллээ засаарай." : "Auto бүртгэл үүслээ.");
    } catch (e) {
      setStatus("Алдаа: " + e.message);
    }
  }

  function TransactionList({ items }) {
    return <div className="list">{items.length ? items.map(function (t) {
      return <div className="txn" key={t.id}>
        <div><b>{t.merchant || t.category} {t.needsReview ? "⚠️" : ""}</b><br /><small>{t.date} • {t.category} • {t.imageData ? "📎" : ""}</small></div>
        <b className={t.needsReview ? "draft" : t.type}>{t.type === "income" ? "+" : "-"}{money(t.amount)}</b>
        {t.imageData && <img className="thumb" src={t.imageData} alt="receipt" />}
        <button className="secondary" onClick={function () { setEdit(t); setPage("receipt"); }}>Засах</button>
        <button className="danger" onClick={function () { setTransactions(function (p) { return p.filter(function (x) { return x.id !== t.id; }); }); }}>Устгах</button>
      </div>;
    }) : <p>Гүйлгээ алга.</p>}</div>;
  }

  return <div className="app">
    <aside className="side">
      <div className="brand"><div className="logo">₮</div><div><h1>Миний Санхүү</h1><p>Gemini backend</p></div></div>
      <div className="nav">
        <button className={page === "dashboard" ? "active" : ""} onClick={function () { setPage("dashboard"); }}>Dashboard</button>
        <button className={page === "transactions" ? "active" : ""} onClick={function () { setPage("transactions"); }}>Гүйлгээнүүд</button>
        <button className={page === "receipt" ? "active" : ""} onClick={function () { setPage("receipt"); }}>Баримт auto</button>
        <button className={page === "manual" ? "active" : ""} onClick={function () { setPage("manual"); }}>Гараар нэмэх</button>
      </div>
    </aside>

    <main className="main">
      <div className="top"><div><h2>{page}</h2><p>Харагдаж буй сар: {monthLabel(monthFilter)}</p></div><button className="primary" onClick={function () { setPage("receipt"); }}>+ Баримт</button></div>

      {page === "dashboard" && <section className="page active">
        <div className="panel" style={{ marginBottom: 14 }}>
          <h3>Сар сонгох</h3>
          <div className="filters">
            <button className="secondary" onClick={function () { setMonthFilter(shiftMonth(monthFilter, -1)); }}>← Өмнөх сар</button>
            <input type="month" value={monthFilter} onChange={function (e) { setMonthFilter(e.target.value); }} />
            <button className="secondary" onClick={function () { setMonthFilter(shiftMonth(monthFilter, 1)); }}>Дараа сар →</button>
          </div>
        </div>
        <div className="cards">
          <div className="card"><span>Энэ сарын орлого</span><b>{money(income)}</b></div>
          <div className="card"><span>Энэ сарын зарлага</span><b>{money(expense)}</b></div>
          <div className="card"><span>Үлдэгдэл</span><b>{money(income - expense)}</b></div>
          <div className="card"><span>Энэ сарын гүйлгээ</span><b>{monthTransactions.length}</b></div>
        </div>
        <div className="panel"><h3>{monthLabel(monthFilter)} — Сүүлийн гүйлгээ</h3><TransactionList items={filteredTransactions.slice(0, 10)} /></div>
      </section>}

      {page === "transactions" && <section className="page active">
        <div className="panel">
          <div className="filters">
            <input placeholder="Хайх" value={search} onChange={function (e) { setSearch(e.target.value); }} />
            <select value={typeFilter} onChange={function (e) { setTypeFilter(e.target.value); }}><option value="all">Бүгд</option><option value="income">Орлого</option><option value="expense">Зарлага</option></select>
            <input type="month" value={monthFilter} onChange={function (e) { setMonthFilter(e.target.value); }} />
          </div>
          <TransactionList items={filteredTransactions} />
        </div>
      </section>}

      {page === "receipt" && <section className="page active">
        <div className="grid">
          <div className="panel">
            <h3>Баримт upload</h3>
            <div className="notice">Gemini API нь backend route-р ажиллана. Баримтын огноогоор тухайн сарын dashboard дээр харагдана.</div>
            <div className="upload-actions">
              <label className="upload-btn">📁 Photos-с сонгох<input type="file" accept="image/*" onChange={function (e) { handleReceipt(e.target.files && e.target.files[0]); }} /></label>
              <label className="upload-btn camera">📷 Camera<input type="file" accept="image/*" capture="environment" onChange={function (e) { handleReceipt(e.target.files && e.target.files[0]); }} /></label>
            </div>
            <div className="status">{status}</div>
            {preview && <img className="preview" style={{ display: "block" }} src={preview} alt="receipt preview" />}
            <details><summary>Raw</summary><pre>{raw}</pre></details>
          </div>
          <div className="panel">
            <h3>Засах</h3>
            <form className="form" onSubmit={saveEdit}>
              <label>Төрөл<select value={edit.type} onChange={function (e) { setEdit(Object.assign({}, edit, { type: e.target.value })); }}><option value="expense">Зарлага</option><option value="income">Орлого</option></select></label>
              <label>Дүн<input required type="number" value={edit.amount} onChange={function (e) { setEdit(Object.assign({}, edit, { amount: e.target.value })); }} /></label>
              <label>Огноо<input required type="date" value={edit.date} onChange={function (e) { setEdit(Object.assign({}, edit, { date: e.target.value })); }} /></label>
              <label>Байгууллага<input value={edit.merchant} onChange={function (e) { setEdit(Object.assign({}, edit, { merchant: e.target.value })); }} /></label>
              <label>Ангилал<select value={edit.category} onChange={function (e) { setEdit(Object.assign({}, edit, { category: e.target.value })); }}>{categories.map(function (c) { return <option key={c}>{c}</option>; })}</select></label>
              <label>Тайлбар<textarea value={edit.description} onChange={function (e) { setEdit(Object.assign({}, edit, { description: e.target.value })); }} /></label>
              <button className="primary">Хадгалах</button>
            </form>
          </div>
        </div>
      </section>}

      {page === "manual" && <section className="page active"><div className="panel"><form className="form" onSubmit={function (e) { e.preventDefault(); addTransaction(Object.assign({}, edit, { id: "t_" + Date.now(), createdAt: new Date().toISOString(), amount: Number(edit.amount), imageData: "", needsReview: false })); }}><input type="number" placeholder="Дүн" value={edit.amount} onChange={function (e) { setEdit(Object.assign({}, edit, { amount: e.target.value })); }} /><button className="primary">Хадгалах</button></form></div></section>}
    </main>
  </div>;
}
