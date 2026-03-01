"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import { Mail, Phone, Shield, Save, Loader2, Building2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { logger } from "../../lib/logger";
export default function ProfileSection() {
    const { userData, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        mobile: '',
        personalEmail: '',
    });
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize form with user data
    useEffect(() => {
        if (userData) {
            setFormData({
                mobile: userData.mobile || '',
                personalEmail: userData.personalEmail || '',
            });
        }
    }, [userData]);

    // Check for changes
    useEffect(() => {
        if (userData) {
            const isChanged =
                formData.mobile !== (userData.mobile || '') ||
                formData.personalEmail !== (userData.personalEmail || '');
            setHasChanges(isChanged);
        }
    }, [formData, userData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!user?.email) return;

        // Basic validation
        if (
            formData.personalEmail &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)
        ) {
            toast.error("Please enter a valid personal email address");
            return;
        }

        if (formData.mobile && !/^\d{10}$/.test(formData.mobile.replace(/\D/g, ''))) {
            toast.warning("Mobile number typically contains 10 digits");
            // Enforce strict 10-digit mobile number format for consistency and validation.
            return;
        }

        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.email);
            await updateDoc(userRef, {
                mobile: formData.mobile,
                personalEmail: formData.personalEmail,
                updatedAt: serverTimestamp()
            });

            toast.success("Profile updated successfully");
            setHasChanges(false);
        } catch (error) {
            logger.error("Error updating profile:", error);
            toast.error("Failed to update profile", { description: error.message });
        } finally {
            setLoading(false);
        }
    };

    if (!userData) {
        return <div className="p-8 text-center">Loading profile...</div>;
    }

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200';
            case 'faculty': return 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border-cyan-200';
            case 'student': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200';
            case 'external_evaluator': return 'bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6 animate-fadeIn">
            {/* Header Card */}
            <Card className="border-none shadow-md bg-gradient-to-r from-slate-900 to-slate-800 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Shield className="w-64 h-64 rotate-12" />
                </div>
                <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <Avatar className="w-24 h-24 border-4 border-white/20 shadow-xl">
                            <AvatarImage src={user?.photoURL} />
                            <AvatarFallback className="text-2xl font-bold bg-white text-slate-900">
                                {userData.name?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="text-center md:text-left space-y-2">
                            <h2 className="text-3xl font-bold tracking-tight">{userData.name}</h2>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                <Badge variant="secondary" className="px-3 py-1 text-sm bg-white/20 hover:bg-white/30 text-white border-transparent">
                                    {userData.email}
                                </Badge>
                                <Badge variant="outline" className="px-3 py-1 text-sm border-white/40 text-white uppercase tracking-wider">
                                    {userData.role?.replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Read-Only Info */}
                <div className="md:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Shield className="w-5 h-5 text-slate-500" />
                                Account Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Official Email</Label>
                                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-md border border-slate-100">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    <span className="text-sm font-medium truncate" title={userData.email}>{userData.email}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase tracking-wider">System Role</Label>
                                <div>
                                    <Badge variant="outline" className={`w-full justify-center py-1.5 capitalize ${getRoleBadgeColor(userData.role)}`}>
                                        {userData.role?.replace(/_/g, ' ')}
                                    </Badge>
                                </div>
                            </div>

                            {userData.department && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Department</Label>
                                    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-md border border-slate-100">
                                        <Building2 className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm font-medium">{userData.department}</span>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 text-xs text-center text-muted-foreground">
                                <p>Account created: {userData.createdAt?.toDate ? userData.createdAt.toDate().toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Editable Form */}
                <div className="md:col-span-2">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-lg">Personal Information</CardTitle>
                            <CardDescription>
                                Update your contact details to help us reach you better.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="mobile" className="flex items-center gap-2">
                                            <Phone className="w-4 h-4 text-slate-500" />
                                            Mobile Number
                                        </Label>
                                        <Input
                                            id="mobile"
                                            name="mobile"
                                            placeholder="+91 98765 43210"
                                            value={formData.mobile}
                                            onChange={handleChange}
                                            className="focus-ring-brand"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Used for urgent notifications specific to your project/evaluation.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="personalEmail" className="flex items-center gap-2">
                                            <Mail className="w-4 h-4 text-slate-500" />
                                            Personal Email (Optional)
                                        </Label>
                                        <Input
                                            id="personalEmail"
                                            name="personalEmail"
                                            type="email"
                                            placeholder="you@gmail.com"
                                            value={formData.personalEmail}
                                            onChange={handleChange}
                                            className="focus-ring-brand"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Backup email for account recovery or critical alerts.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={!hasChanges || loading}
                                        className={hasChanges ? "btn-brand" : ""}
                                        variant={hasChanges ? "default" : "secondary"}
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="w-4 h-4 mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
