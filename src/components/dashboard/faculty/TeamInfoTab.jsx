// src/components/dashboard/faculty/TeamInfoTab.jsx - Premium Team Info Component
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  Users,
  Crown,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  GraduationCap,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import UserProfileDialog from '@/components/dashboard/shared/UserProfileDialog';

import { logger } from "../../../lib/logger";
export default function TeamInfoTab({ team, leader, mentor }) {
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [submissionCount, setSubmissionCount] = useState(0);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [expandedMember, setExpandedMember] = useState(null);
  const [profileDialog, setProfileDialog] = useState({ isOpen: false, email: null, name: null });

  // Fetch submission count
  useEffect(() => {
    const fetchSubmissionCount = async () => {
      if (!team?.id) {
        setLoadingSubmissions(false);
        return;
      }

      try {
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('teamId', '==', team.id)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        setSubmissionCount(submissionsSnapshot.size);
      } catch (error) {
        logger.error('Error fetching submission count:', error);
      } finally {
        setLoadingSubmissions(false);
      }
    };

    fetchSubmissionCount();
  }, [team?.id]);

  // Fetch all member details
  useEffect(() => {
    const fetchMembers = async () => {
      if (!team?.members || team.members.length === 0) {
        setLoadingMembers(false);
        return;
      }

      try {
        const memberPromises = team.members.map(async (email) => {
          // CRITICAL: Normalize email to lowercase (users collection keys are lowercase)
          const normalizedEmail = email?.toLowerCase();
          const userRef = doc(db, 'users', normalizedEmail);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            return { email: normalizedEmail, ...userSnap.data() };
          }
          // Fallback for missing user document
          logger.warn(`User document not found for: ${email}`);
          return { 
            email: normalizedEmail, 
            name: email?.split('@')[0] || 'Unknown User',
            uid: null 
          };
        });

        const membersData = await Promise.all(memberPromises);
        setMembers(membersData);
      } catch (error) {
        logger.error('Error fetching members:', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [team?.members]);

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return '??';
    }
    const trimmedName = name.trim();
    const parts = trimmedName.split(' ').filter(part => part.length > 0);
    
    if (parts.length >= 2) {
      // First name + Last name initials
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    } else if (parts.length === 1 && parts[0].length >= 2) {
      // Single name: take first 2 characters
      return parts[0].substring(0, 2).toUpperCase();
    } else if (parts.length === 1 && parts[0].length === 1) {
      // Single character name
      return parts[0].toUpperCase();
    }
    return '??';
  };

  // Get status config
  const getStatusConfig = (status) => {
    const configs = {
      approved: { icon: CheckCircle, text: 'Approved', className: 'status-success' },
      rejected: { icon: XCircle, text: 'Rejected', className: 'status-danger' },
      pending: { icon: Clock, text: 'Pending', className: 'status-pending' },
      under_review: { icon: AlertTriangle, text: 'Under Review', className: 'status-info' }
    };
    return configs[status] || { icon: Clock, text: 'Not Submitted', className: 'bg-gray-100 text-gray-700' };
  };

  const statusInfo = getStatusConfig(team.abstractStatus);
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <Tabs defaultValue="basic" className="w-full">
        {/* Premium Tab Navigation */}
        <TabsList className="w-full flex bg-white border border-gray-200 rounded-xl p-1 gap-1 shadow-sm">
          {[
            { value: 'basic', label: 'Basic Info' },
            { value: 'members', label: 'Members' },
            { value: 'project', label: 'Project' },
            { value: 'contact', label: 'Contact' }
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 rounded-lg text-sm font-medium py-2.5 px-3 transition-all data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-md text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          {/* Quick Stats - Premium Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card-stat group animate-fade-in-up stagger-1">
              <div className="flex items-center gap-3">
                <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl transition-transform group-hover:scale-110">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="metric-value text-2xl font-bold text-gray-900">
                    {team.members?.length || 0}
                  </div>
                  <div className="metric-label">Members</div>
                </div>
              </div>
            </div>

            <div className="card-stat group animate-fade-in-up stagger-2">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl transition-transform group-hover:scale-110">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  {loadingSubmissions ? (
                    <div className="skeleton-faculty h-8 w-8 rounded" />
                  ) : (
                    <div className="metric-value text-2xl font-bold text-gray-900">
                      {submissionCount}
                    </div>
                  )}
                  <div className="metric-label">Submissions</div>
                </div>
              </div>
            </div>

            <div className="card-stat group animate-fade-in-up stagger-3">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 ${team.abstractStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                  team.abstractStatus === 'rejected' ? 'bg-red-50 text-red-600' :
                    team.abstractStatus === 'pending' ? 'bg-amber-50 text-amber-600' :
                      'bg-gray-50 text-gray-600'
                  }`}>
                  <StatusIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{statusInfo.text}</div>
                  <div className="metric-label">Status</div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Details Card */}
          <div className="card-faculty p-4 animate-fade-in-up stagger-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Project #</p>
                <Badge variant="outline" className="font-bold text-base">
                  {team.projectNumber}
                </Badge>
              </div>
              <div className="h-6 w-px bg-gray-300 hidden sm:block" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Project Title</p>
                <p className="font-semibold text-gray-900 text-base">{team.projectTitle || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Leader & Mentor Card */}
          <div className="card-faculty p-4 animate-fade-in-up stagger-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Team Leader & Mentor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Leader */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <Avatar
                  className="h-12 w-12 border-2 border-blue-200 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setProfileDialog({ isOpen: true, email: leader?.email, name: leader?.name })}
                >
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                    {getInitials(leader?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p
                      className="font-semibold text-gray-900 truncate cursor-pointer hover:underline hover:text-blue-700 transition-colors"
                      onClick={() => setProfileDialog({ isOpen: true, email: leader?.email, name: leader?.name })}
                    >
                      {leader?.name || 'Unknown'}
                    </p>
                    <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{leader?.email}</p>
                </div>
              </div>

              {/* Mentor */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-100">
                <Avatar
                  className="h-12 w-12 border-2 border-teal-200 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setProfileDialog({ isOpen: true, email: mentor?.email, name: mentor?.name })}
                >
                  <AvatarFallback className="bg-teal-100 text-teal-700 font-semibold">
                    {getInitials(mentor?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p
                      className="font-semibold text-gray-900 truncate cursor-pointer hover:underline hover:text-teal-700 transition-colors"
                      onClick={() => setProfileDialog({ isOpen: true, email: mentor?.email, name: mentor?.name })}
                    >
                      {mentor?.name || 'Not assigned'}
                    </p>
                    <GraduationCap className="h-4 w-4 text-teal-600 shrink-0" />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{mentor?.email || 'No email'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Important Dates Timeline */}
          <div className="card-faculty p-4 animate-fade-in-up stagger-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</h3>
            <div className="space-y-3">
              {team.createdAt && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Team Created</p>
                    <p className="font-medium text-gray-900">{format(team.createdAt.toDate(), 'PPP')}</p>
                  </div>
                </div>
              )}
              {team.abstractSubmittedAt && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Abstract Submitted</p>
                    <p className="font-medium text-gray-900">{format(team.abstractSubmittedAt.toDate(), 'PPP')}</p>
                  </div>
                </div>
              )}
              {team.abstractReviewedAt && (
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">Abstract Reviewed</p>
                    <p className="font-medium text-gray-900">{format(team.abstractReviewedAt.toDate(), 'PPP')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          <div className="card-faculty overflow-hidden">
            {loadingMembers ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4 animate-shimmer">
                    <div className="skeleton-faculty w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton-faculty h-4 w-32" />
                      <div className="skeleton-faculty h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="empty-state py-12">
                <div className="empty-state-icon">
                  <Users className="h-8 w-8" />
                </div>
                <p className="empty-state-title">No Members Found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((member, idx) => {
                  const isLeader = member.email === team.leaderEmail;
                  const isExpanded = expandedMember === member.email;

                  return (
                    <div
                      key={member.email}
                      className={`transition-all duration-200 animate-fade-in-up`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      {/* Member Row */}
                      <button
                        onClick={() => setExpandedMember(isExpanded ? null : member.email)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors touch-target"
                      >
                        <Avatar
                          className={`h-12 w-12 border-2 ${isLeader ? 'border-amber-300' : 'border-gray-200'} cursor-pointer hover:opacity-80`}
                          onClick={(e) => { e.stopPropagation(); setProfileDialog({ isOpen: true, email: member.email, name: member.name }); }}
                        >
                          <AvatarFallback className={isLeader ? 'bg-amber-50 text-amber-700 font-semibold' : 'bg-gray-100 text-gray-600 font-semibold'}>
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p
                              className="font-semibold text-gray-900 truncate cursor-pointer hover:underline hover:text-teal-600"
                              onClick={(e) => { e.stopPropagation(); setProfileDialog({ isOpen: true, email: member.email, name: member.name }); }}
                            >
                              {member.name}
                            </p>
                            {isLeader && (
                              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] h-5 px-2 shadow-sm">
                                <Crown className="h-3 w-3 mr-1" />
                                Leader
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{member.email}</p>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                        )}
                      </button>

                      {/* Expanded Contact Info */}
                      {isExpanded && (
                        <div className="px-4 pb-4 animate-fade-in-up">
                          <div className="bg-gray-50 rounded-xl p-4 space-y-2 ml-16">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <a href={`mailto:${member.email}`} className="hover:text-teal-600 hover:underline">
                                {member.email}
                              </a>
                            </div>
                            {member.phone && (
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <a href={`tel:${member.phone}`} className="hover:text-teal-600 hover:underline">
                                  {member.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Project Details Tab */}
        <TabsContent value="project" className="space-y-4 mt-4">
          <div className="card-faculty p-4 animate-fade-in-up">
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Project Title</p>
              <p className="text-lg font-semibold text-gray-900">{team.projectTitle || 'Not provided'}</p>
            </div>

            {team.abstractText && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Abstract</p>
                <div className="p-4 bg-gradient-to-br from-teal-50/50 to-emerald-50/50 rounded-xl border border-teal-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{team.abstractText}</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {team.abstractFileUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(team.abstractFileUrl, '_blank')}
                  className="gap-2 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700"
                >
                  <FileText className="h-4 w-4" />
                  View Abstract
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
              {team.synopsisUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(team.synopsisUrl, '_blank')}
                  className="gap-2 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700"
                >
                  <FileText className="h-4 w-4" />
                  View Synopsis
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {team.abstractFeedback && (
            <div className="card-faculty p-4 border-l-4 border-l-amber-400 bg-amber-50/30 animate-fade-in-up">
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Mentor Feedback</h3>
              <p className="text-sm text-gray-700">{team.abstractFeedback}</p>
            </div>
          )}
        </TabsContent>

        {/* Contact Details Tab */}
        <TabsContent value="contact" className="space-y-4 mt-4">
          {/* Team Members Contact */}
          <div className="card-faculty overflow-hidden animate-fade-in-up">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Team Members</h3>
            </div>
            {loadingMembers ? (
              <div className="p-4 space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="skeleton-faculty h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {members.map((member) => (
                  <div key={member.email} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar
                        className="h-10 w-10 border border-gray-200 cursor-pointer hover:opacity-80"
                        onClick={() => setProfileDialog({ isOpen: true, email: member.email, name: member.name })}
                      >
                        <AvatarFallback className="bg-gray-100 text-gray-600 text-sm font-semibold">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p
                          className="font-semibold text-gray-900 cursor-pointer hover:underline hover:text-teal-600"
                          onClick={() => setProfileDialog({ isOpen: true, email: member.email, name: member.name })}
                        >
                          {member.name}
                        </p>
                        {member.email === team.leaderEmail && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-700 border-amber-200 bg-amber-50">
                            Team Leader
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <a
                        href={`mailto:${member.email}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-teal-600 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        {member.email}
                      </a>
                      {member.phone && (
                        <a
                          href={`tel:${member.phone}`}
                          className="flex items-center gap-2 text-gray-600 hover:text-teal-600 transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                          {member.phone}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mentor Contact */}
          <div className="card-faculty overflow-hidden animate-fade-in-up">
            <div className="p-3 border-b border-gray-100 bg-teal-50">
              <h3 className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Faculty Mentor</h3>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4">
                <Avatar
                  className="h-14 w-14 border-2 border-teal-200 cursor-pointer hover:opacity-80"
                  onClick={() => setProfileDialog({ isOpen: true, email: mentor?.email, name: mentor?.name })}
                >
                  <AvatarFallback className="bg-teal-100 text-teal-700 font-semibold">
                    {getInitials(mentor?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold text-gray-900 mb-2 cursor-pointer hover:underline hover:text-teal-600"
                    onClick={() => setProfileDialog({ isOpen: true, email: mentor?.email, name: mentor?.name })}
                  >
                    {mentor?.name || 'Not assigned'}
                  </p>
                  {mentor?.email && (
                    <div className="space-y-1.5 text-sm">
                      <a
                        href={`mailto:${mentor.email}`}
                        className="flex items-center gap-2 text-gray-600 hover:text-teal-600 transition-colors"
                      >
                        <Mail className="h-4 w-4" />
                        {mentor.email}
                      </a>
                      {mentor.phone && (
                        <a
                          href={`tel:${mentor.phone}`}
                          className="flex items-center gap-2 text-gray-600 hover:text-teal-600 transition-colors"
                        >
                          <Phone className="h-4 w-4" />
                          {mentor.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <UserProfileDialog
        isOpen={profileDialog.isOpen}
        onClose={() => setProfileDialog(prev => ({ ...prev, isOpen: false }))}
        email={profileDialog.email}
        name={profileDialog.name}
      />
    </>
  );
}
