// npmPackages/symptom-tracking/client.js
//
// Client entry — symptom/issue/smoking-status routes, sidebar, embeddable tab
// content, and reusable inputs. Migrated from packages/symptom-tracking
// (Atmosphere symptomatic:symptom-tracking) 2026-06-12.

import React from 'react';

import { IssueReportPage } from './client/pages/IssueReportPage.jsx';
import { SymptomSelectionPage } from './client/pages/SymptomSelectionPage.jsx';
import { BackTrackerPage } from './client/pages/BackTrackerPage.jsx';
import { SmokingStatusPage } from './client/pages/SmokingStatusPage.jsx';
import { SymptomSelector } from './client/components/SymptomSelector.jsx';
import { IssueReportInput } from './client/components/IssueReportInput.jsx';
import SymptomsTabContent from './client/SymptomsTabContent.jsx';
import workflowConfig from './workflow.json';

// =============================================================================
// DYNAMIC ROUTES — component name → element

const DynamicRoutes = workflowConfig.routes.map(function(route) {
  let element = null;
  switch (route.component) {
    case 'IssueReportPage':      element = <IssueReportPage />; break;
    case 'SymptomSelectionPage': element = <SymptomSelectionPage />; break;
    case 'BackTrackerPage':      element = <BackTrackerPage />; break;
    case 'SmokingStatusPage':    element = <SmokingStatusPage />; break;
    default:
      console.warn('[symptom-tracking] Unknown component in workflow.json: ' + route.component);
  }
  return {
    name: route.name,
    path: route.path,
    element: element,
    requireAuth: route.requireAuth || false
  };
});

// =============================================================================
// SIDEBAR WORKFLOWS — iconNames corrected to PascalCase MUI
// (medical_services→MedicalServices, notepad→EventNote, smoking_rooms→SmokingRooms)

const SidebarWorkflows = workflowConfig.sidebarItems.map(function(item) {
  return { primaryText: item.primaryText, to: item.to, iconName: item.iconName, requireAuth: item.requireAuth || false };
});

// =============================================================================
// FOOTER BUTTONS — the Atmosphere package registered a single no-op footer
// (a component returning null on /issue-report); equivalent to none.

const FooterButtons = [];

// =============================================================================
// EXPORTS — pages, reusable inputs, and embeddable tab content preserved

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

export default {
  name: workflowConfig.name,
  routes: DynamicRoutes,
  sidebarItems: SidebarWorkflows,
  footerButtons: FooterButtons
};
