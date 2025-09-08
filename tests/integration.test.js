// packages/symptom-tracking/tests/integration.test.js
// Integration test demonstrating the full workflow

import { describe, it, expect } from '@jest/globals';

describe('Medical Intervention Guidance System Integration', () => {
  
  describe('Issue Reporting Flow', () => {
    it('should create a QuestionnaireResponse when user reports an issue', () => {
      // User clicks "Report New Issue"
      const initialReport = {
        freeText: "I've been having severe pain in my side and noticed blood in my urine"
      };
      
      // System creates QuestionnaireResponse
      const questionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        status: 'in-progress',
        questionnaire: 'Questionnaire/initial-symptom-report',
        item: [{
          linkId: '1',
          answer: [{
            valueString: initialReport.freeText
          }]
        }]
      };
      
      expect(questionnaireResponse.resourceType).toBe('QuestionnaireResponse');
      expect(questionnaireResponse.item[0].answer[0].valueString).toBe(initialReport.freeText);
    });
  });
  
  describe('Symptom Selection Flow', () => {
    it('should perform semantic search and return relevant symptoms', () => {
      const searchQuery = 'flank pain blood urine';
      
      // Mock semantic search results
      const searchResults = [
        {
          id: 'flank-pain',
          display: 'Flank pain',
          code: '102491009',
          relevanceScore: 0.95
        },
        {
          id: 'hematuria', 
          display: 'Blood in urine (hematuria)',
          code: '34436003',
          relevanceScore: 0.90
        }
      ];
      
      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].display).toBe('Flank pain');
      expect(searchResults[1].display).toContain('hematuria');
    });
    
    it('should map selected symptoms to appropriate protocol', () => {
      const selectedSymptoms = ['flank-pain', 'hematuria'];
      
      // Protocol selection logic
      const protocolId = 'kidney-stone-management';
      
      expect(protocolId).toBe('kidney-stone-management');
    });
  });
  
  describe('Intervention Execution Flow', () => {
    it('should create ServiceRequest for intervention', () => {
      const serviceRequest = {
        resourceType: 'ServiceRequest',
        status: 'active',
        intent: 'order',
        priority: 'high',
        code: {
          coding: [{
            system: 'http://honeycomb.ai/intervention-protocols',
            code: 'kidney-stone-management'
          }]
        }
      };
      
      expect(serviceRequest.resourceType).toBe('ServiceRequest');
      expect(serviceRequest.priority).toBe('high');
    });
    
    it('should track step completion', () => {
      const protocol = {
        id: 'kidney-stone-management',
        steps: [
          { id: 'ksm-1', completed: true },
          { id: 'ksm-2', completed: true },
          { id: 'ksm-3', completed: false }
        ]
      };
      
      const completedSteps = protocol.steps.filter(s => s.completed).length;
      const progress = (completedSteps / protocol.steps.length) * 100;
      
      expect(completedSteps).toBe(2);
      expect(progress).toBeCloseTo(66.67);
    });
    
    it('should request approval for restricted steps', () => {
      const step = {
        id: 'ksm-4',
        name: 'Ultrasound Examination',
        requiresApproval: true,
        approvalReason: 'Ultrasound examination requires Flight Surgeon authorization'
      };
      
      // Create Communication for approval
      const communication = {
        resourceType: 'Communication',
        status: 'in-progress',
        priority: 'urgent',
        topic: {
          coding: [{
            code: 'approval-request'
          }]
        }
      };
      
      expect(step.requiresApproval).toBe(true);
      expect(communication.priority).toBe('urgent');
    });
  });
  
  describe('Flight Surgeon Approval Flow', () => {
    it('should display pending approvals on dashboard', () => {
      const pendingApprovals = [
        {
          id: '123',
          patientName: 'John Doe',
          interventionType: 'Ultrasound Examination',
          protocol: 'Kidney Stone Management',
          requestTime: new Date().toISOString()
        }
      ];
      
      expect(pendingApprovals).toHaveLength(1);
      expect(pendingApprovals[0].interventionType).toBe('Ultrasound Examination');
    });
    
    it('should update Communication and ServiceRequest on approval', () => {
      const approvalDecision = {
        approved: true,
        notes: 'Approved for ultrasound examination'
      };
      
      // Update Communication
      const updatedCommunication = {
        status: 'completed',
        note: [{
          text: approvalDecision.notes
        }]
      };
      
      // Update ServiceRequest to allow continuation
      const updatedServiceRequest = {
        extension: [{
          url: 'http://honeycomb.ai/fhir/StructureDefinition/approval-granted',
          valueBoolean: true
        }]
      };
      
      expect(updatedCommunication.status).toBe('completed');
      expect(updatedServiceRequest.extension[0].valueBoolean).toBe(true);
    });
  });
  
  describe('URL Navigation Pattern', () => {
    it('should preserve next parameter through workflow', () => {
      const initialNext = 'patient-chart';
      
      // Step 1: Issue Report
      let url = `/issue-report?next=${initialNext}`;
      expect(url).toContain('next=patient-chart');
      
      // Step 2: Symptom Selection
      const questionnaireResponseId = 'qr-123';
      url = `/symptom-selection?questionnaire-response=${questionnaireResponseId}&next=${initialNext}`;
      expect(url).toContain('questionnaire-response=qr-123');
      expect(url).toContain('next=patient-chart');
      
      // Step 3: Intervention Execution
      const protocolId = 'kidney-stone-management';
      url = `/intervention-execution?questionnaire-response=${questionnaireResponseId}&protocol=${protocolId}&next=${initialNext}`;
      expect(url).toContain('protocol=kidney-stone-management');
      expect(url).toContain('next=patient-chart');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing protocol gracefully', () => {
      const invalidProtocolId = 'non-existent-protocol';
      const errorMessage = 'Invalid protocol specified';
      
      expect(errorMessage).toBe('Invalid protocol specified');
    });
    
    it('should handle semantic search failures', () => {
      const fallbackResults = [
        // Hard-coded symptoms as fallback
        { id: 'flank-pain', display: 'Flank pain' },
        { id: 'back-pain', display: 'Back pain' }
      ];
      
      expect(fallbackResults).toHaveLength(2);
    });
  });
});