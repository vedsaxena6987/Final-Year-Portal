// components/dashboard/student/PhaseSubmissionCard.jsx
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from '@/context/AuthContext';
import { useSession } from '@/context/SessionContext';
import { SubmissionService } from '@/services/submissionService';
import ExtensionService from '@/services/extensionService';
import { toast } from 'sonner';
import { 
  FileText, 
  Upload, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  RefreshCw,
  Info,
  Award
} from 'lucide-react';

import { logger } from "../../../lib/logger";
export default function PhaseSubmissionCard({ team, phase, onSubmitted }) {
  const { userData } = useAuth();
  const { activeSession } = useSession();
  const [files, setFiles] = useState([{ name: '', url: '' }]);
  const [loading, setLoading] = useState(false);
  const [fetchingSubmission, setFetchingSubmission] = useState(true);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [linkValidation, setLinkValidation] = useState([{ valid: false, message: '' }]);
  const [extensionInfo, setExtensionInfo] = useState(null);
  const [loadingExtension, setLoadingExtension] = useState(true);

  // Fetch existing submission
  useEffect(() => {
    if (!team?.id || !phase?.id) {
      setFetchingSubmission(false);
      return;
    }

    const fetchSubmission = async () => {
      try {
        const submission = await SubmissionService.getSubmission(team.id, phase.id);
        if (submission) {
          setExistingSubmission(submission);
          // Pre-populate files from existing submission
          if (submission.files && submission.files.length > 0) {
            setFiles(submission.files.map(f => ({ name: f.name, url: f.url })));
          }
        }
      } catch (error) {
        logger.error('Error fetching submission:', error);
      } finally {
        setFetchingSubmission(false);
      }
    };

    fetchSubmission();
  }, [team?.id, phase?.id]);

  // Check for deadline extension
  useEffect(() => {
    const checkExtension = async () => {
      if (!team?.id || !phase?.id || !phase?.endDate) {
        setLoadingExtension(false);
        return;
      }

      try {
        const extension = await ExtensionService.getExtensionDetails(team.id, phase.id);
        if (extension) {
          setExtensionInfo({
            hasExtension: true,
            extendedDeadline: extension.extendedDeadline.toDate(),
            reason: extension.reason
          });
        } else {
          setExtensionInfo({ hasExtension: false });
        }
      } catch (error) {
        logger.error('Error checking extension:', error);
        setExtensionInfo({ hasExtension: false });
      } finally {
        setLoadingExtension(false);
      }
    };

    checkExtension();
  }, [team?.id, phase?.id, phase?.endDate]);

  // Validate links when they change
  useEffect(() => {
    const validations = files.map(file => {
      if (!file.url.trim()) {
        return { valid: false, message: '' };
      }
      const validation = validateGoogleDriveLink(file.url);
      return {
        valid: validation.valid,
        message: validation.error || '✓ Valid Google Drive link'
      };
    });
    setLinkValidation(validations);
  }, [files]);

  const handleFileChange = (index, field, value) => {
    const newFiles = [...files];
    newFiles[index][field] = value;
    setFiles(newFiles);
  };

  const addFileField = () => {
    if (files.length < 5) {
      setFiles([...files, { name: '', url: '' }]);
    } else {
      toast.error('Maximum 5 files allowed per submission');
    }
  };

  const removeFileField = (index) => {
    if (files.length > 1) {
      const newFiles = files.filter((_, i) => i !== index);
      setFiles(newFiles);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all files
    const filledFiles = files.filter(f => f.url.trim());
    
    if (filledFiles.length === 0) {
      toast.error('Please provide at least one file link');
      return;
    }

    // Check all links are valid
    const allValid = filledFiles.every((file, idx) => {
      const originalIdx = files.findIndex(f => f === file);
      return linkValidation[originalIdx]?.valid;
    });

    if (!allValid) {
      toast.error('Please fix invalid Google Drive links');
      return;
    }

    // Ensure all files have names
    const filesWithNames = filledFiles.map((file, idx) => ({
      name: file.name.trim() || `File ${idx + 1}`,
      url: file.url.trim(),
      type: 'pdf' // Default, can be enhanced to detect from link
    }));

    setLoading(true);
    try {
      const result = await SubmissionService.submitPhase({
        teamId: team.id,
        teamName: `Project ${team.projectNumber}` || 'Team',
        phaseId: phase.id,
        phaseName: phase.name || phase.title,
        phaseType: phase.type || null,
        files: filesWithNames,
        sessionId: activeSession?.id,
        submittedBy: userData?.email
      });

      if (result.success) {
        setExistingSubmission(result.submission || { status: 'submitted' });
        if (onSubmitted) onSubmitted();
      }
    } catch (error) {
      logger.error('Submission error:', error);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
      case 'pending':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Pending Evaluation
          </Badge>
        );
      case 'evaluated':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            Evaluated
          </Badge>
        );
      case 'revisions_requested':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Revisions Required
          </Badge>
        );
      default:
        return null;
    }
  };

  const getProgressValue = () => {
    if (!existingSubmission) return 0;
    if (existingSubmission.evaluationStatus === 'evaluated') return 100;
    if (existingSubmission.evaluationStatus === 'revisions_requested') return 50;
    return 33; // Submitted, pending
  };

  if (fetchingSubmission) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const canSubmit = !existingSubmission || 
                    existingSubmission.evaluationStatus === 'revisions_requested';
  const isResubmission = existingSubmission && 
                         existingSubmission.evaluationStatus === 'revisions_requested';

  return (
    <Card className={existingSubmission ? 'border-l-4 border-l-blue-500' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {phase.name || phase.title}
            </CardTitle>
            <CardDescription>
              Evaluated by <strong>{phase.evaluatorRole}</strong> • Maximum <strong>{phase.maxMarks} marks</strong>
            </CardDescription>
          </div>
          {existingSubmission && getStatusBadge(existingSubmission.evaluationStatus || existingSubmission.status)}
        </div>

        {existingSubmission && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{getProgressValue()}%</span>
            </div>
            <Progress value={getProgressValue()} className="h-2" />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Deadline Extension Alert */}
        {!loadingExtension && extensionInfo?.hasExtension && (
          <Alert className="border-amber-500 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-900">
                  Deadline Extended
                </span>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  New Deadline: {extensionInfo.extendedDeadline.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Badge>
              </div>
              {extensionInfo.reason && (
                <div className="mt-2 text-sm text-amber-800">
                  Reason: {extensionInfo.reason}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Phase Instructions */}
        {phase.instructions && phase.instructions.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Submission Requirements</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                {phase.instructions.map((instruction, idx) => (
                  <li key={idx}>{instruction}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Existing Submission Info */}
        {existingSubmission && (
          <div className="space-y-4">
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Submission Status</h4>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="font-medium">
                    {existingSubmission.submittedAt?.toLocaleString ? 
                      existingSubmission.submittedAt.toLocaleString() : 
                      'Recently'}
                  </span>
                </div>
                
                {existingSubmission.evaluatedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Evaluated:</span>
                    <span className="font-medium">
                      {existingSubmission.evaluatedAt.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {existingSubmission.files && existingSubmission.files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Submitted Files
                  </p>
                  <div className="space-y-1">
                    {existingSubmission.files.map((file, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="w-full justify-start h-auto py-2"
                        asChild
                      >
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-2" />
                          <span className="flex-1 text-left truncate">{file.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {file.type?.toUpperCase()}
                          </Badge>
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mentor Feedback */}
              {existingSubmission.evaluationFeedback && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Evaluation Feedback</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap mt-2">
                    {existingSubmission.evaluationFeedback}
                  </AlertDescription>
                </Alert>
              )}

              {/* Revision Feedback */}
              {existingSubmission.revisionFeedback && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Revisions Required</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap mt-2">
                    {existingSubmission.revisionFeedback}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <Separator />
          </div>
        )}

        {/* Submission Form */}
        {canSubmit && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {isResubmission ? 'Resubmit Files' : 'Upload Your Files'}
                </h4>
                {isResubmission && (
                  <Badge variant="outline" className="gap-1">
                    <RefreshCw className="h-3 w-3" />
                    Resubmission
                  </Badge>
                )}
              </div>

              {files.map((file, index) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide">
                      File {index + 1}
                    </Label>
                    {files.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFileField(index)}
                        className="h-6 text-xs"
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`name-${index}`} className="text-sm">
                      File Name
                    </Label>
                    <Input
                      id={`name-${index}`}
                      placeholder="e.g., Project Abstract"
                      value={file.name}
                      onChange={(e) => handleFileChange(index, 'name', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`url-${index}`} className="text-sm">
                      Google Drive Link <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`url-${index}`}
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={file.url}
                      onChange={(e) => handleFileChange(index, 'url', e.target.value)}
                      required
                    />
                    {linkValidation[index]?.message && (
                      <p className={`text-xs flex items-center gap-1 ${
                        linkValidation[index].valid ? 'text-green-600' : 'text-destructive'
                      }`}>
                        {linkValidation[index].valid ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : (
                          <AlertCircle className="h-3 w-3" />
                        )}
                        {linkValidation[index].message}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {files.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFileField}
                  className="w-full"
                >
                  + Add Another File
                </Button>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Google Drive Sharing</AlertTitle>
                <AlertDescription className="text-xs whitespace-pre-line mt-2">
                  {getDriveSharingInstructions()}
                </AlertDescription>
              </Alert>
            </div>

            <Button 
              type="submit" 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {isResubmission ? 'Resubmit for Evaluation' : 'Submit for Evaluation'}
                </>
              )}
            </Button>
          </form>
        )}

        {/* Evaluated - No further action needed */}
        {existingSubmission && existingSubmission.evaluationStatus === 'evaluated' && (
          <Alert>
            <Award className="h-4 w-4" />
            <AlertTitle>Submission Evaluated</AlertTitle>
            <AlertDescription>
              This phase has been evaluated by your {phase.evaluatorRole}. No further action required.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
