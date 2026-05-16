import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function resetForm() {
    document.getElementById('registrationForm').style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';

    // Reset only the editable fields — keep auto-filled ones intact
    document.getElementById("yearLevel").selectedIndex = 0;
    document.getElementById("section").selectedIndex = 0;
    document.getElementById("phone").value = "";
    document.getElementById("eventDay").selectedIndex = 0;
    document.getElementById("registerAs").selectedIndex = 0;
    document.getElementById("comments").value = "";

    document.querySelectorAll('input[name="events"]').forEach(el => el.checked = false);
    document.getElementById("activitySection").style.display = "none";
    document.getElementById("teamNameGroup").style.display = "none";
    document.getElementById("teamName").value = "";
    document.getElementById("errorMessage").style.display = "none";
}

const modal = document.getElementById('eventModal');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const closeBtn = document.querySelector('.close-btn');

const eventDetails = {
    "Quiz Bee": "A thrilling battle of knowledge where teams compete in rapid-fire trivia across computer science topics. Test your memory, logic, and quick thinking!",
    "Hackathon": "24-hour coding marathon where participants build innovative solutions to real-world problems. Prizes for best projects and creativity!",
    "Logic & Puzzle Challenge": "Mind-bending puzzles and logic problems that will test your analytical skills and problem-solving abilities.",
    "Poster Making": "Digital poster design contest showcasing creativity and design skills with CS Week 2026 theme.",
    "Infographics": "Create stunning data visualizations that tell compelling stories through design and information.",
    "Digital Modulo Art": "Digital art competition using mathematical modulo patterns and algorithms to create mesmerizing visuals.",
    "Esports Tournament": "High-stakes gaming competition featuring popular esports titles with cash prizes and glory!",
    "Seminar": "Expert-led session on cutting-edge technologies and career development in computer science.",
    "Alumni Talk": "Inspiring stories and advice from successful CS alumni sharing their career journeys.",
    "Kahoot Trivia": "Interactive, real-time trivia competition using Kahoot! platform - fun for everyone!",
    "Escape Room": "Team-based puzzle-solving adventure where you race against the clock to escape!"
};

document.querySelectorAll('.event-label').forEach(label => {
    label.addEventListener('click', function() {
        const eventName = this.getAttribute('data-event');
        modalTitle.textContent = eventName;
        modalDescription.textContent = eventDetails[eventName];
        modal.style.display = 'block';
    });
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

function openLogoutConfirm() {
    document.getElementById('logoutConfirmModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLogoutConfirm() {
    document.getElementById('logoutConfirmModal').classList.remove('active');
    document.body.style.overflow = 'auto';
}

async function confirmLogout() {
    await signOut(auth);
    closeLogoutConfirm();
    window.location.href = 'index.html';
}

document.getElementById('logoutBtn').addEventListener('click', function(e) {
    e.preventDefault();
    openLogoutConfirm();
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const errorMsg = document.getElementById("errorMessage");
    errorMsg.style.display = "none";
    
    const formData = {
        studentId: document.getElementById('studentId').value,
        fullName: document.getElementById('fullName').value,
        yearLevel: document.getElementById('yearLevel').value,
        section: document.getElementById('section').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value || 'Not provided',
        eventDay: document.getElementById('eventDay').options[document.getElementById('eventDay').selectedIndex].text,
        registerAs: document.getElementById('registerAs').value,
        events: Array.from(document.querySelectorAll('input[name="events"]:checked')).map(cb => cb.value),
        teamName: document.getElementById('teamName').value || 'N/A',
        comments: document.getElementById('comments').value || 'None'
    };

    const role = document.getElementById("registerAs").value;
    if (role === "Participant" && formData.events.length === 0) {
        errorMsg.innerText = "Please select at least one activity for Participants!";
        errorMsg.style.display = "block";
        return;
    }

    if (!auth || !auth.currentUser) {
        alert("You must be logged in first!");
        return;
    }

    if (!db) {
        console.error("Firebase DB not initialized");
        return;
    }

    const submitBtn = document.querySelector('.submit-btn');
    const btnOriginalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    submitBtn.disabled = true;

    let saved = false;

    try {
        const { collection, addDoc, serverTimestamp } = await import(
            "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
        );

        await addDoc(collection(db, "registrations"), {
            ...formData,
            userId: auth.currentUser.uid,
            createdAt: serverTimestamp()
        });

        console.log("✅ Saved to Firebase");
        saved = true;

    } catch (error) {
        console.error("❌ Firebase error:", error);
    }

    if (!saved) {
        submitBtn.innerHTML = btnOriginalText;
        submitBtn.disabled = false;
        alert("Failed to save. Try again.");
        return;
    }

    setTimeout(() => {
        document.getElementById('registrationForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        
        const details = `
            <strong>Name:</strong> ${formData.fullName}<br>
            <strong>Student ID:</strong> ${formData.studentId}<br>
            <strong>Event:</strong> ${formData.eventDay}<br>
            <strong>Role:</strong> ${formData.registerAs.charAt(0).toUpperCase() + formData.registerAs.slice(1)} 
            ${formData.events.length > 0 ? `- ${formData.events.join(', ')}` : ''}<br>
            <strong>Email:</strong> ${formData.email}
        `;
        document.getElementById('registrationDetails').innerHTML = details;

        submitBtn.innerHTML = btnOriginalText;
        submitBtn.disabled = false;

    }, 1500);
});

const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in').forEach(el => {
    observer.observe(el);
});

window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(15, 15, 35, 0.95)';
        header.style.backdropFilter = 'blur(10px)';
    } else {
        header.style.background = 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #2a2a5e 100%)';
        header.style.backdropFilter = 'none';
    }
});

function createParticle() {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.left = Math.random() * window.innerWidth + 'px';
    particle.style.top = window.innerHeight + 'px';
    particle.style.width = '4px';
    particle.style.height = '4px';
    particle.style.background = 'rgba(0, 212, 255, 0.6)';
    particle.style.borderRadius = '50%';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '999';
    document.body.appendChild(particle);

    const animation = particle.animate([
        { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
        { transform: `translateY(-${window.innerHeight + 100}px) rotate(720deg)`, opacity: 0 }
    ], {
        duration: 3000 + Math.random() * 2000,
        easing: 'linear'
    });

    animation.onfinish = () => particle.remove();
}

setInterval(createParticle, 300);

const heroTitle = document.querySelector('.hero h1');
const originalText = heroTitle.textContent;
let i = 0;
function typeWriter() {
    if (i < originalText.length) {
        heroTitle.textContent = originalText.slice(0, i + 1) + '|';
        i++;
        setTimeout(typeWriter, 100);
    } else {
        heroTitle.textContent = originalText;
    }
}

window.addEventListener('load', () => {
    setTimeout(typeWriter, 1000);
});

const daySelect = document.getElementById("eventDay");
const registerAs = document.getElementById("registerAs");
const activitySection = document.getElementById("activitySection");
const activityItems = document.querySelectorAll(".radio-item");

function updateUI() {
    const selectedDay = daySelect.value;

    const participantOption = registerAs.querySelector('option[value="Participant"]');
    
    if (selectedDay === "Day1" || selectedDay === "Day6") {
        if (participantOption) participantOption.disabled = true;
        if (registerAs.value === "Participant") {
            registerAs.value = "";
        }
    } else {
        if (participantOption) participantOption.disabled = false;
    }

    if (!selectedDay || registerAs.value !== "Participant") {
        activitySection.style.display = "none";
        document.querySelectorAll('input[name="events"]').forEach(cb => cb.checked = false);
        return;
    }

    activitySection.style.display = "block";

    activityItems.forEach(item => {
        const itemDay = item.getAttribute("data-day");
        if (itemDay === selectedDay) {
            item.style.display = "flex";
        } else {
            item.style.display = "none";
            const input = item.querySelector("input");
            if (input) input.checked = false;
        }
    });
}

daySelect.addEventListener("change", updateUI);
registerAs.addEventListener("change", updateUI);

// ✅ Auth check + auto-fill from Firestore
window.addEventListener('load', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }

        // Auto-fill from Firestore user document
        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                document.getElementById('studentId').value = data.studentId || '';
                document.getElementById('fullName').value = data.fullName || '';
                document.getElementById('email').value = data.email || '';
            }
        } catch (err) {
            console.error("Failed to load user data:", err);
        }

        activitySection.style.display = "none";
    });
});

const teamNameGroup = document.getElementById("teamNameGroup");
const teamNameInput = document.getElementById("teamName");

document.querySelectorAll('input[name="events"]').forEach(radio => {
    radio.addEventListener("change", function () {
        if (this.id === "esports" && this.checked) {
            teamNameGroup.style.display = "block";
            teamNameInput.setAttribute("required", "true");
        } else {
            const esports = document.getElementById("esports");
            if (!esports.checked) {
                teamNameGroup.style.display = "none";
                teamNameInput.removeAttribute("required");
                teamNameInput.value = "";
            }
        }
    });
});

// expose functions to global scope for HTML onclick handlers
window.resetForm = resetForm;
window.confirmLogout = confirmLogout;
window.closeLogoutConfirm = closeLogoutConfirm;

