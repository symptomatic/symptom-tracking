// packages/symptom-tracking/client/pages/SymptomSelectionPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';

import { 
  Container,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';

import { 
  NavigateNext as NextIcon, 
  NavigateBefore as BackIcon,
  ExpandMore as ExpandMoreIcon,
  Psychology as PsychologyIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon
} from '@mui/icons-material';

import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { get, set, find } from 'lodash';

import { matchConditionFromSymptoms } from '../../lib/ConditionMatcher';

// Shared components
let DynamicSpacer;
let QuestionnaireResponses;

Meteor.startup(function(){
  DynamicSpacer = Meteor.DynamicSpacer;
  QuestionnaireResponses = Meteor.Collections.QuestionnaireResponses;
});

export function SymptomSelectionPage(props) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse URL parameters
  const searchParams = new URLSearchParams(location.search);
  const questionnaireResponseId = searchParams.get('questionnaire-response');
  const nextPage = searchParams.get('next');
  
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [isSearching, setIsSearching] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [currentExplanation, setCurrentExplanation] = useState(null);
  const [activeStep, setActiveStep] = useState(1);
  
  const issueDescription = useTracker(function() {
    return Session.get('issueDescription');
  }, []);
  
  const currentQuestionnaireResponse = useTracker(function() {
    if (questionnaireResponseId && QuestionnaireResponses) {
      return QuestionnaireResponses.findOne({id: questionnaireResponseId});
    }
    return Session.get('currentQuestionnaireResponse');
  }, [questionnaireResponseId]);

  // Perform semantic search based on issue description
  useEffect(function() {
    async function performSemanticSearch() {
      if (!issueDescription) {
        // Try to get from questionnaire response
        const description = get(currentQuestionnaireResponse, 'item[0].answer[0].valueString');
        if (!description) {
          setError('No issue description found. Please go back and describe your symptoms.');
          setIsSearching(false);
          return;
        }
        Session.set('issueDescription', description);
      }
      
      setIsSearching(true);
      try {
        const results = await Meteor.callAsync('performSemanticSearch', {
          query: issueDescription,
          resourceType: 'Condition',
          limit: 20
        });
        
        if (results && Array.isArray(results)) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Error performing semantic search:', err);
        setError('Failed to search for symptoms. Please try again.');
      } finally {
        setIsSearching(false);
      }
    }
    
    performSemanticSearch();
  }, [issueDescription, currentQuestionnaireResponse]);

  function handleSymptomToggle(symptom) {
    setSelectedSymptoms(prev => {
      const isSelected = prev.some(s => s.code === symptom.code);
      let newSelection;
      if (isSelected) {
        newSelection = prev.filter(s => s.code !== symptom.code);
      } else {
        newSelection = [...prev, symptom];
      }
      
      // Update explanation preview when symptoms change
      if (newSelection.length > 0) {
        const codes = newSelection.map(s => s.code);
        const matchResult = matchConditionFromSymptoms(codes, true);
        setCurrentExplanation(matchResult);
      } else {
        setCurrentExplanation(null);
      }
      
      return newSelection;
    });
  }

  async function handleContinue() {
    if (selectedSymptoms.length === 0) {
      setError('Please select at least one symptom to continue');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Update questionnaire response with selected symptoms
      const updatedResponse = {
        ...currentQuestionnaireResponse,
        item: [
          ...(currentQuestionnaireResponse?.item || []),
          {
            linkId: '2',
            text: 'Select all symptoms that apply',
            answer: selectedSymptoms.map(symptom => ({
              valueCoding: {
                system: symptom.system || 'http://snomed.info/sct',
                code: symptom.code,
                display: symptom.display
              }
            }))
          }
        ]
      };
      
      // Save to session
      Session.set('currentQuestionnaireResponse', updatedResponse);
      Session.set('selectedSymptoms', selectedSymptoms);
      
      // Update in database if available
      if (QuestionnaireResponses && questionnaireResponseId) {
        await QuestionnaireResponses._collection.updateAsync(
          { id: questionnaireResponseId },
          { $set: updatedResponse }
        );
      }
      
      // Match condition and determine intervention with explanation
      const symptomCodes = selectedSymptoms.map(s => s.code);
      const matchResult = matchConditionFromSymptoms(symptomCodes, true);
      
      if (matchResult.bestMatch) {
        Session.set('matchedCondition', matchResult.bestMatch.condition);
        Session.set('selectedProtocolId', matchResult.bestMatch.protocolId);
        Session.set('matchExplanation', matchResult.reasoning);
        
        // Show explanation in console for debugging
        console.log('Protocol Selection Explanation:');
        matchResult.reasoning.forEach(line => console.log(line));
        
        // Navigate to intervention execution
        let navigateUrl = `/intervention-execution?questionnaire-response=${questionnaireResponseId}`;
        navigateUrl += `&protocol=${matchResult.bestMatch.protocolId}`;
        
        if (nextPage) {
          navigateUrl += '&next=' + encodeURIComponent(nextPage);
        }
        
        navigate(navigateUrl);
      } else {
        setError('Unable to match your symptoms to a specific condition. Please consult with a healthcare provider.');
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('Error processing symptoms:', error);
      setError('Failed to process your selection. Please try again.');
      setIsProcessing(false);
    }
  }


  function handleBack() {
    navigate(-1);
  }

  const steps = ['Describe Issue', 'Select Symptoms', 'Assessment', 'Intervention'];

  return (
    <Container id="symptomSelectionPage" maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <CardHeader 
          title="Symptom Selection"
          subheader="Step 2: Select relevant symptoms"
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
        />
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {isSearching ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ ml: 2 }}>Analyzing your symptoms...</Typography>
            </Box>
          ) : (
            <>
              <Typography variant="body1" paragraph>
                Based on your description, select all symptoms that apply:
              </Typography>
              
              <Box sx={{ 
                maxHeight: '440px', 
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                mb: 3,
                backgroundColor: 'background.paper'
              }}>
                <FormGroup>
                  {searchResults.map(symptom => (
                    <Box
                      key={symptom.code || symptom.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        width: '100%',
                        mb: 1.5,
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        '&:hover': {
                          backgroundColor: 'action.hover'
                        }
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedSymptoms.some(s => s.code === symptom.code)}
                            onChange={() => handleSymptomToggle(symptom)}
                            color="primary"
                            sx={{ mt: -1 }}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body1">
                              {symptom.display}
                            </Typography>
                            {symptom.description && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {symptom.description}
                              </Typography>
                            )}
                          </Box>
                        }
                        sx={{ flex: 1, m: 0 }}
                      />
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ 
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          backgroundColor: 'action.hover',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          alignSelf: 'flex-start',
                          mt: 0.5
                        }}
                      >
                        {symptom.code}
                      </Typography>
                    </Box>
                  ))}
                </FormGroup>
              </Box>
              
              {searchResults.length === 0 && !error && (
                <Alert severity="info">
                  No symptoms found. Please go back and provide more detail about your issue.
                </Alert>
              )}
              
              {/* Selected Symptoms Chips */}
              {selectedSymptoms.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Selected ({selectedSymptoms.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedSymptoms.map(symptom => (
                      <Chip
                        key={symptom.code}
                        label={symptom.display}
                        color="primary"
                        size="small"
                        onDelete={() => handleSymptomToggle(symptom)}
                      />
                    ))}
                  </Box>
                </Box>
              )}
              
              {/* Explainable AI Section */}
              {currentExplanation && selectedSymptoms.length > 0 && (
                <Accordion sx={{ mt: 2, mb: 2 }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="explanation-content"
                    id="explanation-header"
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PsychologyIcon color="primary" />
                      <Typography>
                        Recommended Protocol: <strong>{currentExplanation.bestMatch.condition}</strong>
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Why this protocol was selected:
                      </Typography>
                      <List dense>
                        {currentExplanation.reasoning.map((reason, index) => (
                          <ListItem key={index}>
                            <ListItemIcon sx={{ minWidth: 30 }}>
                              {reason.startsWith('•') ? <CheckIcon fontSize="small" color="primary" /> : <InfoIcon fontSize="small" />}
                            </ListItemIcon>
                            <ListItemText 
                              primary={reason.replace('• ', '')} 
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                      
                      {currentExplanation.allMatches.length > 1 && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              Match Score: {currentExplanation.bestMatch.score} points
                              ({currentExplanation.bestMatch.matchedRequired.length} required + 
                              {currentExplanation.bestMatch.matchedOptional.length} optional symptoms)
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => navigate('/plan-definitions')}
                              sx={{ ml: 2 }}
                            >
                              Plan Library
                            </Button>
                          </Box>
                        </>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}
              
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={handleBack}
                  startIcon={<BackIcon />}
                  disabled={isProcessing}
                >
                  Back
                </Button>
                
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleContinue}
                  disabled={isProcessing || selectedSymptoms.length === 0}
                  endIcon={isProcessing ? <CircularProgress size={20} /> : <NextIcon />}
                >
                  {isProcessing ? 'Processing...' : 'Continue to Intervention'}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
      
      <DynamicSpacer />
    </Container>
  );
}