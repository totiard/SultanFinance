import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBWzE4OcL4gYZ7EmlQ6ldTrt_wlKVZCaptk",
  authDomain: "webapp-aacf7.firebaseapp.com",
  projectId: "webapp-aacf7",
  storageBucket: "webapp-aacf7.firebasestorage.app",
  messagingSenderId: "121885112783",
  appId: "1:121885112783:web:4d617aba5a665bb12bb834",
  measurementId: "G-Z4NG7EQ1M7"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
