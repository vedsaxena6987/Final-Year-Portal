// src/components/dashboard/shared/RevisionHistory.jsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  History,
  FileText,
  MessageSquare,
  CheckCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function RevisionHistory({
  teamId,
  projectNumber,
  mentorView = false,
}) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedVersions, setExpandedVersions] = useState(new Set([0])); // Expand latest by default

  useEffect(() => {
    if (!teamId && !projectNumber) return;

    let revisionsQuery;

    if (teamId) {
      revisionsQuery = query(
        collection(db, "revision_history"),
        where("teamId", "==", teamId),
        orderBy("version", "desc"),
        orderBy("createdAt", "desc")
      );
    } else if (projectNumber) {
      revisionsQuery = query(
        collection(db, "revision_history"),
        where("projectNumber", "==", projectNumber),
        orderBy("version", "desc"),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(revisionsQuery, (snapshot) => {
      const revisionsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));

      setRevisions(revisionsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teamId, projectNumber]);

  const toggleVersion = (version) => {
    setExpandedVersions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(version)) {
        newSet.delete(version);
      } else {
        newSet.add(version);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status, feedbackType) => {
    const configs = {
      submitted: {
        color: "bg-blue-100 text-blue-700 border-blue-200",
        icon: FileText,
        label: "Initial Submission",
      },
      revision_requested: {
        color: "bg-orange-100 text-orange-700 border-orange-200",
        icon: MessageSquare,
        label: "Revision Requested",
      },
      resubmitted: {
        color: "bg-purple-100 text-purple-700 border-purple-200",
        icon: ArrowRight,
        label: "Resubmitted",
      },
      approved: {
        color: "bg-green-100 text-green-700 border-green-200",
        icon: CheckCircle,
        label: "Approved",
      },
    };

    const config = configs[status] || configs.submitted;
    const Icon = config.icon;

    return (
      <Badge
        className={`flex items-center gap-1.5 px-2.5 py-1 ${config.color}`}
      >
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 animate-pulse" />
            Loading Revision History...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (revisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Revision History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No revision history yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-purple-600" />
            Revision History
            <Badge variant="outline" className="ml-2">
              {revisions.length}{" "}
              {revisions.length === 1 ? "Version" : "Versions"}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {revisions.map((revision, index) => {
            const isExpanded = expandedVersions.has(revision.version);
            const isLatest = index === 0;

            return (
              <div
                key={revision.id}
                className={`border rounded-lg ${
                  isLatest
                    ? "border-purple-300 bg-purple-50/30"
                    : "border-gray-200"
                }`}
              >
                {/* Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleVersion(revision.version)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">
                          Version {revision.version}
                          {isLatest && (
                            <span className="ml-2 text-xs font-normal text-purple-600">
                              (Latest)
                            </span>
                          )}
                        </h3>
                        {getStatusBadge(revision.status, revision.feedbackType)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(revision.createdAt, {
                            addSuffix: true,
                          })}
                        </div>
                        {revision.mentorName && (
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Mentor:</span>
                            {revision.mentorName}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="ml-2">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expandable Content */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-4">
                      {/* Project Title */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          Project Title
                        </h4>
                        <p className="text-gray-700 bg-white rounded p-3 border">
                          {revision.projectTitle}
                        </p>
                      </div>

                      {/* Project Abstract */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">
                          Project Abstract
                        </h4>
                        <ScrollArea className="h-32 w-full border rounded p-3 bg-white">
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {revision.projectAbstract}
                          </p>
                        </ScrollArea>
                      </div>

                      {/* Show changes from previous version */}
                      {revision.previousTitle && revision.previousAbstract && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                            <ArrowRight className="h-4 w-4" />
                            Changes from Previous Version
                          </h4>
                          {revision.previousTitle !== revision.projectTitle && (
                            <div className="mb-2">
                              <p className="text-xs text-amber-700 font-medium">
                                Title Changed:
                              </p>
                              <p className="text-sm text-amber-800 line-through">
                                {revision.previousTitle}
                              </p>
                              <p className="text-sm text-green-800 font-medium">
                                → {revision.projectTitle}
                              </p>
                            </div>
                          )}
                          {revision.previousAbstract !==
                            revision.projectAbstract && (
                            <p className="text-xs text-amber-700">
                              Abstract was revised
                            </p>
                          )}
                        </div>
                      )}

                      {/* Mentor Feedback */}
                      {revision.mentorFeedback && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Mentor's Feedback
                          </h4>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {revision.mentorFeedback}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for dialogs/modals
export function RevisionHistoryDialog({
  teamId,
  projectNumber,
  triggerText = "View History",
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Complete Revision History
          </DialogTitle>
          <DialogDescription>
            View all versions, feedback, and changes made to this team&apos;s
            project over time.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <RevisionHistory teamId={teamId} projectNumber={projectNumber} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
