// packages/symptom-tracking/server/methods/performSemanticSearch.js

import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import SimpleSchema from 'simpl-schema';
import { get } from 'lodash';
import { fetch } from 'meteor/fetch';

// Helper function to call MCP tools
async function callMcpTool(toolName, args) {
  const mcpUrl = get(Meteor, 'settings.private.mcp.url', 'http://localhost:3000/mcp');
  
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id: Date.now()
    })
  });
  
  if (!response.ok) {
    throw new Error(`MCP call failed: ${response.status}`);
  }
  
  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message);
  }
  
  // Parse the text content
  if (result.result?.content?.[0]?.text) {
    return JSON.parse(result.result.content[0].text);
  }
  
  return null;
}

// Server method for performing semantic search on medical conditions
export const performSemanticSearch = new ValidatedMethod({
  name: 'performSemanticSearch',
  
  validate: new SimpleSchema({
    query: {
      type: String,
      min: 1
    },
    resourceType: {
      type: String,
      allowedValues: ['Condition', 'Observation', 'Procedure'],
      optional: true
    },
    limit: {
      type: SimpleSchema.Integer,
      min: 1,
      max: 100,
      optional: true
    }
  }).validator(),

  async run({ query, resourceType = 'Condition', limit = 20 }) {
    console.log(`performSemanticSearch: Searching for "${query}" in ${resourceType} resources`);

    try {
      // Try to use MCP symptom search if available
      if (Meteor.settings.private?.mcp?.enabled) {
        try {
          const mcpResult = await callMcpTool('searchSymptoms', {
            query: query,
            limit: limit,
            useAI: get(Meteor, 'settings.private.openai.apiKey') ? true : false
          });
          
          if (mcpResult && mcpResult.results) {
            console.log(`performSemanticSearch: Found ${mcpResult.results.length} results via MCP`);
            return mcpResult.results;
          }
        } catch (mcpError) {
          console.warn('MCP symptom search failed, falling back:', mcpError.message);
        }
      }

      // Fallback: Perform a basic text search on Conditions collection
      // This is a simplified implementation for MVP
      console.log('performSemanticSearch: Using fallback text search');
      
      const Conditions = Meteor.Collections.Conditions;
      if (!Conditions) {
        console.error('performSemanticSearch: Conditions collection not found');
        return [];
      }

      // Convert query to lowercase for case-insensitive search
      const searchTerms = query.toLowerCase().split(/\s+/);
      
      // Build search criteria
      const searchCriteria = {
        $or: [
          // Search in code.text
          { 'code.text': { $regex: searchTerms.join('|'), $options: 'i' } },
          // Search in code.coding.display
          { 'code.coding.display': { $regex: searchTerms.join('|'), $options: 'i' } },
          // Search in notes
          { 'note.text': { $regex: searchTerms.join('|'), $options: 'i' } }
        ]
      };

      // Perform the search
      const conditions = await Conditions.find(searchCriteria, {
        limit: limit,
        sort: { recordedDate: -1 }
      }).fetchAsync();

      console.log(`performSemanticSearch: Found ${conditions.length} conditions in database`);

      // Format results to match expected structure
      const results = conditions.map(function(condition) {
        const display = get(condition, 'code.text') || 
                       get(condition, 'code.coding[0].display') || 
                       'Unknown condition';
        
        return {
          id: condition._id,
          resourceType: 'Condition',
          display: display,
          code: get(condition, 'code.coding[0].code'),
          system: get(condition, 'code.coding[0].system'),
          description: get(condition, 'note[0].text'),
          relevanceScore: 1.0 // Basic search doesn't provide relevance scores
        };
      });

      // For MVP, also include some hard-coded common symptoms based on our protocols
      const hardCodedSymptoms = [
        {
          id: 'flank-pain',
          display: 'Flank pain',
          code: '102491009',
          system: 'http://snomed.info/sct',
          description: 'Pain in the side of the body between the ribs and hip'
        },
        {
          id: 'hematuria',
          display: 'Blood in urine (hematuria)',
          code: '34436003',
          system: 'http://snomed.info/sct',
          description: 'Presence of blood in urine'
        },
        {
          id: 'back-pain',
          display: 'Back pain',
          code: '161891005',
          system: 'http://snomed.info/sct',
          description: 'Pain in the back region'
        },
        {
          id: 'headache',
          display: 'Headache',
          code: '25064002',
          system: 'http://snomed.info/sct',
          description: 'Pain in the head'
        },
        {
          id: 'dizziness',
          display: 'Dizziness',
          code: '404640003',
          system: 'http://snomed.info/sct',
          description: 'Feeling of lightheadedness or vertigo'
        },
        {
          id: 'dry-mouth',
          display: 'Dry mouth',
          code: '87715008',
          system: 'http://snomed.info/sct',
          description: 'Lack of adequate saliva in mouth'
        }
      ];

      // Filter hard-coded symptoms based on search query
      const matchingHardCoded = hardCodedSymptoms.filter(function(symptom) {
        const searchText = `${symptom.display} ${symptom.description}`.toLowerCase();
        return searchTerms.some(term => searchText.includes(term));
      });

      // Combine and deduplicate results
      const combinedResults = [...results, ...matchingHardCoded];
      
      // Remove duplicates based on display text
      const uniqueResults = combinedResults.reduce(function(acc, current) {
        const exists = acc.find(item => item.display === current.display);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      return uniqueResults.slice(0, limit);

    } catch (error) {
      console.error('performSemanticSearch: Error during search', error);
      throw new Meteor.Error('search-failed', 'Failed to perform semantic search', error.message);
    }
  }
});