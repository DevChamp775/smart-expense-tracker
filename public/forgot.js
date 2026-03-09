async function sendOtp(){

let email = document.getElementById("email").value;

let res = await fetch("/send-otp",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({email})
});

let data = await res.json();

if(data.success){

alert("OTP sent to your email");

}else{

alert("User not found");

}

}



async function resetPassword(){

let email = document.getElementById("email").value;
let otp = document.getElementById("otp").value;
let newPassword = document.getElementById("newPassword").value;


// verify otp

let verify = await fetch("/verify-otp",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({email,otp})
});

let result = await verify.json();


if(result.success){

await fetch("/reset-password",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({email,newPassword})
});

alert("Password changed successfully");

window.location.href="login.html";

}else{

alert("Invalid OTP");

}

}