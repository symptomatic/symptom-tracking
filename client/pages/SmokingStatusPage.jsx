// packages/symptom-tracking/client/pages/SmokingStatusPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';

import {
  SmokingRooms as SmokingIcon,
  SmokeFree as SmokeFreeIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  Assignment as DocumentIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { get, set, find } from 'lodash';
import moment from 'moment';

import { 
  SmokingStatusTemplates, 
  SmokingSeverityLevels,
  createSymptomObservation,
  mapToUSCoreObservation,
  generateCCDASnippet,
  validateSymptomObservation
} from '../../lib/SymptomIGSchema';

// Shared components
let DynamicSpacer;
let QuestionnaireResponses;
let Patients;
let Observations;

Meteor.startup(function(){
  DynamicSpacer = Meteor.DynamicSpacer;
  QuestionnaireResponses = Meteor.Collections.QuestionnaireResponses;
  Patients = Meteor.Collections.Patients;
  Observations = Meteor.Collections.Observations;
});

export function SmokingStatusPage(props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get patient ID from various sources
  const urlPatientId = searchParams.get('patient');
  const sessionPatientId = Session.get('selectedPatientId');
  const sessionPatient = Session.get('selectedPatient');
  
  const patientId = urlPatientId || sessionPatientId || (typeof sessionPatient === 'string' ? sessionPatient : sessionPatient?._id || sessionPatient?.id);
  const mode = searchParams.get('mode') || 'view'; // view, record, edit
  
  // Debug logging
  console.log('SmokingStatusPage - URL patientId:', urlPatientId);
  console.log('SmokingStatusPage - Session selectedPatientId:', sessionPatientId);
  console.log('SmokingStatusPage - Session selectedPatient:', sessionPatient);
  console.log('SmokingStatusPage - Final patientId:', patientId);
  
  const [selectedStatus, setSelectedStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [quitDate, setQuitDate] = useState('');
  const [packYearHistory, setPackYearHistory] = useState('');
  const [currentForm, setCurrentForm] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCCDA, setShowCCDA] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState([]);

  // Current patient data
  const currentPatient = useTracker(function() {
    console.log('SmokingStatusPage - useTracker patientId:', patientId);
    console.log('SmokingStatusPage - useTracker Patients collection:', !!Patients);
    
    // Try to get patient by ID first
    if (patientId && Patients) {
      const patient = Patients.findOne(patientId);
      console.log('SmokingStatusPage - Found patient from collection:', !!patient);
      if (patient) {
        return patient;
      }
    }
    
    // Fallback to session data
    const selectedPatientData = Session.get('selectedPatient');
    console.log('SmokingStatusPage - Session patient fallback:', !!selectedPatientData);
    if (selectedPatientData) {
      return selectedPatientData;
    }
    
    return null;
  }, [patientId]);

  // Smoking history observations
  const smokingHistory = useTracker(function() {
    if (patientId && Observations) {
      return Observations.find({
        'subject.reference': `Patient/${patientId}`,
        'code.coding.code': { $in: ['72166-2', '365980008', '8517006', '266919005', '182840001'] }
      }, { sort: { effectiveDateTime: -1 } }).fetch();
    }
    return [];
  }, [patientId]);

  // Current smoking status (most recent)
  const currentSmokingStatus = smokingHistory.length > 0 ? smokingHistory[0] : null;

  useEffect(function() {
    if (mode === 'edit' && currentSmokingStatus) {
      // Pre-populate form with current values
      const statusCode = get(currentSmokingStatus, 'code.coding[0].code');
      if (statusCode === '365980008') {
        setSelectedStatus('current-smoker');
        const severityCode = get(currentSmokingStatus, 'keyFeatures.severity.code.code');
        if (severityCode) {
          setSeverity(Object.keys(SmokingSeverityLevels).find(key => 
            SmokingSeverityLevels[key].code === severityCode
          ) || '');
        }
      } else if (statusCode === '8517006') {
        setSelectedStatus('former-smoker');
        setQuitDate(get(currentSmokingStatus, 'timing.course') || '');
      } else if (statusCode === '266919005') {
        setSelectedStatus('never-smoker');
      } else if (statusCode === '182840001') {
        setSelectedStatus('smoking-cessation');
      }
      
      setAdditionalNotes(get(currentSmokingStatus, 'description', ''));
    }
  }, [mode, currentSmokingStatus]);

  async function handleSaveSmokingStatus() {
    if (!selectedStatus) {
      setError('Please select a smoking status');
      return;
    }

    if (!patientId) {
      setError('No patient selected');
      return;
    }

    setIsSaving(true);
    setError(null);
    setValidationErrors([]);

    try {
      // Get the template for the selected status
      const template = SmokingStatusTemplates[selectedStatus];
      if (!template) {
        throw new Error('Invalid smoking status selected');
      }

      // Build additional data based on form inputs
      const additionalData = {
        description: additionalNotes
      };

      // Add severity for current smokers
      if (selectedStatus === 'current-smoker' && severity) {
        const severityData = SmokingSeverityLevels[severity];
        additionalData['keyFeatures.severity'] = {
          code: {
            system: severityData.system,
            code: severityData.code,
            display: severityData.display
          },
          interpretation: severityData.description
        };
      }

      // Add quit date for former smokers
      if (selectedStatus === 'former-smoker' && quitDate) {
        additionalData['timing.onset'] = moment(quitDate).toDate();
      }

      // Add pack-year history if provided
      if (packYearHistory) {
        additionalData['extension'] = [
          {
            url: 'http://honeycomb.healthcare/smoking-pack-years',
            valueInteger: parseInt(packYearHistory)
          }
        ];
      }

      // Create the symptom observation
      const observation = createSymptomObservation(
        template,
        { reference: `Patient/${patientId}`, display: get(currentPatient, 'name[0].text', 'Patient') },
        additionalData
      );

      // Validate the observation
      const validation = validateSymptomObservation(observation);
      if (!validation.valid) {
        setValidationErrors(validation.errors);
        setError('Validation failed. Please check the form.');
        setIsSaving(false);
        return;
      }

      // Save to server
      const result = await Meteor.rpc('symptomTracking.saveSmokingStatus', {
        observation: observation,
        patientId: patientId,
        isUpdate: mode === 'edit'
      });

      if (result.success) {
        setSuccess('Smoking status saved successfully');
        setActiveStep(2); // Move to success step
        
        // Clear form
        setSelectedStatus('');
        setSeverity('');
        setQuitDate('');
        setPackYearHistory('');
        setAdditionalNotes('');
        
        // Update session
        Session.set('lastSmokingStatusUpdate', new Date());
        
        setTimeout(() => {
          if (mode === 'record') {
            navigate(`/smoking-status?patient=${patientId}&mode=view`);
          } else {
            setSuccess(null);
            setActiveStep(0);
          }
        }, 2000);
      } else {
        setError(result.error || 'Failed to save smoking status');
      }
    } catch (err) {
      console.error('Error saving smoking status:', err);
      setError('Failed to save smoking status: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setSelectedStatus('');
    setSeverity('');
    setQuitDate('');
    setPackYearHistory('');
    setAdditionalNotes('');
    setError(null);
    setValidationErrors([]);
    navigate(`/smoking-status?patient=${patientId}&mode=view`);
  }

  async function generateCCDA() {
    if (!currentSmokingStatus) {
      setError('No smoking status available for C-CDA generation');
      return;
    }

    try {
      const ccdaSnippet = generateCCDASnippet(currentSmokingStatus);
      if (ccdaSnippet) {
        const blob = new Blob([ccdaSnippet], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smoking-status-${patientId}-${moment().format('YYYYMMDD')}.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        setSuccess('C-CDA snippet downloaded successfully');
      } else {
        setError('Unable to generate C-CDA snippet');
      }
    } catch (err) {
      console.error('Error generating C-CDA:', err);
      setError('Failed to generate C-CDA: ' + err.message);
    }
  }

  const steps = ['Select Status', 'Enter Details', 'Confirm & Save'];

  const smokingStatusOptions = [
    { value: 'current-smoker', label: 'Current Smoker', icon: <SmokingIcon />, color: 'error' },
    { value: 'former-smoker', label: 'Former Smoker', icon: <SmokeFreeIcon />, color: 'warning' },
    { value: 'never-smoker', label: 'Never Smoker', icon: <SmokeFreeIcon />, color: 'success' },
    { value: 'smoking-cessation', label: 'Currently Quitting', icon: <SmokeFreeIcon />, color: 'info' }
  ];

  const severityOptions = [
    { value: 'light', label: 'Light (< 10 cigarettes/day)' },
    { value: 'moderate', label: 'Moderate (10-20 cigarettes/day)' },
    { value: 'heavy', label: 'Heavy (> 20 cigarettes/day)' }
  ];

  return (
    <Container id="smokingStatusPage" maxWidth="lg" sx={{ py: 4 }}>
      <Card>
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SmokingIcon />
              <Typography variant="h5">
                Smoking Status - ONC 170.315(a)(11)
              </Typography>
            </Box>
          }
          subheader={
            currentPatient ? 
              `Patient: ${get(currentPatient, 'name[0].text', 'Unknown')} • Mode: ${mode.toUpperCase()}` :
              'No patient selected'
          }
          sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              {mode === 'view' && (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate(`/smoking-status?patient=${patientId}&mode=record`)}
                    sx={{ color: 'white', borderColor: 'white' }}
                  >
                    Record
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditIcon />}
                    onClick={() => navigate(`/smoking-status?patient=${patientId}&mode=edit`)}
                    disabled={!currentSmokingStatus}
                    sx={{ color: 'white', borderColor: 'white' }}
                  >
                    Change
                  </Button>
                </>
              )}
            </Box>
          }
        />
        <CardContent>
          {!currentPatient ? (
            <Alert severity="warning">
              Please select a patient to view or manage smoking status.
              <Button onClick={() => navigate('/patients')} sx={{ ml: 2 }}>
                Select Patient
              </Button>
            </Alert>
          ) : (
            <>
              {/* MODE: VIEW/ACCESS */}
              {mode === 'view' && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Current Smoking Status
                  </Typography>
                  
                  {currentSmokingStatus ? (
                    <Paper sx={{ p: 3, mb: 3 }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            {get(currentSmokingStatus, 'code.coding[0].code') === '365980008' ? 
                              <SmokingIcon color="error" /> : <SmokeFreeIcon color="success" />
                            }
                            <Typography variant="h6">
                              {get(currentSmokingStatus, 'code.text', 'Unknown Status')}
                            </Typography>
                            <Chip
                              label={get(currentSmokingStatus, 'status', 'Unknown')}
                              color={get(currentSmokingStatus, 'status') === 'present' ? 'error' : 'success'}
                              size="small"
                            />
                          </Box>
                          
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            <strong>Recorded:</strong> {moment(currentSmokingStatus.effectiveDateTime).format('MMMM D, YYYY [at] h:mm A')}
                          </Typography>
                          
                          {get(currentSmokingStatus, 'keyFeatures.severity.interpretation') && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              <strong>Severity:</strong> {get(currentSmokingStatus, 'keyFeatures.severity.interpretation')}
                            </Typography>
                          )}
                          
                          {get(currentSmokingStatus, 'description') && (
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              <strong>Notes:</strong> {get(currentSmokingStatus, 'description')}
                            </Typography>
                          )}
                        </Grid>
                        
                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Button
                              variant="outlined"
                              startIcon={<DownloadIcon />}
                              onClick={generateCCDA}
                              size="small"
                            >
                              Download C-CDA
                            </Button>
                            <Button
                              variant="outlined"
                              startIcon={<DocumentIcon />}
                              onClick={() => setShowCCDA(true)}
                              size="small"
                            >
                              View FHIR JSON
                            </Button>
                            <Button
                              variant="outlined"
                              startIcon={<HistoryIcon />}
                              onClick={() => setShowHistory(!showHistory)}
                              size="small"
                            >
                              View History ({smokingHistory.length})
                            </Button>
                          </Box>
                        </Grid>
                      </Grid>
                    </Paper>
                  ) : (
                    <Alert severity="info" sx={{ mb: 3 }}>
                      No smoking status recorded for this patient.
                      <Button 
                        onClick={() => navigate(`/smoking-status?patient=${patientId}&mode=record`)}
                        sx={{ ml: 2 }}
                      >
                        Record Status
                      </Button>
                    </Alert>
                  )}

                  {/* Smoking History */}
                  {showHistory && smokingHistory.length > 0 && (
                    <Accordion expanded sx={{ mb: 3 }}>
                      <AccordionSummary>
                        <Typography variant="h6">Smoking Status History</Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <TableContainer component={Paper}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Details</TableCell>
                                <TableCell>Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {smokingHistory.map((record, index) => (
                                <TableRow key={record.id || index}>
                                  <TableCell>
                                    {moment(record.effectiveDateTime).format('MM/DD/YYYY')}
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={get(record, 'code.text', 'Unknown')}
                                      color={get(record, 'status') === 'present' ? 'error' : 'success'}
                                      size="small"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {get(record, 'keyFeatures.severity.interpretation') || 
                                     get(record, 'description') || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <IconButton
                                      size="small"
                                      onClick={() => console.log('View record:', record)}
                                    >
                                      <ViewIcon />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Box>
              )}

              {/* MODE: RECORD/CHANGE */}
              {(mode === 'record' || mode === 'edit') && (
                <Box>
                  <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>

                  {/* Step 1: Select Status */}
                  {activeStep === 0 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Select Smoking Status
                      </Typography>
                      
                      <FormControl component="fieldset" fullWidth>
                        <RadioGroup
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                          <Grid container spacing={2}>
                            {smokingStatusOptions.map((option) => (
                              <Grid item xs={12} sm={6} key={option.value}>
                                <Paper
                                  sx={{
                                    p: 2,
                                    border: selectedStatus === option.value ? 2 : 1,
                                    borderColor: selectedStatus === option.value ? 'primary.main' : 'divider',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => setSelectedStatus(option.value)}
                                >
                                  <FormControlLabel
                                    value={option.value}
                                    control={<Radio />}
                                    label={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {option.icon}
                                        <Typography>{option.label}</Typography>
                                      </Box>
                                    }
                                  />
                                </Paper>
                              </Grid>
                            ))}
                          </Grid>
                        </RadioGroup>
                      </FormControl>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                        <Button
                          variant="outlined"
                          onClick={handleCancelEdit}
                          startIcon={<CancelIcon />}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => setActiveStep(1)}
                          disabled={!selectedStatus}
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Step 2: Enter Details */}
                  {activeStep === 1 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Additional Details
                      </Typography>

                      <Grid container spacing={3}>
                        {/* Severity for current smokers */}
                        {selectedStatus === 'current-smoker' && (
                          <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                              <InputLabel>Smoking Severity</InputLabel>
                              <Select
                                value={severity}
                                onChange={(e) => setSeverity(e.target.value)}
                                label="Smoking Severity"
                              >
                                {severityOptions.map((option) => (
                                  <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        )}

                        {/* Quit date for former smokers */}
                        {selectedStatus === 'former-smoker' && (
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              label="Quit Date"
                              type="date"
                              value={quitDate}
                              onChange={(e) => setQuitDate(e.target.value)}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                        )}

                        {/* Pack-year history */}
                        {(selectedStatus === 'current-smoker' || selectedStatus === 'former-smoker') && (
                          <Grid item xs={12} md={6}>
                            <TextField
                              fullWidth
                              label="Pack-Year History"
                              type="number"
                              value={packYearHistory}
                              onChange={(e) => setPackYearHistory(e.target.value)}
                              helperText="Total packs per day × years smoked"
                            />
                          </Grid>
                        )}

                        {/* Additional notes */}
                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Additional Notes"
                            multiline
                            rows={3}
                            value={additionalNotes}
                            onChange={(e) => setAdditionalNotes(e.target.value)}
                            placeholder="Any additional details about smoking history, cessation attempts, etc."
                          />
                        </Grid>
                      </Grid>

                      {validationErrors.length > 0 && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          <Typography variant="subtitle2">Validation Errors:</Typography>
                          <List dense>
                            {validationErrors.map((error, index) => (
                              <ListItem key={index}>
                                <ListItemIcon sx={{ minWidth: 30 }}>
                                  <WarningIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary={error} />
                              </ListItem>
                            ))}
                          </List>
                        </Alert>
                      )}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                        <Button
                          variant="outlined"
                          onClick={() => setActiveStep(0)}
                        >
                          Back
                        </Button>
                        <Button
                          variant="contained"
                          onClick={() => setActiveStep(2)}
                        >
                          Review
                        </Button>
                      </Box>
                    </Box>
                  )}

                  {/* Step 3: Confirm & Save */}
                  {activeStep === 2 && (
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        Confirm Smoking Status
                      </Typography>

                      <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          <strong>Status:</strong> {smokingStatusOptions.find(opt => opt.value === selectedStatus)?.label}
                        </Typography>
                        
                        {severity && (
                          <Typography variant="body2" gutterBottom>
                            <strong>Severity:</strong> {severityOptions.find(opt => opt.value === severity)?.label}
                          </Typography>
                        )}
                        
                        {quitDate && (
                          <Typography variant="body2" gutterBottom>
                            <strong>Quit Date:</strong> {moment(quitDate).format('MMMM D, YYYY')}
                          </Typography>
                        )}
                        
                        {packYearHistory && (
                          <Typography variant="body2" gutterBottom>
                            <strong>Pack-Year History:</strong> {packYearHistory}
                          </Typography>
                        )}
                        
                        {additionalNotes && (
                          <Typography variant="body2" gutterBottom>
                            <strong>Notes:</strong> {additionalNotes}
                          </Typography>
                        )}
                      </Paper>

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                        <Button
                          variant="outlined"
                          onClick={() => setActiveStep(1)}
                          disabled={isSaving}
                        >
                          Back
                        </Button>
                        <Button
                          variant="contained"
                          onClick={handleSaveSmokingStatus}
                          disabled={isSaving}
                          startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
                        >
                          {isSaving ? 'Saving...' : 'Save Smoking Status'}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Success/Error Messages */}
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert 
                  severity="success" 
                  sx={{ mt: 2 }}
                  icon={<CheckIcon />}
                >
                  {success}
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* FHIR JSON Dialog */}
      <Dialog
        open={showCCDA}
        onClose={() => setShowCCDA(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>FHIR Observation JSON</DialogTitle>
        <DialogContent>
          {currentSmokingStatus && (
            <pre style={{ fontSize: '12px', overflow: 'auto' }}>
              {JSON.stringify(currentSmokingStatus, null, 2)}
            </pre>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCCDA(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <DynamicSpacer />
    </Container>
  );
}