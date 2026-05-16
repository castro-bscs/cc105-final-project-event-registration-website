import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import { 
  doc, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ================= UI FUNCTIONS =================
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.width = Math.random() * 8 + 4 + 'px';
        particle.style.height = particle.style.width;
        particle.style.animationDelay = Math.random() * 6 + 's';
        particle.style.animationDuration = (Math.random() * 3 + 4) + 's';
        particlesContainer.appendChild(particle);
    }
}

function switchTab(tab) {
    document.getElementById('errorMsg').style.display = 'none';
    document.getElementById('successMsg').style.display = 'none';

    document.querySelectorAll('.auth-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.getElementById('loginForm').classList.toggle('active', tab === 'login');
    document.getElementById('registerForm').classList.toggle('active', tab === 'register');
}


// ================= PAGE LOAD =================
document.addEventListener('DOMContentLoaded', function() {
    createParticles();

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    document.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    document.querySelector('.switch-register').addEventListener('click', function(e) {
        e.preventDefault();
        switchTab('register');
    });

    document.querySelector('.switch-login').addEventListener('click', function(e) {
        e.preventDefault();
        switchTab('login');
    });
});


// ================= REGISTER =================
async function handleRegister(e) {
    e.preventDefault();

    const id = document.getElementById("regId").value;
    const firstName = document.getElementById("regFirstName").value.trim();
    const lastName = document.getElementById("regLastName").value.trim();
    const name = firstName + " " + lastName;
    const role = "student";
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const confirmPassword = document.getElementById("regConfirmPassword").value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            studentId: id,
            fullName: name,
            role: role,
            email: email
        });

        document.getElementById("successMsg").style.display = "block";
        document.getElementById("errorMsg").style.display = "none";

        switchTab('login');

    } catch (error) {
        console.error(error);
        let msg = error.message;
        if (error.code === "auth/email-already-in-use") {
            msg = "This email is already registered. Please login instead.";
        } else if (error.code === "auth/weak-password") {
            msg = "Password is too weak. Use at least 6 characters.";
        } else if (error.code === "auth/invalid-email") {
            msg = "Invalid email format.";
        } else if (error.code === "permission-denied" || error.message.includes("Missing or insufficient permissions")) {
            msg = "Registration blocked: you may be trying to register as admin. Please contact the system administrator.";
        }
        document.getElementById("errorMsg").innerText = msg;
        document.getElementById("errorMsg").style.display = "block";
    }
}


// ================= LOGIN =================
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // get real role from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            document.getElementById("errorMsg").innerText = "Account setup incomplete. Please contact the administrator.";
            document.getElementById("errorMsg").style.display = "block";
            return;
        }

        const userData = userDoc.data();

        // secure redirect based on role
        if (userData.role === "admin") {
            window.location.href = "admin.html";
        } else {
            window.location.href = "student.html";
        }

    } catch (error) {
        console.error(error);
        let msg = "Invalid email or password!";
        if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
            msg = "Invalid email or password!";
        } else if (error.code === "auth/too-many-requests") {
            msg = "Too many failed attempts. Please try again later.";
        } else if (error.code === "auth/network-request-failed") {
            msg = "Network error. Please check your connection.";
        } else if (error.code === "auth/invalid-email") {
            msg = "Invalid email format.";
        } else if (error.message === "User data not found") {
            msg = "Account setup incomplete. Please contact the administrator.";
        }
        document.getElementById("errorMsg").innerText = msg;
        document.getElementById("errorMsg").style.display = "block";
    }
}
