/**
 * MineVest Firebase Client Configuration & Service
 */
const firebaseConfig = {
  apiKey: "AIzaSyBa19x_iFT1EDdTK_c8McxQKA47z61AUEY",
  authDomain: "minevest-edc67.firebaseapp.com",
  projectId: "minevest-edc67",
  storageBucket: "minevest-edc67.firebasestorage.app",
  messagingSenderId: "406109477151",
  appId: "1:406109477151:web:a4d112069838c645b7782a",
  measurementId: "G-28EYGMPBPW"
};

// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("[MineVest] Firebase successfully connected: " + firebaseConfig.projectId);
}

const FirebaseAuth = {
  get auth() {
    return (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
  },

  /**
   * 1-Click Google Sign In (Universal for any Gmail account)
   */
  async signInWithGoogle() {
    if (!this.auth) {
      throw new Error("Firebase Auth is not initialized.");
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await this.auth.signInWithPopup(provider);
    return result.user;
  },

  /**
   * Register with Email & Password + Send Native Verification Email
   */
  async registerWithEmail(email, password, fullName) {
    if (!this.auth) throw new Error("Firebase Auth is not initialized.");
    const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    if (fullName) {
      try {
        await user.updateProfile({ displayName: fullName });
      } catch (e) {
        console.warn("Could not update displayName:", e);
      }
    }
    try {
      await user.sendEmailVerification();
    } catch (e) {
      console.warn("Verification email dispatch notice:", e);
    }
    return user;
  },

  /**
   * Sign In with Email & Password
   */
  async loginWithEmail(email, password) {
    if (!this.auth) throw new Error("Firebase Auth is not initialized.");
    const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  },

  /**
   * Resend Verification Email
   */
  async resendVerificationEmail() {
    const user = this.auth?.currentUser;
    if (user) {
      await user.sendEmailVerification();
      return true;
    }
    return false;
  },

  /**
   * Sign Out
   */
  async signOut() {
    if (this.auth) {
      await this.auth.signOut();
    }
  }
};

