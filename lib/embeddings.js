// Embedding model instance cache
let embeddingModel = null;

/**
 * Get the embeddings model instance
 * @returns {Object} - Embeddings model instance
 */
function getEmbeddings() {
  if (!embeddingModel) {
    // Initialize embedding model
    // Using a sentence-transformer model that works well for semantic search
    const modelName = 'sentence-transformers/all-MiniLM-L6-v2';
    
    // Embedding function that wraps either Hugging Face or OpenAI
    embeddingModel = {
      embedQuery: async (text) => {
        try {
          // Need to make fetch available if not global (e.g., older Node versions)
          // const fetch = require('node-fetch'); // Uncomment if fetch is not defined
          return await getEmbeddingFromHF(text, modelName);
        } catch (error) {
          console.error('Error generating embedding:', error);
          // Fallback to mock embeddings if real ones fail
          return generateMockEmbedding(text);
        }
      }
    };
  }
  
  return embeddingModel;
}

/**
 * Get embeddings from Hugging Face API
 * @param {string} text - Text to embed
 * @param {string} modelName - Hugging Face model name
 * @returns {Array} - Embedding vector
 */
async function getEmbeddingFromHF(text, modelName) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      console.warn('No Hugging Face API key found. Using mock embeddings.');
      return generateMockEmbedding(text);
    }

    const normalizedText = text.trim().slice(0, 1000);
    // Verify API endpoint structure for feature extraction
    const apiUrl = `https://api-inference.huggingface.co/pipeline/feature-extraction/${modelName}`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: normalizedText,
        options: {
          wait_for_model: true // Might need adjustment based on model availability
        }
      })
    });
    
    // Check response status BEFORE trying to parse JSON
    if (!response.ok) {
        let errorBody = 'Unknown error';
        try {
            // Try to read the error body as text first
            errorBody = await response.text(); 
        } catch (textError) {
            console.error("Could not read error response body as text.");
        }
        // Log the actual response text
        console.error(`Hugging Face API error response (${response.status}): ${errorBody}`); 
        // Throw an error with more context
        throw new Error(`Hugging Face API request failed with status ${response.status}: ${errorBody}`);
    }
    
    // Parse embedding from successful response
    const result = await response.json();
    
    // The API returns a nested array or object depending on the model/pipeline
    // Adjust this based on the actual successful response structure if needed
    // For sentence-transformers, it's often a nested array
    if (Array.isArray(result) && Array.isArray(result[0]) && result[0].length > 0) {
        return result[0]; // Assuming the first element is the embedding vector
    } else if (Array.isArray(result) && result.length > 0) {
        // Sometimes it might be a flat array
        return result;
    } else {
        console.warn('Unexpected embedding format received:', result);
        return generateMockEmbedding(text); // Fallback if format is unexpected
    }

  } catch (error) {
    console.error('Error getting embedding from Hugging Face:', error);
    return generateMockEmbedding(text); // Fallback to mock on any error
  }
}

/**
 * Generate a deterministic mock embedding for testing
 * @param {string} text - Text to generate mock embedding for
 * @returns {Array} - Mock embedding vector
 */
function generateMockEmbedding(text) {
  // Create a simple deterministic embedding based on text content
  // This is just for testing and fallback - NOT for production use
  const seed = text.length;
  const dimension = 384; // Similar to sentence-transformers dimensions
  
  // Generate vector with pseudo-random values based on text
  return Array.from({ length: dimension }, (_, i) => {
    // Simple hash function to get deterministic values
    const val = Math.sin(seed + i) * 10000;
    return Math.cos(val) * 0.5;
  });
}

/**
 * Calculate similarity between two texts by comparing embeddings
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Similarity score (0-1)
 */
async function calculateSimilarity(text1, text2) {
  const embeddings = getEmbeddings();
  
  const embedding1 = await embeddings.embedQuery(text1);
  const embedding2 = await embeddings.embedQuery(text2);
  
  // Calculate cosine similarity
  return cosineSimilarity(embedding1, embedding2);
}

/**
 * Calculate cosine similarity between two vectors
 * @param {Array} a - First vector
 * @param {Array} b - Second vector
 * @returns {number} - Cosine similarity (0-1)
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Export functions using CommonJS syntax
module.exports = {
  getEmbeddings,
  calculateSimilarity,
  cosineSimilarity // Export if needed elsewhere, e.g., graph-rag
}; 