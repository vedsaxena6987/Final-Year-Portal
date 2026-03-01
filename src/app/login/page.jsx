// app/login/page.jsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { GraduationCap, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

import { logger } from "../../lib/logger";
// Firebase imports
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "firebase/auth";

const ALLOWED_DOMAINS = ["gehu.ac.in", "geu.ac.in"];

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Password Visibility States
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password State
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  // Pre-fill reset email when dialog opens
  useEffect(() => {
    if (isForgotPasswordOpen) {
      setResetEmail(email);
    }
  }, [isForgotPasswordOpen, email]);

  // Show loading while checking authentication status
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 animate-ping opacity-20 absolute inset-0" />
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl relative z-10">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500 animate-pulse">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if user is authenticated
  if (user) {
    return null;
  }

  // Function for creating a new account (UPDATED)
  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Domain Check
    const emailDomain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(emailDomain)) {
      toast.error("Invalid Email Domain", {
        description: `You must use an email ending in @gehu.ac.in or @geu.ac.in to sign up.`,
      });
      setLoading(false);
      return;
    }

    // 2. Confirm Password Check
    if (password !== confirmPassword) {
      toast.error("Passwords do not match", {
        description: "Please ensure both passwords entered are the same."
      });
      setLoading(false);
      return;
    }

    try {
      // 3. Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 4. Check if user data already exists in Firestore (from CSV import)
      const userDocRef = doc(db, "users", user.email);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const existingUserData = userDocSnap.data();

        // User exists in Firestore (imported via CSV) - just link the Auth UID
        await setDoc(userDocRef, {
          uid: user.uid,
          hasAuthAccount: true,
          authAccountCreated: new Date()
        }, { merge: true });

        toast.success("Account Linked Successfully!", {
          description: `Welcome back, ${existingUserData.name || user.email}! Your account has been linked.`
        });
      } else {
        // New user - create fresh Firestore document
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: user.email.split('@')[0].split('.')[0], // Default name from email (handles name.id@domain and name@domain)
          role: "student", // Default role for new sign-ups
          hasAuthAccount: true,
          createdAt: new Date(),
          authAccountCreated: new Date(),
        });

        toast.success("Account Created Successfully!", { description: `Welcome, ${user.email}` });
      }

      router.push("/dashboard");

    } catch (error) {
      toast.error("Sign-Up Failed", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Function for signing into an existing account with smart login
  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Check if user data exists in Firestore (from CSV import)
      const userDocRef = doc(db, "users", user.email);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const existingUserData = userDocSnap.data();

        // User exists in Firestore - update with Auth UID if needed
        if (!existingUserData.uid || existingUserData.uid === user.email) {
          await setDoc(userDocRef, {
            uid: user.uid,
            hasAuthAccount: true,
            lastLogin: new Date()
          }, { merge: true });
        }
      } else {
        // User doesn't exist in Firestore - create basic document
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          name: user.email.split('@')[0].split('.')[0],
          role: "student",
          hasAuthAccount: true,
          createdAt: new Date(),
          lastLogin: new Date()
        });
      }

      // Normal login - redirect to dashboard
      toast.success("Login Successful!");
      router.push("/dashboard");

    } catch (error) {
      toast.error("Sign-In Failed", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Function to handle password reset
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetLoading(true);

    if (!resetEmail) {
      toast.error("Please enter your email address");
      setResetLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("Password Reset Email Sent", {
        description: "Check your inbox for instructions to reset your password."
      });
      setIsForgotPasswordOpen(false);
      setResetEmail(""); // Clear email after success
    } catch (error) {
      logger.error("Password reset error:", error);
      toast.error("Failed to send reset email", {
        description: error.message
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden bg-slate-50">

      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-200/30 blur-[100px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-fuchsia-100/30 blur-[80px]" />
      </div>

      {/* Main Container */}
      <div className="w-full max-w-md p-4 relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Brand Header */}
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-lg shadow-indigo-500/20 mb-4 transform hover:scale-105 transition-transform duration-300">
            <GraduationCap className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Final Year Portal
          </h1>
          <p className="text-slate-500 text-sm">
            Graphic Era Hill University
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-xl ring-1 ring-white/50">
          <CardHeader className="space-y-1 pb-4">
            {/* Not strictly needed here as Tabs handle title, but good for accessibility/structure if we weren't using Tabs for header */}
          </CardHeader>
          <CardContent className="pt-0">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/80 p-1">
                <TabsTrigger value="signin" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all duration-300">Sign In</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all duration-300">Sign Up</TabsTrigger>
              </TabsList>

              {/* Sign In Tab */}
              <TabsContent value="signin" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                <form onSubmit={handleSignIn} autoComplete="on" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-signin" className="text-slate-600 font-medium ml-1">Email Address</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input
                        id="email-signin"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@gehu.ac.in or name@geu.ac.in"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <Label htmlFor="password-signin" className="text-slate-600 font-medium">Password</Label>
                      <span
                        className="text-xs text-indigo-600 hover:text-indigo-700 cursor-pointer font-medium hover:underline"
                        onClick={() => setIsForgotPasswordOpen(true)}
                      >
                        Forgot password?
                      </span>
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input
                        id="password-signin"
                        name="password"
                        type={showSignInPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-indigo-500"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                      >
                        {showSignInPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/30 transition-all duration-300 hover:shadow-indigo-500/50 hover:scale-[1.02] active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating...</>
                    ) : (
                      <>Sign In <ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Tab */}
              <TabsContent value="signup" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex gap-2 items-start mb-4">
                  <div className="mt-0.5 shrink-0 w-1 h-1 bg-amber-500 rounded-full" />
                  Please use your official college email ID (@gehu.ac.in or @geu.ac.in) to create your account.
                </div>

                <form onSubmit={handleSignUp} autoComplete="on" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-signup" className="text-slate-600 font-medium ml-1">Email Address</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input
                        id="email-signup"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="name@gehu.ac.in or name@geu.ac.in"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-signup" className="text-slate-600 font-medium ml-1">Create Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input
                        id="password-signup"
                        name="new-password"
                        type={showSignUpPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10 h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-indigo-500"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      >
                        {showSignUpPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password-signup" className="text-slate-600 font-medium ml-1">Confirm Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <Input
                        id="confirm-password-signup"
                        name="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10 h-10 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all bg-white"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-slate-400 hover:text-indigo-500"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin text-indigo-600" /> Creating Account...</>
                    ) : (
                      <>Create Account</>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          © {new Date().getFullYear()} Final Year Project Management Portal
        </p>

        {/* Forgot Password Dialog */}
        <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter your email address and we'll send you a link to reset your password.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="reset-email" className="sr-only">Email</Label>
                  <Input
                    id="reset-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@gehu.ac.in or name@geu.ac.in"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="sm:justify-start">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsForgotPasswordOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={resetLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Reset Link"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
