import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// TODO: Replace with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyBrAQ1VfdG3l2bnHXFNHN6V7eYsXqkt67M",
  authDomain: "invox-7.firebaseapp.com",
  databaseURL: "https://invox-7-default-rtdb.firebaseio.com",
  projectId: "invox-7",
  storageBucket: "invox-7.firebasestorage.app",
  messagingSenderId: "207206335377",
  appId: "1:207206335377:web:c030425b7a7b2659be9030",
  measurementId: "G-884TBTKYFX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
