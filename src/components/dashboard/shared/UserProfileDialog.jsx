"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Building2, User, Loader2, Copy, Check } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

import { logger } from "../../../lib/logger";
export default function UserProfileDialog({ isOpen, onClose, email, name: initialName }) {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copiedField, setCopiedField] = useState(null);

    useEffect(() => {
        if (isOpen && email) {
            fetchUserData();
        } else {
            setUserData(null);
        }
    }, [isOpen, email]);

    const fetchUserData = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, 'users', email);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                setUserData({ ...userSnap.data(), email }); // Ensure email is present
            } else {
                // Fallback if user doc doesn't exist but we have initial info
                setUserData({
                    name: initialName || email.split('@')[0],
                    email,
                    role: 'user'
                });
            }
        } catch (error) {
            logger.error("Error fetching user profile:", error);
            toast.error("Failed to load user profile");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success(`${field} copied to clipboard`);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const getRoleColor = (role) => {
        switch (role?.toLowerCase()) {
            case 'student': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'faculty': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'external_evaluator': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">User Profile</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        <p className="text-sm text-gray-500">Loading profile...</p>
                    </div>
                ) : userData ? (
                    <div className="space-y-6 py-2">
                        {/* Avatar & Name */}
                        <div className="flex flex-col items-center text-center space-y-3">
                            <Avatar className="h-24 w-24 border-4 border-slate-50 shadow-lg">
                                <AvatarImage src={userData.photoURL} />
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-2xl font-bold">
                                    {userData.name?.charAt(0).toUpperCase() || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{userData.name || initialName || 'Unknown User'}</h3>
                                <div className="flex justify-center mt-1">
                                    <Badge variant="outline" className={`capitalize ${getRoleColor(userData.role)}`}>
                                        {userData.role?.replace(/_/g, ' ') || 'User'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Contact Details */}
                        <div className="space-y-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                            {/* Email */}
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-500">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Email</p>
                                    <p className="text-sm font-medium text-gray-900 truncate" title={userData.email}>
                                        {userData.email}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                                    onClick={() => copyToClipboard(userData.email, 'Email')}
                                >
                                    {copiedField === 'Email' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            </div>

                            {/* Personal Email (if exists) */}
                            {userData.personalEmail && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-500">
                                        <Mail className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Personal Email</p>
                                        <p className="text-sm font-medium text-gray-900 truncate" title={userData.personalEmail}>
                                            {userData.personalEmail}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                                        onClick={() => copyToClipboard(userData.personalEmail, 'Personal Email')}
                                    >
                                        {copiedField === 'Personal Email' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            )}

                            {/* Phone (if exists) */}
                            {userData.mobile && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-500">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Mobile</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {userData.mobile}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-gray-400 hover:text-indigo-600"
                                            onClick={() => copyToClipboard(userData.mobile, 'Mobile')}
                                        >
                                            {copiedField === 'Mobile' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Department (if exists) */}
                            {userData.department && (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 text-gray-500">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Department</p>
                                        <p className="text-sm font-medium text-gray-900">
                                            {userData.department}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            {userData.mobile && (
                                <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => window.open(`https://wa.me/${userData.mobile.replace(/\D/g, '').replace(/^(\+91)?/, '91')}`, '_blank')}>
                                    Chat on WhatsApp
                                </Button>
                            )}
                            <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => window.location.href = `mailto:${userData.email}`}>
                                Send Email
                            </Button>
                        </div>

                    </div>
                ) : (
                    <div className="text-center py-8">
                        <User className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">User not found</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
