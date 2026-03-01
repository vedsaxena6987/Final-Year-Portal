// components/dashboard/admin/ManagePhases.jsx
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from '@/lib/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useSession } from '@/context/SessionContext';
import { useAuth } from '@/context/AuthContext';
import { validatePhaseData, canDeletePhase, formatTimeRemaining } from '@/lib/phaseSchema';
import { Calendar, Trash2, Edit, GripVertical, Plus, Clock, Users, AlertCircle, Info, Eye, EyeOff } from 'lucide-react';
import ManageExtensions from './ManageExtensions';

import { logger } from "../../../lib/logger";
export default function ManagePhases() {
  const { activeSession, loading: sessionLoading } = useSession();
  const { userData } = useAuth();
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [extensionsDialogOpen, setExtensionsDialogOpen] = useState(false);
  const [selectedPhaseForExtension, setSelectedPhaseForExtension] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    phaseName: '',
    startDate: '',
    endDate: '',
    maxMarks: 100,
    phaseType: 'mentor', // 'mentor' or 'panel' (determines meeting/evaluation structure)
    meetingMode: 'both', // 'online', 'offline', or 'both'
    minPanelistsMeetRequired: 3, // Only for panel phases - minimum panelists students must meet
    marksVisible: false, // Admin control - whether students can see marks
    evaluatedBy: null // mentorId or panelId (set during scheduling)
  });

  // Additional state for panel validation
  const [panelMemberCount, setPanelMemberCount] = useState(0);

  // Real-time phase listener
  useEffect(() => {
    if (!activeSession?.id) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "phases"),
      where("sessionId", "==", activeSession.id),
      orderBy("sequenceOrder", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const phasesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate()
        }));
        setPhases(phasesList);
        setLoading(false);
      },
      (error) => {
        logger.error('Error fetching phases:', error);
        toast.error('Failed to load phases');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeSession?.id]);

  // Check if delete is allowed (within 1 hour of creation)
  const isDeleteAllowed = (phase) => {
    return canDeletePhase(phase.createdAt);
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Format date for input field (datetime-local)
  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activeSession?.id) {
      toast.error('No active session found');
      return;
    }

    if (!userData?.email) {
      toast.error('User information not available');
      return;
    }

    // Convert dates
    // For start date: if it's today, use current time; otherwise use start of day (00:00:00)
    let startDate = null;
    if (formData.startDate) {
      const selectedStartDate = new Date(formData.startDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // If selected date is today or in the future, use current time for today, 00:00:00 for future
      if (selectedStartDate.getTime() === today.getTime()) {
        // Today - use current time
        startDate = new Date();
      } else {
        // Past or future date - use 00:00:00
        startDate = selectedStartDate;
      }
    }

    // End date always set to 23:59:59 of the selected day
    const endDate = formData.endDate ? new Date(formData.endDate + 'T23:59:59') : null;

    // Prepare phase data for validation
    const phaseDataToValidate = {
      ...formData,
      evaluatorRole: formData.evaluationMode, // Map evaluationMode to evaluatorRole for validation
      startDate,
      endDate,
      id: editingPhase?.id
    };

    // Validate
    const validation = validatePhaseData(phaseDataToValidate);
    if (!validation.valid) {
      validation.errors.forEach(error => toast.error(error));
      return;
    }

    setSubmitting(true);

    try {
      const phaseData = {
        phaseName: formData.phaseName.trim(),
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        maxMarks: Number(formData.maxMarks),
        phaseType: formData.phaseType, // 'mentor' or 'panel'
        meetingMode: formData.meetingMode, // 'online', 'offline', or 'both'
        marksVisible: formData.marksVisible, // Whether students can see marks
        evaluationMode: formData.phaseType, // Store for backward compatibility
        evaluatorRole: formData.phaseType, // Store for backward compatibility
        evaluatedBy: editingPhase?.evaluatedBy || null, // Preserve existing evaluatedBy during edit
        sessionId: activeSession.id,
        allowLateSubmission: editingPhase?.allowLateSubmission || false,
        isActive: editingPhase?.isActive !== false,
        updatedAt: serverTimestamp()
      };

      // Add panel-specific fields only for panel phases
      if (formData.phaseType === 'panel') {
        phaseData.minPanelistsMeetRequired = Number(formData.minPanelistsMeetRequired);
      }

      if (editingPhase) {
        // Update existing phase
        await updateDoc(doc(db, "phases", editingPhase.id), phaseData);
        toast.success('Phase updated successfully');
      } else {
        // Create new phase - assign next sequence number
        const nextSequence = phases.length > 0
          ? Math.max(...phases.map(p => p.sequenceOrder || 0)) + 1
          : 1;

        await addDoc(collection(db, "phases"), {
          ...phaseData,
          sequenceOrder: nextSequence,
          createdAt: serverTimestamp(),
          createdBy: userData.email
        });
        toast.success('Phase created successfully');
      }

      resetForm();
      setDialogOpen(false);
    } catch (error) {
      logger.error('Error saving phase:', error);
      toast.error('Failed to save phase', {
        description: error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (phaseId, phaseName) => {
    if (!confirm(`Are you sure you want to delete "${phaseName}"? This action cannot be undone and will affect all teams.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "phases", phaseId));
      toast.success('Phase deleted successfully');
    } catch (error) {
      logger.error('Error deleting phase:', error);
      toast.error('Failed to delete phase', {
        description: error.message
      });
    }
  };

  const handleEdit = (phase) => {
    setEditingPhase(phase);
    setFormData({
      phaseName: phase.phaseName || phase.title || '',
      startDate: formatDateForInput(phase.startDate),
      endDate: formatDateForInput(phase.endDate),
      maxMarks: phase.maxMarks || 100,
      phaseType: phase.phaseType || phase.evaluationMode || phase.evaluatorRole || 'mentor', // Backward compatibility
      meetingMode: phase.meetingMode || 'both',
      minPanelistsMeetRequired: phase.minPanelistsMeetRequired || 3,
      marksVisible: phase.marksVisible || false,
      evaluatedBy: phase.evaluatedBy || null
    });
    setDialogOpen(true);
  };

  const toggleLateSubmission = async (phaseId, currentValue, phaseName) => {
    try {
      await updateDoc(doc(db, "phases", phaseId), {
        allowLateSubmission: !currentValue,
        updatedAt: serverTimestamp()
      });
      toast.success(`Late submission ${!currentValue ? 'enabled' : 'disabled'} for ${phaseName}`);
    } catch (error) {
      logger.error('Error toggling late submission:', error);
      toast.error('Failed to update setting');
    }
  };

  const toggleMarksVisibility = async (phaseId, currentValue, phaseName) => {
    try {
      await updateDoc(doc(db, "phases", phaseId), {
        marksVisible: !currentValue,
        updatedAt: serverTimestamp()
      });
      toast.success(`Marks ${!currentValue ? 'visible' : 'hidden'} for ${phaseName}`, {
        description: !currentValue
          ? 'Students can now see their marks for this phase'
          : 'Marks are now hidden from students for this phase'
      });
    } catch (error) {
      logger.error('Error toggling marks visibility:', error);
      toast.error('Failed to update marks visibility');
    }
  };

  const handleOpenExtensions = (phase) => {
    setSelectedPhaseForExtension(phase);
    setExtensionsDialogOpen(true);
  };

  const handleCloseExtensions = () => {
    setExtensionsDialogOpen(false);
    setSelectedPhaseForExtension(null);
  };

  const resetForm = () => {
    setFormData({
      phaseName: '',
      startDate: '',
      endDate: '',
      maxMarks: 100,
      phaseType: 'mentor',
      meetingMode: 'both',
      minPanelistsMeetRequired: 3,
      marksVisible: false,
      evaluatedBy: null
    });
    setEditingPhase(null);
    setPanelMemberCount(0);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  // Loading state
  if (sessionLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // No active session
  if (!activeSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage Evaluation Phases</CardTitle>
          <CardDescription>Create and manage project evaluation phases</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No active session found. Please create an active academic session first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Manage Evaluation Phases</CardTitle>
            <CardDescription>
              Session: {activeSession.name} • {phases.length} phase{phases.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Phase
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : phases.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No phases created yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first evaluation phase to get started
            </p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Phase
            </Button>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Order</TableHead>
                  <TableHead>Phase Details</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead className="text-center">Marks</TableHead>
                  <TableHead className="text-center">Evaluation Mode</TableHead>
                  <TableHead className="text-center">Late Submit</TableHead>
                  <TableHead className="text-center">Marks Visibility</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phases.map((phase) => (
                  <TableRow key={phase.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        <Badge variant="outline" className="font-mono">
                          {phase.sequenceOrder}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{phase.phaseName || phase.title}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {phase.id.substring(0, 8)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-green-600" />
                          <span className="text-xs">{formatDate(phase.startDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-red-600" />
                          <span className="text-xs">{formatDate(phase.endDate)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeRemaining(phase.endDate)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{phase.maxMarks}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="capitalize">
                        <Users className="h-3 w-3 mr-1" />
                        {phase.evaluationMode || phase.evaluatorRole || 'mentor'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={phase.allowLateSubmission ? "default" : "outline"}
                        onClick={() => toggleLateSubmission(phase.id, phase.allowLateSubmission, phase.phaseName)}
                        className="text-xs"
                      >
                        {phase.allowLateSubmission ? 'Enabled' : 'Disabled'}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={phase.marksVisible ? "default" : "outline"}
                        onClick={() => toggleMarksVisibility(phase.id, phase.marksVisible, phase.phaseName)}
                        className="text-xs gap-1"
                        title={phase.marksVisible ? 'Click to hide marks from students' : 'Click to show marks to students'}
                      >
                        {phase.marksVisible ? (
                          <>
                            <Eye className="h-3 w-3" />
                            Visible
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3" />
                            Hidden
                          </>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenExtensions(phase)}
                          title="Manage deadline extensions"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(phase)}
                          title="Edit phase"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isDeleteAllowed(phase) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(phase.id, phase.phaseName)}
                            title="Delete phase (available for 1 hour after creation)"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Info about delete window */}
        {phases.length > 0 && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Note:</strong> Phases can only be deleted within 1 hour of creation.
              After that, you can edit them but not delete them to maintain data integrity.
            </AlertDescription>
          </Alert>
        )}

        {/* Create/Edit Phase Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPhase ? 'Edit Phase' : 'Create New Phase'}
              </DialogTitle>
              <DialogDescription>
                {editingPhase
                  ? 'Update the phase details. Changes will affect all teams.'
                  : 'Define a new evaluation phase for the current academic session.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="phaseName">
                  Phase Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phaseName"
                  placeholder="e.g., Mid-Term Demonstration, Final Evaluation"
                  value={formData.phaseName}
                  onChange={(e) => setFormData({ ...formData, phaseName: e.target.value })}
                  required
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  A clear, descriptive name for this evaluation phase
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Phase starts at 00:00:00
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="endDate">
                    End Date (Deadline) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Deadline at 23:59:59
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="maxMarks">
                    Maximum Marks <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="maxMarks"
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.maxMarks}
                    onChange={(e) => setFormData({ ...formData, maxMarks: e.target.value })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum score for this phase
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phaseType">
                    Phase Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.phaseType}
                    onValueChange={(value) => setFormData({ ...formData, phaseType: value })}
                  >
                    <SelectTrigger id="phaseType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mentor">Mentor Phase</SelectItem>
                      <SelectItem value="panel">Panel Phase</SelectItem>
                      <SelectItem value="external">External Evaluation</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Mentor: Only mentor evaluates. Panel: Multiple panelists evaluate. External: Industry expert evaluates.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="meetingMode">
                    Meeting Mode <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.meetingMode}
                    onValueChange={(value) => setFormData({ ...formData, meetingMode: value })}
                  >
                    <SelectTrigger id="meetingMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online Only (Link Required)</SelectItem>
                      <SelectItem value="offline">Offline Only (Venue Required)</SelectItem>
                      <SelectItem value="both">Both Online & Offline</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Faculty will provide meeting link or venue based on this setting
                  </p>
                </div>

                {formData.phaseType === 'panel' && (
                  <div className="grid gap-2">
                    <Label htmlFor="minPanelistsMeetRequired">
                      Min Panelists Required <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="minPanelistsMeetRequired"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.minPanelistsMeetRequired}
                      onChange={(e) => setFormData({ ...formData, minPanelistsMeetRequired: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Students must meet at least this many panelists to pass
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marksVisible"
                  checked={formData.marksVisible}
                  onCheckedChange={(checked) => setFormData({ ...formData, marksVisible: checked })}
                />
                <Label htmlFor="marksVisible" className="cursor-pointer">
                  Make marks visible to students immediately
                </Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-2 ml-6">
                If unchecked, marks will be hidden until you enable visibility later
              </p>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setDialogOpen(false);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingPhase ? 'Update Phase' : 'Create Phase'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Extensions Management Dialog */}
        <ManageExtensions
          isOpen={extensionsDialogOpen}
          onClose={handleCloseExtensions}
          phase={selectedPhaseForExtension}
        />
      </CardContent>
    </Card>
  );
}
