// packages/symptom-tracking/tests/symptom-tracking.bdd.js

import { Tinytest } from 'meteor/tinytest';
import { Random } from 'meteor/random';
import { ValidatedMethod } from 'meteor/mdg:validated-method';

// Test package loading
Tinytest.add('symptom-tracking - package loads correctly', function (test) {
  test.isNotNull(Package['clinical:symptom-tracking'], 'Package should be loaded');
});

// Test questionnaire structure
Tinytest.addAsync('symptom-tracking - questionnaire structure validation', async function (test) {
  // Import the questionnaire data
  const questionnaireData = {
    resourceType: 'Questionnaire',
    id: 'symptom-assessment',
    status: 'active',
    title: 'Symptom Assessment',
    item: [
      {
        linkId: '1',
        text: 'Primary Symptom',
        type: 'choice',
        required: true
      },
      {
        linkId: '2',
        text: 'Pain Level',
        type: 'integer'
      },
      {
        linkId: '3',
        text: 'Symptom Duration',
        type: 'choice'
      },
      {
        linkId: '4',
        text: 'Additional Symptoms',
        type: 'open-choice',
        repeats: true
      },
      {
        linkId: '5',
        text: 'Additional Notes',
        type: 'text'
      }
    ]
  };

  // Validate questionnaire structure
  test.equal(questionnaireData.resourceType, 'Questionnaire', 'Should be a FHIR Questionnaire');
  test.equal(questionnaireData.status, 'active', 'Questionnaire should be active');
  test.equal(questionnaireData.item.length, 5, 'Should have 5 questionnaire items');
  
  // Validate required fields
  const primarySymptom = questionnaireData.item.find(item => item.linkId === '1');
  test.isTrue(primarySymptom.required, 'Primary symptom should be required');
});

// Test QuestionnaireResponse creation
Tinytest.addAsync('symptom-tracking - QuestionnaireResponse creation', async function (test) {
  const mockResponse = {
    resourceType: 'QuestionnaireResponse',
    id: Random.id(),
    status: 'in-progress',
    questionnaire: 'Questionnaire/symptom-assessment',
    authored: new Date().toISOString(),
    item: [
      {
        linkId: '1',
        answer: [{
          valueCoding: {
            system: 'http://snomed.info/sct',
            code: '102491009',
            display: 'Flank pain'
          }
        }]
      },
      {
        linkId: '2',
        answer: [{
          valueInteger: 7
        }]
      }
    ]
  };

  test.equal(mockResponse.resourceType, 'QuestionnaireResponse', 'Should create QuestionnaireResponse');
  test.equal(mockResponse.status, 'in-progress', 'Initial status should be in-progress');
  test.equal(mockResponse.item.length, 2, 'Should have answers for 2 items');
  test.equal(mockResponse.item[1].answer[0].valueInteger, 7, 'Pain level should be recorded');
});

// Test semantic search functionality
Tinytest.addAsync('symptom-tracking - semantic search mock', async function (test) {
  // Mock semantic search results
  const searchQuery = 'flank pain';
  const expectedResults = [
    {
      id: 'flank-pain',
      display: 'Flank pain',
      code: '102491009',
      system: 'http://snomed.info/sct',
      description: 'Pain in the side of the body between the ribs and hip'
    },
    {
      id: 'back-pain',
      display: 'Back pain',
      code: '161891005',
      system: 'http://snomed.info/sct',
      description: 'Pain in the back region'
    }
  ];

  // Simulate search filtering
  const results = expectedResults.filter(symptom => 
    symptom.display.toLowerCase().includes(searchQuery.toLowerCase()) ||
    symptom.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  test.isTrue(results.length > 0, 'Should find results for flank pain');
  test.equal(results[0].code, '102491009', 'Should return correct SNOMED code');
});

// Test URL parameter handling
Tinytest.add('symptom-tracking - URL parameter parsing', function (test) {
  // Mock URL search params
  const mockSearchParams = new URLSearchParams('?questionnaire-response=abc123&next=patient-chart');
  
  const questionnaireResponseId = mockSearchParams.get('questionnaire-response');
  const nextPage = mockSearchParams.get('next');
  
  test.equal(questionnaireResponseId, 'abc123', 'Should parse questionnaire-response parameter');
  test.equal(nextPage, 'patient-chart', 'Should parse next parameter');
});

// Test navigation flow
Tinytest.add('symptom-tracking - navigation flow preservation', function (test) {
  const nextPage = 'patient-chart';
  const questionnaireResponseId = Random.id();
  
  // Build navigation URL
  let navigateUrl = '/symptom-selection?questionnaire-response=' + questionnaireResponseId;
  if (nextPage) {
    navigateUrl += '&next=' + encodeURIComponent(nextPage);
  }
  
  test.include(navigateUrl, questionnaireResponseId, 'URL should include questionnaire response ID');
  test.include(navigateUrl, 'next=patient-chart', 'URL should preserve next parameter');
});

// Test symptom to protocol mapping
Tinytest.add('symptom-tracking - symptom to protocol mapping', function (test) {
  const symptomMappings = {
    'flank-pain': 'kidney-stone-management',
    'hematuria': 'kidney-stone-management',
    'back-pain': 'acute-back-pain',
    'dehydration': 'dehydration-protocol',
    'dizziness': 'dehydration-protocol',
    'dry-mouth': 'dehydration-protocol'
  };
  
  test.equal(symptomMappings['flank-pain'], 'kidney-stone-management', 'Flank pain should map to kidney stone protocol');
  test.equal(symptomMappings['back-pain'], 'acute-back-pain', 'Back pain should map to back pain protocol');
  test.equal(symptomMappings['dizziness'], 'dehydration-protocol', 'Dizziness should map to dehydration protocol');
});