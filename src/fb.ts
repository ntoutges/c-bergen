import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";

// Initialize Firebase
export const app = initializeApp({
    apiKey: "AIzaSyCEbBdwzED1WMzg0MgZ7P1Pnx3zXJ_WPI4",
    authDomain: "c-bergen.firebaseapp.com",
    projectId: "c-bergen",
    storageBucket: "c-bergen.firebasestorage.app",
    messagingSenderId: "137705429562",
    appId: "1:137705429562:web:b3bbb287e6d9a39ceff303",
    measurementId: "G-ST4T65JVVK",
});
export const analytics = getAnalytics(app);
export const firestore = getFirestore(app);
export const auth = getAuth(app);

// connectFirestoreEmulator(firestore, "localhost", 8080);
// connectAuthEmulator(auth, "http://127.0.0.1:9099");

// // _DEV_
// import * as fs from "firebase/firestore";
// // @ts-ignore
// window.fs = fs;
// // @ts-ignore
// window.firestore = firestore;
