# Symptom Tracking Package

A FHIR-compliant symptom tracking and assessment module for the Honeycomb healthcare platform.

## Overview

This package provides comprehensive symptom tracking capabilities including:
- Patient symptom selection and reporting
- Back pain tracking with anatomical visualization
- Semantic search for symptom-to-condition matching
- FHIR Questionnaire-based assessments
- Issue reporting workflow

## Features

### Symptom Selection
- Interactive symptom selector component
- Semantic search integration for finding related symptoms
- Support for multiple symptom categories

### Back Pain Tracking
- Visual anatomical representation
- Location-specific pain reporting
- Severity and duration tracking

### Issue Reporting
- Structured issue report forms
- Integration with FHIR Condition resources
- Clinical terminology support

## Components

- **SymptomSelector** - Main symptom selection interface
- **IssueReportInput** - Structured issue reporting form
- **BackTrackerPage** - Specialized back pain tracking interface
- **SymptomSelectionPage** - Full symptom assessment workflow
- **IssueReportPage** - Issue documentation and submission

## FHIR Resources

This package works with the following FHIR resources:
- Questionnaire (symptom assessments)
- QuestionnaireResponse (patient responses)
- Condition (diagnosed conditions)
- Observation (symptom observations)

## Installation

Add to your Meteor application:

```bash
meteor add symptom-tracking
```

## Configuration

Configure in your settings file:

```json
{
  "public": {
    "enableSymptomTracking": true,
    "semanticSearch": {
      "enabled": true,
      "endpoint": "your-semantic-search-endpoint"
    }
  }
}
```

## Usage

Import and use in your React components:

```javascript
import { SymptomSelectionPage } from 'meteor/symptom-tracking';

// In your router
<Route path="/symptoms" element={<SymptomSelectionPage />} />
```

## API Methods

### Server Methods
- `performSemanticSearch` - Search for symptoms using semantic matching
- `saveSymptomReport` - Save patient symptom assessment
- `getConditionMatches` - Find potential conditions based on symptoms

## Testing

Run package tests:

```bash
meteor test-packages symptom-tracking
```

## Dependencies

- FHIR R4 resources
- React 18+
- Material-UI v5
- Meteor 3.0+

## License

See LICENSE.MD for details.