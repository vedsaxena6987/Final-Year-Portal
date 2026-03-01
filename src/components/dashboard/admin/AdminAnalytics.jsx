// components/dashboard/admin/AdminAnalytics.jsx
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { logger } from "../../../lib/logger";
// A simple hook to fetch all data needed for analytics
function useAnalyticsData() {
    const [data, setData] = useState({ teams: [], faculty: [], grades: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const teamsQuery = query(collection(db, "teams"));
                const usersQuery = query(collection(db, "users"));
                const gradesQuery = query(collection(db, "grades"));

                const [teamsSnapshot, usersSnapshot, gradesSnapshot] = await Promise.all([
                    getDocs(teamsQuery),
                    getDocs(usersQuery),
                    getDocs(gradesQuery),
                ]);

                const teams = teamsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const grades = gradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setData({ teams, faculty: users.filter(u => u.role === 'faculty'), grades });
            } catch (error) {
                logger.error("Error fetching analytics data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, []);

    return { ...data, loading };
}

export default function AdminAnalytics() {
    const { teams, faculty, grades, loading } = useAnalyticsData();

    // Process data for charts
    const mentorWorkload = faculty.map(mentor => {
        const mentoredTeamsCount = teams.filter(team => team.mentorId === mentor.id).length;
        return { name: mentor.name, teams: mentoredTeamsCount };
    });

    const totalStudents = teams.reduce((acc, team) => acc + (team.members?.length || 0), 0);

    if (loading) return <p>Loading analytics...</p>;

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader><CardTitle>Total Teams</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{teams.length}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Total Students</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{totalStudents}</div></CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Total Faculty</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{faculty.length}</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Total Graded Items</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{grades.length}</div></CardContent>
                </Card>
            </div>

            {/* Charts */}
            <Card>
                <CardHeader><CardTitle>Mentor Workload</CardTitle></CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={mentorWorkload}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="teams" fill="#8884d8" name="Number of Teams" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
