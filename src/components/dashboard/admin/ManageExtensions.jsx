// components/dashboard/admin/ManageExtensions.jsx
"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { Clock, Calendar, AlertCircle, Trash2, Users } from 'lucide-react';
import ExtensionService from '@/services/extensionService';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';

import { logger } from "../../../lib/logger";
export default function ManageExtensions({ isOpen, onClose, phase }) {
  const { activeSession } = useSession();
  const { userData } = useAuth();
  const [teams, setTeams] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [extendedDeadline, setExtendedDeadline] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Load teams for current session
  useEffect(() => {
    if (!activeSession?.id || !isOpen) return;

    setLoadingTeams(true);
    const teamsQuery = query(
      collection(db, 'teams'),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribe = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeams(teamsData);
      setLoadingTeams(false);
    });

    return () => unsubscribe();
  }, [activeSession?.id, isOpen]);

  // Load existing extensions for this phase
  useEffect(() => {
    if (!phase?.id || !isOpen) return;

    const loadExtensions = async () => {
      const phaseExtensions = await ExtensionService.getPhaseExtensions(phase.id);
      setExtensions(phaseExtensions);
    };

    loadExtensions();

    // Set up real-time listener for extensions
    const extensionsQuery = query(
      collection(db, 'extensions'),
      where('phaseId', '==', phase.id),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(extensionsQuery, (snapshot) => {
      const extensionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExtensions(extensionsData);
    });

    return () => unsubscribe();
  }, [phase?.id, isOpen]);

  // Set default extended deadline (7 days after original)
  useEffect(() => {
    if (phase?.endDate && !extendedDeadline) {
      const originalDate = phase.endDate.toDate();
      const extended = new Date(originalDate);
      extended.setDate(extended.getDate() + 7);
      setExtendedDeadline(extended.toISOString().slice(0, 16));
    }
  }, [phase?.endDate, extendedDeadline]);

  const handleTeamSelection = (teamId) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedTeams.length === teams.length) {
      setSelectedTeams([]);
    } else {
      setSelectedTeams(teams.map(t => t.id));
    }
  };

  const handleGrantExtensions = async () => {
    if (selectedTeams.length === 0) {
      toast.error('Please select at least one team');
      return;
    }

    if (!extendedDeadline) {
      toast.error('Please set an extended deadline');
      return;
    }

    const deadlineDate = new Date(extendedDeadline);
    const originalDate = phase.endDate.toDate();

    if (deadlineDate <= originalDate) {
      toast.error('Extended deadline must be after the original deadline');
      return;
    }

    setLoading(true);

    try {
      const result = await ExtensionService.grantBulkExtensions({
        phaseId: phase.id,
        teamIds: selectedTeams,
        extendedDeadline: deadlineDate,
        reason: reason || 'No reason provided',
        grantedBy: userData.email
      });

      if (result.success) {
        toast.success(result.message, {
          description: `${result.results.successful.length} team(s) granted extension`
        });

        if (result.results.failed.length > 0) {
          toast.warning(`${result.results.failed.length} team(s) failed`, {
            description: 'Check console for details'
          });
          logger.error('Failed extensions:', result.results.failed);
        }

        // Reset form
        setSelectedTeams([]);
        setReason('');
      } else {
        toast.error('Failed to grant extensions', {
          description: result.error
        });
      }
    } catch (error) {
      logger.error('Error granting extensions:', error);
      toast.error('An error occurred while granting extensions');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeExtension = async (extensionId, teamName) => {
    if (!confirm(`Revoke extension for ${teamName}?`)) return;

    try {
      const result = await ExtensionService.revokeExtension(extensionId);
      
      if (result.success) {
        toast.success('Extension revoked successfully');
      } else {
        toast.error('Failed to revoke extension', {
          description: result.error
        });
      }
    } catch (error) {
      logger.error('Error revoking extension:', error);
      toast.error('An error occurred');
    }
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team ? `Project #${team.projectNumber}` : 'Unknown Team';
  };

  const hasExtension = (teamId) => {
    return extensions.some(ext => ext.teamId === teamId);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!phase) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Manage Deadline Extensions - {phase.phaseName}
          </DialogTitle>
          <DialogDescription>
            Grant deadline extensions to teams for this phase. Original deadline: {formatDate(phase.endDate)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Active Extensions */}
          {extensions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Active Extensions ({extensions.length})
              </h3>
              <ScrollArea className="h-32 border rounded-md p-2">
                <div className="space-y-2">
                  {extensions.map((ext) => (
                    <div
                      key={ext.id}
                      className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded text-sm"
                    >
                      <div className="flex-1">
                        <span className="font-medium">{getTeamName(ext.teamId)}</span>
                        <div className="text-xs text-muted-foreground">
                          Extended to: {formatDate(ext.extendedDeadline)}
                        </div>
                        {ext.reason && (
                          <div className="text-xs text-muted-foreground italic">
                            Reason: {ext.reason}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeExtension(ext.id, getTeamName(ext.teamId))}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Grant New Extension Form */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="extendedDeadline">New Deadline *</Label>
              <Input
                id="extendedDeadline"
                type="datetime-local"
                value={extendedDeadline}
                onChange={(e) => setExtendedDeadline(e.target.value)}
                min={phase.endDate?.toDate().toISOString().slice(0, 16)}
              />
            </div>

            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Medical emergency, technical issues..."
                rows={2}
                className="max-h-16 md:max-h-20 resize-y"
              />
            </div>

            {/* Team Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Select Teams *
                </Label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSelectAll}
                  className="text-xs"
                >
                  {selectedTeams.length === teams.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              {loadingTeams ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : teams.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No teams found in the current session
                  </AlertDescription>
                </Alert>
              ) : (
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center space-x-2 p-2 hover:bg-accent rounded"
                      >
                        <Checkbox
                          id={`team-${team.id}`}
                          checked={selectedTeams.includes(team.id)}
                          onCheckedChange={() => handleTeamSelection(team.id)}
                        />
                        <label
                          htmlFor={`team-${team.id}`}
                          className="flex-1 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            Project #{team.projectNumber || 'N/A'}
                            {hasExtension(team.id) && (
                              <Badge variant="secondary" className="text-xs">
                                Has Extension
                              </Badge>
                            )}
                          </div>
                          {team.projectTitle && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {team.projectTitle}
                            </div>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {selectedTeams.length > 0 && (
              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  <strong>{selectedTeams.length}</strong> team(s) selected. 
                  {extensions.some(ext => selectedTeams.includes(ext.teamId)) && (
                    <span className="text-amber-600 ml-1">
                      (Existing extensions will be replaced)
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleGrantExtensions} disabled={loading || selectedTeams.length === 0}>
            {loading ? 'Granting...' : `Grant Extension${selectedTeams.length > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
