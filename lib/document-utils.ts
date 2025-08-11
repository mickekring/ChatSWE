// Document chunk interface
export interface DocumentChunk {
  id: string
  content: string
  embedding?: number[]
  metadata: {
    filename: string
    chunkIndex: number
    totalChunks: number
  }
}

// Chunk text into smaller pieces for better embeddings
export function chunkText(text: string, filename: string, maxChunkSize: number = 300, overlap: number = 50): DocumentChunk[] {
  const chunks: DocumentChunk[] = []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  let currentChunk = ''
  let chunkIndex = 0
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue
    
    // If adding this sentence would exceed the max chunk size, create a new chunk
    if (currentChunk && (currentChunk.length + trimmedSentence.length > maxChunkSize)) {
      chunks.push({
        id: `${filename}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          filename,
          chunkIndex,
          totalChunks: 0 // Will be updated later
        }
      })
      
      // Start new chunk with overlap from previous chunk
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(overlap / 5)) // Rough estimate for overlap
      currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence
      chunkIndex++
    } else {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence
    }
  }
  
  // Add the last chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      id: `${filename}-chunk-${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: {
        filename,
        chunkIndex,
        totalChunks: 0
      }
    })
  }
  
  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length
  })
  
  return chunks
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length')
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

// Find most similar chunks to a query
export function findSimilarChunks(queryEmbedding: number[], chunks: DocumentChunk[], topK: number = 5): DocumentChunk[] {
  const similarities = chunks
    .filter(chunk => chunk.embedding)
    .map(chunk => ({
      chunk,
      similarity: cosineSimilarity(queryEmbedding, chunk.embedding!)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
  
  return similarities.map(item => item.chunk)
}

// Create context from similar chunks
export function createContextFromChunks(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) {
    return "No relevant context found in the uploaded documents."
  }
  
  const context = chunks
    .map((chunk, index) => {
      return `**Document: ${chunk.metadata.filename} (Chunk ${chunk.metadata.chunkIndex + 1}/${chunk.metadata.totalChunks})**\n${chunk.content}`
    })
    .join('\n\n---\n\n')
  
  return `Based on the uploaded documents, here is the relevant context:\n\n${context}`
}