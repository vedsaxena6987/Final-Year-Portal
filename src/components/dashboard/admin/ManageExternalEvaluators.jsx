// components/dashboard/admin/ManageExternalEvaluators.jsx
"use client";

import { useState, useEffect } from 'react';
import { useSession } from '@/context/SessionContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { UserPlus, Users, Calendar, CheckCircle, Clock, AlertTriangle, Mail, Shuffle, Target } from 'lucide-react';

export default function ManageExternalEvaluators() {
  const { activeSession } = useSession();
  const [externalEvaluators, setExternalEvaluators] = useState([]);
  const [teams, setTeams] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addEvaluatorDialog, setAddEvaluatorDialog] = useState(false);
  const [assignTeamsDialog, setAssignTeamsDialog] = useState(false);
  const [selectedEvaluator, setSelectedEvaluator] = useState(null);
  const [newEvaluator, setNewEvaluator] = useState({
    name: '',
    email: '',
    organization: '',
    expertise: '',
    bio: ''
  });

  useEffect(() => {
    if (!activeSession?.id) return;

    // Listen for external evaluators
    const evaluatorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'external_evaluator'),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribeEvaluators = onSnapshot(evaluatorsQuery, (snapshot) => {
      const evaluatorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.id,
        ...doc.data()
      }));
      setExternalEvaluators(evaluatorsList);
    });

    // Listen for teams
    const teamsQuery = query(
      collection(db, 'teams'),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribeTeams = onSnapshot(teamsQuery, (snapshot) => {
      const teamsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeams(teamsList);
    });

    // Listen for external evaluations
    const evaluationsQuery = query(
      collection(db, 'external_evaluations'),
      where('sessionId', '==', activeSession.id)
    );

    const unsubscribeEvaluations = onSnapshot(evaluationsQuery, (snapshot) => {
      const evaluationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        evaluatedAt: doc.data().evaluatedAt?.toDate()
      }));
      setEvaluations(evaluationsList);
      setLoading(false);
    });

    return () => {
      unsubscribeEvaluators();
      unsubscribeTeams();
      unsubscribeEvaluations();
    };
  }, [activeSession?.id]);

  const handleAddEvaluator = async () => {
    if (!newEvaluator.name.trim() || !newEvaluator.email.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      const batch = writeBatch(db);

      // Create external evaluator user document
      const userRef = doc(db, 'users', newEvaluator.email);
      batch.set(userRef, {
        name: newEvaluator.name,
        email: newEvaluator.email,
        role: 'external_evaluator',
        organization: newEvaluator.organization || '',
        expertise: newEvaluator.expertise || '',
        bio: newEvaluator.bio || '',
        sessionId: activeSession.id,
        createdAt: serverTimestamp(),
        isActive: true
      });

      await batch.commit();
      
      toast.success('External evaluator added successfully');
      setAddEvaluatorDialog(false);
      setNewEvaluator({
        name: '',
        email: '',
        organization: '',
        expertise: '',
        bio: ''
      });
    } catch (error) {
      toast.error('Failed to add external evaluator', { description: error.message });
    }
  };

  const handleAssignTeams = async (evaluatorId, teamIds) => {
    try {
      const batch = writeBatch(db);

      // First, remove this evaluator from all other teams
      teams.forEach(team => {
        if (team.externalEvaluatorId === evaluatorId) {
          const teamRef = doc(db, 'teams', team.id);
          batch.update(teamRef, {
            externalEvaluatorId: null,
            externalEvaluationStatus: 'not_assigned'
          });
        }
      });

      // Then assign to selected teams
      teamIds.forEach(teamId => {
        const teamRef = doc(db, 'teams', teamId);
        batch.update(teamRef, {
          externalEvaluatorId: evaluatorId,
          externalEvaluationStatus: 'assigned',
          externalAssignedAt: serverTimestamp()
        });
      });

      await batch.commit();
      
      toast.success('Teams assigned successfully');
      setAssignTeamsDialog(false);
    } catch (error) {
      toast.error('Failed to assign teams', { description: error.message });
    }
  };

  const handleRandomAssignment = async () => {
    if (externalEvaluators.length === 0 || teams.length === 0) {
      toast.error('Need both external evaluators and teams for assignment');
      return;
    }

    try {
      // Calculate teams per evaluator
      const teamsPerEvaluator = Math.ceil(teams.length / externalEvaluators.length);
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
      
      const batch = writeBatch(db);
      
      // Clear existing assignments
      teams.forEach(team => {
        const teamRef = doc(db, 'teams', team.id);
        batch.update(teamRef, {
          externalEvaluatorId: null,
          externalEvaluationStatus: 'not_assigned'
        });
      });

      // Assign teams to evaluators
      externalEvaluators.forEach((evaluator, evaluatorIndex) => {
        const startIndex = evaluatorIndex * teamsPerEvaluator;
        const endIndex = Math.min(startIndex + teamsPerEvaluator, shuffledTeams.length);
        const assignedTeams = shuffledTeams.slice(startIndex, endIndex);

        assignedTeams.forEach(team => {
          const teamRef = doc(db, 'teams', team.id);
          batch.update(teamRef, {
            externalEvaluatorId: evaluator.id,
            externalEvaluationStatus: 'assigned',
            externalAssignedAt: serverTimestamp()
          });
        });
      });

      await batch.commit();
      
      toast.success('Teams randomly assigned to external evaluators');
    } catch (error) {
      toast.error('Failed to assign teams', { description: error.message });
    }
  };

  const getEvaluatorStats = (evaluatorId) => {
    const assignedTeams = teams.filter(t => t.externalEvaluatorId === evaluatorId);
    const completedEvaluations = evaluations.filter(e => e.evaluatorId === evaluatorId);
    
    return {
      assigned: assignedTeams.length,
      completed: completedEvaluations.length,
      pending: assignedTeams.length - completedEvaluations.length,
      avgScore: completedEvaluations.length > 0 ? 
        Math.round(completedEvaluations.reduce((sum, e) => sum + e.overallScore, 0) / completedEvaluations.length) : 0
    };
  };

  const unassignedTeams = teams.filter(t => !t.externalEvaluatorId);
  const totalAssigned = teams.filter(t => t.externalEvaluatorId).length;
  const totalEvaluated = evaluations.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">External Evaluators</h2>
          <p className="text-muted-foreground">Manage external evaluators for final project evaluation</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRandomAssignment}
            variant="outline"
            disabled={externalEvaluators.length === 0 || teams.length === 0}
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Random Assignment
          </Button>
          <Button onClick={() => setAddEvaluatorDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add External Evaluator
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">External Evaluators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{externalEvaluators.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams Assigned</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssigned}</div>
            <p className="text-xs text-muted-foreground">
              {unassignedTeams.length} unassigned
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluated</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalEvaluated}</div>
            <p className="text-xs text-muted-foreground">
              {totalAssigned - totalEvaluated} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {teams.length > 0 ? Math.round((totalAssigned / teams.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">teams assigned</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="evaluators" className="space-y-4">
        <TabsList>
          <TabsTrigger value="evaluators">Evaluators ({externalEvaluators.length})</TabsTrigger>
          <TabsTrigger value="assignments">Team Assignments</TabsTrigger>
          <TabsTrigger value="progress">Evaluation Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="evaluators" className="space-y-4">
          {externalEvaluators.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No External Evaluators</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add external evaluators to help with final project evaluation.
                </p>
                <Button onClick={() => setAddEvaluatorDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Evaluator
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {externalEvaluators.map((evaluator) => {
                const stats = getEvaluatorStats(evaluator.id);
                
                return (
                  <Card key={evaluator.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{evaluator.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{evaluator.email}</p>
                          {evaluator.organization && (
                            <p className="text-sm text-muted-foreground">{evaluator.organization}</p>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            {stats.assigned} assigned
                          </Badge>
                          <Badge variant={stats.pending > 0 ? "secondary" : "default"}>
                            {stats.completed} completed
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEvaluator(evaluator);
                              setAssignTeamsDialog(true);
                            }}
                          >
                            Assign Teams
                          </Button>
                        </div>
                      </div>
                      
                      {evaluator.expertise && (
                        <p className="text-sm"><strong>Expertise:</strong> {evaluator.expertise}</p>
                      )}
                    </CardHeader>
                    
                    {stats.assigned > 0 && (
                      <CardContent>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <p className="text-2xl font-bold">{stats.assigned}</p>
                            <p className="text-xs text-muted-foreground">Assigned</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                            <p className="text-xs text-muted-foreground">Completed</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{stats.avgScore}%</p>
                            <p className="text-xs text-muted-foreground">Avg Score</p>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Assignment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unassignedTeams.length > 0 && (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-orange-600" />
                      <h4 className="font-semibold text-orange-800">
                        {unassignedTeams.length} Unassigned Teams
                      </h4>
                    </div>
                    <div className="text-sm text-orange-700">
                      {unassignedTeams.map(team => `Project #${team.projectNumber}`).join(', ')}
                    </div>
                  </div>
                )}

                {externalEvaluators.map(evaluator => {
                  const assignedTeams = teams.filter(t => t.externalEvaluatorId === evaluator.id);
                  
                  return assignedTeams.length > 0 && (
                    <div key={evaluator.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{evaluator.name}</h4>
                        <Badge variant="outline">{assignedTeams.length} teams</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {assignedTeams.map(team => `Project #${team.projectNumber}`).join(', ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Evaluations Yet</h3>
                <p className="text-muted-foreground text-center">
                  External evaluation progress will appear here once evaluators start their work.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {evaluations.map((evaluation) => {
                const team = teams.find(t => t.id === evaluation.teamId);
                const evaluator = externalEvaluators.find(e => e.id === evaluation.evaluatorId);
                
                return (
                  <Card key={evaluation.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg">{team?.name || 'Unknown Team'}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Evaluated by {evaluator?.name || 'Unknown Evaluator'}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          {evaluation.overallScore}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Completed on {evaluation.evaluatedAt?.toLocaleDateString()}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm font-medium">Technical</p>
                          <p className="text-2xl font-bold">{evaluation.technicalScore}%</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Presentation</p>
                          <p className="text-2xl font-bold">{evaluation.presentationScore}%</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Innovation</p>
                          <p className="text-2xl font-bold">{evaluation.innovationScore}%</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Documentation</p>
                          <p className="text-2xl font-bold">{evaluation.documentationScore}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add External Evaluator Dialog */}
      <Dialog open={addEvaluatorDialog} onOpenChange={setAddEvaluatorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add External Evaluator</DialogTitle>
            <DialogDescription>
              Add a new external evaluator for final project evaluation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newEvaluator.name}
                onChange={(e) => setNewEvaluator(prev => ({
                  ...prev,
                  name: e.target.value
                }))}
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newEvaluator.email}
                onChange={(e) => setNewEvaluator(prev => ({
                  ...prev,
                  email: e.target.value
                }))}
              />
            </div>
            <div>
              <Label htmlFor="organization">Organization</Label>
              <Input
                id="organization"
                value={newEvaluator.organization}
                onChange={(e) => setNewEvaluator(prev => ({
                  ...prev,
                  organization: e.target.value
                }))}
              />
            </div>
            <div>
              <Label htmlFor="expertise">Areas of Expertise</Label>
              <Input
                id="expertise"
                placeholder="e.g., Machine Learning, Web Development, Mobile Apps"
                value={newEvaluator.expertise}
                onChange={(e) => setNewEvaluator(prev => ({
                  ...prev,
                  expertise: e.target.value
                }))}
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio/Background</Label>
              <Textarea
                id="bio"
                placeholder="Brief background information..."
                value={newEvaluator.bio}
                onChange={(e) => setNewEvaluator(prev => ({
                  ...prev,
                  bio: e.target.value
                }))}
                rows={3}
                className="max-h-28 md:max-h-32 resize-y"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddEvaluatorDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEvaluator}>
              Add Evaluator
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Teams Dialog */}
      <Dialog open={assignTeamsDialog} onOpenChange={setAssignTeamsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Teams - {selectedEvaluator?.name}</DialogTitle>
            <DialogDescription>
              Select teams to assign to this external evaluator for evaluation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {teams.map((team) => {
              const isCurrentlyAssigned = team.externalEvaluatorId === selectedEvaluator?.id;
              const isAssignedToOther = team.externalEvaluatorId && team.externalEvaluatorId !== selectedEvaluator?.id;
              
              return (
                <div key={team.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <input
                    type="checkbox"
                    id={`team-${team.id}`}
                    defaultChecked={isCurrentlyAssigned}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`team-${team.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium">Project #{team.projectNumber}</div>
                    {team.projectTitle && (
                      <div className="text-sm text-muted-foreground">{team.projectTitle}</div>
                    )}
                  </label>
                  {isAssignedToOther && (
                    <Badge variant="secondary">
                      Assigned to {externalEvaluators.find(e => e.id === team.externalEvaluatorId)?.name}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTeamsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              const checkedTeams = Array.from(
                document.querySelectorAll('input[id^="team-"]:checked')
              ).map(input => input.id.replace('team-', ''));
              handleAssignTeams(selectedEvaluator.id, checkedTeams);
            }}>
              Update Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
