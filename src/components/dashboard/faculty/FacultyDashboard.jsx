// src/components/dashboard/faculty/FacultyDashboard.jsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Upload,
  HelpCircle,
  Home,
  Menu,
  X
} from 'lucide-react';
import { cn } from "@/lib/utils";
import FacultyTasks from './FacultyTasks';
import AbstractsView from './AbstractsView';
import TeamsListView from './TeamsListView';
import PhasesOverview from './PhasesOverview';
import MeetingAnnouncements from '@/components/dashboard/MeetingAnnouncements';
import MentorshipRequests from './MentorshipRequests';
import AllSubmissionsView from './AllSubmissionsView';
import FacultyHelp from './FacultyHelp';
import ProfileSection from '@/components/dashboard/ProfileSection';
import Footer from '@/components/dashboard/shared/Footer';

export default function FacultyDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Handle mounting to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Restore tab from URL on page load
  useEffect(() => {
    if (!mounted) return;

    const tab = searchParams.get('tab');
    const validTabs = ['dashboard', 'requests', 'abstracts', 'teams', 'phases', 'submissions', 'help', 'profile'];

    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams, mounted]);

  // Update document title based on active tab
  useEffect(() => {
    const titles = {
      dashboard: 'Dashboard - Faculty Portal',
      requests: 'Mentorship Requests - Faculty Portal',
      abstracts: 'Abstracts - Faculty Portal',
      teams: 'Teams - Faculty Portal',
      phases: 'Phases & Evaluations - Faculty Portal',
      submissions: 'Submissions - Faculty Portal',
      help: 'Help Center - Faculty Portal',
      profile: 'My Profile - Faculty Portal'
    };

    document.title = titles[activeTab] || 'Faculty Portal';
  }, [activeTab]);

  // Close mobile menu on tab change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeTab]);

  // Handle tab change with URL update
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);

    // Update URL without page reload
    const currentPath = window.location.pathname;
    router.push(`${currentPath}?tab=${newTab}`, { scroll: false });
  };

  // Navigation config
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', shortLabel: 'Home' },
    { id: 'requests', icon: MessageSquare, label: 'Requests', shortLabel: 'Requests' },
    { id: 'abstracts', icon: FileText, label: 'Abstracts', shortLabel: 'Abstracts' },
    { id: 'teams', icon: Users, label: 'Teams', shortLabel: 'Teams' },
    { id: 'phases', icon: Calendar, label: 'Phases', shortLabel: 'Phases' },
    { id: 'submissions', icon: Upload, label: 'Submissions', shortLabel: 'Submit' },
    { id: 'help', icon: HelpCircle, label: 'Help', shortLabel: 'Help' }
  ];

  // Bottom nav items (subset for mobile)
  const bottomNavItems = [
    { id: 'dashboard', icon: Home, label: 'Home' },
    { id: 'requests', icon: MessageSquare, label: 'Requests' },
    { id: 'teams', icon: Users, label: 'Teams' },
    { id: 'phases', icon: Calendar, label: 'Phases' },
    { id: 'help', icon: Menu, label: 'More', isMore: true }
  ];

  if (!mounted) {
    return (
      <div className="flex h-screen">
        <div className="hidden md:block w-56 bg-gray-50 border-r animate-pulse" />
        <div className="flex-1 bg-gray-50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50">
      {/* Desktop Sidebar Navigation */}
      <aside
        className={cn(
          "hidden md:flex sticky top-[48px] h-[calc(100vh-48px)] flex-col transition-all duration-300 ease-out sidebar-faculty",
          sidebarCollapsed ? "w-[68px]" : "w-56"
        )}
      >
        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "sidebar-nav-item w-full",
                  isActive && "active",
                  `animate-fade-in-up stagger-${Math.min(index + 1, 5)}`
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="sidebar-nav-icon" />
                {!sidebarCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-200"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto content-area-faculty flex flex-col">
        <div className="page-content flex-1">
          {/* Meeting Announcements Banner (shown on all tabs) */}
          <MeetingAnnouncements userRole="faculty" />

          {/* Tab Content with Animation */}
          <div className="animate-fade-in-up">
            {activeTab === 'dashboard' && <FacultyTasks setActiveTab={setActiveTab} />}
            {activeTab === 'requests' && <MentorshipRequests />}
            {activeTab === 'abstracts' && <AbstractsView />}
            {activeTab === 'teams' && <TeamsListView />}
            {activeTab === 'phases' && <PhasesOverview />}
            {activeTab === 'submissions' && <AllSubmissionsView />}
            {activeTab === 'profile' && <ProfileSection />}
            {activeTab === 'help' && <FacultyHelp />}
          </div>
        </div>

        {/* Footer - inside scrollable area, below sidebar level */}
        <Footer showPhoneNumbers={true} />
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav md:hidden">
        <div className="flex items-center justify-around">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            if (item.isMore) {
              return (
                <button
                  key={item.id}
                  onClick={() => setMobileMenuOpen(true)}
                  className="bottom-nav-item"
                >
                  <Menu className="h-5 w-5" />
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn("bottom-nav-item", isActive && "active")}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile "More" Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in-scale" />

          {/* Menu Panel */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl animate-slide-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Menu Header */}
            <div className="px-5 pb-3">
              <h3 className="text-lg font-semibold text-gray-900">More Options</h3>
              <p className="text-sm text-gray-500">Navigate to other sections</p>
            </div>

            {/* Menu Items */}
            <div className="px-3 pb-6 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      handleTabChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all touch-target",
                      isActive
                        ? "bg-teal-50 text-teal-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg",
                      isActive ? "bg-teal-100" : "bg-gray-100"
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-sm">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-2 h-2 rounded-full bg-teal-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Safe area padding for notched devices */}
            <div className="h-[env(safe-area-inset-bottom)]" />
          </div>
        </div>
      )}
    </div>
  );
}
