// src/components/dashboard/student/ProjectDetails.jsx
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FileText, Save, Edit2, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

import { logger } from "../../../lib/logger";
/**
 * ProjectDetails Component
 * 
 * Allows students to save their project title and abstract once,
 * which auto-populates in mentorship requests and other forms.
 * 
 * Features:
 * - Team leader can edit project details
 * - Team members can view but not edit
 * - Validation: min 100 characters for abstract
 * - Character counter for abstract
 * - Saves to team document in Firestore
 * - Auto-populates in SelectMentor and resubmission forms
 */
export default function ProjectDetails({ team }) {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectAbstract, setProjectAbstract] = useState('');

  // Check leadership using both UID and email for backward compatibility
  const isLeader = userData?.uid === team?.leaderId || 
                   userData?.email?.toLowerCase() === team?.leaderEmail?.toLowerCase();

  useEffect(() => {
    if (team) {
      setProjectTitle(team.projectTitle || '');
      setProjectAbstract(team.projectAbstract || '');
      
      // Auto-enable editing if no details saved yet
      if (!team.projectTitle && !team.projectAbstract && isLeader) {
        setEditing(true);
      }
      
      setLoading(false);
    }
  }, [team, isLeader]);

  const handleSave = async () => {
    // Validation
    if (!projectTitle.trim()) {
      toast.error('Project title is required');
      return;
    }

    if (!projectAbstract.trim()) {
      toast.error('Project abstract is required');
      return;
    }

    if (projectAbstract.trim().length < 100) {
      toast.error('Abstract must be at least 100 characters');
      return;
    }

    setSaving(true);
    try {
      const teamRef = doc(db, 'teams', team.id);
      await updateDoc(teamRef, {
        projectTitle: projectTitle.trim(),
        projectAbstract: projectAbstract.trim(),
        updatedAt: new Date()
      });

      toast.success('Project details saved successfully!', {
        description: 'These details will auto-fill in mentorship requests'
      });
      
      setEditing(false);
    } catch (error) {
      logger.error('Error saving project details:', error);
      toast.error('Failed to save project details');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setProjectTitle(team.projectTitle || '');
    setProjectAbstract(team.projectAbstract || '');
    setEditing(false);
  };

  if (loading) {
    return (
      <Card className="border-teal-200">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasSavedDetails = team.projectTitle && team.projectAbstract;

  return (
    <Card className="border-teal-200">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-600" />
            <h3 className="text-sm font-semibold text-gray-900">Project Details</h3>
          </div>
          {hasSavedDetails && (
            <Badge variant="outline" className="border-green-600 text-green-600 text-xs h-5">
              <CheckCircle className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>
        
        <p className="text-xs text-gray-600">
          {isLeader 
            ? 'Save your project title and abstract here. These will auto-fill when sending mentorship requests.'
            : 'View your team\'s project details. Only the team leader can edit these.'}
        </p>

        {/* Info Alert */}
        <Alert className="bg-teal-50 border-teal-200 p-2">
          <Info className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">
            {isLeader 
              ? 'Save your project details once to avoid retyping when sending mentorship requests or resubmitting proposals.'
              : 'These project details are managed by your team leader.'}
          </AlertDescription>
        </Alert>

        <Separator className="my-2" />

        {/* Project Title */}
        <div className="space-y-1.5">
          <Label htmlFor="project-title" className="text-xs font-medium">
            Project Title {isLeader && <span className="text-destructive">*</span>}
          </Label>
          {editing ? (
            <Input
              id="project-title"
              placeholder="Enter your project title"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              disabled={saving}
              className="text-sm h-9"
            />
          ) : (
            <div className="bg-teal-50 p-2.5 rounded-lg border border-teal-200">
              <p className="text-sm font-medium text-gray-900">
                {projectTitle || (
                  <span className="text-gray-500 italic font-normal">No title saved yet</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Project Abstract */}
        <div className="space-y-1.5">
          <Label htmlFor="project-abstract" className="text-xs font-medium">
            Project Abstract {isLeader && <span className="text-destructive">*</span>}
          </Label>
          {editing ? (
            <>
              <Textarea
                id="project-abstract"
                placeholder="Provide a detailed abstract of your project (minimum 100 characters)"
                value={projectAbstract}
                onChange={(e) => setProjectAbstract(e.target.value)}
                rows={6}
                disabled={saving}
                className="text-sm max-h-40 md:max-h-48 resize-y"
              />
              <div className="flex items-center justify-between text-[10px]">
                <span className={projectAbstract.length < 100 ? 'text-destructive' : 'text-gray-500'}>
                  {projectAbstract.length} / 100 characters minimum
                </span>
                {projectAbstract.length >= 100 && (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Minimum length met
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="bg-teal-50 p-2.5 rounded-lg border border-teal-200 max-h-48 overflow-y-auto">
              {projectAbstract ? (
                <p className="text-xs whitespace-pre-wrap text-gray-900">{projectAbstract}</p>
              ) : (
                <span className="text-gray-500 italic text-xs">No abstract saved yet</span>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {isLeader && (
          <div className="pt-2 border-t">
            {editing ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 h-8 text-xs hover:bg-teal-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !projectTitle.trim() || projectAbstract.trim().length < 100}
                  className="flex-1 flex items-center gap-2 h-8 text-xs bg-teal-600 hover:bg-teal-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'Save Details'}
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setEditing(true)}
                variant="outline"
                className="w-full flex items-center gap-2 h-8 text-xs hover:bg-teal-50 hover:border-teal-300"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Project Details
              </Button>
            )}
          </div>
        )}

        {/* Non-leader view footer */}
        {!isLeader && !hasSavedDetails && (
          <div className="pt-2 border-t">
            <Alert className="bg-blue-50 border-blue-200 p-2">
              <Info className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">
                Your team leader needs to add project details.
              </AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
