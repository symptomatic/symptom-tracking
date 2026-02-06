// packages/symptom-tracking/server/methods.js

import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { get, set } from 'lodash';
import moment from 'moment';

import { mapToUSCoreObservation, validateSymptomObservation } from '../lib/SymptomIGSchema';

// Lazy accessor functions for collections
function getObservations() {
  return global.Collections?.Observations;
}

function getPatients() {
  return global.Collections?.Patients;
}

Meteor.methods({
  'symptomTracking.saveSmokingStatus': async function(args) {
    check(args, {
      observation: Object,
      patientId: String,
      isUpdate: Match.Maybe(Boolean)
    });

    // Check authentication
    if (!this.userId) {
      throw new Meteor.Error('unauthorized', 'Must be logged in to save smoking status');
    }

    const { observation, patientId, isUpdate = false } = args;

    try {
      // Validate the observation
      const validation = validateSymptomObservation(observation);
      if (!validation.valid) {
        throw new Meteor.Error('validation-failed', 'Observation validation failed', validation.errors);
      }

      // Verify patient exists
      const Patients = getPatients();
      if (Patients) {
        const patient = await Patients.findOneAsync(patientId);
        if (!patient) {
          throw new Meteor.Error('patient-not-found', 'Patient not found');
        }
      }

      // Add server-side metadata
      const enrichedObservation = {
        ...observation,
        recordedDate: new Date().toISOString(),
        recorder: {
          reference: `Practitioner/${this.userId}`,
          display: 'System User'
        }
      };

      // If this is an update, find and update the existing record
      const Observations = getObservations();
      if (isUpdate && Observations) {
        const existingRecord = await Observations.findOneAsync({
          'subject.reference': `Patient/${patientId}`,
          'code.coding.system': 'http://snomed.info/sct',
          'code.coding.code': { $in: ['365980008', '8517006', '266919005', '182840001'] }
        }, { sort: { effectiveDateTime: -1 } });

        if (existingRecord) {
          await Observations.updateAsync(
            existingRecord._id,
            { $set: enrichedObservation }
          );

          console.log(`Updated smoking status for patient ${patientId}`);
          return {
            success: true,
            id: existingRecord._id,
            message: 'Smoking status updated successfully'
          };
        }
      }

      // Insert new observation
      if (Observations) {
        const observationId = await Observations.insertAsync(enrichedObservation);

        // Also create a US Core compatible version for interoperability
        const usCoreObservation = mapToUSCoreObservation(enrichedObservation);
        usCoreObservation.id = `${observationId}-uscore`;
        usCoreObservation.identifier = [
          {
            system: 'http://honeycomb.healthcare/observation-id',
            value: observationId
          }
        ];

        // Save US Core version with different identifier
        await Observations.insertAsync(usCoreObservation);
        
        console.log(`Saved smoking status for patient ${patientId}: ${observationId}`);
        return { 
          success: true, 
          id: observationId,
          message: 'Smoking status recorded successfully'
        };
      } else {
        // Fallback if collections not available
        console.log('Collections not available, simulation mode');
        return { 
          success: true, 
          id: 'simulation-' + Date.now(),
          message: 'Smoking status saved (simulation mode)'
        };
      }

    } catch (error) {
      console.error('Error saving smoking status:', error);
      throw new Meteor.Error('save-failed', error.message);
    }
  },

  'symptomTracking.getSmokingHistory': async function(patientId) {
    check(patientId, String);

    if (!this.userId) {
      throw new Meteor.Error('unauthorized', 'Must be logged in to access smoking history');
    }

    try {
      const Observations = getObservations();
      if (!Observations) {
        return [];
      }

      const history = await Observations.findAsync({
        'subject.reference': `Patient/${patientId}`,
        'code.coding.code': { $in: ['72166-2', '365980008', '8517006', '266919005', '182840001'] }
      }, {
        sort: { effectiveDateTime: -1 },
        limit: 50
      }).fetchAsync();

      return history;
    } catch (error) {
      console.error('Error fetching smoking history:', error);
      throw new Meteor.Error('fetch-failed', error.message);
    }
  },

  'symptomTracking.generateSmokingReport': async function(patientId, format = 'json') {
    check(patientId, String);
    check(format, Match.OneOf('json', 'ccda', 'csv'));

    if (!this.userId) {
      throw new Meteor.Error('unauthorized', 'Must be logged in to generate reports');
    }

    try {
      // Get current smoking status
      const currentStatus = await Meteor.callAsync('symptomTracking.getSmokingHistory', patientId);
      
      if (!currentStatus || currentStatus.length === 0) {
        throw new Meteor.Error('no-data', 'No smoking status data found for patient');
      }

      const latestStatus = currentStatus[0];

      switch (format) {
        case 'json':
          return {
            patientId: patientId,
            currentStatus: latestStatus,
            history: currentStatus,
            generatedAt: new Date().toISOString(),
            format: 'FHIR R4 JSON'
          };

        case 'ccda':
          // Generate basic C-CDA structure
          const { generateCCDASnippet } = await import('../lib/SymptomIGSchema');
          const ccdaSnippet = generateCCDASnippet(latestStatus);
          
          return {
            patientId: patientId,
            ccdaSnippet: ccdaSnippet,
            generatedAt: new Date().toISOString(),
            format: 'C-CDA R2.1'
          };

        case 'csv':
          // Generate CSV format for analysis
          const csvData = currentStatus.map(record => ({
            date: moment(record.effectiveDateTime).format('YYYY-MM-DD'),
            status: get(record, 'code.text', ''),
            severity: get(record, 'keyFeatures.severity.interpretation', ''),
            notes: get(record, 'description', '')
          }));

          return {
            patientId: patientId,
            csvData: csvData,
            generatedAt: new Date().toISOString(),
            format: 'CSV'
          };

        default:
          throw new Meteor.Error('invalid-format', 'Unsupported format requested');
      }

    } catch (error) {
      console.error('Error generating smoking report:', error);
      throw new Meteor.Error('report-failed', error.message);
    }
  },

  'symptomTracking.performSemanticSearch': async function(args) {
    check(args, {
      query: String,
      resourceType: String,
      limit: Match.Maybe(Number)
    });

    if (!this.userId) {
      throw new Meteor.Error('unauthorized', 'Must be logged in to perform search');
    }

    const { query, resourceType, limit = 10 } = args;

    try {
      // For smoking status, return predefined symptoms related to tobacco use
      if (query.toLowerCase().includes('smok') || query.toLowerCase().includes('tobacco') || query.toLowerCase().includes('cigarette')) {
        return [
          {
            code: '365980008',
            system: 'http://snomed.info/sct',
            display: 'Tobacco smoking behavior',
            description: 'Current tobacco smoking'
          },
          {
            code: '8517006', 
            system: 'http://snomed.info/sct',
            display: 'Former smoker',
            description: 'History of tobacco smoking, but currently not smoking'
          },
          {
            code: '266919005',
            system: 'http://snomed.info/sct', 
            display: 'Never smoked tobacco',
            description: 'Patient has never smoked tobacco'
          },
          {
            code: '182840001',
            system: 'http://snomed.info/sct',
            display: 'Drug therapy discontinued', 
            description: 'Currently attempting smoking cessation'
          }
        ];
      }

      // For other queries, return general symptoms
      return [
        {
          code: '25064002',
          system: 'http://snomed.info/sct',
          display: 'Headache',
          description: 'Pain in the head or neck area'
        },
        {
          code: '422587007',
          system: 'http://snomed.info/sct',
          display: 'Nausea',
          description: 'Feeling of sickness with inclination to vomit'
        },
        {
          code: '271825005',
          system: 'http://snomed.info/sct',
          display: 'Fatigue',
          description: 'Extreme tiredness resulting from mental or physical exertion'
        }
      ];

    } catch (error) {
      console.error('Error performing semantic search:', error);
      throw new Meteor.Error('search-failed', error.message);
    }
  }
});