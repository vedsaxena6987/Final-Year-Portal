// components/dashboard/admin/AdminDashboard.jsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { logger } from "../../../lib/logger";
// ... (imports remain same)

// ... inside component ...

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LayoutDashboard,
    Users,
    UserCog,
    Calendar,
    BarChart3,
    Shield,
    UserCheck,
    ClipboardList,
    Award,
    Database,
    Bell,
    ChevronLeft,
    ChevronRight,
    Trash2,
    GraduationCap,
    Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

// Loading fallback component
const TabLoadingFallback = () => (
    <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-slate-500">Loading...</p>
        </div>
    </div>
);

// Dynamic imports with next/dynamic for better Next.js optimization
const AdminOverview = dynamic(() => import("./AdminOverview"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManagePhases = dynamic(() => import("./ManagePhases"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManagePanels = dynamic(() => import("./ManagePanels"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const EnhancedAnalytics = dynamic(() => import("./EnhancedAnalytics"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManageSessions = dynamic(() => import("./ManageSessions"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManageUsers = dynamic(() => import("./ManageUsers"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManageExpertise = dynamic(() => import("./ManageExpertise"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManageExternalEvaluators = dynamic(() => import("./ManageExternalEvaluators"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManageNotifications = dynamic(() => import("./ManageNotifications"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});
const ManageTeams = dynamic(() => import("./ManageTeams"), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});

const MeetingAnnouncements = dynamic(() => import('@/components/dashboard/MeetingAnnouncements'), {
    ssr: false
});
const ProfileSection = dynamic(() => import('@/components/dashboard/ProfileSection'), {
    loading: () => <TabLoadingFallback />,
    ssr: false
});

export default function AdminDashboard() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { userData } = useAuth();
    const { activeSession } = useSession();
    const [activeTab, setActiveTab] = useState('overview');
    const [mounted, setMounted] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [dashboardData, setDashboardData] = useState({
        totalStudents: 0,
        totalFaculty: 0,
        totalTeams: 0,
        totalPhases: 0,
        activePanels: 0,
        pendingRequests: 0
    });
    const [loading, setLoading] = useState(true);

    // Handle mounting to avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Restore tab from URL on page load
    useEffect(() => {
        if (!mounted) return;

        const tab = searchParams.get('tab');
        const validTabs = ['overview', 'sessions', 'users', 'teams', 'expertise', 'panels', 'external', 'notifications', 'cleanup', 'phases', 'analytics', 'profile'];

        if (tab && validTabs.includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams, mounted]);

    // Update document title based on active tab
    useEffect(() => {
        const titles = {
            overview: 'Overview - Admin Portal',
            sessions: 'Sessions - Admin Portal',
            users: 'Users - Admin Portal',
            teams: 'Teams - Admin Portal',
            expertise: 'Expertise - Admin Portal',
            panels: 'Panels - Admin Portal',
            external: 'External Evaluators - Admin Portal',
            notifications: 'Notifications - Admin Portal',
            cleanup: 'Announcement Cleanup - Admin Portal',
            phases: 'Phases - Admin Portal',
            analytics: 'Analytics - Admin Portal',
            profile: 'My Profile - Admin Portal'
        };

        document.title = titles[activeTab] || 'Admin Portal';
    }, [activeTab]);

    // Handle tab change with URL update
    const handleTabChange = (newTab) => {
        setActiveTab(newTab);

        // Update URL without page reload
        const currentPath = window.location.pathname;
        router.push(`${currentPath}?tab=${newTab}`, { scroll: false });
    };

    useEffect(() => {
        if (userData?.role !== 'admin') {
            toast.error('Unauthorized access. Admin privileges required.');
            return;
        }

        const fetchDashboardData = async () => {
            try {
                // Initialize default counts
                const stats = {
                    totalStudents: 0,
                    totalFaculty: 0,
                    totalTeams: 0,
                    totalPhases: 0,
                    activePanels: 0,
                    pendingRequests: 0
                };

                if (activeSession?.id) {
                    const sessionQueries = [
                        // Students in active session
                        query(collection(db, 'users'), where('role', '==', 'student'), where('sessionId', '==', activeSession.id)),
                        // Faculty in active session
                        query(collection(db, 'users'), where('role', '==', 'faculty'), where('sessionId', '==', activeSession.id)),
                        // Teams in active session
                        query(collection(db, 'teams'), where('sessionId', '==', activeSession.id)),
                        // Phases in active session
                        query(collection(db, 'phases'), where('sessionId', '==', activeSession.id)),
                        // Panels in active session
                        query(collection(db, 'panels'), where('sessionId', '==', activeSession.id))
                    ];

                    // Execute session-specific queries in parallel
                    // Use catch to handle individual failures gracefully (especially panels)
                    const [studentsSnap, facultySnap, teamsSnap, phasesSnap, panelsSnap] = await Promise.all(
                        sessionQueries.map(q => getCountFromServer(q).catch(e => {
                            logger.warn('Count query failed:', e);
                            return { data: () => ({ count: 0 }) };
                        }))
                    );

                    stats.totalStudents = studentsSnap.data().count;
                    stats.totalFaculty = facultySnap.data().count;
                    stats.totalTeams = teamsSnap.data().count;
                    stats.totalPhases = phasesSnap.data().count;
                    stats.activePanels = panelsSnap.data().count;
                }

                // Fetch pending requests (global check for now)
                try {
                    const requestsQuery = query(collection(db, 'mentorship_requests'), where('status', '==', 'pending'));
                    const requestsSnap = await getCountFromServer(requestsQuery);
                    stats.pendingRequests = requestsSnap.data().count;
                } catch (error) {
                    logger.warn('Mentorship requests check failed:', error);
                }

                setDashboardData(stats);
            } catch (error) {
                logger.error("Error fetching dashboard data:", error);
                toast.error("Failed to load dashboard statistics");
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [userData, activeSession]);

    // Navigation config organized into groups
    const navGroups = [
        {
            label: 'Overview',
            items: [
                { id: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'sessions', icon: Database, label: 'Sessions' },
            ]
        },
        {
            label: 'User Management',
            items: [
                { id: 'users', icon: Users, label: 'Users' },
                { id: 'teams', icon: UserCog, label: 'Teams' },
                { id: 'expertise', icon: Award, label: 'Expertise' },
            ]
        },
        {
            label: 'Evaluation',
            items: [
                { id: 'panels', icon: ClipboardList, label: 'Panels' },
                { id: 'phases', icon: Calendar, label: 'Phases' },
                { id: 'external', icon: UserCheck, label: 'External' },
            ]
        },
        {
            label: 'Communication',
            items: [
                { id: 'notifications', icon: Bell, label: 'Notifications' },
            ]
        },
        {
            label: 'System',
            items: [
                { id: 'analytics', icon: BarChart3, label: 'Analytics' },
            ]
        }
    ];

    if (userData?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Card className="p-8 text-center card-elevated">
                    <Shield className="h-16 w-16 mx-auto mb-4 text-red-500" />
                    <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground">You need administrator privileges to view this page.</p>
                </Card>
            </div>
        );
    }

    if (loading || !mounted) {
        return (
            <div className="flex h-screen w-full">
                <div className="w-60 bg-gradient-to-b from-white to-slate-50 border-r animate-pulse" />
                <div className="flex-1 gradient-mesh animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex min-h-full w-full bg-slate-50">
            {/* Fixed Sidebar Navigation - Professional Design */}
            <aside
                className={cn(
                    "fixed left-0 top-[48px] h-[calc(100vh-48px)] bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-40",
                    "gradient-sidebar shadow-sm",
                    sidebarCollapsed ? "w-16" : "w-60"
                )}
            >
                {/* Sidebar Header with Logo */}
                {!sidebarCollapsed && (
                    <div className="px-4 py-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
                                <GraduationCap className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-800">Admin Portal</p>
                                <p className="text-[10px] text-slate-500">GEHU Final Year</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Items */}
                <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
                    {navGroups.map((group, groupIdx) => (
                        <div key={group.label}>
                            {/* Section Header */}
                            {!sidebarCollapsed && (
                                <div className="section-header">
                                    {group.label}
                                </div>
                            )}

                            {/* Section Items */}
                            <div className="px-2 space-y-0.5">
                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = activeTab === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => handleTabChange(item.id)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                                                "hover:bg-slate-100",
                                                isActive
                                                    ? "bg-gradient-to-r from-indigo-50 to-indigo-50/50 text-indigo-700 border-l-[3px] border-indigo-500 -ml-[1px]"
                                                    : "text-slate-600",
                                                sidebarCollapsed && "justify-center px-2"
                                            )}
                                            title={sidebarCollapsed ? item.label : undefined}
                                        >
                                            <Icon className={cn(
                                                "h-4 w-4 shrink-0 transition-colors",
                                                isActive ? "text-indigo-600" : "text-slate-400"
                                            )} />
                                            {!sidebarCollapsed && (
                                                <span className="truncate">{item.label}</span>
                                            )}
                                            {isActive && !sidebarCollapsed && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Divider between groups */}
                            {groupIdx < navGroups.length - 1 && !sidebarCollapsed && (
                                <div className="divider-subtle mx-3 my-2" />
                            )}
                        </div>
                    ))}
                </nav>

                {/* Collapse Toggle */}
                <div className="p-2 border-t border-stone-100">
                    <button
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        className={cn(
                            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium",
                            "text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-all duration-200"
                        )}
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

            {/* Main Content Area - fixed scrolling and width issue */}
            <main
                className={cn(
                    "flex-1 min-h-full transition-all duration-300 gradient-mesh",
                    sidebarCollapsed ? "ml-16" : "ml-60"
                )}
            >
                <div className="p-6 pb-12 max-w-full">
                    {/* Meeting Announcements Banner (shown on all tabs) */}
                    <MeetingAnnouncements userRole="admin" />

                    {/* Dynamic loaded tab content - loading handled by next/dynamic */}
                    {activeTab === 'overview' && <AdminOverview dashboardData={dashboardData} onNavigate={handleTabChange} />}
                    {activeTab === 'sessions' && <ManageSessions />}
                    {activeTab === 'users' && <ManageUsers />}
                    {activeTab === 'teams' && <ManageTeams />}
                    {activeTab === 'expertise' && <ManageExpertise />}
                    {activeTab === 'panels' && <ManagePanels />}
                    {activeTab === 'external' && <ManageExternalEvaluators />}
                    {activeTab === 'notifications' && <ManageNotifications />}

                    {activeTab === 'phases' && <ManagePhases />}
                    {activeTab === 'analytics' && <EnhancedAnalytics />}
                    {activeTab === 'profile' && <ProfileSection />}
                </div>
            </main>
        </div>
    );
}
