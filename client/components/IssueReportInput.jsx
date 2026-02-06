// packages/symptom-tracking/client/components/IssueReportInput.jsx

import React, { useState } from 'react';
import { 
  TextField, 
  Button, 
  Box, 
  Typography, 
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

export function IssueReportInput({ onSubmit, isLoading = false, error = null }) {
  const [issueDescription, setIssueDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = function(event) {
    event.preventDefault();
    
    // Clear any previous validation errors
    setValidationError('');
    
    // Validate input
    const trimmedDescription = issueDescription.trim();
    if (!trimmedDescription) {
      setValidationError('Please describe your medical issue');
      return;
    }
    
    if (trimmedDescription.length < 10) {
      setValidationError('Please provide more detail about your symptoms');
      return;
    }
    
    // Call the parent's onSubmit handler
    onSubmit(trimmedDescription);
  };

  const handleChange = function(event) {
    setIssueDescription(event.target.value);
    // Clear validation error when user starts typing
    if (validationError) {
      setValidationError('');
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Box component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          Describe Your Medical Issue
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Please describe your symptoms or medical concern in detail. Include information about:
          location, severity, duration, and any associated symptoms.
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          placeholder="Example: I have sharp pain in my lower back on the right side that started 2 hours ago..."
          value={issueDescription}
          onChange={handleChange}
          error={Boolean(validationError || error)}
          helperText={validationError || error}
          disabled={isLoading}
          sx={{ mb: 2 }}
        />

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isLoading || !issueDescription.trim()}
          startIcon={isLoading ? <CircularProgress size={20} /> : <SearchIcon />}
        >
          {isLoading ? 'Searching for Related Symptoms...' : 'Search for Related Symptoms'}
        </Button>
      </Box>
    </Paper>
  );
}