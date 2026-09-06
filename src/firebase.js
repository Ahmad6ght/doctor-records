import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDb2WXV3pQOmDC09ShWoJInLHaB-ci7Lwg",
  authDomain: "bs-clienic.firebaseapp.com",
  projectId: "bs-clienic",
  storageBucket: "bs-clienic.firebasestorage.app",
  messagingSenderId: "301174034800",
  appId: "1:301174034800:web:da6b1e76644faf044a3fb5",
  measurementId: "G-9JX8TGXQ7E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and export it
export const db = getFirestore(app);