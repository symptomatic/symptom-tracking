// packages/symptom-tracking/index.jsx

import React from 'react';

// Import pages
import { IssueReportPage } from './client/pages/IssueReportPage';
import { SymptomSelectionPage } from './client/pages/SymptomSelectionPage';
import { BackTrackerPage } from './client/pages/BackTrackerPage';
import { SmokingStatusPage } from './client/pages/SmokingStatusPage';

// Import reusable components
import { SymptomSelector } from './client/components/SymptomSelector';
import { IssueReportInput } from './client/components/IssueReportInput';
import SymptomsTabContent from './client/SymptomsTabContent';

// Import icons
import { 
  MedicalServices as MedicalIcon,
  Psychology as SymptomIcon,
  CalendarMonth as CalendarIcon
} from '@mui/icons-material';

//====================================================================================
// Dynamic Routes for React Router

let DynamicRoutes = [
  {
    name: 'IssueReport',
    path: '/issue-report',
    element: <IssueReportPage />,
    requireAuth: true
  },
  {
    name: 'SymptomSelection', 
    path: '/symptom-selection',
    element: <SymptomSelectionPage />,
    requireAuth: true
  },
  {
    name: 'SymptomBackTracker',
    path: '/symptom-back-tracker',
    element: <BackTrackerPage />,
    requireAuth: true
  },
  {
    name: 'SmokingStatus',
    path: '/smoking-status',
    element: <SmokingStatusPage />,
    requireAuth: true
  }
];

//====================================================================================
// Sidebar Navigation Items

let SidebarWorkflows = [
  {
    primaryText: 'Report Medical Issue',
    to: '/issue-report',
    iconName: 'medical_services',
    requireAuth: true
  },
  {
    primaryText: 'Symptom Backtracker',
    to: '/symptom-back-tracker',
    iconName: 'notepad',
    requireAuth: true
  },
  {
    primaryText: 'Smoking Status',
    to: '/smoking-status',
    iconName: 'smoking_rooms',
    requireAuth: true
  }
];

//====================================================================================
// Footer Buttons for contextual actions

let FooterButtons = [
  {
    pathname: '/issue-report',
    component: function IssueReportFooter(props) {
      return null; // No special footer for this page
    }
  }
];

//====================================================================================
// Export all package APIs

export {
  DynamicRoutes,
  SidebarWorkflows,
  FooterButtons,
  IssueReportPage,
  SymptomSelectionPage,
  BackTrackerPage,
  SmokingStatusPage,
  SymptomSelector,
  IssueReportInput,
  SymptomsTabContent
};

// Also attach to Package for Meteor's package system
if (typeof Package !== 'undefined') {
  Package['symptomatic:symptom-tracking'] = {
    DynamicRoutes,
    SidebarWorkflows,
    FooterButtons,
    SymptomsTabContent
  };
}