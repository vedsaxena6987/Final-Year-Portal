// src/components/dashboard/faculty/FacultyHelp.jsx - Premium Help Center
"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "@/context/SessionContext";
import {
  HelpCircle,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  Upload,
  CheckCircle2,
  AlertCircle,
  Mail,
  ChevronRight,
  Lightbulb,
  BookOpen,
  Shield,
} from "lucide-react";

export default function FacultyHelp() {
  const { activeSession } = useSession();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="card-faculty-elevated p-6">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-500 p-3 rounded-2xl text-white shadow-md">
            <HelpCircle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Faculty Help Center
            </h1>
            <p className="text-sm text-gray-500">
              Quick guides and answers to common questions
            </p>
          </div>
        </div>
      </div>

      {/* Project Workflow Overview */}
      <div className="card-faculty-elevated overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-violet-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            CSE Final Year Project Workflow
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {/* Your Roles */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-semibold text-gray-900 mb-2">
              Your Dual Role as Faculty:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <p className="font-bold text-blue-900">🎓 As Mentor</p>
                <p className="text-gray-600 mt-1">
                  Guide your mentored teams, approve abstracts, conduct mentor
                  phase evaluations, and schedule progress meetings.
                </p>
              </div>
              <div className="p-2 bg-violet-50 rounded border border-violet-200">
                <p className="font-bold text-violet-900">👥 As Panelist</p>
                <p className="text-gray-600 mt-1">
                  Evaluate teams assigned to your panel during panel phases.
                  Each team member is graded individually.
                </p>
              </div>
            </div>
          </div>

          {/* Semester Timeline */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">
              Evaluation Timeline:
            </p>
            <div className="p-3 bg-violet-50 rounded-lg border border-violet-200">
              <p className="text-xs font-bold text-violet-900 mb-2">
                7th Semester (3 Phases)
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                  1. Mentor Phase
                </span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-violet-100 text-violet-800 rounded">
                  2. Panel Phase
                </span>
                <span className="text-gray-400">→</span>
                <span className="px-2 py-1 bg-violet-100 text-violet-800 rounded">
                  2. Panel Phase
                </span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <p className="text-xs font-bold text-emerald-900 mb-2">
                8th Semester (2 Phases)
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 bg-violet-100 text-violet-800 rounded">
                  1. Panel Phase
                </span>
                <span className=" text-gray-400">→</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                  2. External Phase
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="card-faculty-elevated overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-emerald-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-teal-600" />
            Quick Start Guide
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {[
            {
              step: 1,
              title: "Review Mentorship Requests",
              desc: 'Check the "Requests" tab for pending mentorship requests. Approve abstracts before teams can proceed.',
            },
            {
              step: 2,
              title: "Manage Your Mentored Teams",
              desc: "Track progress, schedule meetings, and conduct mentor phase evaluations for your teams.",
            },
            {
              step: 3,
              title: "Panel Evaluations",
              desc: "During panel phases, evaluate ALL teams assigned to your panel. Each panelist must evaluate for completion.",
            },
            {
              step: 4,
              title: "Grade Individually",
              desc: "Remember: Each team member receives individual marks, not team marks. Mark absent if student doesn't appear.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 animate-fade-in-up"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-sm">
                {item.step}
              </div>
              <div className="flex-1 pt-1">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            icon: MessageSquare,
            title: "Mentorship Requests",
            color: "blue",
            items: [
              {
                q: "How to accept requests?",
                a: 'Click on a pending request, review the project details, and click "Accept" to become their mentor.',
              },
              {
                q: "Can I decline requests?",
                a: "Yes, you can decline requests if you're at capacity or the project isn't in your expertise area.",
              },
            ],
          },
          {
            icon: Users,
            title: "Team Management",
            color: "violet",
            items: [
              {
                q: "How to track team progress?",
                a: 'Go to "Teams" tab and click on any team to see their submissions, grades, and meeting history.',
              },
              {
                q: "Mentored vs Panel teams?",
                a: "Mentored teams are under your guidance. Panel teams are assigned to you for evaluation only.",
              },
            ],
          },
          {
            icon: Upload,
            title: "Panel Evaluations",
            color: "emerald",
            items: [
              {
                q: "Where to evaluate?",
                a: 'Go to "Phases" tab, select a panel phase, and evaluate all teams assigned to your panel.',
              },
              {
                q: "All panelists required?",
                a: "Yes! Every panelist must evaluate each team. Students track which panelists have evaluated them.",
              },
              {
                q: "Conflict of interest?",
                a: "You cannot evaluate teams you mentor - they're automatically assigned to different panels.",
              },
              {
                q: "Marking absent?",
                a: "If a student doesn't appear, mark them absent. They must contact you for re-evaluation.",
              },
            ],
          },
          {
            icon: Calendar,
            title: "Meetings & Communication",
            color: "amber",
            items: [
              {
                q: "How to schedule meetings?",
                a: 'Go to "Teams" tab, select a team, and click "Schedule Meeting" to set up meetings.',
              },
              {
                q: "Meeting notifications?",
                a: "Teams receive automatic notifications and meeting links when you schedule a meeting.",
              },
            ],
          },
        ].map((feature, idx) => {
          const Icon = feature.icon;
          const colorClasses = {
            blue: "text-blue-600 bg-blue-50",
            violet: "text-violet-600 bg-violet-50",
            emerald: "text-emerald-600 bg-emerald-50",
            amber: "text-amber-600 bg-amber-50",
          };

          return (
            <div key={idx} className="card-faculty p-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`p-2.5 rounded-xl ${colorClasses[feature.color]}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
              </div>
              <div className="space-y-3">
                {feature.items.map((item, i) => (
                  <div key={i}>
                    <p className="font-medium text-gray-800 text-sm">
                      {item.q}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Contact & System Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-faculty p-4 bg-gradient-to-br from-teal-50 to-emerald-50 border-teal-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-teal-100 text-teal-600 p-2.5 rounded-xl">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-gray-900">Contact Support</h3>
          </div>
          <p className="text-sm text-gray-600">
            Need technical assistance or have questions about the portal? Use the contact links in the footer below to reach the development team.
          </p>
        </div>
      </div>
    </div>
  );
}
