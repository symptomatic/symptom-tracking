Package.describe({
  name: 'clinical:symptom-tracking',
  version: '0.1.0',
  summary: 'Medical symptom assessment and tracking for spaceflight participants',
  git: 'https://github.com/clinical-meteor/symptom-tracking',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('3.0.4');
  
  api.use([
    'meteor',
    'webapp',
    'ecmascript',
    'react-meteor-data',
    'session',
    'mongo'
  ]);
  
  // Client entry point
  api.mainModule('index.jsx', 'client');
  
  // Server entry point
  api.mainModule('server/index.js', 'server');
  
  // Export APIs
  api.export([
    'DynamicRoutes',
    'SidebarWorkflows',
    'FooterButtons'
  ], 'client');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('clinical:symptom-tracking');
  api.mainModule('tests/symptom-tracking.bdd.js');
});