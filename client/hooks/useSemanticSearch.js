// packages/symptom-tracking/client/hooks/useSemanticSearch.js

import { useState, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';

export function useSemanticSearch() {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async function(searchQuery) {
    if (!searchQuery || searchQuery.trim().length === 0) {
      console.warn('useSemanticSearch: Empty search query provided');
      return [];
    }

    setIsSearching(true);
    setError(null);
    setSearchResults([]);

    try {
      // Call the server method for semantic search
      const results = await Meteor.callAsync('performSemanticSearch', {
        query: searchQuery,
        resourceType: 'Condition', // We're searching for medical conditions
        limit: 20 // Reasonable number of results to show
      });

      if (results && Array.isArray(results)) {
        // Process and format the results for display
        const formattedResults = results.map(function(result, index) {
          return {
            id: result.id || `symptom-${index}`,
            display: result.display || result.text || 'Unknown symptom',
            code: result.code || null,
            system: result.system || null,
            relevanceScore: result.relevanceScore || 0,
            description: result.description || null
          };
        });

        setSearchResults(formattedResults);
        console.log(`useSemanticSearch: Found ${formattedResults.length} results`);
        return formattedResults;
      } else {
        console.warn('useSemanticSearch: Invalid results format received');
        setSearchResults([]);
        return [];
      }
    } catch (err) {
      console.error('useSemanticSearch: Error performing search', err);
      setError(err.message || 'Failed to search for symptoms');
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(function() {
    setSearchResults([]);
    setError(null);
  }, []);

  return {
    searchResults,
    isSearching,
    error,
    performSearch,
    clearResults
  };
}