"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Download, Eye, Calendar, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

import { logger } from "../../../lib/logger";
export default function TeamSubmissionsTab({ teamId, sessionId }) {
  const [submissions, setSubmissions] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhase, setSelectedPhase] = useState('all');

  // Fetch phases and submissions
  useEffect(() => {
    const fetchData = async () => {
      if (!teamId || !sessionId) return;

      try {
        // Fetch phases
        const phasesRef = collection(db, 'phases');
        const phasesQuery = query(
          phasesRef,
          where('sessionId', '==', sessionId)
        );
        const phasesSnapshot = await getDocs(phasesQuery);
        const phasesData = phasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPhases(phasesData);

        // Fetch submissions
        const submissionsRef = collection(db, 'submissions');
        const submissionsQuery = query(
          submissionsRef,
          where('teamId', '==', teamId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);

        const submissionsData = [];
        for (const docSnap of submissionsSnapshot.docs) {
          const subData = { id: docSnap.id, ...docSnap.data() };

          // Fetch phase details
          if (subData.phaseId) {
            const phaseRef = doc(db, 'phases', subData.phaseId);
            const phaseSnap = await getDoc(phaseRef);
            if (phaseSnap.exists()) {
              const phaseData = phaseSnap.data();
              subData.phaseName = phaseData.phaseName || phaseData.name || 'Unknown Phase';
            }
          }

          submissionsData.push(subData);
        }

        // Sort by submission date (newest first)
        submissionsData.sort((a, b) => {
          if (!a.submittedAt) return 1;
          if (!b.submittedAt) return -1;
          return b.submittedAt.toDate() - a.submittedAt.toDate();
        });

        setSubmissions(submissionsData);
      } catch (error) {
        logger.error('Error fetching submissions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teamId, sessionId]);

  // Filter submissions
  const filteredSubmissions = submissions.filter(submission => {
    if (selectedPhase !== 'all' && submission.phaseId !== selectedPhase) return false;
    return true;
  });

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'evaluated':
        return { icon: CheckCircle, text: 'Evaluated', className: 'bg-green-500 hover:bg-green-600' };
      case 'pending':
        return { icon: Clock, text: 'Pending Evaluation', className: 'bg-yellow-500 hover:bg-yellow-600 text-white' };
      case 'submitted':
        return { icon: CheckCircle, text: 'Submitted', className: 'bg-blue-500 hover:bg-blue-600' };
      case 'rejected':
        return { icon: XCircle, text: 'Rejected', className: 'bg-red-500 hover:bg-red-600' };
      default:
        return { icon: Clock, text: 'Unknown', className: 'bg-gray-500 hover:bg-gray-600' };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton-card h-20" />
        {[1, 2, 3].map(i => (
          <div key={i} className="card-faculty p-4 animate-shimmer">
            <div className="flex items-center gap-4">
              <div className="skeleton-faculty w-12 h-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-faculty h-5 w-40" />
                <div className="skeleton-faculty h-3 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter */}
      <div className="card-faculty-elevated p-4 animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Filter by Phase</label>
            <Select value={selectedPhase} onValueChange={setSelectedPhase}>
              <SelectTrigger className="rounded-xl border-gray-200 focus:ring-teal-500">
                <SelectValue placeholder="All Phases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phases</SelectItem>
                {phases.map(phase => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="metric-value text-2xl font-bold text-teal-600">{filteredSubmissions.length}</div>
              <div className="metric-label">Submissions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      <div className="space-y-3">
        {filteredSubmissions.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon">
              <FileText className="h-8 w-8" />
            </div>
            <h2 className="empty-state-title">No Submissions Yet</h2>
            <p className="empty-state-text">
              {selectedPhase === 'all'
                ? "This team hasn't submitted any work yet."
                : 'No submissions for the selected phase.'}
            </p>
          </div>
        ) : (
          filteredSubmissions.map((submission) => {
            const statusInfo = getStatusBadge(submission.status || 'submitted');
            const StatusIcon = statusInfo.icon;

            return (
              <Card key={submission.id} className="border-teal-200 hover:border-teal-400 transition-colors">
                <CardHeader className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-teal-600" />
                        <h4 className="text-base font-semibold">{submission.phaseName || 'Unknown Phase'}</h4>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {submission.submittedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Submitted {format(submission.submittedAt.toDate(), 'MMM dd, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={statusInfo.className}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusInfo.text}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Submission Title */}
                  {submission.submissionTitle && (
                    <div>
                      <p className="text-sm font-medium mb-1">Title</p>
                      <p className="text-sm text-gray-700">{submission.submissionTitle}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {submission.notes && (
                    <div>
                      <p className="text-sm font-medium mb-1">Notes</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.notes}</p>
                    </div>
                  )}

                  {/* Project Details (for abstracts) */}
                  {submission.projectTitle && (
                    <div>
                      <p className="text-sm font-medium mb-1">Project Title</p>
                      <p className="text-sm text-gray-700">{submission.projectTitle}</p>
                    </div>
                  )}
                  {submission.abstract && (
                    <div>
                      <p className="text-sm font-medium mb-1">Abstract</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{submission.abstract}</p>
                    </div>
                  )}

                  {/* Submitted Files */}
                  {((submission.files && submission.files.length > 0) || (submission.fileUrls && submission.fileUrls.length > 0)) && (
                    <div>
                      <p className="text-sm font-medium mb-2">Submitted Files</p>
                      <div className="space-y-2">
                        {submission.files && submission.files.length > 0 ? (
                          // New format with file details
                          submission.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-teal-600" />
                                <div>
                                  <p className="text-sm font-medium">{file.name || `File ${idx + 1}`}</p>
                                  {file.type && (
                                    <p className="text-xs text-muted-foreground">{file.type}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(file.url, '_blank')}
                                  className="gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(file.url, '_blank')}
                                  className="gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : (
                          // Fallback to fileUrls array
                          submission.fileUrls.map((url, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                              <div className="flex items-center gap-3">
                                <FileText className="h-5 w-5 text-teal-600" />
                                <div>
                                  <p className="text-sm font-medium">Submitted File {idx + 1}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">{url}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(url, '_blank')}
                                  className="gap-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(url, '_blank')}
                                  className="gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Download
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* Legacy single file support */}
                  {!submission.files && !submission.fileUrls && submission.fileUrl && (
                    <div>
                      <p className="text-sm font-medium mb-2">Submitted File</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(submission.fileUrl, '_blank')}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View File
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(submission.fileUrl, '_blank')}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Additional Links */}
                  {submission.links && submission.links.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Additional Links</p>
                      <div className="space-y-1">
                        {submission.links.map((link, idx) => (
                          <a
                            key={idx}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {link}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Feedback */}
                  {submission.feedback && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-medium mb-1">Faculty Feedback</p>
                      <p className="text-sm text-amber-900">{submission.feedback}</p>
                    </div>
                  )}

                  {/* Evaluation Status */}
                  {submission.status === 'evaluated' && submission.marks !== undefined && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-900">Evaluation Complete</p>
                          <p className="text-xs text-green-700 mt-1">
                            Marks: {submission.marks} / {submission.maxMarks}
                          </p>
                        </div>
                        <Badge className="bg-green-600 hover:bg-green-700">
                          {((submission.marks / submission.maxMarks) * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
