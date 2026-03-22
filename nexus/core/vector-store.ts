/**
 * NEXUS Vector Store
 * In-memory vector database for semantic memory search
 * 
 * Features:
 * - Semantic search with cosine similarity
 * - Memory type filtering
 * - Importance ranking
 * - Persistent storage to disk
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EmbeddingsEngine } from './embeddings';
import { Memory, MemoryType } from './types';

export interface VectorSearchResult {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  similarity: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  lastAccessed: Date;
}

export interface VectorStoreConfig {
  path: string;
  collectionName: string;
  maxResults: number;
  similarityThreshold: number;
}

const DEFAULT_CONFIG: VectorStoreConfig = {
  path: '.nexus/memory',
  collectionName: 'nexus_vectors',
  maxResults: 10,
  similarityThreshold: 0.1
};

interface StoredVector {
  id: string;
  content: string;
  type: MemoryType;
  importance: number;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
}

export class VectorStore {
  private config: VectorStoreConfig;
  private embeddings: EmbeddingsEngine;
  private vectors: Map<string, StoredVector> = new Map();
  private initialized: boolean = false;
  private storageFile: string;

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.embeddings = new EmbeddingsEngine();
    this.storageFile = join(this.config.path, 'vectors.json');
  }

  /**
   * Initialize the vector store
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure directory exists
    if (!existsSync(this.config.path)) {
      mkdirSync(this.config.path, { recursive: true });
    }

    // Load existing vectors
    await this.loadFromDisk();

    this.initialized = true;
  }

  /**
   * Store a memory with its embedding
   */
  async store(memory: Memory): Promise<string> {
    const embedding = await this.embeddings.embed(memory.content);

    const stored: StoredVector = {
      id: memory.id,
      content: memory.content,
      type: memory.type,
      importance: memory.importance,
      embedding,
      metadata: memory.metadata,
      createdAt: memory.createdAt.toISOString(),
      lastAccessed: memory.lastAccessed.toISOString(),
      accessCount: memory.accessCount
    };

    this.vectors.set(memory.id, stored);
    await this.saveToDisk();

    return memory.id;
  }

  /**
   * Store multiple memories
   */
  async storeBatch(memories: Memory[]): Promise<string[]> {
    const ids: string[] = [];

    for (const memory of memories) {
      const id = await this.store(memory);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Search for similar memories
   */
  async search(query: string, limit?: number): Promise<VectorSearchResult[]> {
    const maxResults = limit || this.config.maxResults;
    const queryEmbedding = await this.embeddings.embed(query);

    const results: VectorSearchResult[] = [];

    for (const [id, stored] of this.vectors) {
      const similarity = this.embeddings.cosineSimilarity(queryEmbedding, stored.embedding);

      if (similarity >= this.config.similarityThreshold) {
        // Update access count
        stored.accessCount++;
        stored.lastAccessed = new Date().toISOString();

        results.push({
          id,
          content: stored.content,
          type: stored.type,
          importance: stored.importance,
          similarity,
          metadata: stored.metadata,
          createdAt: new Date(stored.createdAt),
          lastAccessed: new Date(stored.lastAccessed)
        });
      }
    }

    // Sort by similarity * importance, then by similarity
    results.sort((a, b) => {
      const scoreA = a.similarity * (1 + a.importance);
      const scoreB = b.similarity * (1 + b.importance);
      return scoreB - scoreA;
    });

    // Save updated access counts
    await this.saveToDisk();

    return results.slice(0, maxResults);
  }

  /**
   * Get memories by type
   */
  getByType(type: MemoryType): VectorSearchResult[] {
    const results: VectorSearchResult[] = [];

    for (const [id, stored] of this.vectors) {
      if (stored.type === type) {
        results.push({
          id,
          content: stored.content,
          type: stored.type,
          importance: stored.importance,
          similarity: 1,
          metadata: stored.metadata,
          createdAt: new Date(stored.createdAt),
          lastAccessed: new Date(stored.lastAccessed)
        });
      }
    }

    // Sort by importance
    results.sort((a, b) => b.importance - a.importance);

    return results;
  }

  /**
   * Get memory by ID
   */
  getById(id: string): VectorSearchResult | null {
    const stored = this.vectors.get(id);
    if (!stored) return null;

    return {
      id: stored.id,
      content: stored.content,
      type: stored.type,
      importance: stored.importance,
      similarity: 1,
      metadata: stored.metadata,
      createdAt: new Date(stored.createdAt),
      lastAccessed: new Date(stored.lastAccessed)
    };
  }

  /**
   * Delete a memory
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.vectors.delete(id);
    if (existed) {
      await this.saveToDisk();
    }
    return existed;
  }

  /**
   * Update a memory
   */
  async update(id: string, updates: Partial<Memory>): Promise<boolean> {
    const stored = this.vectors.get(id);
    if (!stored) return false;

    // Apply updates
    if (updates.content !== undefined) {
      stored.content = updates.content;
      stored.embedding = await this.embeddings.embed(updates.content);
    }
    if (updates.importance !== undefined) {
      stored.importance = updates.importance;
    }
    if (updates.type !== undefined) {
      stored.type = updates.type;
    }
    if (updates.metadata !== undefined) {
      stored.metadata = { ...stored.metadata, ...updates.metadata };
    }
    if (updates.accessCount !== undefined) {
      stored.accessCount = updates.accessCount;
    }

    stored.lastAccessed = new Date().toISOString();

    await this.saveToDisk();
    return true;
  }

  /**
   * Get statistics about stored vectors
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    avgImportance: number;
    totalAccessCount: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const byType: Record<string, number> = {};
    let totalImportance = 0;
    let totalAccessCount = 0;
    let oldestDate: Date | null = null;
    let newestDate: Date | null = null;

    for (const stored of this.vectors.values()) {
      byType[stored.type] = (byType[stored.type] || 0) + 1;
      totalImportance += stored.importance;
      totalAccessCount += stored.accessCount;

      const created = new Date(stored.createdAt);
      if (!oldestDate || created < oldestDate) oldestDate = created;
      if (!newestDate || created > newestDate) newestDate = created;
    }

    return {
      total: this.vectors.size,
      byType,
      avgImportance: this.vectors.size > 0 ? totalImportance / this.vectors.size : 0,
      totalAccessCount,
      oldestEntry: oldestDate,
      newestEntry: newestDate
    };
  }

  /**
   * Find similar memories (for consolidation)
   */
  async findSimilar(threshold: number = 0.85): Promise<Array<{ memories: VectorSearchResult[]; similarity: number }>> {
    const groups: Array<{ memories: VectorSearchResult[]; similarity: number }> = [];
    const processed = new Set<string>();

    for (const [id1, stored1] of this.vectors) {
      if (processed.has(id1)) continue;

      const group: VectorSearchResult[] = [{
        id: id1,
        content: stored1.content,
        type: stored1.type,
        importance: stored1.importance,
        similarity: 1,
        metadata: stored1.metadata,
        createdAt: new Date(stored1.createdAt),
        lastAccessed: new Date(stored1.lastAccessed)
      }];

      let maxSimilarity = 1;

      for (const [id2, stored2] of this.vectors) {
        if (id1 === id2 || processed.has(id2)) continue;

        const similarity = this.embeddings.cosineSimilarity(stored1.embedding, stored2.embedding);

        if (similarity >= threshold) {
          group.push({
            id: id2,
            content: stored2.content,
            type: stored2.type,
            importance: stored2.importance,
            similarity,
            metadata: stored2.metadata,
            createdAt: new Date(stored2.createdAt),
            lastAccessed: new Date(stored2.lastAccessed)
          });
          processed.add(id2);
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }
      }

      if (group.length > 1) {
        groups.push({ memories: group, similarity: maxSimilarity });
      }

      processed.add(id1);
    }

    return groups.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Clear all vectors
   */
  async clear(): Promise<void> {
    this.vectors.clear();
    await this.saveToDisk();
  }

  /**
   * Save vectors to disk
   */
  private async saveToDisk(): Promise<void> {
    const data: StoredVector[] = Array.from(this.vectors.values());
    
    if (!existsSync(this.config.path)) {
      mkdirSync(this.config.path, { recursive: true });
    }

    writeFileSync(this.storageFile, JSON.stringify(data, null, 2));
  }

  /**
   * Load vectors from disk
   */
  private async loadFromDisk(): Promise<void> {
    if (!existsSync(this.storageFile)) {
      return;
    }

    try {
      const data = readFileSync(this.storageFile, 'utf-8');
      const vectors: StoredVector[] = JSON.parse(data);

      for (const stored of vectors) {
        this.vectors.set(stored.id, stored);
      }
    } catch (error) {
      console.error('Failed to load vectors from disk:', error);
    }
  }

  /**
   * Export vectors for backup
   */
  export(): string {
    const data = Array.from(this.vectors.values());
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import vectors from backup
   */
  async import(jsonData: string): Promise<number> {
    try {
      const vectors: StoredVector[] = JSON.parse(jsonData);
      
      for (const stored of vectors) {
        this.vectors.set(stored.id, stored);
      }

      await this.saveToDisk();
      return vectors.length;
    } catch (error) {
      console.error('Failed to import vectors:', error);
      return 0;
    }
  }

  /**
   * Get embeddings engine for external use
   */
  getEmbeddings(): EmbeddingsEngine {
    return this.embeddings;
  }
}

export default VectorStore;
