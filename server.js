const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();

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


// ================= SERVER =================

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log(`Server running at http://localhost:${PORT}`);
});