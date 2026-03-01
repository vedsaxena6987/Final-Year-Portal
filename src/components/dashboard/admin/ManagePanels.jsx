"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/context/SessionContext";
import { useAuth } from "@/context/AuthContext";
import PanelService from "@/services/panelService";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Users,
  Plus,
  Trash2,
  UserPlus,
  UserMinus,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileStack,
  UserCog,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";

import { logger } from "../../../lib/logger";
import BulkPanelAssignment from "./BulkPanelAssignment";

export default function ManagePanels() {
  const { activeSession } = useSession();
  const { userData } = useAuth();

  const [panels, setPanels] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingPanels, setCreatingPanels] = useState(false);
  const [assigningTeams, setAssigningTeams] = useState(false);

  // Panel creation form state
  const [panelSize, setPanelSize] = useState(3);
  const [selectedFaculty, setSelectedFaculty] = useState([]);
  const [assignmentMode, setAssignmentMode] = useState("random"); // 'random' or 'manual'

  // Conflict tracking
  const [conflicts, setConflicts] = useState([]);

  // Load panels, faculty, and teams for active session
  useEffect(() => {
    if (!activeSession?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to panels
    const panelsQuery = query(
      collection(db, "panels"),
      where("sessionId", "==", activeSession.id),
      orderBy("panelNumber", "asc")
    );

    const unsubscribePanels = onSnapshot(panelsQuery, (snapshot) => {
      const panelsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPanels(panelsData);
    });

    // Subscribe to faculty
    const facultyQuery = query(
      collection(db, "users"),
      where("role", "==", "faculty")
    );

    const unsubscribeFaculty = onSnapshot(facultyQuery, (snapshot) => {
      const facultyData = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          // Use actual UID from document if available, otherwise fall back to doc.id (email)
          uid: data.uid || doc.id,
          email: doc.id,
          ...data,
        };
      });
      setFaculty(facultyData);

      // Auto-select all faculty for panel creation
      if (selectedFaculty.length === 0) {
        setSelectedFaculty(facultyData.map((f) => f.uid));
      }
    });

    // Subscribe to teams
    const teamsQuery = query(
      collection(db, "teams"),
      where("sessionId", "==", activeSession.id),
      orderBy("projectNumber", "asc")
    );

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTeams(teamsData);
      setLoading(false);
    });

    return () => {
      unsubscribePanels();
      unsubscribeFaculty();
      unsubscribeTeams();
    };
  }, [activeSession?.id]);

  // Calculate panel statistics
  const panelStats = {
    totalPanels: panels.length,
    totalFaculty: faculty.length,
    assignedFaculty: faculty.filter((f) => f.panelId).length,
    unassignedFaculty: faculty.filter((f) => !f.panelId).length,
    totalTeams: teams.length,
    assignedTeams: teams.filter((t) => t.panelId).length,
    unassignedTeams: teams.filter((t) => !t.panelId).length,
  };

  // Handle panel creation
  const handleCreatePanels = async () => {
    if (!activeSession?.id) {
      toast.error("No active session");
      return;
    }

    if (selectedFaculty.length === 0) {
      toast.error("Please select at least one faculty member");
      return;
    }

    if (panelSize < 2) {
      toast.error("Panel size must be at least 2");
      return;
    }

    setCreatingPanels(true);

    try {
      const selectedFacultyData = faculty.filter((f) =>
        selectedFaculty.includes(f.uid)
      );

      const result = await PanelService.createPanels(
        activeSession.id,
        panelSize,
        selectedFacultyData,
        userData.uid
      );

      if (result.success) {
        // Reset form
        setSelectedFaculty([]);
        setPanelSize(3);
      }
    } catch (error) {
      logger.error("Error creating panels:", error);
    } finally {
      setCreatingPanels(false);
    }
  };

  // Handle team assignment
  const handleAssignTeams = async () => {
    if (!activeSession?.id) {
      toast.error("No active session");
      return;
    }

    if (panels.length === 0) {
      toast.error("Create panels first before assigning teams");
      return;
    }

    const teamsToAssign = teams.filter((t) => t.mentorId); // Only assign teams with mentors

    if (teamsToAssign.length === 0) {
      toast.error("No teams with assigned mentors found");
      return;
    }

    setAssigningTeams(true);

    try {
      const result = await PanelService.assignTeamsToPanels(
        activeSession.id,
        teamsToAssign
      );

      if (result.success && result.conflicts) {
        setConflicts(result.conflicts);
      }
    } catch (error) {
      logger.error("Error assigning teams:", error);
    } finally {
      setAssigningTeams(false);
    }
  };

  // Handle delete panel
  const handleDeletePanel = async (panelId) => {
    if (
      !confirm(
        "Are you sure? This will remove all faculty and team assignments from this panel."
      )
    ) {
      return;
    }

    await PanelService.deletePanel(panelId);
  };

  // Handle delete ALL panels
  const handleDeleteAllPanels = async () => {
    if (panels.length === 0) {
      toast.error("No panels to delete");
      return;
    }

    const confirmMessage = `⚠️ DELETE ALL PANELS?\n\nThis will permanently delete all ${
      panels.length
    } panel(s) and remove ALL panel assignments from:\n- ${
      faculty.filter((f) => f.panelId).length
    } faculty members\n- ${
      teams.filter((t) => t.panelId).length
    } teams\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm:`;

    const userInput = prompt(confirmMessage);

    if (userInput !== "DELETE ALL") {
      if (userInput !== null) {
        toast.error("Confirmation text did not match. Panels NOT deleted.");
      }
      return;
    }

    setCreatingPanels(true);
    try {
      // Delete all panels using the service
      await PanelService.deleteAllPanels(activeSession.id);

      toast.success("All panels deleted successfully", {
        description: `Removed ${panels.length} panel(s) and cleared all assignments`,
      });
    } catch (error) {
      logger.error("Error deleting all panels:", error);
      toast.error("Failed to delete all panels", {
        description: error.message,
      });
    } finally {
      setCreatingPanels(false);
    }
  };

  // Handle add faculty to panel
  const handleAddFacultyToPanel = async (panelId, facultyUid) => {
    const facultyData = faculty.find((f) => f.uid === facultyUid);
    if (!facultyData) return;

    await PanelService.addFacultyToPanel(panelId, facultyData);
  };

  // Handle remove faculty from panel
  const handleRemoveFacultyFromPanel = async (panelId, facultyUid) => {
    await PanelService.removeFacultyFromPanel(panelId, facultyUid);
  };

  // Handle add team to panel
  const handleAddTeamToPanel = async (panelId, teamId) => {
    await PanelService.addTeamToPanel(panelId, teamId);
  };

  // Handle remove team from panel
  const handleRemoveTeamFromPanel = async (panelId, teamId) => {
    await PanelService.removeTeamFromPanel(panelId, teamId);
  };

  // Toggle faculty selection
  const toggleFacultySelection = (facultyUid) => {
    setSelectedFaculty((prev) =>
      prev.includes(facultyUid)
        ? prev.filter((uid) => uid !== facultyUid)
        : [...prev, facultyUid]
    );
  };

  // Get unassigned faculty
  const unassignedFaculty = faculty.filter((f) => !f.panelId);

  // Get unassigned teams
  const unassignedTeams = teams.filter((t) => !t.panelId && t.mentorId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!activeSession) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No active session. Please create or activate a session first.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Manage Evaluation Panels
        </h2>
        <p className="text-muted-foreground">
          Create and manage faculty panels for {activeSession.name}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Panels</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{panelStats.totalPanels}</div>
            <p className="text-xs text-muted-foreground">
              {panelStats.totalFaculty} faculty members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Faculty Status
            </CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {panelStats.assignedFaculty}
            </div>
            <p className="text-xs text-muted-foreground">
              {panelStats.unassignedFaculty} unassigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams Status</CardTitle>
            <FileStack className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{panelStats.assignedTeams}</div>
            <p className="text-xs text-muted-foreground">
              {panelStats.unassignedTeams} unassigned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
            {conflicts.length > 0 ? (
              <ShieldAlert className="h-4 w-4 text-destructive" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conflicts.length}</div>
            <p className="text-xs text-muted-foreground">
              {conflicts.length === 0 ? "No conflicts" : "Mentor conflicts"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conflict Warnings */}
      {conflicts.length > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>
            <strong>{conflicts.length} team(s) have mentor conflicts:</strong>
            <ul className="mt-2 space-y-1">
              {conflicts.map((conflict, index) => (
                <li key={index} className="text-sm">
                  • Project #{conflict.projectNumber} (Panel {conflict.panelNumber}):{" "}
                  {conflict.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Panel Creation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Evaluation Panels
          </CardTitle>
          <CardDescription>
            Select faculty members and define panel size. The system will
            balance expertise across panels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Panel Size Input */}
          <div className="space-y-2">
            <Label htmlFor="panelSize">
              Panel Size (faculty members per panel)
            </Label>
            <Input
              id="panelSize"
              type="number"
              min="2"
              max="10"
              value={panelSize}
              onChange={(e) => {
                // Get the raw value from the input
                const value = e.target.value;

                // If the input is empty, set the state to an empty string.
                // An empty string is a valid value for a number input.
                if (value === "") {
                  setPanelSize("");
                } else {
                  // Otherwise, parse the number
                  const num = parseInt(value);
                  // Only update the state if it's a valid number
                  if (!isNaN(num)) {
                    setPanelSize(num);
                  }
                }
              }}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              {faculty.length > 0 && (
                <>
                  With {selectedFaculty.length} selected faculty, you'll create
                  approximately{" "}
                  <strong>
                    {Math.ceil(selectedFaculty.length / panelSize)}
                  </strong>{" "}
                  panel(s)
                </>
              )}
            </p>
          </div>

          {/* Faculty Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select Faculty Members</Label>
              <div className="space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFaculty(faculty.map((f) => f.uid))}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFaculty([])}
                >
                  Clear All
                </Button>
              </div>
            </div>

            <ScrollArea className="h-64 rounded-md border p-4">
              <div className="space-y-3">
                {faculty.map((f) => (
                  <div
                    key={f.uid}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      f.panelId ? "bg-muted opacity-60" : "bg-background"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedFaculty.includes(f.uid)}
                        onCheckedChange={() => toggleFacultySelection(f.uid)}
                        disabled={f.panelId}
                      />
                      <div>
                        <p className="font-medium">{f.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {f.email}
                        </p>
                        {f.expertise && f.expertise.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {f.expertise.map((tag, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {f.panelId && (
                      <Badge variant="secondary">Already in Panel</Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Create Panels Button */}
          <Button
            onClick={handleCreatePanels}
            disabled={
              creatingPanels || selectedFaculty.length === 0 || panelSize < 2
            }
            className="w-full"
          >
            {creatingPanels ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Creating Panels...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Panels ({Math.ceil(selectedFaculty.length / panelSize)})
              </>
            )}
          </Button>

          {/* Delete All Panels Button - Only show if panels exist */}
          {panels.length > 0 && (
            <Button
              onClick={handleDeleteAllPanels}
              disabled={creatingPanels}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete All Panels ({panels.length})
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Team Assignment Section */}
      {panels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              Assign Teams to Panels
            </CardTitle>
            <CardDescription>
              Automatically distribute teams across panels with mentor conflict
              prevention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="auto" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="auto" className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Auto-Assign
                </TabsTrigger>
                <TabsTrigger value="csv" className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV Import
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="auto" className="mt-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="font-medium">Teams ready for assignment</p>
                    <p className="text-sm text-muted-foreground">
                      {unassignedTeams.length} teams with assigned mentors
                    </p>
                  </div>
                  <Button
                    onClick={handleAssignTeams}
                    disabled={assigningTeams || unassignedTeams.length === 0}
                  >
                    {assigningTeams ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Auto-Assign Teams
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="csv" className="mt-4">
                <BulkPanelAssignment />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Panels List with Tabs */}
      {panels.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Evaluation Panels ({panels.length})</CardTitle>
                <CardDescription className="mt-1.5">
                  View and manage faculty and team assignments for each panel
                </CardDescription>
              </div>
              {panels.length > 0 && (
                <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{panels.reduce((acc, p) => acc + (p.actualSize || 0), 0)} total faculty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileStack className="h-4 w-4" />
                    <span>{panels.reduce((acc, p) => acc + (p.teamCount || 0), 0)} total teams</span>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={panels[0]?.id} className="space-y-4">
              <div className="relative">
                <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 h-auto rounded-lg bg-muted p-2">
                  {panels.map((panel) => {
                    const hasConflicts = panel.assignedTeams?.some((teamId) => {
                      const team = teams.find((t) => t.id === teamId);
                      return panel.facultyMembers?.some((f) => f.uid === team?.mentorId);
                    });
                    
                    return (
                      <TabsTrigger 
                        key={panel.id} 
                        value={panel.id}
                        className="relative flex h-10 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">Panel {panel.panelNumber}</span>
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background/50 border border-border/50">
                                <Users className="h-3 w-3 text-blue-600" />
                                <span className="text-xs font-medium">{panel.actualSize}</span>
                              </div>
                              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
                                (panel.teamCount || 0) > 0 ? 'bg-background/50 border border-border/50' : 'bg-muted border border-border/30'
                              }`}>
                                <FileStack className={`h-3 w-3 ${(panel.teamCount || 0) > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
                                <span className="text-xs font-medium">{panel.teamCount || 0}</span>
                              </div>
                            </div>
                            {hasConflicts && (
                              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                            )}
                          </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {panels.map((panel) => (
                <TabsContent
                  key={panel.id}
                  value={panel.id}
                  className="space-y-6 mt-6"
                >
                  {/* Panel Header with Stats and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        Panel {panel.panelNumber}
                        {panel.assignedTeams?.some((teamId) => {
                          const team = teams.find((t) => t.id === teamId);
                          return panel.facultyMembers?.some((f) => f.uid === team?.mentorId);
                        }) && (
                          <Badge variant="destructive" className="text-xs">
                            Has Conflicts
                          </Badge>
                        )}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />
                          <span>{panel.actualSize} faculty members</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FileStack className="h-3.5 w-3.5" />
                          <span>{panel.teamCount || 0} assigned teams</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeletePanel(panel.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Panel
                    </Button>
                  </div>

                  {/* Faculty Members */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Faculty Members
                          <Badge variant="secondary" className="ml-1">
                            {panel.actualSize}
                          </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Evaluators assigned to this panel
                        </p>
                      </div>
                      <AddFacultyDialog
                        panelId={panel.id}
                        currentFaculty={panel.facultyMembers || []}
                        availableFaculty={unassignedFaculty}
                        onAdd={handleAddFacultyToPanel}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {panel.facultyMembers?.map((f) => (
                        <div
                          key={f.uid}
                          className="group relative flex items-start justify-between p-4 rounded-lg border bg-card hover:shadow-md transition-all"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{f.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {f.email}
                            </p>
                            {f.expertise && f.expertise.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {f.expertise.slice(0, 3).map((tag, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className="text-xs"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {f.expertise.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{f.expertise.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveFacultyFromPanel(panel.id, f.uid)
                            }
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Assigned Teams */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold flex items-center gap-2">
                          <FileStack className="h-4 w-4" />
                          Assigned Teams
                          <Badge variant="secondary" className="ml-1">
                            {panel.teamCount || 0}
                          </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Projects evaluated by this panel
                        </p>
                      </div>
                      <AddTeamDialog
                        panelId={panel.id}
                        panelNumber={panel.panelNumber}
                        currentTeams={panel.assignedTeams || []}
                        availableTeams={unassignedTeams}
                        panelFacultyUids={
                          panel.facultyMembers?.map((f) => f.uid) || []
                        }
                        onAdd={handleAddTeamToPanel}
                      />
                    </div>

                    {panel.assignedTeams && panel.assignedTeams.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {panel.assignedTeams.map((teamId) => {
                          const team = teams.find((t) => t.id === teamId);
                          if (!team) return null;

                          const mentor = faculty.find(
                            (f) => f.uid === team.mentorId
                          );
                          const hasConflict = panel.facultyMembers?.some(
                            (f) => f.uid === team.mentorId
                          );

                          return (
                            <div
                              key={teamId}
                              className={`group relative flex items-start justify-between p-4 rounded-lg border transition-all ${
                                hasConflict
                                  ? "border-destructive bg-destructive/5 hover:bg-destructive/10"
                                  : "bg-card hover:shadow-md"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-sm">
                                    Project #{team.projectNumber}
                                  </p>
                                  {hasConflict && (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs"
                                    >
                                      <ShieldAlert className="h-3 w-3 mr-1" />
                                      Conflict
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {team.projectTitle || team.teamName}
                                </p>
                                <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                                  <UserCog className="h-3 w-3" />
                                  <span className="truncate">
                                    {mentor?.name || "Unknown Mentor"}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleRemoveTeamFromPanel(panel.id, teamId)
                                }
                                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed rounded-lg bg-muted/30">
                        <FileStack className="h-10 w-10 text-muted-foreground/50 mb-3" />
                        <h4 className="font-medium text-sm mb-1">No teams assigned yet</h4>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Add teams manually or use the auto-assign feature to distribute teams across panels
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {panels.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Panels Created Yet
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              Create evaluation panels to start assigning faculty and teams
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Dialog for adding faculty to panel
function AddFacultyDialog({
  panelId,
  currentFaculty,
  availableFaculty,
  onAdd,
}) {
  const [open, setOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState("");

  const handleAdd = async () => {
    if (!selectedFaculty) return;

    await onAdd(panelId, selectedFaculty);
    setSelectedFaculty("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Faculty
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Faculty to Panel</DialogTitle>
          <DialogDescription>
            Select a faculty member to add to this evaluation panel
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {availableFaculty.length > 0 ? (
            <>
              <Select
                value={selectedFaculty}
                onValueChange={setSelectedFaculty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select faculty member" />
                </SelectTrigger>
                <SelectContent>
                  {availableFaculty.map((f) => (
                    <SelectItem key={f.uid} value={f.uid}>
                      {f.name} ({f.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!selectedFaculty}>
                  Add Faculty
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              All faculty members are already assigned to panels
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Dialog for adding team to panel
function AddTeamDialog({
  panelId,
  panelNumber,
  currentTeams,
  availableTeams,
  panelFacultyUids,
  onAdd,
}) {
  const [open, setOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState("");

  const handleAdd = async () => {
    if (!selectedTeam) return;

    await onAdd(panelId, selectedTeam);
    setSelectedTeam("");
    setOpen(false);
  };

  // Check if team would have conflict
  const teamHasConflict = (team) => {
    return panelFacultyUids.includes(team.mentorId);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Add Team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team to Panel {panelNumber}</DialogTitle>
          <DialogDescription>
            Select a team to manually assign to this evaluation panel
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {availableTeams.length > 0 ? (
            <>
              <ScrollArea className="h-64 rounded-md border p-2">
                <div className="space-y-2">
                  {availableTeams.map((team) => {
                    const hasConflict = teamHasConflict(team);
                    return (
                      <div
                        key={team.id}
                        onClick={() => !hasConflict && setSelectedTeam(team.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTeam === team.id
                            ? "border-primary bg-primary/10"
                            : hasConflict
                            ? "border-destructive bg-destructive/5 opacity-60 cursor-not-allowed"
                            : "hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              Project #{team.projectNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {team.projectTitle || 'No title'}
                            </p>
                          </div>
                          {hasConflict && (
                            <Badge variant="destructive" className="text-xs">
                              Mentor Conflict
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!selectedTeam}>
                  Add Team
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              All teams are already assigned to panels
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
