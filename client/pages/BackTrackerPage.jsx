// /Volumes/SonicMagic/Code/honeycomb-public-release/packages/symptom-tracking/client/pages/BackTrackerPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTracker } from 'meteor/react-meteor-data';

import { 
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Chip,
  Container,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

// Date handling with moment

import { get, set } from 'lodash';
import moment from 'moment';

import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';

// These will be loaded from Meteor object
// import PatientSearchDialog from '/imports/components/PatientSearchDialog';
// import { FhirUtilities } from '/imports/lib/FhirUtilities';

// Get the Patients collection 
let Patients;
Meteor.startup(function(){
  if (Meteor.Collections?.Patients) {
    Patients = Meteor.Collections.Patients;
  }
});

// Get the Conditions collection from Meteor.Collections
let Conditions;
Meteor.startup(function(){
  Conditions = Meteor.Collections.Conditions;
});

export function BackTrackerPage(props) {
  const navigate = useNavigate();
  
  // Get theme primary color from settings or use default
  const themePrimaryColor = get(Meteor, 'settings.public.theme.palette.primary.main', '#1976d2');
  
  // State for calendar view mode (3, 6, or 9 months)
  const [calendarView, setCalendarView] = useState('3months');
  
  // State for cycle reference display
  const [showCycleReference, setShowCycleReference] = useState(false);
  
  // State for cycle estimate data
  const [cycleData, setCycleData] = useState({
    newDate: '',  // New moon date
    fullDate: '', // Full moon date
    cycleLength: 28,
    color: '#C75B7A' // Dusty maroon/rose color
  });
  
  // Separate state for cycle moon dates (virtual/shadow dates)
  const [cycleMoonDates, setCycleMoonDates] = useState([]);
  
  // Date range state - default to last 28 days
  const [dateRange, setDateRange] = useState({
    start: moment().subtract(28, 'days').format('YYYY-MM-DD'),
    end: moment().format('YYYY-MM-DD'),
    color: themePrimaryColor
  });
  
  // Store multiple date ranges for calendar display
  const [dateRanges, setDateRanges] = useState([]);
  
  // Preset date ranges
  const presetRanges = {
    'Last 7 Days': () => ({
      start: moment().subtract(7, 'days').format('YYYY-MM-DD'),
      end: moment().format('YYYY-MM-DD'),
      color: dateRange.color || themePrimaryColor
    }),
    'Last 28 Days': () => ({
      start: moment().subtract(28, 'days').format('YYYY-MM-DD'),
      end: moment().format('YYYY-MM-DD'),
      color: dateRange.color || themePrimaryColor
    }),
    'This Month': () => ({
      start: moment().startOf('month').format('YYYY-MM-DD'),
      end: moment().endOf('month').format('YYYY-MM-DD'),
      color: dateRange.color || themePrimaryColor
    }),
    'Last Month': () => ({
      start: moment().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
      end: moment().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
      color: dateRange.color || themePrimaryColor
    }),
    'Last 3 Months': () => ({
      start: moment().subtract(3, 'months').format('YYYY-MM-DD'),
      end: moment().format('YYYY-MM-DD'),
      color: dateRange.color || themePrimaryColor
    })
  };
  
  // Subscribe to conditions and patients data
  const subscriptionReady = useTracker(() => {
    const conditionsHandle = Meteor.subscribe('conditions.all');
    const patientsHandle = Meteor.subscribe('patients.all');
    return conditionsHandle.ready() && patientsHandle.ready();
  }, []);

  // Get selected patient and current user from session/tracker
  const selectedPatient = useTracker(function() {
    return Session.get('selectedPatient');
  }, []);
  
  const selectedPatientId = useTracker(function() {
    return Session.get('selectedPatientId');
  }, []);
  
  const currentUser = useTracker(function() {
    return Meteor.user();
  }, []);

  // State for handling terminology chip clicks
  const [newCondition, setNewCondition] = useState({
    code: '',
    display: '',
    system: 'http://snomed.info/sct'
  });
  
  // State for selected terminology chip
  const [selectedChipId, setSelectedChipId] = useState(null);
  
  // Initialize state with proper FHIR R4 structure for a new condition
  const [condition, setCondition] = useState({
    resourceType: "Condition",
    subject: {
      reference: "",
      display: ""
    },
    encounter: {
      reference: "",
      display: ""
    },
    asserter: {
      reference: "",
      display: ""
    },
    recordedDate: moment().format('YYYY-MM-DD'),
    code: {
      coding: [{
        system: "http://snomed.info/sct",
        code: "",
        display: ""
      }],
      text: ""
    },
    clinicalStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
        code: "active",
        display: "Active"
      }]
    },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        code: "provisional",
        display: "Provisional"
      }]
    },
    category: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-category",
        code: "problem-list-item",
        display: "Problem List Item"
      }]
    }],
    severity: {
      coding: [{
        system: "http://snomed.info/sct",
        code: "",
        display: ""
      }]
    },
    onsetDateTime: "",
    note: [{
      text: ""
    }]
  });

  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  
  // Set patient info when selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      setCondition(prev => ({
        ...prev,
        subject: {
          reference: `Patient/${get(selectedPatient, 'id', '')}`,
          display: get(selectedPatient, 'name[0].text', '')
        }
      }));
    }
  }, [selectedPatient]);

  // Set asserter to current user
  useEffect(() => {
    if (currentUser) {
      const userName = get(currentUser, 'profile.name.text', get(currentUser, 'username', ''));
      setCondition(prev => ({
        ...prev,
        asserter: {
          reference: `Practitioner/${get(currentUser, '_id', '')}`,
          display: userName
        }
      }));
    }
  }, [currentUser]);

  // Load conditions within date range for selected patient
  const loadConditions = useTracker(() => {
    if (!selectedPatient || !dateRange.start || !dateRange.end) return [];
    
    const query = {
      'subject.reference': `Patient/${get(selectedPatient, 'id', '')}`,
      'onsetDateTime': {
        $gte: dateRange.start,
        $lte: dateRange.end
      }
    };
    
    return Conditions ? Conditions.find(query).fetch() : [];
  }, [selectedPatient, dateRange]);

  useEffect(() => {
    setConditions(loadConditions);
  }, [loadConditions]);

  // Handle form field changes
  const handleChange = (path, value) => {
    setCondition(prev => {
      const newCondition = { ...prev };
      set(newCondition, path, value);
      return newCondition;
    });
  };

  // Handle terminology chip click - populate the Add Condition form
  const handleTerminologyClick = (code, display, system, chipId) => {
    // Map terminology systems to FHIR URLs
    const systemMap = {
      'SNOMED': 'http://snomed.info/sct',
      'LOINC': 'http://loinc.org',
      'ICD-10': 'http://hl7.org/fhir/sid/icd-10'
    };
    
    // Update the condition's code
    handleChange('code.coding[0].system', systemMap[system] || 'http://snomed.info/sct');
    handleChange('code.coding[0].code', code);
    handleChange('code.coding[0].display', display);
    handleChange('code.text', display);
    
    // Track which chip is selected
    setSelectedChipId(chipId);
  };

  // Handle calendar day click - set onset date for new date range
  const handleDayClick = (monthMoment, day) => {
    if (!day) return;
    
    const clickedDate = monthMoment.clone().date(day).format('YYYY-MM-DD');
    setDateRange(prev => ({ ...prev, start: clickedDate }));
  };

  // Handle saving condition
  const handleSaveCondition = async () => {
    if (!condition.code.text) {
      setError('Please enter a condition description');
      return;
    }
    
    // Set onset date to the start of the selected range if not specified
    const onsetDate = condition.onsetDateTime || dateRange.start;
    
    setLoading(true);
    setError(null);
    
    try {
      const dataToSave = {
        ...condition,
        onsetDateTime: onsetDate,
        recordedDate: moment().format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      };
      
      await Meteor.callAsync('conditions.create', dataToSave);
      
      // Reset form for next entry
      setCondition(prev => ({
        ...prev,
        code: {
          coding: [{
            system: "http://snomed.info/sct",
            code: "",
            display: ""
          }],
          text: ""
        },
        onsetDateTime: "",
        severity: {
          coding: [{
            system: "http://snomed.info/sct",
            code: "",
            display: ""
          }]
        },
        note: [{
          text: ""
        }]
      }));
      
      // Reload conditions
      const updatedConditions = await Conditions.find({
        'subject.reference': `Patient/${get(selectedPatient, 'id', '')}`,
        'onsetDateTime': {
          $gte: dateRange.start,
          $lte: dateRange.end
        }
      }).fetch();
      
      setConditions(updatedConditions);
      
    } catch (error) {
      console.error('Error saving condition:', error);
      setError(error.message || 'Failed to save condition');
    } finally {
      setLoading(false);
    }
  };


  // Check if a day is within any date range or is a moon date
  const getDayColor = (monthMoment, day) => {
    if (!day) return null;
    
    const dayDate = monthMoment.clone().date(day);
    const dayDateStr = dayDate.format('YYYY-MM-DD');
    
    // First check cycle moon dates (they take precedence for visualization)
    for (const moonDate of cycleMoonDates) {
      if (moonDate.start === dayDateStr) {
        return moonDate.color;
      }
    }
    
    // Then check saved dateRanges
    for (const range of dateRanges) {
      if (!range.start || !range.end) continue;
      
      const start = moment(range.start);
      const end = moment(range.end);
      if (dayDate.isSameOrAfter(start, 'day') && dayDate.isSameOrBefore(end, 'day')) {
        return range.color;
      }
    }
    
    return null;
  };

  // Generate calendar data for 3 months
  const generateCalendarMonth = (monthOffset = 0) => {
    const targetMonth = moment().add(monthOffset, 'months');
    const startOfMonth = targetMonth.clone().startOf('month');
    const endOfMonth = targetMonth.clone().endOf('month');
    
    // Get the first day of the week for the month (Sunday = 0)
    const startDay = startOfMonth.day();
    
    // Create array for calendar days (5 weeks x 7 days)
    const calendarDays = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      calendarDays.push(null);
    }
    
    // Add all days of the month with color information
    const daysInMonth = endOfMonth.date();
    for (let day = 1; day <= daysInMonth; day++) {
      calendarDays.push({
        day: day,
        color: getDayColor(targetMonth, day)
      });
    }
    
    // Fill remaining cells to complete 35 cells (5 weeks)
    while (calendarDays.length < 35) {
      calendarDays.push(null);
    }
    
    return {
      month: targetMonth.format('MMMM YYYY'),
      days: calendarDays,
      monthMoment: targetMonth
    };
  };

  // Generate calendar months - make them reactive to dateRanges and cycleMoonDates changes
  // For 9-month view, we need months -7, -6, -5 as well
  const month7Ago = React.useMemo(() => generateCalendarMonth(-7), [dateRanges, dateRange, cycleMoonDates]);
  const month6Ago = React.useMemo(() => generateCalendarMonth(-6), [dateRanges, dateRange, cycleMoonDates]);
  const month5Ago = React.useMemo(() => generateCalendarMonth(-5), [dateRanges, dateRange, cycleMoonDates]);
  // For 6-month view, we need months -4, -3, -2 as well
  const month4Ago = React.useMemo(() => generateCalendarMonth(-4), [dateRanges, dateRange, cycleMoonDates]);
  const month3Ago = React.useMemo(() => generateCalendarMonth(-3), [dateRanges, dateRange, cycleMoonDates]);
  const month2Ago = React.useMemo(() => generateCalendarMonth(-2), [dateRanges, dateRange, cycleMoonDates]);
  const lastMonth = React.useMemo(() => generateCalendarMonth(-1), [dateRanges, dateRange, cycleMoonDates]);
  const currentMonth = React.useMemo(() => generateCalendarMonth(0), [dateRanges, dateRange, cycleMoonDates]);
  const nextMonth = React.useMemo(() => generateCalendarMonth(1), [dateRanges, dateRange, cycleMoonDates]);

  return (
    <Box 
      id="symptomBackTrackerPage" 
      sx={{ 
        px: 3, 
        py: 4,
        bgcolor: theme => theme.palette.mode === 'light' 
          ? theme.palette.grey[50] 
          : theme.palette.background.default,
        minHeight: '100vh'
      }}
    >
      {/* Header with title and view toggle buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Symptom Backtracker
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant={calendarView === '3months' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setCalendarView('3months')}
          >
            3 months
          </Button>
          <Button
            variant={calendarView === '6months' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setCalendarView('6months')}
          >
            6 months
          </Button>
          <Button
            variant={calendarView === '9months' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setCalendarView('9months')}
          >
            9 months
          </Button>
          <Button
            variant={showCycleReference ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setShowCycleReference(!showCycleReference)}
          >
            view cycle reference
          </Button>
        </Stack>
      </Box>
      
      {/* 9-Month View - First 3 months (shown only when 9months is selected) */}
      {calendarView === '9months' && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Month -7 */}
          <Grid item xs={12} md={4} lg={4}>
            <Card>
              <CardHeader 
                title={month7Ago.month}
                titleTypographyProps={{ variant: 'h6', align: 'center' }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Grid container>
                  {/* Day headers row */}
                  <Grid container item xs={12} spacing={0}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Grid item key={day} xs style={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {day}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Calendar weeks (5 rows) */}
                  {[0, 1, 2, 3, 4].map((weekIndex) => (
                    <Grid container item xs={12} spacing={0} key={weekIndex}>
                      {month7Ago.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: dayData?.day ? 'pointer' : 'default',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography variant="body2">
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Month -6 */}
          <Grid item xs={12} md={4} lg={4}>
            <Card>
              <CardHeader 
                title={month6Ago.month}
                titleTypographyProps={{ variant: 'h6', align: 'center' }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Grid container>
                  {/* Day headers row */}
                  <Grid container item xs={12} spacing={0}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Grid item key={day} xs style={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {day}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Calendar weeks (5 rows) */}
                  {[0, 1, 2, 3, 4].map((weekIndex) => (
                    <Grid container item xs={12} spacing={0} key={weekIndex}>
                      {month6Ago.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: dayData?.day ? 'pointer' : 'default',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography variant="body2">
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Month -5 */}
          <Grid item xs={12} md={4} lg={4}>
            <Card>
              <CardHeader 
                title={month5Ago.month}
                titleTypographyProps={{ variant: 'h6', align: 'center' }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Grid container>
                  {/* Day headers row */}
                  <Grid container item xs={12} spacing={0}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Grid item key={day} xs style={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {day}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Calendar weeks (5 rows) */}
                  {[0, 1, 2, 3, 4].map((weekIndex) => (
                    <Grid container item xs={12} spacing={0} key={weekIndex}>
                      {month5Ago.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: dayData?.day ? 'pointer' : 'default',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography variant="body2">
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* 6-Month View - First 3 months (shown when 6months OR 9months is selected) */}
      {(calendarView === '6months' || calendarView === '9months') && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Month -4 */}
          <Grid item xs={12} md={4} lg={4}>
            <Card>
              <CardHeader 
                title={month4Ago.month}
                titleTypographyProps={{ variant: 'h6', align: 'center' }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Grid container>
                  {/* Day headers row */}
                  <Grid container item xs={12} spacing={0}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Grid item key={day} xs style={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {day}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Calendar weeks (5 rows) */}
                  {[0, 1, 2, 3, 4].map((weekIndex) => (
                    <Grid container item xs={12} spacing={0} key={weekIndex}>
                      {month4Ago.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: dayData?.day ? 'pointer' : 'default',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography variant="body2">
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Month -3 */}
          <Grid item xs={12} md={4} lg={4}>
            <Card>
              <CardHeader 
                title={month3Ago.month}
                titleTypographyProps={{ variant: 'h6', align: 'center' }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Grid container>
                  {/* Day headers row */}
                  <Grid container item xs={12} spacing={0}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Grid item key={day} xs style={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {day}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Calendar weeks (5 rows) */}
                  {[0, 1, 2, 3, 4].map((weekIndex) => (
                    <Grid container item xs={12} spacing={0} key={weekIndex}>
                      {month3Ago.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: dayData?.day ? 'pointer' : 'default',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography variant="body2">
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Month -2 */}
          <Grid item xs={12} md={4} lg={4}>
            <Card>
              <CardHeader 
                title={month2Ago.month}
                titleTypographyProps={{ variant: 'h6', align: 'center' }}
                sx={{ pb: 1 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <Grid container>
                  {/* Day headers row */}
                  <Grid container item xs={12} spacing={0}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <Grid item key={day} xs style={{ textAlign: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {day}
                        </Typography>
                      </Grid>
                    ))}
                  </Grid>
                  {/* Calendar weeks (5 rows) */}
                  {[0, 1, 2, 3, 4].map((weekIndex) => (
                    <Grid container item xs={12} spacing={0} key={weekIndex}>
                      {month2Ago.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              cursor: dayData?.day ? 'pointer' : 'default',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover',
                                borderRadius: 1
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography variant="body2">
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main 3-Month Calendar Grid (always shown) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Last Month */}
        <Grid item xs={12} md={4} lg={4}>
          <Card>
            <CardHeader 
              title={lastMonth.month}
              titleTypographyProps={{ variant: 'h6', align: 'center' }}
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container>
                {/* Day headers row */}
                <Grid container item xs={12} spacing={0}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Grid item key={day} xs style={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {day}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
                {/* Calendar weeks (5 rows) */}
                {[0, 1, 2, 3, 4].map((weekIndex) => (
                  <Grid container item xs={12} spacing={0} key={weekIndex}>
                    {lastMonth.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                      <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                        <Box
                          onClick={() => handleDayClick(lastMonth.monthMoment, dayData?.day)}
                          sx={{
                            height: 40,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            cursor: dayData?.day ? 'pointer' : 'default',
                            '&:hover': dayData?.day ? {
                              bgcolor: 'action.hover',
                              borderRadius: 1
                            } : {}
                          }}
                        >
                          {dayData?.day && (
                            <>
                              <Typography variant="body2">
                                {dayData.day}
                              </Typography>
                              {dayData.color && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: 2,
                                    width: 20,
                                    height: 4,
                                    bgcolor: dayData.color,
                                    borderRadius: 0.5
                                  }}
                                />
                              )}
                            </>
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Current Month */}
        <Grid item xs={12} md={4} lg={4}>
          <Card>
            <CardHeader 
              title={currentMonth.month}
              titleTypographyProps={{ variant: 'h6', align: 'center' }}
              sx={{ pb: 1, bgcolor: 'primary.main', color: 'primary.contrastText' }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container>
                {/* Day headers row */}
                <Grid container item xs={12} spacing={0}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Grid item key={day} xs style={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {day}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
                {/* Calendar weeks (5 rows) */}
                {[0, 1, 2, 3, 4].map((weekIndex) => (
                  <Grid container item xs={12} spacing={0} key={weekIndex}>
                    {currentMonth.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => {
                      const isToday = dayData?.day === moment().date();
                      return (
                        <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                          <Box
                            onClick={() => handleDayClick(currentMonth.monthMoment, dayData?.day)}
                            sx={{
                              height: 40,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              borderRadius: 1,
                              cursor: dayData?.day ? 'pointer' : 'default',
                              bgcolor: isToday ? 'action.selected' : 'transparent',
                              '&:hover': dayData?.day ? {
                                bgcolor: 'action.hover'
                              } : {}
                            }}
                          >
                            {dayData?.day && (
                              <>
                                <Typography 
                                  variant="body2"
                                  fontWeight={isToday ? 'bold' : 'normal'}
                                >
                                  {dayData.day}
                                </Typography>
                                {dayData.color && (
                                  <Box
                                    sx={{
                                      position: 'absolute',
                                      bottom: 2,
                                      width: 20,
                                      height: 4,
                                      bgcolor: dayData.color,
                                      borderRadius: 0.5
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Next Month */}
        <Grid item xs={12} md={4} lg={4}>
          <Card>
            <CardHeader 
              title={nextMonth.month}
              titleTypographyProps={{ variant: 'h6', align: 'center' }}
              sx={{ pb: 1 }}
            />
            <CardContent sx={{ pt: 0 }}>
              <Grid container>
                {/* Day headers row */}
                <Grid container item xs={12} spacing={0}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Grid item key={day} xs style={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {day}
                      </Typography>
                    </Grid>
                  ))}
                </Grid>
                {/* Calendar weeks (5 rows) */}
                {[0, 1, 2, 3, 4].map((weekIndex) => (
                  <Grid container item xs={12} spacing={0} key={weekIndex}>
                    {nextMonth.days.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayData, dayIndex) => (
                      <Grid item key={`${weekIndex}-${dayIndex}`} xs>
                        <Box
                          onClick={() => handleDayClick(nextMonth.monthMoment, dayData?.day)}
                          sx={{
                            height: 40,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            cursor: dayData?.day ? 'pointer' : 'default',
                            '&:hover': dayData?.day ? {
                              bgcolor: 'action.hover',
                              borderRadius: 1
                            } : {}
                          }}
                        >
                          {dayData?.day && (
                            <>
                              <Typography variant="body2">
                                {dayData.day}
                              </Typography>
                              {dayData.color && (
                                <Box
                                  sx={{
                                    position: 'absolute',
                                    bottom: 2,
                                    width: 20,
                                    height: 4,
                                    bgcolor: dayData.color,
                                    borderRadius: 0.5
                                  }}
                                />
                              )}
                            </>
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Two-column layout for Add Condition and Date Range */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Left Column - Frequent Conditions and Add Condition */}
        <Grid item xs={12} md={6} lg={6}>
          {/* Frequent Conditions Card */}
          {currentUser?.profile?.terminology && (
            currentUser.profile.terminology.snomed?.length > 0 || 
            currentUser.profile.terminology.loinc?.length > 0 || 
            currentUser.profile.terminology.icd10?.length > 0
          ) && (
            <Card sx={{ mb: 2 }}>
              <CardHeader 
                title="Frequent Conditions"
                subheader="Click on a condition to add it to the form below"
              />
              <CardContent>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {/* SNOMED codes - blue border */}
                  {currentUser.profile.terminology.snomed?.map((term, index) => {
                    const chipId = `snomed-${index}`;
                    const isSelected = selectedChipId === chipId;
                    return (
                      <Chip
                        key={chipId}
                        label={`${term.display || term.code}`}
                        onClick={() => handleTerminologyClick(term.code, term.display || term.code, 'SNOMED', chipId)}
                        variant={isSelected ? "filled" : "outlined"}
                        sx={{ 
                          mb: 1,
                          borderColor: '#2196f3',
                          bgcolor: isSelected ? 'rgba(33, 150, 243, 0.2)' : 'transparent',
                          '&:hover': {
                            bgcolor: isSelected ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.08)',
                            borderColor: '#1976d2'
                          }
                        }}
                      />
                    );
                  })}
                  
                  {/* LOINC codes - green border */}
                  {currentUser.profile.terminology.loinc?.map((term, index) => {
                    const chipId = `loinc-${index}`;
                    const isSelected = selectedChipId === chipId;
                    return (
                      <Chip
                        key={chipId}
                        label={`${term.display || term.code}`}
                        onClick={() => handleTerminologyClick(term.code, term.display || term.code, 'LOINC', chipId)}
                        variant={isSelected ? "filled" : "outlined"}
                        sx={{ 
                          mb: 1,
                          borderColor: '#4caf50',
                          bgcolor: isSelected ? 'rgba(76, 175, 80, 0.2)' : 'transparent',
                          '&:hover': {
                            bgcolor: isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.08)',
                            borderColor: '#388e3c'
                          }
                        }}
                      />
                    );
                  })}
                  
                  {/* ICD-10 codes - orange border */}
                  {currentUser.profile.terminology.icd10?.map((term, index) => {
                    const chipId = `icd10-${index}`;
                    const isSelected = selectedChipId === chipId;
                    return (
                      <Chip
                        key={chipId}
                        label={`${term.display || term.code}`}
                        onClick={() => handleTerminologyClick(term.code, term.display || term.code, 'ICD-10', chipId)}
                        variant={isSelected ? "filled" : "outlined"}
                        sx={{ 
                          mb: 1,
                          borderColor: '#ff9800',
                          bgcolor: isSelected ? 'rgba(255, 152, 0, 0.2)' : 'transparent',
                          '&:hover': {
                            bgcolor: isSelected ? 'rgba(255, 152, 0, 0.3)' : 'rgba(255, 152, 0, 0.08)',
                            borderColor: '#f57c00'
                          }
                        }}
                      />
                    );
                  })}
                  
                  {/* Show message if no terminology */}
                  {(!currentUser.profile.terminology.snomed || currentUser.profile.terminology.snomed.length === 0) &&
                   (!currentUser.profile.terminology.loinc || currentUser.profile.terminology.loinc.length === 0) &&
                   (!currentUser.profile.terminology.icd10 || currentUser.profile.terminology.icd10.length === 0) && (
                    <Typography variant="body2" color="text.secondary">
                      No frequent conditions found. Visit My Profile to scan your medical records.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Add Condition Card */}
          <Card>
            <CardHeader 
              title="Add Condition"
              subheader="Enter symptoms or conditions that occurred during the selected date range"
            />
            <CardContent>
              <Grid container spacing={2}>
                {/* Top row - Three select inputs */}
                <Grid item xs={12} md={4} lg={4}>
                  <FormControl fullWidth>
                    <InputLabel id="clinical-status-label">Clinical Status</InputLabel>
                    <Select
                      labelId="clinical-status-label"
                      value={get(condition, 'clinicalStatus.coding[0].code', 'active')}
                      onChange={(e) => {
                        const statusMap = {
                          'active': 'Active',
                          'recurrence': 'Recurrence',
                          'relapse': 'Relapse',
                          'inactive': 'Inactive',
                          'remission': 'Remission',
                          'resolved': 'Resolved'
                        };
                        handleChange('clinicalStatus.coding[0].code', e.target.value);
                        handleChange('clinicalStatus.coding[0].display', statusMap[e.target.value]);
                      }}
                      label="Clinical Status"
                    >
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="recurrence">Recurrence</MenuItem>
                      <MenuItem value="relapse">Relapse</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="remission">Remission</MenuItem>
                      <MenuItem value="resolved">Resolved</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4} lg={4}>
                  <FormControl fullWidth>
                    <InputLabel id="severity-label">Severity</InputLabel>
                    <Select
                      labelId="severity-label"
                      value={get(condition, 'severity.coding[0].code', '')}
                      onChange={(e) => {
                        const severityMap = {
                          '255604002': 'Mild',
                          '6736007': 'Moderate',
                          '24484000': 'Severe'
                        };
                        handleChange('severity.coding[0].code', e.target.value);
                        handleChange('severity.coding[0].display', severityMap[e.target.value]);
                      }}
                      label="Severity"
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="255604002">Mild</MenuItem>
                      <MenuItem value="6736007">Moderate</MenuItem>
                      <MenuItem value="24484000">Severe</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4} lg={4}>
                  <FormControl fullWidth>
                    <InputLabel id="verification-status-label">Verification Status</InputLabel>
                    <Select
                      labelId="verification-status-label"
                      value={get(condition, 'verificationStatus.coding[0].code', 'provisional')}
                      onChange={(e) => {
                        const verificationMap = {
                          'unconfirmed': 'Unconfirmed',
                          'provisional': 'Provisional',
                          'differential': 'Differential',
                          'confirmed': 'Confirmed',
                          'refuted': 'Refuted',
                          'entered-in-error': 'Entered in Error'
                        };
                        handleChange('verificationStatus.coding[0].code', e.target.value);
                        handleChange('verificationStatus.coding[0].display', verificationMap[e.target.value]);
                      }}
                      label="Verification Status"
                    >
                      <MenuItem value="unconfirmed">Unconfirmed</MenuItem>
                      <MenuItem value="provisional">Provisional</MenuItem>
                      <MenuItem value="differential">Differential</MenuItem>
                      <MenuItem value="confirmed">Confirmed</MenuItem>
                      <MenuItem value="refuted">Refuted</MenuItem>
                      <MenuItem value="entered-in-error">Entered in Error</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Condition/Symptom Description with LLM integration placeholder */}
                <Grid item xs={12}>
                  <TextField
                    id="conditionText"
                    label="Condition/Symptom Description"
                    fullWidth
                    multiline
                    rows={2}
                    value={get(condition, 'code.text', '')}
                    onChange={(e) => handleChange('code.text', e.target.value)}
                    helperText="Describe the condition - AI will suggest appropriate codes"
                  />
                </Grid>

                {/* Coding row - System, Code, Description */}
                <Grid item xs={12} md={3} lg={3}>
                  <FormControl fullWidth>
                    <InputLabel id="coding-system-label">System</InputLabel>
                    <Select
                      labelId="coding-system-label"
                      value={get(condition, 'code.coding[0].system', 'http://snomed.info/sct')}
                      onChange={(e) => handleChange('code.coding[0].system', e.target.value)}
                      label="System"
                    >
                      <MenuItem value="http://snomed.info/sct">SNOMED CT</MenuItem>
                      <MenuItem value="http://loinc.org">LOINC</MenuItem>
                      <MenuItem value="http://hl7.org/fhir/sid/icd-10">ICD-10</MenuItem>
                      <MenuItem value="http://hl7.org/fhir/sid/icd-9">ICD-9</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3} lg={3}>
                  <TextField
                    label="Code"
                    fullWidth
                    value={get(condition, 'code.coding[0].code', '')}
                    onChange={(e) => handleChange('code.coding[0].code', e.target.value)}
                    placeholder="e.g., 386661006"
                  />
                </Grid>

                <Grid item xs={10} md={5} lg={5}>
                  <TextField
                    label="Code Description"
                    fullWidth
                    value={get(condition, 'code.coding[0].display', '')}
                    onChange={(e) => handleChange('code.coding[0].display', e.target.value)}
                    placeholder="e.g., Fever"
                  />
                </Grid>

                <Grid item xs={2} md={1} lg={1}>
                  <Tooltip title="Add another code">
                    <IconButton 
                      color="primary"
                      onClick={() => {
                        // TODO: Add logic to append additional coding entries
                        console.log('Add additional code');
                      }}
                      sx={{ mt: 1 }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Grid>

            <Grid item xs={12}>
              <TextField
                id="notes"
                label="Additional Notes"
                fullWidth
                multiline
                rows={3}
                value={get(condition, 'note[0].text', '')}
                onChange={(e) => handleChange('note[0].text', e.target.value)}
              />
            </Grid>
              </Grid>

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Cycle Estimate and Date Range Selection */}
        <Grid item xs={12} md={6} lg={6}>
          {/* Cycle Estimate Card (shown when cycle reference is toggled on) */}
          {showCycleReference && (
            <Card sx={{ mb: 2 }}>
              <CardHeader 
                title="Cycle Estimate"
                subheader="Track lunar cycle patterns"
              />
              <CardContent>
                <Grid container spacing={2} alignItems="center">
                  {/* New Moon Date */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      id="newMoonDate"
                      label="New Moon"
                      type="date"
                      fullWidth
                      value={cycleData.newDate}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        // Automatically calculate Full Moon as halfway through cycle
                        const fullDate = newDate ? 
                          moment(newDate).add(Math.floor(cycleData.cycleLength / 2), 'days').format('YYYY-MM-DD') : 
                          '';
                        setCycleData(prev => ({ 
                          ...prev, 
                          newDate: newDate,
                          fullDate: fullDate 
                        }));
                      }}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      helperText="First day of cycle"
                    />
                  </Grid>
                  
                  {/* Full Moon Date */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      id="fullMoonDate"
                      label="Full Moon"
                      type="date"
                      fullWidth
                      value={cycleData.fullDate}
                      onChange={(e) => setCycleData(prev => ({ ...prev, fullDate: e.target.value }))}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      helperText="Mid-cycle day (auto-calculated)"
                      disabled={!cycleData.newDate}
                    />
                  </Grid>
                  
                  {/* Cycle Length */}
                  <Grid item xs={6} sm={4}>
                    <TextField
                      id="cycleLength"
                      label="Cycle Length (days)"
                      type="number"
                      fullWidth
                      value={cycleData.cycleLength}
                      onChange={(e) => {
                        const newLength = parseInt(e.target.value) || 28;
                        // Recalculate Full Moon if New Moon is set
                        const fullDate = cycleData.newDate ? 
                          moment(cycleData.newDate).add(Math.floor(newLength / 2), 'days').format('YYYY-MM-DD') : 
                          cycleData.fullDate;
                        setCycleData(prev => ({ 
                          ...prev, 
                          cycleLength: newLength,
                          fullDate: fullDate
                        }));
                      }}
                      InputProps={{
                        inputProps: { 
                          min: 20,
                          max: 45
                        }
                      }}
                    />
                  </Grid>
                  
                  {/* Color Picker */}
                  <Grid item xs={6} sm={2}>
                    <Tooltip title="Select cycle color">
                      <Button
                        variant="contained"
                        fullWidth
                        sx={{ 
                          height: 56,
                          bgcolor: cycleData.color,
                          '&:hover': {
                            bgcolor: cycleData.color,
                            filter: 'brightness(0.9)'
                          },
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        <input
                          type="color"
                          value={cycleData.color}
                          onChange={(e) => setCycleData(prev => ({ ...prev, color: e.target.value }))}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            cursor: 'pointer'
                          }}
                        />
                        <Typography variant="caption" sx={{ color: 'white' }}>
                          Color
                        </Typography>
                      </Button>
                    </Tooltip>
                  </Grid>
                  
                  {/* Apply Button */}
                  <Grid item xs={12} sm={6}>
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={() => {
                        console.log('Applying cycle estimate:', cycleData);
                        if (cycleData.newDate) {
                          // Calculate moon dates based on cycle length
                          const moonDates = [];
                          const newMoonStart = moment(cycleData.newDate);
                          const halfCycle = Math.floor(cycleData.cycleLength / 2);
                          
                          // Generate moon dates for the visible calendar range (-7 to +1 months)
                          for (let i = -10; i <= 10; i++) {
                            // New Moon dates
                            const newMoonDate = newMoonStart.clone().add(i * cycleData.cycleLength, 'days');
                            moonDates.push({
                              start: newMoonDate.format('YYYY-MM-DD'),
                              end: newMoonDate.format('YYYY-MM-DD'),
                              color: cycleData.color,
                              id: `new-moon-${Date.now()}-${i}`,
                              type: 'new-moon'
                            });
                            
                            // Full Moon dates (halfway through cycle)
                            const fullMoonDate = newMoonDate.clone().add(halfCycle, 'days');
                            moonDates.push({
                              start: fullMoonDate.format('YYYY-MM-DD'),
                              end: fullMoonDate.format('YYYY-MM-DD'),
                              color: cycleData.color,
                              id: `full-moon-${Date.now()}-${i}`,
                              type: 'full-moon'
                            });
                          }
                          
                          // Set cycle moon dates separately (virtual/shadow dates)
                          setCycleMoonDates(moonDates);
                        }
                      }}
                      disabled={!cycleData.newDate}
                    >
                      Apply Cycle Estimate
                    </Button>
                  </Grid>
                </Grid>
                
                {/* Cycle Preview/Info */}
                {cycleData.newDate && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      Next cycle starts: {moment(cycleData.newDate).add(cycleData.cycleLength, 'days').format('MMM DD, YYYY')}
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Date Range Selection Card */}
          <Card>
            <CardHeader 
              title="Select Date Range for Back-Entry"
              subheader="Choose the period when symptoms occurred"
            />
            <CardContent>
              <Stack spacing={3}>
                {/* Quick preset buttons */}
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Quick Select:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {Object.entries(presetRanges).map(([label, getRangeFunc]) => (
                      <Button
                        key={label}
                        variant="outlined"
                        size="small"
                        onClick={() => setDateRange(getRangeFunc())}
                      >
                        {label}
                      </Button>
                    ))}
                  </Stack>
                </Box>
                
                {/* Manual date inputs with color pickers - same row */}
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={5}>
                    <TextField
                      id="onsetDate"
                      label="Onset Date"
                      type="date"
                      fullWidth
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <Tooltip title="Select color for this symptom">
                      <TextField
                        type="color"
                        value={dateRange.color}
                        onChange={(e) => setDateRange(prev => ({ ...prev, color: e.target.value }))}
                        sx={{ 
                          width: 56,
                          '& .MuiInputBase-root': {
                            height: 56
                          },
                          '& input': { 
                            height: '100%',
                            cursor: 'pointer',
                            border: 'none'
                          }
                        }}
                      />
                    </Tooltip>
                  </Grid>
                  <Grid item xs={5}>
                    <TextField
                      id="abatementDate"
                      label="Abatement Date"
                      type="date"
                      fullWidth
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      InputLabelProps={{
                        shrink: true,
                      }}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <Tooltip title="Add this date range">
                      <IconButton 
                        color="primary"
                        onClick={() => {
                          if (dateRange.start && dateRange.end) {
                            setDateRanges(prev => [...prev, { ...dateRange, id: Date.now() }]);
                            // Reset dates but keep the color for consistency
                            setDateRange(prev => ({
                              start: '',
                              end: '',
                              color: prev.color
                            }));
                          }
                        }}
                        sx={{ mt: 1 }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>
                
                {/* Display added date ranges */}
                {dateRanges.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Added Date Ranges:
                    </Typography>
                    <Stack spacing={1}>
                      {dateRanges.map((range) => (
                        <Chip
                          key={range.id}
                          label={`${moment(range.start).format('MMM DD')} - ${moment(range.end).format('MMM DD')}`}
                          onDelete={() => setDateRanges(prev => prev.filter(r => r.id !== range.id))}
                          sx={{ 
                            bgcolor: range.color,
                            color: 'white',
                            '& .MuiChip-deleteIcon': {
                              color: 'rgba(255, 255, 255, 0.7)',
                              '&:hover': {
                                color: 'white'
                              }
                            }
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
                
                {/* Display selected range */}
                <Alert severity="info" icon={false}>
                  <Typography variant="body2">
                    Selected Range: {moment(dateRange.start).format('MMM DD, YYYY')} - {moment(dateRange.end).format('MMM DD, YYYY')}
                    ({moment(dateRange.end).diff(moment(dateRange.start), 'days') + 1} days)
                  </Typography>
                </Alert>
              </Stack>
            </CardContent>
          </Card>
          
          {/* Add Condition Button - below Date Range Selection */}
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            fullWidth
            onClick={handleSaveCondition}
            disabled={loading || !selectedPatient || !condition.code.text}
            sx={{ mt: '20px' }}
          >
            Add Condition
          </Button>
        </Grid>
      </Grid>

      {/* List of conditions in date range */}
      {conditions.length > 0 && (
        <Card>
          <CardHeader 
            title="Conditions in Selected Date Range"
            subheader={`${conditions.length} condition(s) found`}
          />
          <CardContent>
            <Stack spacing={2}>
              {conditions.map((cond, index) => (
                <Paper key={index} elevation={1} sx={{ p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Onset Date
                      </Typography>
                      <Typography>
                        {moment(get(cond, 'onsetDateTime')).format('MMM DD, YYYY')}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="caption" color="text.secondary">
                        Condition
                      </Typography>
                      <Typography>
                        {get(cond, 'code.text', get(cond, 'code.coding[0].display', 'Unknown'))}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="caption" color="text.secondary">
                        Status
                      </Typography>
                      <Chip 
                        label={get(cond, 'clinicalStatus.coding[0].display', 'Unknown')}
                        size="small"
                        color={get(cond, 'clinicalStatus.coding[0].code') === 'active' ? 'primary' : 'default'}
                      />
                    </Grid>
                    {get(cond, 'note[0].text') && (
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">
                          Notes
                        </Typography>
                        <Typography variant="body2">
                          {get(cond, 'note[0].text')}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>
                </Paper>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Patient Search Dialog - To be implemented */}
    </Box>
  );
}

export default BackTrackerPage;