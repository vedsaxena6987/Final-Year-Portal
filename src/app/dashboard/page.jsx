// src/app/dashboard/page.jsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import {
  LogOut,
  User,
  ChevronDown,
  Shield,
  GraduationCap,
  BookOpen,
  UserCheck
} from "lucide-react";

// Import all the necessary dashboard components
import TeamCreationGuard from "@/components/dashboard/student/TeamCreationGuard";
import FacultyDashboard from "@/components/dashboard/faculty/FacultyDashboard";
import AdminDashboard from "@/components/dashboard/admin/AdminDashboard";
import ExternalEvaluatorDashboard from "@/components/dashboard/external/ExternalEvaluatorDashboard";

export default function DashboardPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // Protect dashboard - redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto animate-pulse shadow-lg">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
          </div>
          <p className="mt-4 text-slate-600 font-medium">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      router.push("/login");
    } catch (error) {
      toast.error("Logout failed", { description: error.message });
    }
  };

  const getInitials = (name, email) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (!email) return "??";
    return email.substring(0, 2).toUpperCase();
  };

  // Get role-specific header title, subtitle, and icon
  const getHeaderContent = () => {
    const role = userData?.role;
    switch (role) {
      case 'student':
        return {
          title: 'Student Portal',
          subtitle: 'Final Year Project Management',
          icon: GraduationCap,
          roleLabel: 'Student',
          roleClass: 'role-badge-student'
        };
      case 'faculty':
        return {
          title: 'Faculty Portal',
          subtitle: 'Mentorship & Evaluation',
          icon: BookOpen,
          roleLabel: 'Faculty',
          roleClass: 'role-badge-faculty'
        };
      case 'admin':
        return {
          title: 'Admin Portal',
          subtitle: 'System Administration',
          icon: Shield,
          roleLabel: 'Administrator',
          roleClass: 'role-badge-admin'
        };
      case 'external_evaluator':
        return {
          title: 'Evaluator Portal',
          subtitle: 'External Evaluation System',
          icon: UserCheck,
          roleLabel: 'External',
          roleClass: 'role-badge-faculty'
        };
      default:
        return {
          title: 'Final Year Portal',
          subtitle: 'GEHU - CSE Department',
          icon: GraduationCap,
          roleLabel: 'User',
          roleClass: ''
        };
    }
  };

  const headerContent = getHeaderContent();
  const HeaderIcon = headerContent.icon;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Professional Header */}
      <header className="flex-none z-50 gradient-header border-b border-slate-800/50">
        <div className="flex items-center justify-between px-4 py-2 h-[48px]">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            {/* University Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/gehu-logo.png"
                alt="GEHU Logo"
                className="h-8 w-8 rounded-lg object-contain bg-white p-0.5"
              />
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold text-white leading-tight">{headerContent.title}</h1>
                <p className="text-[10px] text-slate-400">{headerContent.subtitle}</p>
              </div>
            </div>
          </div>

          {/* Right: User Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 focus:outline-none hover:bg-white/10 rounded-lg px-2 py-1.5 transition-all duration-200 group">
                {/* User Info - Desktop */}
                <div className="text-right hidden md:block">
                  <p className="text-xs font-medium text-white leading-tight">{userData?.name || 'User'}</p>
                  <span className={`role-badge ${headerContent.roleClass} text-[9px] py-0.5 px-2`}>
                    {headerContent.roleLabel}
                  </span>
                </div>

                {/* Avatar */}
                <Avatar className="h-8 w-8 ring-2 ring-white/20 group-hover:ring-white/40 transition-all">
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-semibold">
                    {getInitials(userData?.name, user.email)}
                  </AvatarFallback>
                </Avatar>

                <ChevronDown className="h-3 w-3 text-slate-400 group-hover:text-white transition-colors hidden md:block" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-2">
              {/* Profile Header in Dropdown */}
              <div className="px-2 py-3 mb-2 rounded-lg bg-slate-50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-white shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-semibold">
                      {getInitials(userData?.name, user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{userData?.name || 'User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    <span className={`role-badge ${headerContent.roleClass} mt-1 inline-flex`}>
                      {headerContent.roleLabel}
                    </span>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />

              {/* Menu Items */}
              <DropdownMenuItem
                onClick={() => {
                  // For role-based dashboards rendered within this page
                  const params = new URLSearchParams(window.location.search);
                  params.set('tab', 'profile');
                  router.push(`${window.location.pathname}?${params.toString()}`);
                }}
                className="cursor-pointer rounded-lg py-2.5 px-3 focus:bg-slate-100"
              >
                <User className="mr-3 h-4 w-4 text-slate-500" />
                <span className="text-sm">My Profile</span>
              </DropdownMenuItem>



              <DropdownMenuSeparator className="my-2" />

              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer rounded-lg py-2.5 px-3 text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-3 h-4 w-4" />
                <span className="text-sm font-medium">Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Subtle brand accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 opacity-80" />
      </header>

      <main className="flex-1 overflow-y-auto">
        {userData?.role === 'student' && (
          <div className="p-4 lg:p-6 bg-slate-50/50">
            <TeamCreationGuard redirectToStudentDashboard={true} />
          </div>
        )}

        {userData?.role === 'faculty' && (
          <>
            <FacultyDashboard />
          </>
        )}

        {userData?.role === 'admin' && (
          <>
            <AdminDashboard />
          </>
        )}

        {userData?.role === 'external_evaluator' && <ExternalEvaluatorDashboard />}

        {/* Fallback for users without a valid role */}
        {!userData?.role && userData && (
          <div className="text-center py-16 p-4 lg:p-6 bg-slate-50/50">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-800 mb-3">Account Setup Required</h1>
              <p className="text-sm text-slate-600 mb-4">
                Your account doesn't have a role assigned. Please contact an administrator to set up your account.
              </p>
              <p className="text-xs text-slate-400 bg-slate-100 rounded-lg px-3 py-2 inline-block">
                {userData.email}
              </p>
            </div>
          </div>
        )}

        {/* Loading state for userData */}
        {!userData && user && (
          <div className="text-center py-16 p-4 lg:p-6 bg-slate-50/50">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-orange-500 border-r-transparent" />
            <p className="mt-4 text-sm text-slate-600">Loading your profile...</p>
          </div>
        )}
      </main>
    </div>
  );
}
