let userId = localStorage.getItem("userId");

let budget = localStorage.getItem("budget_"+userId);

if(!budget){

budget = prompt("Enter your monthly budget (₹):");
localStorage.setItem("budget_"+userId, budget);

}

async function addExpense(){

let amount = document.getElementById("amount").value;
let category = document.getElementById("category").value;
let date = document.getElementById("date").value;
let description = document.getElementById("desc").value;

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

loadExpenses();
}


async function loadExpenses(){

let userId = localStorage.getItem("userId");

let res = await fetch("/expenses?userId="+userId);
let data = await res.json();

let table = document.getElementById("tableData");
table.innerHTML="";

let total=0;
let categoryTotals={};

data.forEach(exp=>{

total+=Number(exp.amount);

table.innerHTML+=`
<tr>
<td>₹${exp.amount}</td>
<td>${exp.category}</td>
<td>${exp.date}</td>
<td>${exp.description}</td>
<td>
<button onclick="deleteExpense(${exp.id})">Delete</button>
</td>
</tr>
`;

if(!categoryTotals[exp.category]){
categoryTotals[exp.category]=0;
}

categoryTotals[exp.category]+=Number(exp.amount);

});

document.getElementById("total").innerText=total;


/* -------- BUDGET WARNING LOGIC -------- */

let percent = (total / budget) * 100;

let warning = document.getElementById("warning");

if(percent >= 100){

warning.innerText = "🚨 Budget Exceeded! (" + percent.toFixed(1) + "%)";
warning.style.color = "red";

}
else if(percent >= 80){

warning.innerText = "⚠ " + percent.toFixed(1) + "% of budget used";
warning.style.color = "orange";

}
else{

warning.innerText = percent.toFixed(1) + "% of budget used";
warning.style.color = "green";

}

/* ------------------------------------- */


createChart(categoryTotals);

}


async function deleteExpense(id){

await fetch("/delete/"+id,{
method:"DELETE"
});

loadExpenses();

}


let chart;

function createChart(data){

let labels = Object.keys(data);
let values = Object.values(data);

if(chart){
chart.destroy();
}

chart = new Chart(document.getElementById("expenseChart"),{

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
responsive:true,
maintainAspectRatio:true
}

});

}


async function loadMonthlyChart(){

let res = await fetch("/monthly-analysis");
let data = await res.json();

let labels = data.map(x=>"Month "+x.month);
let values = data.map(x=>x.total);

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
responsive:true,
maintainAspectRatio:true
}

});

}


loadMonthlyChart();
loadExpenses();