const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());


// open login page when site loads
app.get("/", (req,res)=>{
    res.sendFile(__dirname + "/public/login.html");
});

app.use(express.static("public"));

const db = new sqlite3.Database("database.db");


// Create Tables
db.serialize(() => {

db.run(`
CREATE TABLE IF NOT EXISTS users(
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
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


// REGISTER USER
app.post("/register",(req,res)=>{

const {username,password} = req.body;

db.run(
"INSERT INTO users(username,password) VALUES(?,?)",
[username,password],
function(err){

if(err){
res.json({success:false,message:"User already exists"});
}else{
res.json({success:true,message:"User created"});
}

});

});


// LOGIN USER
app.post("/login",(req,res)=>{

const {username,password} = req.body;

db.get(
"SELECT * FROM users WHERE username=? AND password=?",
[username,password],
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


// ADD EXPENSE
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


// GET EXPENSES
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


// DELETE EXPENSE
app.delete("/delete/:id",(req,res)=>{

db.run(
"DELETE FROM expenses WHERE id=?",
[req.params.id],
()=>res.send("Deleted")
);

});


// MONTHLY ANALYSIS
app.get("/monthly-analysis",(req,res)=>{

db.all(
`
SELECT strftime('%m',date) as month,
SUM(amount) as total
FROM expenses
GROUP BY month
`,
(err,rows)=>{

res.json(rows);

});

});

const PORT = process.env.PORT || 3000;

app.listen(PORT,()=>{
console.log("Server running on port " + PORT);
});