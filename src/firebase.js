import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSy...", // <-- Paste your actual key from the Firebase settings here
  authDomain: "bs-clienic.firebaseapp.com",
  projectId: "bs-clienic",
  storageBucket: "bs-clienic.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);