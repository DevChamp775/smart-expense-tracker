const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const nodemailer = require("nodemailer");
const { exec } = require("child_process");
const multer = require("multer");
const Tesseract = require("tesseract.js");

const app = express();
const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    cb(null, Date.now() + file.originalname);
  }

});

const upload = multer({ storage });

app.use(express.json());
app.use(cors());


// open login page when site loads
app.get("/", (req,res)=>{
    res.sendFile(__dirname + "/public/login.html");
});

app.use(express.static("public"));

const path = require("path");

const dbPath = process.env.RENDER
  ? "/tmp/database.db"
  : path.join(__dirname, "database.db");

const db = new sqlite3.Database(dbPath, (err)=>{
    if(err){
        console.error("Database error:",err);
    } else{
        console.log("Connected to SQLite database");
    }
});


// ================= DATABASE TABLES =================

db.serialize(() => {

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS expenses(
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
amount REAL,
category TEXT,
date TEXT,
description TEXT
)
`);

});


// ================= REGISTER =================

app.post("/register",(req,res)=>{

const {email,password} = req.body;

db.run(
"INSERT INTO users(email,password) VALUES(?,?)",
[email,password],
function(err){

if(err){
res.json({success:false,message:"User already exists"});
}else{
res.json({success:true,message:"User created"});
}

});

});


// ================= LOGIN =================

app.post("/login",(req,res)=>{

const {email,password} = req.body;

db.get(
"SELECT * FROM users WHERE email=? AND password=?",
[email,password],
(err,row)=>{

if(err){
return res.json({success:false});
}

if(row){
res.json({
success:true,
userId: row.id
});
}else{
res.json({success:false});
}

});

});


// ================= ADD EXPENSE =================

app.post("/add-expense",(req,res)=>{

const {userId,amount,category,date,description} = req.body;

db.run(
"INSERT INTO expenses(user_id,amount,category,date,description) VALUES(?,?,?,?,?)",
[userId,amount,category,date,description],
function(err){

if(err){
return res.status(500).send(err);
}

res.json({
message:"Expense Added",
id:this.lastID
});

});

});


// ================= GET EXPENSES =================

app.get("/expenses",(req,res)=>{

let userId = req.query.userId;

db.all(
"SELECT * FROM expenses WHERE user_id=?",
[userId],
(err,rows)=>{

if(err){
return res.status(500).send(err);
}

res.json(rows);

});

});


// ================= DELETE EXPENSE =================

app.delete("/delete/:id",(req,res)=>{

db.run(
"DELETE FROM expenses WHERE id=?",
[req.params.id],
()=>res.send("Deleted")
);

});


// ================= HISTORY =================

app.get("/history",(req,res)=>{

let userId = req.query.userId;

db.all(
`
SELECT * FROM expenses
WHERE user_id=?
ORDER BY date DESC
`,
[userId],
(err,rows)=>{

if(err){
return res.status(500).send(err);
}

res.json(rows);

});

});


// ================= MONTHLY ANALYSIS =================

app.get("/monthly-analysis",(req,res)=>{

let userId = req.query.userId;

db.all(
`
SELECT strftime('%Y-%m',date) as month,
SUM(amount) as total
FROM expenses
WHERE user_id=?
GROUP BY month
ORDER BY month
`,
[userId],
(err,rows)=>{

res.json(rows);

});

});


// ================= OTP RESET PASSWORD =================

let otpStore = {};

const transporter = nodemailer.createTransport({
service:"gmail",
auth:{
user:"yourgmail@gmail.com",
pass:"your_app_password"
}
});


// SEND OTP

app.post("/send-otp",(req,res)=>{

let {email} = req.body;

db.get("SELECT * FROM users WHERE email=?",[email],(err,row)=>{

if(!row){
return res.json({success:false,message:"User not found"});
}

let otp = Math.floor(100000 + Math.random()*900000);

otpStore[email] = otp;

let mailOptions = {
from:"yourgmail@gmail.com",
to:email,
subject:"Password Reset OTP",
text:`Your OTP is ${otp}`
};

transporter.sendMail(mailOptions,(err,info)=>{

if(err){
console.log(err);
return res.json({success:false});
}

res.json({success:true});

});

});

});


// VERIFY OTP

app.post("/verify-otp",(req,res)=>{

let {email,otp} = req.body;

if(otpStore[email] == otp){

delete otpStore[email];

res.json({success:true});

}else{

res.json({success:false});

}

});


// RESET PASSWORD

app.post("/reset-password",(req,res)=>{

let {email,newPassword} = req.body;

db.run(
"UPDATE users SET password=? WHERE email=?",
[newPassword,email],
function(err){

if(err){
return res.json({success:false});
}

res.json({success:true});

});

});

// FULL RESET DATABASE
app.delete("/reset-all", (req, res) => {

  db.serialize(() => {
    db.run("DELETE FROM expenses");
    db.run("DELETE FROM users");
  });

  res.send("Database fully reset");

});

// ================= JULIA ANALYSIS =================

app.get("/run-analysis", (req, res) => {
  let userId = req.query.userId;

  db.all("SELECT * FROM expenses WHERE user_id=?", [userId], (err, rows) => {
    if (err || !rows.length) {
      return res.json({ success: false, error: "No expenses found" });
    }

    let total = rows.reduce((s, r) => s + r.amount, 0);
    let avg = total / rows.length;
    let max = Math.max(...rows.map(r => r.amount));
    let maxExp = rows.find(r => r.amount === max);
    let budget = 0; // pulled from client, skip server-side for now

    // Category totals
    let catMap = {};
    rows.forEach(r => {
      catMap[r.category] = (catMap[r.category] || 0) + r.amount;
    });

    let sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    let topCat = sorted[0];
    let topPct = ((topCat[1] / total) * 100).toFixed(1);

    // Monthly trend
    let monthMap = {};
    rows.forEach(r => {
      let m = r.date.slice(0, 7);
      monthMap[m] = (monthMap[m] || 0) + r.amount;
    });
    let months = Object.keys(monthMap).sort();
    let trending = months.length >= 2
      ? monthMap[months[months.length - 1]] > monthMap[months[months.length - 2]]
        ? "up" : "down"
      : "stable";

    let insights = [];

    // 1. Overview
    insights.push({
      type: total > 10000 ? "danger" : total > 5000 ? "warning" : "success",
      icon: "💰",
      title: "Monthly Overview",
      message: `Total spending this month: ₹${total.toFixed(0)}`,
      detail: total > 10000
        ? "This is significantly high. Consider cutting discretionary expenses immediately."
        : total > 5000
        ? "Moderate spending. Review your non-essential expenses."
        : "Good job keeping spending in check this month!"
    });

    // 2. Top category
    insights.push({
      type: topPct > 50 ? "danger" : topPct > 35 ? "warning" : "info",
      icon: "📊",
      title: "Spending Concentration",
      message: `${topCat[0]} is your top category at ₹${topCat[1].toFixed(0)} (${topPct}%)`,
      detail: topPct > 50
        ? `Over half your money went to ${topCat[0]}! This is a red flag — diversify or cut this down.`
        : topPct > 35
        ? `${topCat[0]} is dominating your budget. Try to keep any single category below 30%.`
        : `Spending is reasonably spread. ${topCat[0]} leads but isn't overwhelming.`
    });

    // 3. Food
    if (catMap["Food"]) {
      let foodPct = ((catMap["Food"] / total) * 100).toFixed(1);
      insights.push({
        type: catMap["Food"] > 2000 ? "danger" : catMap["Food"] > 1000 ? "warning" : "success",
        icon: "🍽️",
        title: "Food & Dining",
        message: `₹${catMap["Food"].toFixed(0)} spent on food (${foodPct}% of total)`,
        detail: catMap["Food"] > 2000
          ? "Very high food spending. Meal prepping at home could save you ₹1000+ monthly."
          : catMap["Food"] > 1000
          ? "Eating out frequently adds up. Try cooking 3-4 days a week."
          : "Great food budgeting! You're keeping dining costs reasonable."
      });
    }

    // 4. Shopping
    if (catMap["Shopping"]) {
      let shopPct = ((catMap["Shopping"] / total) * 100).toFixed(1);
      insights.push({
        type: shopPct > 30 ? "danger" : shopPct > 20 ? "warning" : "info",
        icon: "🛍️",
        title: "Shopping Habits",
        message: `₹${catMap["Shopping"].toFixed(0)} on shopping (${shopPct}%)`,
        detail: shopPct > 30
          ? "Impulse buying detected! Use the 24-hour rule — wait a day before any purchase above ₹500."
          : shopPct > 20
          ? "Shopping is noticeable. List what you need before browsing to avoid impulse buys."
          : "Shopping is under control. Keep asking: need or want?"
      });
    }

    // 5. Travel
    if (catMap["Travel"]) {
      let tPct = ((catMap["Travel"] / total) * 100).toFixed(1);
      insights.push({
        type: tPct > 30 ? "warning" : "info",
        icon: "🚗",
        title: "Travel & Transport",
        message: `₹${catMap["Travel"].toFixed(0)} on travel (${tPct}%)`,
        detail: tPct > 30
          ? "High travel costs. Consider carpooling, monthly passes, or planning trips in advance."
          : "Travel spending looks reasonable. Booking ahead can save more."
      });
    }

    // 6. Bills
    if (catMap["Bills"]) {
      insights.push({
        type: "info",
        icon: "📋",
        title: "Bills & Utilities",
        message: `₹${catMap["Bills"].toFixed(0)} in bills`,
        detail: "Always pay bills on time to avoid penalties. Set auto-pay reminders for recurring bills."
      });
    }

    // 7. Entertainment
    if (catMap["Entertainment"]) {
      let ePct = ((catMap["Entertainment"] / total) * 100).toFixed(1);
      insights.push({
        type: ePct > 20 ? "warning" : "success",
        icon: "🎬",
        title: "Entertainment",
        message: `₹${catMap["Entertainment"].toFixed(0)} on entertainment (${ePct}%)`,
        detail: ePct > 20
          ? "Entertainment is eating into your savings. Budget a fixed fun allowance each month."
          : "Good balance! Enjoying life while keeping it reasonable."
      });
    }

    // 8. Medical
    if (catMap["Medical"]) {
      insights.push({
        type: "info",
        icon: "🏥",
        title: "Medical Expenses",
        message: `₹${catMap["Medical"].toFixed(0)} on medical`,
        detail: "Health is wealth. Consider a health insurance plan to reduce out-of-pocket costs."
      });
    }

    // 9. Biggest purchase
    insights.push({
      type: max > 2000 ? "warning" : "info",
      icon: "⚡",
      title: "Largest Single Expense",
      message: `₹${max} on "${maxExp.description || maxExp.category}"`,
      detail: max > 2000
        ? "Large purchase detected. Always compare prices and check for better deals before big spends."
        : "Your biggest expense is reasonable. Good impulse control!"
    });

    // 10. Trend
    insights.push({
      type: trending === "up" ? "warning" : "success",
      icon: trending === "up" ? "📈" : "📉",
      title: "Spending Trend",
      message: trending === "up" ? "Spending is increasing vs last month" : trending === "down" ? "Spending decreased vs last month!" : "First month tracked",
      detail: trending === "up"
        ? "Your expenses rose this month. Identify the biggest jump and cut it next month."
        : "Great discipline! Keeping spending lower than last month is a strong habit."
    });

    // 11. Avg per transaction
    insights.push({
      type: avg > 800 ? "warning" : "success",
      icon: "🧮",
      title: "Average Transaction",
      message: `₹${avg.toFixed(0)} average per expense`,
      detail: avg > 800
        ? "High average transaction value. Break large expenses into planned purchases."
        : "You're making mindful, smaller purchases — that's a healthy habit."
    });

    // 12. Savings advice
    let savingsGoal = total * 0.2;
    insights.push({
      type: total > 8000 ? "danger" : "success",
      icon: "🏦",
      title: "Savings Recommendation",
      message: `Target saving at least ₹${savingsGoal.toFixed(0)} this month`,
      detail: "Financial rule: Save 20%, invest 10%, live on 70%. Even saving ₹500/month compounds significantly over years."
    });

    res.json({ success: true, insights });
  });
});

// ================= BILL OCR SCANNER =================

app.post("/scan-bill", upload.single("bill"), async (req, res) => {

  try {

    const result = await Tesseract.recognize(
      req.file.path,
      "eng",
      {
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,/:- ',
      }
    );

    let text = result.data.text;

    console.log("RAW OCR TEXT:", text);

    // ===== CLEAN TEXT =====
    let cleanText = text
      .replace(/[^\x20-\x7E\n₹]/g, " ")  // remove garbage chars
      .replace(/\s+/g, " ")               // collapse spaces
      .trim();

    // ===== DETECT AMOUNT (smart) =====
    let amount = "";

    // First try: look near keywords Total / Amount / Grand Total
    let keywordMatch = cleanText.match(
      /(?:total|grand total|amount|net amount|bill amount|rs|₹|inr)[^\d]*(\d+[.,]?\d*)/gi
    );

    if (keywordMatch) {
      let last = keywordMatch[keywordMatch.length - 1];
      let num = last.match(/(\d+[.,]?\d*)$/);
      if (num) amount = num[1].replace(",", "");
    }

    // Second try: largest decimal number on the bill
    if (!amount) {
      let allNums = cleanText.match(/\d{2,6}[.,]\d{2}/g);
      if (allNums) {
        amount = Math.max(...allNums.map(n => parseFloat(n.replace(",", ".")))).toString();
      }
    }

    // Third try: any standalone number above 10
    if (!amount) {
      let anyNums = cleanText.match(/\b\d{2,6}\b/g);
      if (anyNums) {
        let nums = anyNums.map(Number).filter(n => n > 10);
        if (nums.length) amount = Math.max(...nums).toString();
      }
    }

    // ===== STORE NAME (first clean line) =====
    // ===== STORE NAME - cleaner extraction =====
let store = "Bill Expense";

// Try to get a short, clean first line (max 30 chars, only letters/spaces)
let cleanLines = cleanText
  .split("\n")
  .map(l => l.trim())
  .filter(l => l.length >= 3 && l.length <= 40 && /^[a-zA-Z\s&'.-]{3,}$/.test(l));

if (cleanLines.length > 0) {
  store = cleanLines[0].trim();
}

    // ===== CATEGORY DETECTION =====
    let category = "Other";
    let lower = cleanText.toLowerCase();

    if (
      lower.includes("food") ||
      lower.includes("restaurant") ||
      lower.includes("hotel") ||
      lower.includes("cafe") ||
      lower.includes("swiggy") ||
      lower.includes("zomato") ||
      lower.includes("burger") ||
      lower.includes("pizza") ||
      lower.includes("dhaba")
    ) {
      category = "Food";
    }
    else if (
      lower.includes("uber") ||
      lower.includes("ola") ||
      lower.includes("travel") ||
      lower.includes("flight") ||
      lower.includes("railway") ||
      lower.includes("petrol") ||
      lower.includes("fuel")
    ) {
      category = "Travel";
    }
    else if (
      lower.includes("mall") ||
      lower.includes("shopping") ||
      lower.includes("mart") ||
      lower.includes("store") ||
      lower.includes("fashion") ||
      lower.includes("amazon") ||
      lower.includes("flipkart")
    ) {
      category = "Shopping";
    }
    else if (
      lower.includes("electric") ||
      lower.includes("water bill") ||
      lower.includes("gas") ||
      lower.includes("broadband") ||
      lower.includes("wifi") ||
      lower.includes("mobile bill") ||
      lower.includes("recharge")
    ) {
      category = "Bills";
    }
    else if (
      lower.includes("medical") ||
      lower.includes("pharmacy") ||
      lower.includes("hospital") ||
      lower.includes("clinic") ||
      lower.includes("medicine") ||
      lower.includes("doctor")
    ) {
      category = "Medical";
    }

    // ===== RESPONSE =====
    res.json({
      success: true,
      amount,
      store,
      category,
      rawText: cleanText
    });

  }
  catch(err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "OCR Failed"
    });
  }

});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log(`Server running at http://localhost:${PORT}`);
});