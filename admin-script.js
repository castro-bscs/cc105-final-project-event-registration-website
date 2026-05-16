import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const daysData = {
    day1: { title: "Day 1", subtitle: "Opening Ceremony", icon: "fas fa-star", activities: [], registrations: [] },
    day2: { title: "Day 2", subtitle: "Academic Competitions", icon: "fas fa-brain", activities: ["Quiz Bee (Battle of Brains", "Hackathon", "Logic & Puzzle Challenge"], registrations: [] },
    day3: { title: "Day 3", subtitle: "Showcasing Creativity", icon: "fas fa-paint-brush", activities: ["Poster Making Contest", "Infographics Competition", "Digital Modulo Art", "Esports Tournament"], registrations: [] },
    day4: { title: "Day 4", subtitle: "Workshops & Tech Talks", icon: "fas fa-chalkboard-teacher", activities: ["Seminar", "Alumni Talk"], registrations: [] },
    day5: { title: "Day 5", subtitle: "Student Engagement", icon: "fas fa-gamepad", activities: ["Kahoot Trivia Games", "Escape Room Challenge"], registrations: [] },
    day6: { title: "Day 6", subtitle: "Closing Ceremony", icon: "fas fa-trophy", activities: [], registrations: [] }
};

let currentDay = null;
let allRegistrations = [];
let filteredRegistrations = [];
let currentTheme = "Empowering the Next Generation of Tech Leaders";
let editActivityCount = 0;
let addActivityCount = 0;
let activeRoleFilter = '';
let cachedAccountCount = 0; // fetched ONCE on load, reused for all stat updates

// ================= STATS BAR =================
// Fully synchronous - reads local array so updates are instant on add/edit/delete
function updateStatsBar() {
    const total = allRegistrations.length;
    const attendees = allRegistrations.filter(r => (r.registeredAs || '').toLowerCase() === 'attendee').length;
    const participants = allRegistrations.filter(r => (r.registeredAs || '').toLowerCase() === 'participant').length;

    animateCount('statAccounts', cachedAccountCount);
    animateCount('statTotal', total);
    animateCount('statAttendees', attendees);
    animateCount('statParticipants', participants);
}

function animateCount(elementId, target) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    const diff = target - current;
    const step = diff > 0 ? 1 : -1;
    const duration = Math.min(Math.abs(diff) * 30, 600);
    const steps = Math.abs(diff);
    const interval = steps > 0 ? duration / steps : 0;
    let count = current;
    const timer = setInterval(() => {
        count += step;
        el.textContent = count;
        if (count === target) clearInterval(timer);
    }, interval);
}

// ================= LOAD DATA =================
async function loadRegistrations() {
    // Fetch user account count once on page load and cache it
    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        cachedAccountCount = usersSnapshot.size;
    } catch (e) {
        console.error("Failed to fetch user count:", e);
    }

    const snapshot = await getDocs(collection(db, "registrations"));
    allRegistrations = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        allRegistrations.push({
            id: docSnap.id,
            studentId: data.studentId || '-',
            name: data.fullName,
            year: data.yearLevel,
            section: data.section,
            email: data.email,
            contact: data.phone,
            registeredAs: data.registerAs,
            activity: data.events?.join(", ") || "",
            day: data.eventDay
        });
    });
    renderTable(allRegistrations);
    updateStatsBar();
}

function regMatchesDay(reg, dayKey) {
    if (!reg.day) return false;
    const title = daysData[dayKey]?.title || '';
    return reg.day === dayKey ||
        reg.day.replace(/\s/g, '').toLowerCase() === title.replace(/\s/g, '').toLowerCase() ||
        reg.day.includes(title);
}

// ================= FILTER DROPDOWN =================
function toggleFilterDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    const chevron = document.getElementById('filterChevron');
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open', !isOpen);
    chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}

function closeFilterDropdown() {
    const dropdown = document.getElementById('filterDropdown');
    const chevron = document.getElementById('filterChevron');
    dropdown.classList.remove('open');
    chevron.style.transform = 'rotate(0deg)';
}

function applyRoleFilter(role) {
    if (!currentDay) return;
    activeRoleFilter = role;

    document.getElementById('filterAttendeeBtn').classList.toggle('active', role === 'Attendee');
    document.getElementById('filterParticipantBtn').classList.toggle('active', role === 'Participant');
    document.getElementById('filterAllBtn').classList.toggle('active', role === '');

    const badge = document.getElementById('activeFilterBadge');
    const label = document.getElementById('activeFilterLabel');
    if (role) {
        badge.style.display = 'block';
        label.textContent = role;
    } else {
        badge.style.display = 'none';
    }

    let results = allRegistrations.filter(reg => regMatchesDay(reg, currentDay));
    if (role) results = results.filter(r => (r.registeredAs || "").toLowerCase() === role.toLowerCase());
    filteredRegistrations = results;
    renderTable(filteredRegistrations);
    closeFilterDropdown();
}

document.addEventListener('click', function(e) {
    const wrapper = document.getElementById('filterWrapper');
    if (wrapper && !wrapper.contains(e.target)) closeFilterDropdown();
});

// ================= INIT =================
function updateParticipantOption() {
    const updateRegisteredAsSelect = document.getElementById('updateRegisteredAs');
    if (!currentDay || !daysData[currentDay].activities || daysData[currentDay].activities.length === 0) {
        const participantOption = updateRegisteredAsSelect.querySelector('option[value="Participant"]');
        if (participantOption) {
            participantOption.disabled = true;
            participantOption.textContent = 'Participant (No activities available)';
        }
        if (updateRegisteredAsSelect.value === 'Participant') {
            updateRegisteredAsSelect.value = 'Attendee';
            toggleUpdateActivityField();
        }
    } else {
        const participantOption = updateRegisteredAsSelect.querySelector('option[value="Participant"]');
        if (participantOption) {
            participantOption.disabled = false;
            participantOption.textContent = 'Participant';
        }
    }
}

function init() {
    document.getElementById('currentTheme').textContent = currentTheme;
    createDaysCards();
    populateDaySelects();
    document.getElementById('tableSection').style.display = 'none';

    document.getElementById('logoutBtn').addEventListener('click', function(e) {
        e.preventDefault();
        openLogoutConfirm();
    });

    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchRegistrations();
    });

    setupFormEventListeners();
}

function setupFormEventListeners() {
    document.getElementById('addForm').onsubmit = handleAddFormSubmit;
    document.getElementById('updateForm').onsubmit = handleUpdateFormSubmit;
    document.getElementById('themeForm').onsubmit = handleThemeFormSubmit;
    document.getElementById('editDayForm').onsubmit = handleEditDayFormSubmit;
    document.getElementById('addDayForm').onsubmit = handleAddDayFormSubmit;
    document.getElementById('deleteDayForm').onsubmit = handleDeleteDayFormSubmit;
}

window.addEventListener('load', () => {
    onAuthStateChanged(auth, async (user) => {
        if (!user) { window.location.href = 'index.html'; return; }
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists() || userDoc.data().role !== 'admin') { window.location.href = 'index.html'; return; }
        init();
        await loadRegistrations();
        createDaysCards();
    });
});

// ================= MODALS =================
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = 'auto';
    if (modalId === 'addModal') {
        resetFormFields('addForm');
        document.getElementById('addModalTitle').innerHTML = '<i class="fas fa-plus"></i> Add New Registration';
        document.getElementById('addActivityRadios').innerHTML = '';
    }
}

// ================= ADD REGISTRATION =================
function openAddModal() {
    if (!currentDay) { alert('Please select a day first!'); return; }
    resetFormFields('addForm');
    const hasActivities = daysData[currentDay].activities.length > 0;
    const registeredAsSelect = document.getElementById('addRegisteredAs');
    registeredAsSelect.innerHTML = '<option value="">Select</option><option value="Attendee">Attendee</option>';
    if (hasActivities) registeredAsSelect.innerHTML += '<option value="Participant">Participant</option>';
    document.getElementById('addModalTitle').innerHTML = `<i class="fas fa-plus"></i> Add Registration - ${daysData[currentDay].title}: ${daysData[currentDay].subtitle}`;
    toggleActivityField();
    openModal('addModal');
}

function toggleActivityField() {
    const registeredAs = document.getElementById('addRegisteredAs').value;
    const activityField = document.getElementById('addActivityField');
    if (registeredAs === 'Participant' && currentDay && daysData[currentDay].activities.length > 0) {
        activityField.style.display = 'block';
        populateAddActivityRadios();
        document.querySelectorAll('input[name="addActivity"]').forEach(r => r.required = true);
    } else {
        activityField.style.display = 'none';
        document.getElementById('addActivityRadios').innerHTML = '';
        document.querySelectorAll('input[name="addActivity"]').forEach(r => r.required = false);
    }
}

function populateAddActivityRadios() {
    const container = document.getElementById('addActivityRadios');
    container.innerHTML = '';
    if (currentDay && daysData[currentDay].activities.length > 0) {
        daysData[currentDay].activities.forEach(activity => {
            const radioItem = document.createElement('div');
            radioItem.className = 'activity-radio-item';
            const safeId = `addActivity_${activity.replace(/[^a-zA-Z0-9]/g, '_')}`;
            radioItem.innerHTML = `
                <input type="radio" name="addActivity" value="${activity}" id="${safeId}">
                <label for="${safeId}"><span>${activity}</span></label>
            `;
            container.appendChild(radioItem);
        });
    }
}

async function handleAddFormSubmit(e) {
    e.preventDefault();
    const registeredAs = document.getElementById('addRegisteredAs').value;
    if (!registeredAs) { alert('Please select "Registered As"!'); return; }
    if (registeredAs === 'Participant') {
        const selectedActivityRadio = document.querySelector('input[name="addActivity"]:checked');
        if (!selectedActivityRadio) { alert('Please select an activity!'); return; }
    }
    const regData = {
        studentId: document.getElementById('addStudentId').value || '-',
        name: document.getElementById('addFirstName').value.trim() + ' ' + document.getElementById('addLastName').value.trim(),
        year: document.getElementById('addYearLevel').value,
        section: document.getElementById('addSection').value,
        email: document.getElementById('addEmail').value,
        contact: document.getElementById('addContact').value || '',
        registeredAs: registeredAs,
        activity: registeredAs === 'Participant' ? document.querySelector('input[name="addActivity"]:checked')?.value || '' : ''
    };
    try {
        const docRef = await addDoc(collection(db, "registrations"), {
            studentId: regData.studentId,
            fullName: regData.name,
            yearLevel: regData.year,
            section: regData.section,
            email: regData.email,
            phone: regData.contact || '',
            eventDay: currentDay,
            registerAs: regData.registeredAs,
            events: regData.activity ? [regData.activity] : [],
            createdAt: serverTimestamp()
        });
        regData.id = docRef.id;
        regData.day = currentDay;
        allRegistrations.push(regData); // update local array immediately
        applyRoleFilter(activeRoleFilter);
        updateDaysCards();
        updateStatsBar(); // instant — no Firestore call
        closeModal('addModal');
        alert('✅ Registration added successfully!');
    } catch (error) {
        console.error("❌ Error adding:", error);
        alert("Failed to add. Try again.");
    }
}

// ================= UPDATE REGISTRATION =================
function openUpdateModal(id) {
    if (!currentDay) return;
    const reg = allRegistrations.find(r => r.id == id);
    if (reg) {
        document.getElementById('updateId').value = reg.id;
        document.getElementById('updateDisplayId').value = reg.studentId || reg.id;
        document.getElementById('updateName').value = reg.name;
        document.getElementById('updateYearLevel').value = reg.year;
        document.getElementById('updateSection').value = reg.section;
        document.getElementById('updateEmail').value = reg.email;
        document.getElementById('updateContact').value = reg.contact || '';
        const registeredAsSelect = document.getElementById('updateRegisteredAs');
        registeredAsSelect.innerHTML = '<option value="">Select</option><option value="Attendee">Attendee</option><option value="Participant">Participant</option>';
        registeredAsSelect.value = reg.registeredAs;
        updateParticipantOption();
        toggleUpdateActivityField();
        if (reg.registeredAs === 'Participant' && reg.activity) {
            setTimeout(() => {
                const activityRadio = document.querySelector(`input[name="updateActivity"][value="${reg.activity}"]`);
                if (activityRadio) activityRadio.checked = true;
            }, 150);
        }
        document.getElementById('updateModalTitle').innerHTML = `<i class="fas fa-edit"></i> Update Registration`;
        openModal('updateModal');
    }
}

function populateUpdateActivityRadios() {
    const container = document.getElementById('updateActivityRadios');
    container.innerHTML = '';
    if (currentDay && daysData[currentDay].activities.length > 0) {
        daysData[currentDay].activities.forEach(activity => {
            const radioItem = document.createElement('div');
            radioItem.className = 'activity-radio-item';
            const safeId = `updateActivity_${activity.replace(/[^a-zA-Z0-9]/g, '_')}`;
            radioItem.innerHTML = `
                <input type="radio" name="updateActivity" value="${activity}" id="${safeId}">
                <label for="${safeId}"><span>${activity}</span></label>
            `;
            container.appendChild(radioItem);
        });
    }
}

function toggleUpdateActivityField() {
    const selectedRegisteredAs = document.getElementById('updateRegisteredAs').value;
    const activityField = document.getElementById('updateActivityField');
    if (selectedRegisteredAs === 'Participant' && currentDay && daysData[currentDay].activities.length > 0) {
        activityField.style.display = 'block';
        populateUpdateActivityRadios();
        document.querySelectorAll('input[name="updateActivity"]').forEach(r => r.required = true);
    } else {
        activityField.style.display = 'none';
        document.getElementById('updateActivityRadios').innerHTML = '';
        document.querySelectorAll('input[name="updateActivity"]').forEach(r => r.required = false);
    }
}

async function handleUpdateFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('updateId').value;
    const selectedRegisteredAs = document.getElementById('updateRegisteredAs').value;
    if (!selectedRegisteredAs) { alert('Please select Registered As!'); return; }
    let activity = '';
    if (selectedRegisteredAs === 'Participant') {
        const selectedActivityRadio = document.querySelector('input[name="updateActivity"]:checked');
        if (!selectedActivityRadio) { alert('Please select an activity for Participant!'); return; }
        activity = selectedActivityRadio.value;
    }
    const regData = {
        id: id,
        studentId: allRegistrations.find(r => r.id == id)?.studentId || '-',
        name: document.getElementById('updateName').value,
        year: document.getElementById('updateYearLevel').value,
        section: document.getElementById('updateSection').value,
        email: document.getElementById('updateEmail').value,
        contact: document.getElementById('updateContact').value,
        registeredAs: selectedRegisteredAs,
        activity: activity
    };
    const index = allRegistrations.findIndex(r => r.id == id);
    if (index !== -1) {
        const firestoreId = allRegistrations[index].id;
        try {
            await updateDoc(doc(db, "registrations", firestoreId), {
                fullName: regData.name,
                yearLevel: regData.year,
                section: regData.section,
                email: regData.email,
                phone: regData.contact || '',
                registerAs: regData.registeredAs,
                events: regData.activity ? [regData.activity] : []
            });
            regData.day = allRegistrations[index].day;
            regData.studentId = allRegistrations[index].studentId;
            allRegistrations[index] = regData; // update local array immediately
            filteredRegistrations = filteredRegistrations.map(r => r.id == id ? regData : r);
            renderTable(filteredRegistrations);
            updateDaysCards();
            updateStatsBar(); // instant — no Firestore call
            closeUpdateModal();
            alert('Registration updated successfully!');
        } catch (error) {
            console.error("❌ Error updating:", error);
            alert("Failed to update. Try again.");
        }
    }
}

function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('active');
    document.body.style.overflow = 'auto';
    resetFormFields('updateForm');
    document.getElementById('updateActivityRadios').innerHTML = '';
}

// ================= TABLE =================
function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;padding:2rem;color:#666;">
                    <i class="fas fa-inbox" style="font-size:3rem;margin-bottom:1rem;display:block;"></i>
                    No registrations found
                </td>
            </tr>`;
        return;
    }
    data.forEach(reg => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reg.studentId}</td>
            <td>${reg.name}</td>
            <td>${reg.year}</td>
            <td>${reg.section}</td>
            <td>${reg.email}</td>
            <td>${reg.contact || '-'}</td>
            <td>${reg.registeredAs}</td>
            <td>${reg.activity || '-'}</td>
            <td>
                <button class="action-btn btn-primary" onclick="openUpdateModal('${reg.id}')" title="Update">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn btn-danger" onclick="deleteRegistration('${reg.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </td>`;
        tbody.appendChild(row);
    });
}

// ================= DAY CARDS =================
function createDaysCards() {
    const grid = document.getElementById('daysGrid');
    grid.innerHTML = '';
    Object.keys(daysData).forEach(dayKey => {
        const day = daysData[dayKey];
        const card = document.createElement('div');
        card.className = 'day-card';
        card.dataset.day = dayKey;
        const count = allRegistrations.filter(r => regMatchesDay(r, dayKey)).length;
        const activitiesText = day.activities.length > 0 ? `(${day.activities.length} activities)` : '';
        card.innerHTML = `
            <div class="day-icon"><i class="${day.icon}"></i></div>
            <div class="day-title">${day.title}</div>
            <div class="day-subtitle">${day.subtitle} ${activitiesText}</div>
            <div class="day-stats">${count} Registrations</div>`;
        card.addEventListener('click', function() { showDayTable(dayKey, this); });
        grid.appendChild(card);
    });
}

function showDayTable(dayKey, clickedCard) {
    currentDay = dayKey;
    activeRoleFilter = '';
    document.getElementById('activeFilterBadge').style.display = 'none';
    document.querySelectorAll('.filter-option').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.day-card').forEach(card => card.classList.remove('active'));
    clickedCard.classList.add('active');
    filteredRegistrations = allRegistrations.filter(reg => regMatchesDay(reg, dayKey));
    const tableSection = document.getElementById('tableSection');
    tableSection.style.display = 'block';
    tableSection.classList.add('active');
    renderTable(filteredRegistrations);
}

function updateDaysCards() {
    const cards = document.querySelectorAll('.day-card');
    cards.forEach((card, index) => {
        const dayKey = Object.keys(daysData)[index];
        if (daysData[dayKey]) {
            const day = daysData[dayKey];
            const activitiesText = day.activities.length > 0 ? `(${day.activities.length} activities)` : '';
            card.querySelector('.day-subtitle').innerHTML = `${day.subtitle} ${activitiesText}`;
            const count = allRegistrations.filter(r => regMatchesDay(r, dayKey)).length;
            card.querySelector('.day-stats').textContent = `${count} Registrations`;
        }
    });
}

// ================= DELETE =================
async function deleteRegistration(id) {
    if (!currentDay) return;
    if (confirm(`Are you sure you want to delete this registration?`)) {
        try {
            await deleteDoc(doc(db, "registrations", id));
            allRegistrations = allRegistrations.filter(r => r.id != id); // update local array immediately
            applyRoleFilter(activeRoleFilter);
            updateDaysCards();
            updateStatsBar(); // instant — no Firestore call
            alert('Registration deleted successfully!');
        } catch (error) {
            console.error("❌ Error deleting:", error);
            alert("Failed to delete. Try again.");
        }
    }
}

function hideTableSection() {
    document.getElementById('tableSection').classList.remove('active');
    document.getElementById('tableSection').style.display = 'none';
    document.querySelectorAll('.day-card').forEach(card => card.classList.remove('active'));
    currentDay = null;
    activeRoleFilter = '';
    closeFilterDropdown();
}

// ================= SEARCH =================
function searchRegistrations() {
    if (!currentDay) return;
    const term = document.getElementById('searchInput').value.toLowerCase().trim();
    let dayRegs = allRegistrations.filter(reg => regMatchesDay(reg, currentDay));
    if (activeRoleFilter) dayRegs = dayRegs.filter(r => (r.registeredAs || "").toLowerCase() === activeRoleFilter.toLowerCase());
    if (!term) { filteredRegistrations = dayRegs; renderTable(filteredRegistrations); return; }
    filteredRegistrations = dayRegs.filter(reg =>
        (reg.studentId || '').toLowerCase().includes(term) ||
        reg.name.toLowerCase().includes(term) ||
        reg.email.toLowerCase().includes(term) ||
        (reg.contact || '').toLowerCase().includes(term)
    );
    renderTable(filteredRegistrations);
    document.getElementById('searchInput').value = '';
}

// ================= THEME =================
function openEditThemeModal() {
    document.getElementById('themeInput').value = currentTheme;
    openModal('editThemeModal');
}
function closeEditThemeModal() { closeModal('editThemeModal'); }
function handleThemeFormSubmit(e) {
    e.preventDefault();
    currentTheme = document.getElementById('themeInput').value;
    document.getElementById('currentTheme').textContent = currentTheme;
    closeEditThemeModal();
    alert('Theme updated successfully!');
}

// ================= DAY SELECTS =================
function populateDaySelects() {
    const selects = ['editDaySelect', 'deleteDaySelect'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select Day</option>';
        Object.keys(daysData).forEach(dayKey => {
            const day = daysData[dayKey];
            select.innerHTML += `<option value="${dayKey}">${day.title} - ${day.subtitle}</option>`;
        });
    });
}

function openEditDayModal() {
    document.getElementById('editDaySelect').selectedIndex = 0;
    document.getElementById('editDaySubtitle').value = '';
    document.getElementById('editActivitiesContainer').innerHTML = '';
    editActivityCount = 0;
    openModal('editDayModal');
}
function closeEditDayModal() { closeModal('editDayModal'); }

function openAddDayModal() {
    document.getElementById('addDayTitle').value = '';
    document.getElementById('addDaySubtitle').value = '';
    document.getElementById('addActivitiesContainer').innerHTML = '';
    addActivityCount = 0;
    openModal('addDayModal');
}
function closeAddDayModal() { closeModal('addDayModal'); }

function openDeleteDayModal() {
    document.getElementById('deleteDaySelect').selectedIndex = 0;
    openModal('deleteDayModal');
}
function closeDeleteDayModal() { closeModal('deleteDayModal'); }

function addEditActivity() {
    editActivityCount++;
    const container = document.getElementById('editActivitiesContainer');
    const activityGroup = document.createElement('div');
    activityGroup.className = 'activity-input-group';
    activityGroup.id = `editActivityGroup${editActivityCount}`;
    activityGroup.innerHTML = `
        <input type="text" placeholder="Enter activity name" required>
        <button type="button" class="activity-remove-btn" onclick="removeEditActivity(${editActivityCount})">
            <i class="fas fa-times"></i>
        </button>`;
    container.appendChild(activityGroup);
}

function addAddActivity() {
    addActivityCount++;
    const container = document.getElementById('addActivitiesContainer');
    const activityGroup = document.createElement('div');
    activityGroup.className = 'activity-input-group';
    activityGroup.id = `addActivityGroup${addActivityCount}`;
    activityGroup.innerHTML = `
        <input type="text" placeholder="Enter activity name" required>
        <button type="button" class="activity-remove-btn" onclick="removeAddActivity(${addActivityCount})">
            <i class="fas fa-times"></i>
        </button>`;
    container.appendChild(activityGroup);
}

function removeEditActivity(index) {
    const group = document.getElementById(`editActivityGroup${index}`);
    if (group) group.remove();
}
function removeAddActivity(index) {
    const group = document.getElementById(`addActivityGroup${index}`);
    if (group) group.remove();
}

document.getElementById('editDaySelect').addEventListener('change', function() {
    const dayKey = this.value;
    if (dayKey && daysData[dayKey]) {
        const day = daysData[dayKey];
        document.getElementById('editDaySubtitle').value = day.subtitle;
        const container = document.getElementById('editActivitiesContainer');
        container.innerHTML = '';
        editActivityCount = 0;
        day.activities.forEach(activity => {
            editActivityCount++;
            const activityGroup = document.createElement('div');
            activityGroup.className = 'activity-input-group';
            activityGroup.id = `editActivityGroup${editActivityCount}`;
            activityGroup.innerHTML = `
                <input type="text" value="${activity}" required>
                <button type="button" class="activity-remove-btn" onclick="removeEditActivity(${editActivityCount})">
                    <i class="fas fa-times"></i>
                </button>`;
            container.appendChild(activityGroup);
        });
    }
});

function handleEditDayFormSubmit(e) {
    e.preventDefault();
    const dayKey = document.getElementById('editDaySelect').value;
    if (!dayKey) { alert('Please select a day'); return; }
    const subtitle = document.getElementById('editDaySubtitle').value;
    const activities = [];
    document.querySelectorAll('#editActivitiesContainer .activity-input-group input').forEach(input => {
        if (input.value.trim()) activities.push(input.value.trim());
    });
    daysData[dayKey].subtitle = subtitle;
    daysData[dayKey].activities = activities;
    createDaysCards();
    populateDaySelects();
    updateStatsBar();
    closeEditDayModal();
    alert('Day updated successfully!');
}

function handleAddDayFormSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('addDayTitle').value;
    const subtitle = document.getElementById('addDaySubtitle').value;
    const activities = [];
    document.querySelectorAll('#addActivitiesContainer .activity-input-group input').forEach(input => {
        if (input.value.trim()) activities.push(input.value.trim());
    });
    const newDayKey = `day${Object.keys(daysData).length + 1}`;
    daysData[newDayKey] = { title, subtitle, icon: "fas fa-calendar-day", activities, registrations: [] };
    createDaysCards();
    populateDaySelects();
    closeAddDayModal();
    alert('Day added successfully!');
}

function handleDeleteDayFormSubmit(e) {
    e.preventDefault();
    const dayKey = document.getElementById('deleteDaySelect').value;
    if (!dayKey) { alert('Please select a day'); return; }
    if (confirm(`Are you sure you want to delete ${daysData[dayKey].title}?`)) {
        delete daysData[dayKey];
        const newDaysData = {};
        let index = 1;
        Object.keys(daysData).sort().forEach(oldKey => {
            newDaysData[`day${index}`] = daysData[oldKey];
            index++;
        });
        Object.assign(daysData, newDaysData);
        createDaysCards();
        populateDaySelects();
        updateStatsBar();
        closeDeleteDayModal();
        alert('Day deleted successfully!');
    }
}

// ================= HELPERS =================
function resetFormFields(formPrefix) {
    document.querySelectorAll(`#${formPrefix} input`).forEach(input => input.value = '');
    document.querySelectorAll(`#${formPrefix} select`).forEach(select => select.selectedIndex = 0);
    if (formPrefix === 'addForm') document.getElementById('addActivityRadios').innerHTML = '';
}

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

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            const modalId = this.id;
            if (modalId === 'addModal') closeModal('addModal');
            else if (modalId === 'updateModal') closeUpdateModal();
            else if (modalId === 'editThemeModal') closeEditThemeModal();
            else if (modalId === 'editDayModal') closeEditDayModal();
            else if (modalId === 'addDayModal') closeAddDayModal();
            else if (modalId === 'deleteDayModal') closeDeleteDayModal();
            else if (modalId === 'logoutConfirmModal') closeLogoutConfirm();
        }
    });
});

// ================= EXPOSE TO GLOBAL =================
window.openEditDayModal = openEditDayModal;
window.openAddDayModal = openAddDayModal;
window.openDeleteDayModal = openDeleteDayModal;
window.openAddModal = openAddModal;
window.openUpdateModal = openUpdateModal;
window.deleteRegistration = deleteRegistration;
window.closeModal = closeModal;
window.closeUpdateModal = closeUpdateModal;
window.closeEditDayModal = closeEditDayModal;
window.closeAddDayModal = closeAddDayModal;
window.closeDeleteDayModal = closeDeleteDayModal;
window.searchRegistrations = searchRegistrations;
window.toggleFilterDropdown = toggleFilterDropdown;
window.applyRoleFilter = applyRoleFilter;
window.toggleActivityField = toggleActivityField;
window.toggleUpdateActivityField = toggleUpdateActivityField;
window.addEditActivity = addEditActivity;
window.addAddActivity = addAddActivity;
window.removeEditActivity = removeEditActivity;
window.removeAddActivity = removeAddActivity;
window.hideTableSection = hideTableSection;
window.confirmLogout = confirmLogout;
window.closeLogoutConfirm = closeLogoutConfirm;
window.openEditThemeModal = openEditThemeModal;
window.closeEditThemeModal = closeEditThemeModal;
