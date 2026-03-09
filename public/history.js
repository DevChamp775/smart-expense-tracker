let userId = localStorage.getItem("userId");

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

loadMonths();