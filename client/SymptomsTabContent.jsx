// packages/symptom-tracking/client/SymptomsTabContent.jsx

import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Session } from 'meteor/session';
import { get } from 'lodash';
import { Random } from 'meteor/random';
import moment from 'moment';

import {
  Box, Card, CardHeader, CardContent, CardActions,
  Typography, Button, Grid, Alert, AlertTitle, CircularProgress,
  TextField, Checkbox, FormControlLabel, FormGroup, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Snackbar
} from '@mui/material';

import {
  Search as SearchIcon
} from '@mui/icons-material';

// --- Local helpers ---

function getPersonName(patient) {
  const text = get(patient, 'name.0.text');
  if (text) return text;
  const given = get(patient, 'name.0.given.0', '');
  const family = get(patient, 'name.0.family', '');
  return (given + ' ' + family).trim() || 'Unknown';
}

function getSeverityLabel(severity) {
  if (!severity) return 'Moderate';
  const code = get(severity, 'coding.0.code', '');
  const display = get(severity, 'coding.0.display', '');
  return display || code || 'Moderate';
}

// --- Component ---

export default function SymptomsTabContent({ isDark, cardBgColor, cardTextColor }) {
  // Patient context from Session
  const selectedPatient = useTracker(function() {
    return Session.get('selectedPatient');
  }, []);

  const selectedPatientId = useTracker(function() {
    return Session.get('selectedPatientId');
  }, []);

  // Search state
  const [issueDescription, setIssueDescription] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Selection state
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  // Today's logged Conditions for this patient
  const { todayConditions } = useTracker(function() {
    const Conditions = get(global, 'Collections.Conditions') ||
      get(Meteor, 'Collections.Conditions');

    if (!Conditions || !selectedPatientId) {
      return { todayConditions: [] };
    }

    const todayStart = moment().startOf('day').toISOString();
    const todayEnd = moment().endOf('day').toISOString();

    return {
      todayConditions: Conditions.find({
        'subject.reference': { $regex: selectedPatientId },
        recordedDate: {
          $gte: todayStart,
          $lte: todayEnd
        }
      }).fetch()
    };
  }, [selectedPatientId]);

  // Search handler
  async function handleSearch() {
    const trimmed = issueDescription.trim();
    if (!trimmed || trimmed.length < 3) {
      setSearchError('Please describe your symptoms in more detail (at least 3 characters)');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setHasSearched(true);

    try {
      const results = await Meteor.callAsync('performSemanticSearch', {
        query: trimmed,
        resourceType: 'Condition',
        limit: 20
      });

      if (results && Array.isArray(results)) {
        setSearchResults(results);
        console.log('[SymptomsTabContent] Found', results.length, 'results');
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('[SymptomsTabContent] Search error:', err);
      setSearchError(err.message || 'Failed to search for symptoms');
    } finally {
      setIsSearching(false);
    }
  }

  // Toggle symptom selection
  function handleSymptomToggle(symptom) {
    setSelectedSymptoms(function(prev) {
      const isSelected = prev.some(function(s) { return s.code === symptom.code; });
      if (isSelected) {
        return prev.filter(function(s) { return s.code !== symptom.code; });
      } else {
        return [...prev, symptom];
      }
    });
  }

  // Remove a selected symptom chip
  function handleRemoveSymptom(symptomCode) {
    setSelectedSymptoms(function(prev) {
      return prev.filter(function(s) { return s.code !== symptomCode; });
    });
  }

  // Submit handler — log each selected symptom as a Condition resource
  async function handleLogSymptoms() {
    if (selectedSymptoms.length === 0 || !selectedPatient) return;

    setSubmitting(true);
    setError(null);

    const patientId = get(selectedPatient, '_id');
    const patientName = getPersonName(selectedPatient);
    const now = new Date().toISOString();

    try {
      for (let i = 0; i < selectedSymptoms.length; i++) {
        const symptom = selectedSymptoms[i];
        const conditionId = Random.id();

        const condition = {
          _id: conditionId,
          id: conditionId,
          resourceType: 'Condition',
          clinicalStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active',
              display: 'Active'
            }]
          },
          verificationStatus: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'provisional',
              display: 'Provisional'
            }]
          },
          category: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/condition-category',
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis'
            }]
          }],
          code: {
            coding: [{
              system: symptom.system || 'http://snomed.info/sct',
              code: symptom.code,
              display: symptom.display
            }],
            text: symptom.display
          },
          subject: {
            reference: 'Patient/' + patientId,
            display: patientName
          },
          recordedDate: now,
          note: notes.trim() ? [{ text: notes.trim() }] : undefined
        };

        await Meteor.callAsync('conditions.create', condition);
        console.log('[SymptomsTabContent] Logged condition:', conditionId, symptom.display);
      }

      const count = selectedSymptoms.length;
      setSnackbar({
        open: true,
        message: 'Logged ' + count + ' symptom' + (count > 1 ? 's' : '') + ' for ' + patientName
      });

      // Reset selection
      setSelectedSymptoms([]);
      setNotes('');

    } catch (err) {
      console.error('[SymptomsTabContent] Error logging symptoms:', err);
      setError(err.message || 'Failed to log symptoms');
    } finally {
      setSubmitting(false);
    }
  }

  // Guard: no patient selected
  if (!selectedPatient) {
    return (
      <Alert
        severity="warning"
        sx={{
          bgcolor: isDark ? 'rgba(237, 108, 2, 0.15)' : 'rgba(237, 108, 2, 0.1)',
          color: cardTextColor,
          '& .MuiAlert-icon': { color: isDark ? '#ff9800' : '#ed6c02' },
          '& .MuiAlertTitle-root': { color: cardTextColor }
        }}
      >
        <AlertTitle>No Patient Selected</AlertTitle>
        Please select a patient from the sidebar to track symptoms.
      </Alert>
    );
  }

  return (
    <Box id="symptomsTabContent">
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            bgcolor: isDark ? 'rgba(211, 47, 47, 0.15)' : 'rgba(211, 47, 47, 0.1)',
            color: cardTextColor,
            '& .MuiAlert-icon': { color: isDark ? '#f44336' : '#d32f2f' }
          }}
        >
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* LEFT: Report Symptoms Card */}
        <Grid item xs={12} md={8}>
          <Card sx={{
            bgcolor: cardBgColor,
            color: cardTextColor,
            '& .MuiInputLabel-root': { color: cardTextColor },
            '& .MuiOutlinedInput-root': { color: cardTextColor },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)' },
            '& .MuiCheckbox-root': { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)' },
            '& .MuiFormControlLabel-label': { color: cardTextColor }
          }}>
            <CardHeader
              title="Report Symptoms"
              action={
                selectedSymptoms.length > 0 ? (
                  <Chip
                    label={selectedSymptoms.length + ' selected'}
                    color="primary"
                    size="small"
                    sx={{ mr: 1 }}
                  />
                ) : null
              }
              sx={{
                '& .MuiCardHeader-title': { color: cardTextColor }
              }}
            />
            <CardContent>
              {/* Describe symptoms */}
              <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', mb: 2 }}>
                Describe your symptoms or medical concern, then search for matching conditions.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
                <TextField
                  id="symptomDescriptionInput"
                  fullWidth
                  multiline
                  rows={3}
                  label="Describe your symptoms"
                  placeholder="Example: sharp pain in lower back, headache with nausea, persistent fatigue..."
                  value={issueDescription}
                  onChange={function(e) { setIssueDescription(e.target.value); }}
                  disabled={isSearching}
                  error={Boolean(searchError)}
                  helperText={searchError}
                />
                <Button
                  id="symptomSearchButton"
                  variant="contained"
                  onClick={handleSearch}
                  disabled={isSearching || !issueDescription.trim()}
                  sx={{ minWidth: 100, alignSelf: 'flex-start', mt: 1 }}
                  startIcon={isSearching ? <CircularProgress size={18} /> : <SearchIcon />}
                >
                  {isSearching ? 'Searching' : 'Search'}
                </Button>
              </Box>

              {/* Search results */}
              {isSearching && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={32} />
                  <Typography sx={{ ml: 2, color: cardTextColor }}>Analyzing symptoms...</Typography>
                </Box>
              )}

              {!isSearching && searchResults.length > 0 && (
                <Box sx={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  borderRadius: 1,
                  p: 2,
                  mb: 2
                }}>
                  <Typography variant="subtitle2" sx={{ color: cardTextColor, mb: 1 }}>
                    Select matching symptoms ({searchResults.length} found):
                  </Typography>
                  <FormGroup>
                    {searchResults.map(function(symptom) {
                      const isSelected = selectedSymptoms.some(function(s) { return s.code === symptom.code; });
                      return (
                        <Box
                          key={symptom.code || symptom.id}
                          sx={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            width: '100%',
                            mb: 1,
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                            bgcolor: isSelected
                              ? (isDark ? 'rgba(33,150,243,0.15)' : 'rgba(25,118,210,0.08)')
                              : 'transparent',
                            '&:hover': {
                              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                            }
                          }}
                        >
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={isSelected}
                                onChange={function() { handleSymptomToggle(symptom); }}
                                color="primary"
                                sx={{ mt: -0.5 }}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant="body2" sx={{ color: cardTextColor }}>
                                  {symptom.display}
                                </Typography>
                                {symptom.description && (
                                  <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                                    {symptom.description}
                                  </Typography>
                                )}
                              </Box>
                            }
                            sx={{ flex: 1, m: 0 }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
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
                      );
                    })}
                  </FormGroup>
                </Box>
              )}

              {!isSearching && hasSearched && searchResults.length === 0 && !searchError && (
                <Alert
                  severity="info"
                  sx={{
                    bgcolor: isDark ? 'rgba(33, 150, 243, 0.15)' : 'rgba(33, 150, 243, 0.1)',
                    color: cardTextColor,
                    '& .MuiAlert-icon': { color: isDark ? '#90caf9' : '#1976d2' }
                  }}
                >
                  No matching symptoms found. Try describing your issue differently.
                </Alert>
              )}

              {/* Selected Chips below search */}
              {selectedSymptoms.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: cardTextColor, mb: 1 }}>
                    Selected Symptoms:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {selectedSymptoms.map(function(symptom) {
                      return (
                        <Chip
                          key={symptom.code}
                          label={symptom.display}
                          color="primary"
                          size="small"
                          onDelete={function() { handleRemoveSymptom(symptom.code); }}
                        />
                      );
                    })}
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT: Sidebar */}
        <Grid item xs={12} md={4}>
          <Box sx={{ position: { md: 'sticky' }, top: { md: 20 } }}>
            {/* Log Symptoms Card */}
            <Card sx={{
              bgcolor: cardBgColor,
              color: cardTextColor,
              mb: 3,
              '& .MuiInputLabel-root': { color: cardTextColor },
              '& .MuiOutlinedInput-root': { color: cardTextColor },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: isDark ? 'rgba(255,255,255,0.23)' : 'rgba(0,0,0,0.23)' }
            }}>
              <CardHeader
                title="Log Symptoms"
                sx={{ '& .MuiCardHeader-title': { color: cardTextColor } }}
              />
              <CardContent>
                {selectedSymptoms.length === 0 ? (
                  <Typography
                    variant="body2"
                    sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', mb: 2, textAlign: 'center', py: 2 }}
                  >
                    Search and select symptoms to log
                  </Typography>
                ) : (
                  <Box sx={{ mb: 2 }}>
                    {selectedSymptoms.map(function(symptom) {
                      return (
                        <Box
                          key={symptom.code}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            py: 1,
                            borderBottom: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                            <Typography variant="body2" sx={{ color: cardTextColor }} noWrap>
                              {symptom.display}
                            </Typography>
                            <Typography variant="caption" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                              {symptom.system || 'SNOMED CT'} | {symptom.code}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            onClick={function() { handleRemoveSymptom(symptom.code); }}
                            sx={{
                              minWidth: 28, px: 0, py: 0,
                              color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                              fontSize: '0.85rem'
                            }}
                          >
                            &times;
                          </Button>
                        </Box>
                      );
                    })}
                  </Box>
                )}

                {/* Notes */}
                <Box sx={{ mb: 2 }}>
                  <TextField
                    id="symptomNotesInput"
                    fullWidth
                    label="Notes (optional)"
                    multiline
                    rows={2}
                    value={notes}
                    onChange={function(e) { setNotes(e.target.value); }}
                    placeholder="e.g., Started after dinner, moderate severity..."
                    size="small"
                  />
                </Box>

                {/* Patient info */}
                <Alert
                  severity="info"
                  sx={{
                    mb: 2,
                    bgcolor: isDark ? 'rgba(33, 150, 243, 0.15)' : 'rgba(33, 150, 243, 0.1)',
                    color: cardTextColor,
                    '& .MuiAlert-icon': { color: isDark ? '#90caf9' : '#1976d2' }
                  }}
                >
                  Logging for: <strong>{getPersonName(selectedPatient)}</strong>
                </Alert>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button
                  id="logSymptomsButton"
                  variant="contained"
                  fullWidth
                  onClick={handleLogSymptoms}
                  disabled={submitting || selectedSymptoms.length === 0}
                >
                  {submitting ? <CircularProgress size={24} /> : 'Log Symptoms (' + selectedSymptoms.length + ')'}
                </Button>
              </CardActions>
            </Card>

            {/* Today's Log Card */}
            <Card sx={{
              bgcolor: cardBgColor,
              color: cardTextColor,
              '& .MuiTableCell-root': { color: cardTextColor, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }
            }}>
              <CardHeader
                title="Today's Log"
                subheader={moment().format('ddd, MMM D')}
                titleTypographyProps={{ variant: 'subtitle1' }}
                sx={{
                  pb: 0,
                  '& .MuiCardHeader-title': { color: cardTextColor },
                  '& .MuiCardHeader-subheader': { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }
                }}
              />
              <CardContent sx={{ pt: 1 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Time</TableCell>
                        <TableCell>Symptom</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {todayConditions.map(function(condition, index) {
                        const display = get(condition, 'code.text', get(condition, 'code.coding.0.display', 'Unknown'));
                        const time = moment(condition.recordedDate).format('HH:mm');
                        const status = get(condition, 'clinicalStatus.coding.0.display', 'Active');

                        return (
                          <TableRow key={condition._id || index}>
                            <TableCell sx={{ py: 0.5 }}>{time}</TableCell>
                            <TableCell sx={{ py: 0.5 }}>{display}</TableCell>
                            <TableCell sx={{ py: 0.5 }}>{status}</TableCell>
                          </TableRow>
                        );
                      })}
                      {todayConditions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} align="center">
                            <Typography variant="body2" sx={{ py: 1, color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                              No symptoms logged today
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* Success Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={function() { setSnackbar({ open: false, message: '' }); }}
        message={snackbar.message}
      />
    </Box>
  );
}
