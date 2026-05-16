// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcu_v1HEq1jx3wwLJSpptB__IgHk6zwRQ",
  authDomain: "eventsystem-b0bc0.firebaseapp.com",
  projectId: "eventsystem-b0bc0",
  storageBucket: "eventsystem-b0bc0.firebasestorage.app",
  messagingSenderId: "1019531204229",
  appId: "1:1019531204229:web:2d48a9062cfa6b4f98fbec"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);