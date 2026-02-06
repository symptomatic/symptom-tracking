// packages/symptom-tracking/lib/SymptomIGSchema.js

// Enhanced Symptom IG implementation for ONC 170.315(a)(11) compliance
// Uses smoking status as exemplar condition while providing robust framework

import { get, set } from 'lodash';

// HL7 FHIR Symptoms IG based schema structure
export const SymptomIGSchema = {
  // Core observation properties
  resourceType: 'Observation',
  id: String,
  identifier: [
    {
      system: String,
      value: String
    }
  ],
  
  // Based on assessment questionnaire or clinical observation
  basedOn: {
    reference: String,
    type: String
  },
  
  // Status of observation
  status: {
    type: String,
    allowedValues: ['present', 'absent', 'unknown', 'improving', 'worsening', 'stable'],
    defaultValue: 'present'
  },
  
  // Symptom or behavior code (using SNOMED CT)
  code: {
    coding: [
      {
        system: String,
        code: String,
        display: String
      }
    ],
    text: String
  },
  
  // Subject (patient)
  subject: {
    reference: String,
    display: String
  },
  
  // Who reported the symptom
  informant: {
    reference: String,
    display: String
  },
  
  // Effective date/time
  effectiveDateTime: Date,
  effectivePeriod: {
    start: Date,
    end: Date
  },
  
  // Patient description of symptom/behavior
  description: String,
  
  // Key symptom features per HL7 Symptoms IG
  keyFeatures: {
    // Severity assessment
    severity: {
      code: {
        system: String,
        code: String,
        display: String
      },
      value: Number, // 1-10 scale
      interpretation: String
    },
    
    // Body location (if applicable)
    bodyLocation: {
      code: {
        system: String,
        code: String,
        display: String
      },
      description: String
    },
    
    // Surrounding events and context
    surroundingEvents: {
      triggerOrExacerbatingFactors: [
        {
          description: String,
          code: {
            system: String,
            code: String,
            display: String
          }
        }
      ],
      alleviatingFactors: [
        {
          description: String,
          medication: {
            reference: String,
            display: String
          },
          procedure: {
            reference: String,
            display: String
          }
        }
      ]
    },
    
    // Associated symptoms
    associatedSymptoms: [
      {
        code: {
          system: String,
          code: String,
          display: String
        },
        severity: String
      }
    ]
  },
  
  // Timing characteristics
  timing: {
    onset: Date,
    frequency: String,
    periodicity: String,
    course: {
      type: String,
      allowedValues: ['acute', 'chronic', 'episodic', 'continuous', 'improving', 'worsening', 'stable'],
      defaultValue: 'stable'
    },
    trend: {
      type: String,
      allowedValues: ['increasing', 'decreasing', 'stable', 'fluctuating']
    }
  },
  
  // Clinical context
  clinicalContext: {
    setting: String,
    circumstances: String,
    relatedConditions: [
      {
        reference: String,
        display: String
      }
    ]
  },
  
  // Outcome goals (for behavioral tracking like smoking cessation)
  outcomeGoals: [
    {
      description: String,
      target: String,
      targetDate: Date,
      achieved: Boolean
    }
  ],
  
  // Record metadata
  recordedDate: Date,
  recorder: {
    reference: String,
    display: String
  },
  
  // Extensions for additional data
  extension: [
    {
      url: String,
      valueString: String,
      valueBoolean: Boolean,
      valueInteger: Number,
      valueDateTime: Date
    }
  ]
};

// Pre-defined smoking status templates per ONC requirements
export const SmokingStatusTemplates = {
  'current-smoker': {
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '365980008',
          display: 'Tobacco smoking behavior'
        }
      ],
      text: 'Current tobacco smoker'
    },
    status: 'present',
    keyFeatures: {
      severity: {
        code: {
          system: 'http://snomed.info/sct',
          code: '255604002',
          display: 'Mild'
        }
      },
      surroundingEvents: {
        triggerOrExacerbatingFactors: [],
        alleviatingFactors: []
      }
    },
    timing: {
      course: 'chronic',
      trend: 'stable'
    }
  },
  
  'former-smoker': {
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '8517006',
          display: 'Former smoker'
        }
      ],
      text: 'Former tobacco smoker'
    },
    status: 'absent',
    timing: {
      course: 'chronic',
      trend: 'stable'
    },
    outcomeGoals: [
      {
        description: 'Maintain smoking cessation',
        achieved: true
      }
    ]
  },
  
  'never-smoker': {
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '266919005',
          display: 'Never smoked tobacco'
        }
      ],
      text: 'Never smoked tobacco'
    },
    status: 'absent'
  },
  
  'smoking-cessation': {
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '182840001',
          display: 'Drug therapy discontinued'
        }
      ],
      text: 'Tobacco smoking cessation'
    },
    status: 'improving',
    timing: {
      course: 'acute',
      trend: 'decreasing'
    },
    outcomeGoals: [
      {
        description: 'Complete smoking cessation',
        achieved: false
      }
    ]
  }
};

// Standard severity levels for smoking
export const SmokingSeverityLevels = {
  'light': {
    system: 'http://snomed.info/sct',
    code: '255604002',
    display: 'Light smoker',
    description: 'Less than 10 cigarettes per day'
  },
  'moderate': {
    system: 'http://snomed.info/sct',
    code: '6736007',
    display: 'Moderate smoker',
    description: '10-20 cigarettes per day'
  },
  'heavy': {
    system: 'http://snomed.info/sct',
    code: '247510003',
    display: 'Heavy smoker',
    description: 'More than 20 cigarettes per day'
  }
};

// Utility functions for working with Symptom IG data

export function createSymptomObservation(template, patientRef, additionalData = {}) {
  const baseObservation = {
    resourceType: 'Observation',
    id: `symptom-${Date.now()}`,
    identifier: [
      {
        system: 'http://honeycomb.healthcare/symptom-tracking',
        value: `symptom-${Date.now()}`
      }
    ],
    status: template.status || 'present',
    code: template.code,
    subject: {
      reference: patientRef.reference || `Patient/${patientRef}`,
      display: patientRef.display || 'Patient'
    },
    informant: {
      reference: patientRef.reference || `Patient/${patientRef}`,
      display: patientRef.display || 'Patient (self-reported)'
    },
    effectiveDateTime: new Date().toISOString(),
    recordedDate: new Date().toISOString(),
    ...template
  };

  // Merge additional data
  Object.keys(additionalData).forEach(key => {
    if (additionalData[key] !== undefined) {
      set(baseObservation, key, additionalData[key]);
    }
  });

  return baseObservation;
}

export function mapToUSCoreObservation(symptomObservation) {
  // Map rich Symptom IG data to standard US Core Observation for interoperability
  const isSmoking = get(symptomObservation, 'code.coding[0].code') === '365980008';
  
  if (isSmoking) {
    return {
      resourceType: 'Observation',
      id: symptomObservation.id,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'social-history',
              display: 'Social History'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '72166-2',
            display: 'Tobacco smoking status'
          }
        ]
      },
      subject: symptomObservation.subject,
      effectiveDateTime: symptomObservation.effectiveDateTime,
      valueCodeableConcept: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: deriveSNOMEDSmokingStatus(symptomObservation),
            display: deriveSNOMEDSmokingDisplay(symptomObservation)
          }
        ]
      }
    };
  }
  
  // For other symptoms, create standard observation
  return {
    resourceType: 'Observation',
    id: symptomObservation.id,
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey'
          }
        ]
      }
    ],
    code: symptomObservation.code,
    subject: symptomObservation.subject,
    effectiveDateTime: symptomObservation.effectiveDateTime,
    valueString: symptomObservation.description
  };
}

function deriveSNOMEDSmokingStatus(observation) {
  const status = observation.status;
  const code = get(observation, 'code.coding[0].code');
  
  if (code === '8517006') return '8517006'; // Former smoker
  if (code === '266919005') return '266919005'; // Never smoker
  if (status === 'present') return '449868002'; // Current every day smoker
  if (status === 'improving') return '428041000124106'; // Current some day smoker
  
  return '449868002'; // Default to current smoker
}

function deriveSNOMEDSmokingDisplay(observation) {
  const status = observation.status;
  const code = get(observation, 'code.coding[0].code');
  
  if (code === '8517006') return 'Former smoker';
  if (code === '266919005') return 'Never smoker';
  if (status === 'present') return 'Current every day smoker';
  if (status === 'improving') return 'Current some day smoker';
  
  return 'Current every day smoker';
}

export function generateCCDASnippet(observation) {
  // Generate C-CDA XML snippet for the observation
  const isSmoking = get(observation, 'code.coding[0].code') === '365980008';
  
  if (!isSmoking) {
    return null; // Only smoking status for now
  }
  
  const snomedCode = deriveSNOMEDSmokingStatus(observation);
  const display = deriveSNOMEDSmokingDisplay(observation);
  
  return `
    <observation classCode="OBS" moodCode="EVN">
      <templateId root="2.16.840.1.113883.10.20.22.4.78"/>
      <id root="${observation.id}"/>
      <code code="72166-2" codeSystem="2.16.840.1.113883.6.1" 
            codeSystemName="LOINC" displayName="Tobacco smoking status"/>
      <statusCode code="completed"/>
      <effectiveTime value="${observation.effectiveDateTime.replace(/[-:T]/g, '').substring(0, 14)}"/>
      <value xsi:type="CD" code="${snomedCode}" 
             codeSystem="2.16.840.1.113883.6.96"
             codeSystemName="SNOMED CT" 
             displayName="${display}"/>
    </observation>
  `;
}

// Enhanced interoperability mappings for ONC certification
export function mapToHL7FHIR(observation) {
  // Map to HL7 FHIR R4 standard format
  return {
    resourceType: 'Observation',
    id: observation.id,
    meta: {
      profile: ['http://hl7.org/fhir/us/core/StructureDefinition/us-core-smokingstatus']
    },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'social-history',
            display: 'Social History'
          }
        ]
      }
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '72166-2',
          display: 'Tobacco smoking status'
        }
      ]
    },
    subject: observation.subject,
    effectiveDateTime: observation.effectiveDateTime,
    valueCodeableConcept: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: deriveSNOMEDSmokingStatus(observation),
          display: deriveSNOMEDSmokingDisplay(observation)
        }
      ]
    }
  };
}

export function mapToQDM(observation) {
  // Map to Quality Data Model for quality measure reporting
  const snomedCode = deriveSNOMEDSmokingStatus(observation);
  const display = deriveSNOMEDSmokingDisplay(observation);
  
  return {
    qdmTitle: 'Assessment, Performed',
    hqmfOid: '2.16.840.1.113883.10.20.28.4.117',
    qdmCategory: 'assessment',
    qdmStatus: 'performed',
    qdmVersion: '5.6',
    _id: observation.id,
    authorDatetime: observation.effectiveDateTime,
    code: {
      system: 'http://snomed.info/sct',
      code: '229819007',
      display: 'Tobacco use and exposure'
    },
    result: {
      system: 'http://snomed.info/sct',
      code: snomedCode,
      display: display
    },
    relevantPeriod: {
      low: observation.effectiveDateTime,
      high: observation.effectiveDateTime
    }
  };
}

export function mapToASTM(observation) {
  // Map to ASTM Continuity of Care Document format
  const snomedCode = deriveSNOMEDSmokingStatus(observation);
  const display = deriveSNOMEDSmokingDisplay(observation);
  
  return {
    type: 'SocialHistory',
    description: display,
    dateTime: observation.effectiveDateTime,
    status: 'Active',
    code: {
      value: snomedCode,
      codingSystem: 'SNOMED CT'
    },
    source: {
      actor: get(observation, 'recorder.display', 'Unknown'),
      role: 'Healthcare Provider'
    }
  };
}

export function generateHL7v2Message(observation) {
  // Generate HL7 v2.x message format for legacy system integration
  const snomedCode = deriveSNOMEDSmokingStatus(observation);
  const display = deriveSNOMEDSmokingDisplay(observation);
  const timestamp = new Date(observation.effectiveDateTime);
  const hl7Timestamp = timestamp.toISOString().replace(/[-:T]/g, '').substring(0, 14);
  
  const segments = [
    'MSH|^~\\&|HoneycombEHR|Facility|ReceivingApp|ReceivingFacility|' + hl7Timestamp + '||ORU^R01|' + observation.id + '|P|2.5.1',
    'PID|1||' + get(observation, 'subject.reference', '').replace('Patient/', '') + '^^^MRN||||||||||||||||||',
    'OBR|1|' + observation.id + '|' + observation.id + '|72166-2^Tobacco smoking status^LN||||' + hl7Timestamp + '||||||||||||' + hl7Timestamp,
    'OBX|1|CE|72166-2^Tobacco smoking status^LN||' + snomedCode + '^' + display + '^SCT|||N|||F|||' + hl7Timestamp
  ];
  
  return segments.join('\r\n');
}

export function generateCSVReport(observations) {
  // Generate CSV format for quality reporting and analytics
  const headers = [
    'Patient_ID',
    'Observation_Date',
    'Smoking_Status_Code',
    'Smoking_Status_Display',
    'Severity',
    'Pack_Years',
    'Quit_Date',
    'Provider',
    'FHIR_ID'
  ];
  
  const rows = observations.map(obs => [
    get(obs, 'subject.reference', '').replace('Patient/', ''),
    new Date(obs.effectiveDateTime).toISOString().split('T')[0],
    deriveSNOMEDSmokingStatus(obs),
    deriveSNOMEDSmokingDisplay(obs),
    get(obs, 'keyFeatures.severity.interpretation', ''),
    get(obs, 'extension[0].valueInteger', ''),
    get(obs, 'timing.onset', ''),
    get(obs, 'recorder.display', ''),
    obs.id
  ]);
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

export function validateONCCompliance(observation) {
  // Validate against ONC 170.315(a)(11) requirements
  const errors = [];
  const warnings = [];
  
  // Check required elements for ONC certification
  if (!observation.code || !observation.code.coding || observation.code.coding.length === 0) {
    errors.push('Missing required code element');
  }
  
  if (!observation.subject || !observation.subject.reference) {
    errors.push('Missing required subject reference');
  }
  
  if (!observation.effectiveDateTime) {
    errors.push('Missing required effective date/time');
  }
  
  // Check SNOMED CT coding
  const snomedCoding = observation.code.coding.find(c => c.system === 'http://snomed.info/sct');
  if (!snomedCoding) {
    warnings.push('SNOMED CT coding recommended for interoperability');
  }
  
  // Check for US Core compliance
  const validSmokingCodes = ['365980008', '8517006', '266919005', '182840001'];
  if (snomedCoding && !validSmokingCodes.includes(snomedCoding.code)) {
    warnings.push('Non-standard smoking status code may impact interoperability');
  }
  
  // Check documentation requirements
  if (!observation.recorder || !observation.recorder.reference) {
    warnings.push('Missing recorder information for audit trail');
  }
  
  return {
    compliant: errors.length === 0,
    errors: errors,
    warnings: warnings,
    score: Math.max(0, 100 - (errors.length * 25) - (warnings.length * 10))
  };
}

// Validation functions
export function validateSymptomObservation(observation) {
  const errors = [];
  
  if (!observation.code || !observation.code.coding || observation.code.coding.length === 0) {
    errors.push('Missing required code');
  }
  
  if (!observation.subject || !observation.subject.reference) {
    errors.push('Missing required subject reference');
  }
  
  if (!observation.status) {
    errors.push('Missing required status');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default SymptomIGSchema;