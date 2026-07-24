import React, { useState } from 'react';
import { 
  BookOpen, ShieldWarning, UserCheck, ArrowsClockwise, Prohibit, 
  CheckSquare, WarningCircle, Question, User, Medal, 
  Clock, Lock, Lightning, Sliders, Stack, CaretRight, Pulse, HardDrives,
  Compass
} from '@phosphor-icons/react';
import { useAuth } from '../components/AuthContext';

interface Scenario {
  id: number;
  title: string;
  category: 'Policy' | 'Delegation' | 'Workflow' | 'Admin' | 'Edge Cases' | 'Navigation & UX';
  description: string;
  badge?: string;
  badgeType?: 'default' | 'amber' | 'rose' | 'green';
  rolesInvolved: string[];
  steps: string[];
  expectedOutcome: string;
  status: 'Fully Implemented' | 'Not yet implemented' | 'Blocked';
}

export const ScenarioGuide: React.FC = () => {
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const scenarios: Scenario[] = [
    {
      id: 1,
      title: "Segregation of duties",
      category: "Policy",
      description: "An Approver cannot approve their own claim to prevent conflicts of interest and maintain financial compliance.",
      rolesInvolved: ["Bob Santos (Approver)", "Ivy Senior (VP)"],
      steps: [
        "Switch to Bob Santos (bob@mgenesis.com) and go to 'New Reimbursement' to submit a claim of his own.",
        "Because claim routing always resolves to the submitter's own manager (never to the submitter), Bob's claim routes to Ivy Salazar, not to Bob himself — self-approval can't occur through normal submission.",
        "As defense-in-depth, the server also rejects any approval attempt where the acting user matches the claim's requestor, regardless of how the claim got routed to them."
      ],
      expectedOutcome: "The Approver cannot self-approve; the system enforces strict segregation of duties on the server-side.",
      status: "Fully Implemented"
    },
    {
      id: 2,
      title: "Approver can only act on direct reports",
      category: "Policy",
      description: "Strict hierarchical check: Approvers can only view and approve claims submitted by their own direct reports, unless granted delegated access.",
      rolesInvolved: ["Grace Navarro (Approver)", "Alice Reyes (Report to Bob)"],
      steps: [
        "Using the 'Preview As...' role switcher in the bottom-right corner, switch to Grace Navarro (grace@mgenesis.com).",
        "Try to view or approve a claim belonging to one of Bob's reports (like Alice Reyes's or Eve Garcia's claim).",
        "Since Grace is not in Alice's direct reporting chain and has no active delegation from Bob, the server will block any approval/rejection request with a 'Forbidden' or authorization error."
      ],
      expectedOutcome: "The request is rejected with a server-side permission error, protecting organizational data integrity.",
      status: "Fully Implemented"
    },
    {
      id: 3,
      title: "Active delegation auto-routing",
      category: "Delegation",
      description: "When an Approver establishes an active delegation window, claims filed by their reports automatically route to their designated delegate.",
      badge: "Active Delegation Seeded",
      badgeType: "green",
      rolesInvolved: ["Eve Garcia (Requestor)", "Bob Santos (Manager)", "Grace Navarro (Delegate)"],
      steps: [
        "Bob Santos has an active delegation to Grace Navarro.",
        "Using the 'Preview As...' role switcher, switch to Eve Garcia (eve@mgenesis.com) (one of Bob's reports).",
        "Navigate to 'Submit Claim', select an available Completed MOM, enter any claim detail, and submit.",
        "Open the claim detail page and look at the 'Activity Timeline'. You will see that the Current Approver is Grace Navarro instead of Bob, and the timeline shows: 'Auto-routed to delegate Grace Navarro (on behalf of Bob Santos)'."
      ],
      expectedOutcome: "The claim is instantly and dynamically routed to Grace Navarro for immediate review.",
      status: "Fully Implemented"
    },
    {
      id: 4,
      title: "Expired delegation does NOT auto-route",
      category: "Delegation",
      description: "If the delegation date window has already expired, claims route back to the original manager, preventing stale delegations.",
      badge: "Expired Delegation Seeded",
      badgeType: "default",
      rolesInvolved: ["Henry Castillo (Manager)", "Bob Santos (Stale Delegate)"],
      steps: [
        "Henry Castillo has an expired delegation to Bob (the dates in the seed data are in the past).",
        "Switch to one of Henry's reports or submit a claim directly.",
        "Verify that the claim is routed directly to Henry Castillo and does NOT auto-route to Bob, confirming that date-bound constraints are active."
      ],
      expectedOutcome: "The claim is routed to Henry Castillo, verifying the delegation expired logic.",
      status: "Fully Implemented"
    },
    {
      id: 5,
      title: "MOM reuse guard",
      category: "Policy",
      description: "Each completed Minutes of Meeting document can only be linked to a single claim to prevent double-claiming.",
      rolesInvolved: ["Any Requestor"],
      steps: [
        "Go to 'Submit Claim' as any Requestor.",
        "In the MOM dropdown, you will see completed meetings. Attempt to submit a claim using a MOM that is already linked (e.g. Globe Telecom's MOM).",
        "The server-side system validates MOM usage and rejects the request with the error: 'This Minutes of Meeting is already linked to another claim and cannot be reused.'."
      ],
      expectedOutcome: "The system rejects duplicate MOM linkage with a clear error prompt.",
      status: "Fully Implemented"
    },
    {
      id: 6,
      title: "Returned → Revise & Resubmit",
      category: "Workflow",
      description: "Returned claims can be fully modified and resubmitted, restarting the approval workflow without losing prior activity logs.",
      rolesInvolved: ["Henry Castillo (Manager)", "Requestor"],
      steps: [
        "Switch to Henry Castillo (henry@mgenesis.com).",
        "In 'Approver Inbox', find the BDO Unibank claim, which has been returned to Henry (in status 'Needs Revision').",
        "Click 'Fix & Resubmit'. In the form, edit the remarks, categories, or amounts as needed.",
        "Click 'Revise & Resubmit Claim'. The claim's status transitions back to 'Pending Approval' for review."
      ],
      expectedOutcome: "The claim resets to Pending Approval and records the revision in the history timeline.",
      status: "Fully Implemented"
    },
    {
      id: 7,
      title: "Rejected is terminal",
      category: "Workflow",
      description: "Once a claim is explicitly rejected, it becomes terminal and cannot be modified, resubmitted, or advanced.",
      rolesInvolved: ["Alice Reyes (Requestor)", "Bob Santos (Manager)"],
      steps: [
        "Find the Meralco claim (originally submitted by Alice and rejected by Bob).",
        "Click to view the claim details. Notice that all interactive action buttons (like Revise, Reassign, Approve, or Process) are hidden.",
        "This terminal state is preserved across all roles to ensure records cannot be tampered with once finalized."
      ],
      expectedOutcome: "No further state transitions are possible for rejected claims.",
      status: "Fully Implemented"
    },
    {
      id: 8,
      title: "Bulk approve/reject",
      category: "Workflow",
      description: "Allows high-volume approvers to process multiple claims simultaneously in a single transaction from their Inbox.",
      rolesInvolved: ["Bob Santos (Approver)"],
      steps: [
        "Switch to Bob Santos (bob@mgenesis.com) and go to 'Approver Inbox'.",
        "In the 'Action Items' table, select the checkboxes next to multiple claims.",
        "Choose 'Bulk Actions' above the table, insert a comment (e.g. 'Bulk Approved'), and select 'Bulk Approve' or 'Bulk Reject'.",
        "All selected claims will be updated together in the database, with email notifications dispatched to all requestors."
      ],
      expectedOutcome: "Batch-updates multiple claims instantly, sending out corresponding mock emails.",
      status: "Fully Implemented"
    },
    {
      id: 9,
      title: "Admin reassignment",
      category: "Admin",
      description: "System administrators can manually override any claim's current approver to resolve organizational blockers.",
      rolesInvolved: ["Dave Lopez (Admin)"],
      steps: [
        "Switch to Dave Lopez (dave@mgenesis.com) using the role switcher.",
        "Navigate to the 'Audit Log' page to view the list of system events.",
        "Click any highlighted claim number link (e.g., REIM-XXXXXX) to navigate to its Claim Detail page.",
        "In the Admin Reassignment panel at the top of the detail view, select a new approver (e.g., Ivy Salazar), input a reassignment reason, and click 'Confirm Reassignment'.",
        "Verify that the claim is immediately reassigned to the new approver, and that the change is logged in both the activity timeline and the audit log."
      ],
      expectedOutcome: "The claim is instantly reassigned to the new approver, bypassing standard hierarchy, and logging the manual override in the audit trail.",
      status: "Fully Implemented"
    },
    {
      id: 10,
      title: "3-tier approval chain",
      category: "Workflow",
      description: "Supports multi-level routing, ensuring hierarchical progression from Mid-Level Approvers up to Executive VPs.",
      rolesInvolved: ["Jack Herrera (Manager)", "Ivy Salazar (VP)"],
      steps: [
        "Jack is a Mid-Level Approver who reports to Ivy.",
        "Switch to Jack (jack@mgenesis.com) and submit a new reimbursement claim.",
        "The system identifies Jack's supervisor and automatically routes the claim to Ivy Salazar.",
        "Check the seeded 'Ayala Land Inc' claim which was filed by Jack to view this routing in action."
      ],
      expectedOutcome: "The claim routes automatically to Ivy Salazar for final executive sign-off.",
      status: "Fully Implemented"
    },
    {
      id: 11,
      title: "Amount boundary cases",
      category: "Edge Cases",
      description: "Validation limits: confirms support for micro-transactions (₱0.01) and policy flags for high-value claims (₱15,000+).",
      rolesInvolved: ["Any User"],
      steps: [
        "Locate the Cebu Pacific Air claim in the database, which is seeded at ₱0.01. This demonstrates floating-point precision support.",
        "Locate the Robinsons Land Corp claim, which is seeded at ₱185,000. It is fully submitted and pending review, showing no hard upper block.",
        "Any claim containing a line item exceeding ₱15,000 gets flagged on creation with 'flagged_high_value: true', adding a visual high-value badge for the Approver."
      ],
      expectedOutcome: "Both edge cases are handled elegantly, proving exact monetary calculations.",
      status: "Fully Implemented"
    },
    {
      id: 12,
      title: "Duplicate expense warning",
      category: "Edge Cases",
      description: "Real-time client-side cross-referencing alerts the Requestor if a new expense duplicates a previous claim's category and amount.",
      rolesInvolved: ["Alice Reyes (Requestor)"],
      steps: [
        "Switch to Alice Reyes (alice@mgenesis.com).",
        "Navigate to the 'Submit Claim' page.",
        "Click the brand-new, amber 'Simulate Duplicate Expense' button next to Quick-fill.",
        "This automatically populates a line item with Category = 'Client Meals' and Amount = '1500.00', which matches Alice's pre-existing seeded claim.",
        "An amber notice instantly warns: 'A previous claim has the exact same category and amount. Ensure this is not a duplicate.'"
      ],
      expectedOutcome: "The duplicate alert renders dynamically on screen in real-time.",
      status: "Fully Implemented"
    },
    {
      id: 13,
      title: "Global search and role-scoping",
      category: "Navigation & UX",
      description: "Verifies searching via the global search bar returns correctly scoped and accessible results based on the logged-in user's role.",
      rolesInvolved: ["Alice Reyes (Requestor)", "Dave Lopez (Admin)"],
      steps: [
        "Logged in as Alice Reyes (alice@mgenesis.com), use the global search bar at the top to search for claims (by reference, claimant, purpose, or amount). Verify only Alice's own requests are listed.",
        "Click a search result and verify it successfully navigates to Alice's claim detail page.",
        "Switch to Dave Lopez (dave@mgenesis.com) and search for the exact same query in the global search bar.",
        "Verify that Dave can search and find all claims across the entire organization, and clicking any result navigates to its details."
      ],
      expectedOutcome: "Search results are correctly filtered and scoped to the active user's permissions, with seamless navigation to detail pages.",
      status: "Fully Implemented"
    },
    {
      id: 14,
      title: "Role-based navigation hierarchy",
      category: "Navigation & UX",
      description: "Verifies that navigation links and their category section headers are conditionally rendered based on the user's role.",
      rolesInvolved: ["Alice Reyes (Requestor)", "Carol Ramos (Custodian)", "Dave Lopez (Admin)"],
      steps: [
        "Logged in as Alice Reyes, verify the sidebar only displays permitted links (Dashboard, Submit Claim, Calendar, MOM, etc.) under relevant headers.",
        "Switch to Carol Ramos and verify her sidebar displays custodian-specific links like 'Processing Queue'.",
        "Switch to Dave Lopez and verify that his sidebar displays admin-only links like 'Audit Log'.",
        "Confirm that group section headers (e.g., PRIMARY, PLANNING, SYSTEM) are dynamically hidden when the active role has no visible items in that group."
      ],
      expectedOutcome: "Each role is presented with a tailored sidebar navigation matching their permissions, with empty sections automatically hidden.",
      status: "Fully Implemented"
    },
    {
      id: 15,
      title: "Approval Delegation vs. Data Management naming",
      category: "Navigation & UX",
      description: "Verifies that the former 'Settings' navigation item, page title, and breadcrumbs dynamically adapt their labels and controls depending on the active user's role.",
      rolesInvolved: ["Bob Santos (Approver)", "Dave Lopez (Admin)"],
      steps: [
        "Switch to Bob Santos (bob@mgenesis.com) and verify the lower navigation menu link is labeled 'Approval Delegation' with a user-switching icon.",
        "Click the link and verify that the page header, breadcrumbs, and content render as 'Approval Delegation' with delegation and date-range controls.",
        "Switch to Dave Lopez (dave@mgenesis.com) and observe the same navigation item is now labeled 'Data Management' with a database icon.",
        "Click the link and verify the header, breadcrumbs, and content render as 'Data Management' with database seed and reset controls."
      ],
      expectedOutcome: "The settings navigation item, page headers, and breadcrumbs dynamically adapt to the user's role, providing an intuitive experience.",
      status: "Fully Implemented"
    },
    {
      id: 16,
      title: "Responsive UX: Mobile drawers and tables",
      category: "Navigation & UX",
      description: "Verifies the application adapts fluidly to mobile viewport widths, switching to layout patterns optimized for smaller screens.",
      rolesInvolved: ["Any User"],
      steps: [
        "Resize the browser window below the mobile breakpoint (768px) or use a mobile device simulator.",
        "Verify that the sidebar collapses into an off-canvas drawer that opens via a hamburger menu button and includes a shaded overlay backdrop.",
        "Verify that the global search bar collapses into an icon-triggered overlay to conserve header space.",
        "Verify that tabular data (e.g., claim lists) seamlessly transforms into stacked responsive card layouts rather than introducing horizontal scrolling."
      ],
      expectedOutcome: "The interface gracefully restructures with slide-out drawers, overlay search, and responsive cards for optimal touch-screen usability.",
      status: "Fully Implemented"
    }
  ];

  const categories = ['All', 'Policy', 'Delegation', 'Workflow', 'Admin', 'Edge Cases', 'Navigation & UX'];

  const filteredScenarios = selectedCategory === 'All' 
    ? scenarios 
    : scenarios.filter(s => s.category === selectedCategory);

  const getStatusBadge = (status: Scenario['status'], badge?: string, type?: Scenario['badgeType']) => {
    if (status === 'Blocked') {
      return (
        <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          {badge || "Blocked"}
        </span>
      );
    }
    if (status === 'Not yet implemented') {
      return (
        <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-gray-100 text-gray-500 border border-gray-200">
          Not yet implemented
        </span>
      );
    }
    
    if (badge) {
      const bgColors = {
        default: 'bg-slate-100 text-slate-700 border-slate-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200',
        green: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
      return (
        <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full border ${bgColors[type || 'default']}`}>
          {badge}
        </span>
      );
    }

    return (
      <span className="px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
        Active & Verified
      </span>
    );
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Policy': return <ShieldWarning className="w-4 h-4 text-rose-500" />;
      case 'Delegation': return <Stack className="w-4 h-4 text-purple-500" />;
      case 'Workflow': return <Lightning className="w-4 h-4 text-amber-500" />;
      case 'Admin': return <Sliders className="w-4 h-4 text-slate-500" />;
      case 'Edge Cases': return <Pulse className="w-4 h-4 text-emerald-500" />;
      case 'Navigation & UX': return <Compass className="w-4 h-4 text-teal-500" />;
      default: return <BookOpen className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight font-display flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand" /> Demo Scenario Guide
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            A comprehensive, interactive playbook showing how the system's business rules and edge-case behaviors are enforced server-side.
          </p>
        </div>
        <div className="bg-brand bg-opacity-5 border border-brand border-opacity-10 rounded px-4 py-2 flex items-center gap-2.5">
          <HardDrives className="w-4 h-4 text-brand shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-gray-700">Sandbox Environment:</span> Active. Use the <span className="font-semibold text-brand">Preview As…</span> switcher to toggle users instantly.
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 text-xs font-bold border-b-2 -mb-px transition-colors ${
              selectedCategory === cat 
                ? 'border-brand text-brand' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid List of Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredScenarios.map(scenario => (
          <div 
            key={scenario.id} 
            className="corp-card p-5 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Card Top Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(scenario.category)}
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{scenario.category}</span>
                </div>
                {getStatusBadge(scenario.status, scenario.badge, scenario.badgeType)}
              </div>

              {/* Title & Description */}
              <h3 className="text-base font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                {scenario.title}
              </h3>
              <p className="text-xs text-gray-600 mb-4 leading-relaxed">
                {scenario.description}
              </p>

              {/* Roles Involved */}
              <div className="mb-4 bg-gray-50 rounded p-2.5 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Key Users / Actors:</span>
                <div className="flex flex-wrap gap-1.5">
                  {scenario.rolesInvolved.map((role, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-white text-gray-700 border border-gray-200 rounded px-2 py-0.5 text-[11px] font-medium">
                      <User className="w-2.5 h-2.5 text-gray-400" /> {role}
                    </span>
                  ))}
                </div>
              </div>

              {/* Steps to Reproduce */}
              <div className="space-y-2 mb-4">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">How to verify / test:</span>
                <ol className="list-decimal pl-4 space-y-1.5 text-xs text-gray-700 leading-relaxed">
                  {scenario.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Expected Result */}
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-700">
              <Medal className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-gray-900">Expected System Outcome:</span> {scenario.expectedOutcome}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
