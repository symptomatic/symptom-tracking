// packages/symptom-tracking/client/pages/IssueReportPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';

import { 
  Container,
  Card,
  CardContent,
  CardHeader,
  Typography,
  TextField,
  Button,
  Box,
  Alert,
  CircularProgress,
  useTheme
} from '@mui/material';

import { NavigateNext as NextIcon } from '@mui/icons-material';

import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Random } from 'meteor/random';
import { get, set } from 'lodash';

// Shared components
let DynamicSpacer;
let Questionnaires;
let QuestionnaireResponses;

Meteor.startup(function(){
  DynamicSpacer = Meteor.DynamicSpacer;
  Questionnaires = Meteor.Collections.Questionnaires;
  QuestionnaireResponses = Meteor.Collections.QuestionnaireResponses;
});

export function IssueReportPage(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  
  // Parse URL parameters
  const searchParams = new URLSearchParams(location.search);
  const nextPage = searchParams.get('next');
  
  const [issueDescription, setIssueDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  
  const currentUser = useTracker(function() {
    return Meteor.user();
  }, []);
  
  const selectedPatientId = useTracker(function() {
    return Session.get('selectedPatientId');
  }, []);
  
  const selectedPatient = useTracker(function() {
    return Session.get('selectedPatient');
  }, []);

  // Initialize patient context if needed
  useEffect(function() {
    if (!selectedPatientId && currentUser) {
      // If no patient selected, use current user as patient
      const userId = get(currentUser, '_id');
      const userPatient = {
        id: userId,
        resourceType: 'Patient',
        name: [{
          text: get(currentUser, 'profile.name.text', 'Anonymous User'),
          given: get(currentUser, 'profile.name.given', ['Anonymous']),
          family: get(currentUser, 'profile.name.family', 'User')
        }]
      };
      
      Session.set('selectedPatientId', userId);
      Session.set('selectedPatient', userPatient);
    }
  }, [currentUser, selectedPatientId]);

  async function handleSubmit(event) {
    event.preventDefault();
    
    if (!issueDescription.trim()) {
      setError('Please describe your medical issue');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Create a new QuestionnaireResponse with the initial issue
      const questionnaireResponseId = Random.id();
      const newQuestionnaireResponse = {
        id: questionnaireResponseId,
        resourceType: 'QuestionnaireResponse',
        questionnaire: 'Questionnaire/symptom-assessment',
        status: 'in-progress',
        subject: {
          reference: `Patient/${selectedPatientId || 'anonymous'}`,
          display: get(selectedPatient, 'name[0].text', 'Anonymous User')
        },
        authored: new Date().toISOString(),
        author: {
          reference: `Patient/${selectedPatientId || 'anonymous'}`,
          display: get(selectedPatient, 'name[0].text', 'Anonymous User')
        },
        item: [
          {
            linkId: '1',
            text: 'Please describe your medical issue in detail',
            answer: [{
              valueString: issueDescription
            }]
          }
        ]
      };
      
      // Save to session for workflow continuity
      Session.set('currentQuestionnaireResponseId', questionnaireResponseId);
      Session.set('currentQuestionnaireResponse', newQuestionnaireResponse);
      Session.set('issueDescription', issueDescription);
      
      // Optionally save to database
      if (QuestionnaireResponses) {
        await QuestionnaireResponses._collection.insertAsync(newQuestionnaireResponse);
      }
      
      // Navigate to symptom selection page
      let navigateUrl = '/symptom-selection?questionnaire-response=' + questionnaireResponseId;
      
      // Preserve the next parameter for workflow continuity
      if (nextPage) {
        navigateUrl += '&next=' + encodeURIComponent(nextPage);
      }
      
      navigate(navigateUrl);
      
    } catch (error) {
      console.error('Error creating questionnaire response:', error);
      setError('Failed to process your request. Please try again.');
      setIsProcessing(false);
    }
  }

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      backgroundColor: theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.grey[50],
      pt: 2
    }}>
    <Container id="issueReportPage" maxWidth="md" sx={{ pb: 4 }}>
      <Card>
        <CardHeader 
          title="Report Medical Issue"
          subheader="Step 1: Describe your symptoms"
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
        />
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Typography variant="body1" paragraph>
              Please describe your medical issue in detail. Include information about:
            </Typography>
            
            <Box component="ul" sx={{ mb: 3 }}>
              <li>Primary symptoms you're experiencing</li>
              <li>When the symptoms started</li>
              <li>Severity and location of any pain</li>
              <li>Any factors that make it better or worse</li>
            </Box>
            
            <TextField
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              label="Describe your symptoms"
              placeholder="Example: I have sharp pain in my lower back on the right side that started 2 hours ago. The pain gets worse when I bend forward..."
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              error={Boolean(error)}
              helperText={error}
              disabled={isProcessing}
              sx={{ mb: 3 }}
            />
            
            {selectedPatient && (
              <Alert severity="info" sx={{ mb: 3 }}>
                Reporting for: {get(selectedPatient, 'name[0].text', 'Unknown Patient')}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => navigate(-1)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={isProcessing || !issueDescription.trim()}
                endIcon={isProcessing ? <CircularProgress size={20} /> : <NextIcon />}
              >
                {isProcessing ? 'Processing...' : 'Continue to Symptom Selection'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
      
      <DynamicSpacer />
    </Container>
    </Box>
  );
}