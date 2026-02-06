// packages/symptom-tracking/client/components/SymptomSelector.jsx

import React, { useState } from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Button,
  Paper,
  Chip,
  Alert
} from '@mui/material';
import { NavigateNext as NextIcon } from '@mui/icons-material';

export function SymptomSelector({ symptoms = [], onContinue, minSelections = 1 }) {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [validationError, setValidationError] = useState('');

  const handleSymptomToggle = function(symptom) {
    setSelectedSymptoms(function(prevSelected) {
      const isCurrentlySelected = prevSelected.some(s => s.id === symptom.id);
      
      if (isCurrentlySelected) {
        // Remove from selection
        return prevSelected.filter(s => s.id !== symptom.id);
      } else {
        // Add to selection
        return [...prevSelected, symptom];
      }
    });
    
    // Clear validation error when user makes a selection
    if (validationError) {
      setValidationError('');
    }
  };

  const handleContinue = function() {
    if (selectedSymptoms.length < minSelections) {
      setValidationError(`Please select at least ${minSelections} symptom(s) to continue`);
      return;
    }
    
    onContinue(selectedSymptoms);
  };

  const isSymptomSelected = function(symptomId) {
    return selectedSymptoms.some(s => s.id === symptomId);
  };

  if (!symptoms || symptoms.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <Alert severity="info">
          No symptoms found. Please try describing your issue differently.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Box>
        <Typography variant="h6" gutterBottom>
          Select Relevant Symptoms
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Please select all symptoms that apply to your current condition:
        </Typography>

        {selectedSymptoms.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Selected ({selectedSymptoms.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {selectedSymptoms.map(function(symptom) {
                return (
                  <Chip
                    key={symptom.id}
                    label={symptom.display}
                    color="primary"
                    size="small"
                    onDelete={() => handleSymptomToggle(symptom)}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        <FormGroup sx={{ mb: 3 }}>
          {symptoms.map(function(symptom) {
            return (
              <FormControlLabel
                key={symptom.id}
                control={
                  <Checkbox
                    checked={isSymptomSelected(symptom.id)}
                    onChange={() => handleSymptomToggle(symptom)}
                    color="primary"
                  />
                }
                label={
                  <Box>
                    <Typography variant="body1">
                      {symptom.display}
                    </Typography>
                    {symptom.description && (
                      <Typography variant="caption" color="text.secondary">
                        {symptom.description}
                      </Typography>
                    )}
                  </Box>
                }
                sx={{ 
                  mb: 1, 
                  '& .MuiFormControlLabel-label': { 
                    display: 'flex', 
                    flexDirection: 'column' 
                  } 
                }}
              />
            );
          })}
        </FormGroup>

        {validationError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {validationError}
          </Alert>
        )}

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleContinue}
          disabled={selectedSymptoms.length === 0}
          endIcon={<NextIcon />}
        >
          Continue to Assessment ({selectedSymptoms.length} selected)
        </Button>
      </Box>
    </Paper>
  );
}