import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAO7p_H3IjTZKygiOpHPg8fxJMyj--2oIM",
  authDomain: "cyber-snake-587c1.firebaseapp.com",
  databaseURL: "https://cyber-snake-587c1-default-rtdb.firebaseio.com",
  projectId: "cyber-snake-587c1",
  storageBucket: "cyber-snake-587c1.firebasestorage.app",
  messagingSenderId: "885642683851",
  appId: "1:885642683851:web:754bb8a7f37cc597c5024e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();