// Function definitions for the AI
export const functions = [
  {
    name: "search_internet",
    description: "Search the internet for current information, news, or any topic that requires up-to-date data",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the internet"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "search_documents",
    description: "Search through uploaded documents to find relevant information and answer questions based on the document content",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The question or search query to look up in the uploaded documents"
        }
      },
      required: ["query"]
    }
  }
]

// Function to execute Tavily search
export async function searchInternet(query: string): Promise<string> {
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        include_answer: true,
        include_images: false,
        include_raw_content: false,
        max_results: 5
      })
    })

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.statusText}`)
    }

    const data = await response.json()
    
    // Format the search results
    let formattedResults = ''
    
    if (data.answer) {
      formattedResults += `**Answer**: ${data.answer}\n\n`
    }
    
    if (data.results && data.results.length > 0) {
      formattedResults += '**Search Results**:\n'
      data.results.forEach((result: any, index: number) => {
        formattedResults += `${index + 1}. **${result.title}**\n`
        formattedResults += `   ${result.content}\n`
        formattedResults += `   Source: ${result.url}\n\n`
      })
    }

    return formattedResults || 'No results found.'
  } catch (error) {
    console.error('Search error:', error)
    return 'Search failed. Please try again.'
  }
}

// Function to search documents
export async function searchDocuments(query: string, documentChunks: any[]): Promise<string> {
  try {
    if (!documentChunks || documentChunks.length === 0) {
      return 'No documents have been uploaded yet. Please upload some documents first to search through them.'
    }

    // Get embedding for the query using OpenAI
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: [query]
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create query embedding')
    }

    const embeddingResult = await response.json()
    console.log('Embedding API response:', embeddingResult)
    const queryEmbedding = embeddingResult.data?.[0]?.embedding || embeddingResult.embeddings?.[0]
    console.log('Query embedding dimensions:', queryEmbedding?.length)

    if (!queryEmbedding) {
      return 'Failed to generate embedding for the search query.'
    }

    // Calculate similarity with document chunks
    const chunksWithEmbeddings = documentChunks.filter(chunk => chunk.embedding)
    console.log('Found', chunksWithEmbeddings.length, 'chunks with embeddings')
    
    if (chunksWithEmbeddings.length > 0) {
      console.log('First chunk embedding dimensions:', chunksWithEmbeddings[0].embedding.length)
    }
    
    const similarities = chunksWithEmbeddings
      .map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // Top 5 most similar chunks

    console.log('Similarity scores:', similarities.map(s => ({ filename: s.chunk.metadata.filename, similarity: s.similarity.toFixed(4) })))

    if (similarities.length === 0) {
      return 'No relevant information found in the uploaded documents for this query.'
    }

    // Create context from similar chunks
    const context = similarities
      .map((item, index) => {
        const chunk = item.chunk
        console.log(`Returning chunk ${index + 1}: ${chunk.content.substring(0, 100)}...`)
        return `**Document: ${chunk.metadata.filename} (Chunk ${chunk.metadata.chunkIndex + 1}/${chunk.metadata.totalChunks})**\n${chunk.content}`
      })
      .join('\n\n---\n\n')

    const result = `Based on the uploaded documents, here is the relevant context:\n\n${context}`
    console.log('Document search returning:', result.length, 'characters of context')
    return result

  } catch (error) {
    console.error('Document search error:', error)
    return 'Failed to search through documents. Please try again.'
  }
}

// Helper function for cosine similarity (moved here from document-utils)
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    console.error('Vector dimension mismatch:', vecA.length, 'vs', vecB.length)
    console.error('Query vector length:', vecA.length)
    console.error('Document vector length:', vecB.length)
    throw new Error(`Vectors must have the same length: ${vecA.length} vs ${vecB.length}`)
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)
  
  if (normA === 0 || normB === 0) {
    return 0
  }
  
  return dotProduct / (normA * normB)
}

// Function executor
export async function executeFunction(name: string, args: any, documentChunks?: any[]): Promise<string> {
  switch (name) {
    case 'search_internet':
      return await searchInternet(args.query)
    case 'search_documents':
      return await searchDocuments(args.query, documentChunks || [])
    default:
      return 'Unknown function'
  }
}