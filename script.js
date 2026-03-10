// LOGIN CHECK
let userId = localStorage.getItem("userId");

if (!userId) {
    window.location.href = "/login.html";
}

// CURRENT MONTH
let month = new Date().toISOString().slice(0,7);

// BUDGET
let budgetKey = "budget_" + userId + "_" + month;
let budget = Number(localStorage.getItem(budgetKey));

if (!budget) {

    budget = Number(prompt("Enter budget for " + month + " (₹):"));

    if (!budget || budget <= 0) {
        alert("Invalid budget. Please reload and enter a valid amount.");
        budget = 1;
    }

    localStorage.setItem(budgetKey, budget);
}


// ADD EXPENSE
async function addExpense(){

let amount = document.getElementById("amount").value;
let category = document.getElementById("category").value;
let date = document.getElementById("date").value;
let description = document.getElementById("desc").value;

if(!amount || !date){
alert("Please enter amount and date");
return;
}

await fetch("/add-expense",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
userId,
amount,
category,
date,
description
})
});

document.getElementById("amount").value="";
document.getElementById("desc").value="";

loadExpenses();
}


// LOAD EXPENSES
async function loadExpenses(){

let res = await fetch("/expenses?userId=" + userId);
let data = await res.json();

let table = document.getElementById("tableData");

let rows="";
let total=0;
let categoryTotals={};

data.forEach(exp=>{

// CURRENT MONTH ONLY
if(exp.date.startsWith(month)){

total += Number(exp.amount);

if(!categoryTotals[exp.category]){
categoryTotals[exp.category]=0;
}

categoryTotals[exp.category]+=Number(exp.amount);

}

// TABLE ROW
rows += `
<tr>
<td>₹${exp.amount}</td>
<td>${exp.category}</td>
<td>${exp.date}</td>
<td>${exp.description || ""}</td>
<td>
<button onclick="deleteExpense(${exp.id})">Delete</button>
</td>
</tr>
`;

});

table.innerHTML=rows;

document.getElementById("total").innerText=total;


// BUDGET WARNING
let percent=(total/budget)*100;

let warning=document.getElementById("warning");

if(percent>=100){

warning.innerText="🚨 Budget Exceeded! ("+percent.toFixed(1)+"%)";
warning.style.color="red";

}
else if(percent>=80){

warning.innerText="⚠ "+percent.toFixed(1)+"% of budget used";
warning.style.color="orange";

}
else{

warning.innerText=percent.toFixed(1)+"% of budget used";
warning.style.color="green";

}


// UPDATE PIE CHART
createChart(categoryTotals);

}


// DELETE EXPENSE
async function deleteExpense(id){

await fetch("/delete/"+id,{
method:"DELETE"
});

loadExpenses();
}


// PIE CHART
let chart;

function createChart(data){

let labels=Object.keys(data);
let values=Object.values(data);

if(chart){
chart.destroy();
}

chart=new Chart(document.getElementById("expenseChart"),{

type:"pie",

data:{
labels:labels,
datasets:[{
data:values,
backgroundColor:[
"#4CAF50",
"#FF6384",
"#36A2EB",
"#FFCE56",
"#8E44AD"
]
}]
},

options:{
responsive:true
}

});

}


// MONTHLY CHART
let monthlyChart;

async function loadMonthlyChart(){

let res = await fetch("/monthly-analysis?userId=" + userId);
let data = await res.json();

let labels = data.map(x => x.month);
let values = data.map(x => x.total);

if(monthlyChart){
monthlyChart.destroy();
}

new Chart(document.getElementById("monthlyChart"),{

type:"bar",

data:{
labels:labels,
datasets:[{
label:"Monthly Spending",
data:values,
backgroundColor:"#36A2EB"
}]
},

options:{
responsive:true
}

});

}


// LOGOUT
function logout(){
localStorage.removeItem("userId");
window.location.href="/login.html";
}

function openHistory(){
window.location.href = "/history.html";
}

// SHOW HISTORY

function showHistory(){
document.getElementById("historySection").style.display="block";
loadMonths();
}
async function loadMonths(){

let res = await fetch("/history?userId=" + userId);
let data = await res.json();

let months = new Set();

data.forEach(exp=>{
months.add(exp.date.slice(0,7));
});

let select = document.getElementById("historyMonth");

select.innerHTML="";

months.forEach(m=>{
select.innerHTML += `<option value="${m}">${m}</option>`;
});

loadHistory();

}
async function loadHistory(){

let month = document.getElementById("historyMonth").value;

let res = await fetch("/history?userId=" + userId);
let data = await res.json();

let table = document.getElementById("historyTable");

table.innerHTML="";

data.forEach(exp=>{

if(exp.date.startsWith(month)){

table.innerHTML += `
<tr>
<td>₹${exp.amount}</td>
<td>${exp.category}</td>
<td>${exp.date}</td>
<td>${exp.description || ""}</td>
</tr>
`;
}
});
}

async function exportPDF(){

let res = await fetch("/expenses?userId=" + userId);
let data = await res.json();

const { jsPDF } = window.jspdf;

let doc = new jsPDF();

doc.setFontSize(18);
doc.text("Smart Expense Tracker Report",20,20);
doc.setFontSize(12);
let y = 40;
doc.text("Date",20,y);
doc.text("Category",60,y);
doc.text("Amount",110,y);
doc.text("Description",150,y);
y += 10;
data.forEach(exp => {
doc.text(exp.date,20,y);
doc.text(exp.category,60,y);
doc.text("₹"+exp.amount,110,y);
doc.text(exp.description || "",150,y);
y += 10;
});
doc.save("Expense_Report.pdf");
}
// INIT
loadMonthlyChart();
loadExpenses();
