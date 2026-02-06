// packages/symptom-tracking/lib/ConditionMatcher.js

// We'll define the protocol mapping here since cross-package imports are complex
// In a real app, this would be shared via a common package or API

// Condition matching logic with explainable AI
export const CONDITION_MAPPINGS = {
  'kidney-stones': {
    name: 'Kidney Stones',
    protocolId: 'kidney-stone-management',
    requiredSymptoms: ['102491009'], // Flank pain
    optionalSymptoms: ['34436003', '422587007', '422400008', '49650001'], // Hematuria, nausea, vomiting, painful urination
    minSymptomCount: 1,
    explanation: 'Flank pain is a primary indicator of kidney stones, especially when combined with urinary symptoms'
  },
  'acute-back-pain': {
    name: 'Acute Back Pain',
    protocolId: 'acute-back-pain',
    requiredSymptoms: ['161891005', '279039007'], // Back pain, Lower back pain
    optionalSymptoms: ['13791008', '271681002', '102494001'], // Weakness, numbness, radiating pain
    minSymptomCount: 1,
    explanation: 'Back pain symptoms indicate musculoskeletal issues requiring pain management and mobility assessment'
  },
  'dehydration': {
    name: 'Dehydration',
    protocolId: 'dehydration-protocol',
    requiredSymptoms: [],
    optionalSymptoms: ['25064002', '404640003', '87715008', '271825005', '167217005', '165232002'], // Headache, dizziness, dry mouth, fatigue, dark urine, decreased urination
    minSymptomCount: 2,
    explanation: 'Multiple systemic symptoms like headache, dizziness, and dry mouth together indicate dehydration'
  }
};

// Map SNOMED codes to readable names for explanation
export const SYMPTOM_NAMES = {
  '102491009': 'Flank pain',
  '34436003': 'Blood in urine',
  '422587007': 'Nausea',
  '422400008': 'Vomiting',
  '49650001': 'Painful urination',
  '161891005': 'Back pain',
  '279039007': 'Lower back pain',
  '13791008': 'Muscle weakness',
  '271681002': 'Numbness',
  '102494001': 'Radiating pain',
  '25064002': 'Headache',
  '404640003': 'Dizziness',
  '87715008': 'Dry mouth',
  '271825005': 'Fatigue',
  '167217005': 'Dark urine',
  '165232002': 'Decreased urination'
};

export function matchConditionFromSymptoms(symptomCodes, returnExplanation = false) {
  let bestMatch = null;
  let bestScore = 0;
  let matchDetails = [];
  
  Object.entries(CONDITION_MAPPINGS).forEach(([conditionKey, mapping]) => {
    let score = 0;
    let requiredMet = true;
    let matchedRequired = [];
    let matchedOptional = [];
    let missingRequired = [];
    
    // Check required symptoms
    mapping.requiredSymptoms.forEach(reqSymptom => {
      if (symptomCodes.includes(reqSymptom)) {
        score += 2; // Required symptoms worth more
        matchedRequired.push(SYMPTOM_NAMES[reqSymptom] || reqSymptom);
      } else {
        requiredMet = false;
        missingRequired.push(SYMPTOM_NAMES[reqSymptom] || reqSymptom);
      }
    });
    
    // Check optional symptoms
    mapping.optionalSymptoms.forEach(optSymptom => {
      if (symptomCodes.includes(optSymptom)) {
        score += 1;
        matchedOptional.push(SYMPTOM_NAMES[optSymptom] || optSymptom);
      }
    });
    
    // Check if minimum symptom count is met
    const totalMatchedSymptoms = matchedRequired.length + matchedOptional.length;
    
    // Store match details for explanation
    const detail = {
      condition: mapping.name,
      protocolId: mapping.protocolId,
      score: score,
      matchedRequired: matchedRequired,
      matchedOptional: matchedOptional,
      missingRequired: missingRequired,
      totalMatched: totalMatchedSymptoms,
      minRequired: mapping.minSymptomCount,
      requiredMet: requiredMet,
      explanation: mapping.explanation
    };
    
    matchDetails.push(detail);
    
    // Only consider if required symptoms are met or no required symptoms
    if (requiredMet || mapping.requiredSymptoms.length === 0) {
      if (totalMatchedSymptoms >= mapping.minSymptomCount && score > bestScore) {
        bestMatch = detail;
        bestScore = score;
      }
    }
  });
  
  // If no specific match found, default to general assessment protocol
  if (!bestMatch) {
    console.log('No specific condition matched, defaulting to general assessment');
    bestMatch = {
      condition: 'General Assessment',
      protocolId: 'acute-back-pain', // Using back pain as general protocol for now
      score: 0,
      matchedRequired: [],
      matchedOptional: [],
      missingRequired: [],
      totalMatched: 0,
      explanation: 'No specific condition pattern matched. Using general assessment protocol for safety.'
    };
  }
  
  if (returnExplanation) {
    return {
      bestMatch: bestMatch,
      allMatches: matchDetails.sort((a, b) => b.score - a.score),
      reasoning: generateReasoning(bestMatch, matchDetails)
    };
  }
  
  return bestMatch;
}

// Generate human-readable reasoning for the match
function generateReasoning(bestMatch, allMatches) {
  let reasoning = [];
  
  if (bestMatch.score === 0) {
    reasoning.push('No specific symptom patterns were recognized.');
    reasoning.push('Defaulting to a general assessment protocol for safety.');
  } else {
    reasoning.push(`Selected "${bestMatch.condition}" protocol because:`);
    
    if (bestMatch.matchedRequired.length > 0) {
      reasoning.push(`• Key symptoms present: ${bestMatch.matchedRequired.join(', ')}`);
    }
    
    if (bestMatch.matchedOptional.length > 0) {
      reasoning.push(`• Supporting symptoms: ${bestMatch.matchedOptional.join(', ')}`);
    }
    
    reasoning.push(`• ${bestMatch.explanation}`);
    
    // Explain why other protocols weren't selected
    const otherMatches = allMatches.filter(m => m.protocolId !== bestMatch.protocolId && m.score > 0);
    if (otherMatches.length > 0) {
      reasoning.push('');
      reasoning.push('Other protocols considered:');
      otherMatches.forEach(match => {
        if (match.missingRequired.length > 0) {
          reasoning.push(`• ${match.condition}: Missing required symptom(s) - ${match.missingRequired.join(', ')}`);
        } else if (match.totalMatched < match.minRequired) {
          reasoning.push(`• ${match.condition}: Only ${match.totalMatched} symptom(s) matched, needs at least ${match.minRequired}`);
        } else {
          reasoning.push(`• ${match.condition}: Lower match score (${match.score} vs ${bestMatch.score})`);
        }
      });
    }
  }
  
  return reasoning;
}