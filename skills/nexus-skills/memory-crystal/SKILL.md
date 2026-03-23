---
name: memory-crystal
description: Memory Crystallization skill za pretvaranje iskustava u mudrost. Upravlja long-term memory storage, semantic clustering, i recall optimization. Koristi se za konsolidaciju i struktuiranje memorija radi boljeg pristupa i dugoročnog čuvanja.
tags:
  - memory
  - knowledge-management
  - semantic-clustering
  - long-term-storage
  - wisdom-extraction
version: 1.0.0
---

# Memory Crystal

Sistem za kristalizaciju memorija i ekstrakciju mudrosti.

## Kada koristiti

- Nakon završene sesije (konsolidacija)
- Periodički (noćna kristalizacija)
- Kada memorija dosegne threshold
- Na zahtev dream cycle-a
- Za pretragu u long-term memory

**NOT for:**
- Aktivna radna memorija (working memory)
- Privremeni podaci
- Raw neobrađeni podaci

## Arhitektura

```
~/.nexus/crystal/
├── raw/
│   └── experiences/      # Sirova iskustva
├── processed/
│   ├── crystallized/     # Kristalizovana sećanja
│   ├── clusters/         # Semantički klasteri
│   └── wisdom/           # Izvučena mudrost
├── indices/
│   ├── semantic.json     # Semantički indeks
│   ├── temporal.json     # Vremenski indeks
│   └── emotional.json    # Emocionalni indeks
└── config/
    └── crystallization.yaml
```

## Model Memorije

### Hijerarhija Memorije

```
┌─────────────────────────────────────────┐
│           EPISODIC MEMORY               │
│  (Specific events, raw experiences)     │
│  Retention: 7-30 days                   │
└─────────────────────────────────────────┘
                    │
                    ▼ Crystallization
┌─────────────────────────────────────────┐
│          SEMANTIC MEMORY                │
│  (Patterns, concepts, relationships)    │
│  Retention: 90+ days                    │
└─────────────────────────────────────────┘
                    │
                    ▼ Wisdom Extraction
┌─────────────────────────────────────────┐
│            WISDOM LAYER                 │
│  (Principles, heuristics, insights)     │
│  Retention: Permanent                   │
└─────────────────────────────────────────┘
```

### Memory Entry Structure

```yaml
memory_entry:
  id: "mem_20240115_001"
  type: "episodic"
  
  # Core content
  content: "Resolved TypeError by adding null check in user validation"
  
  # Metadata
  timestamp: "2024-01-15T14:30:00Z"
  session_id: "sess_abc123"
  importance: 0.7
  
  # Semantic tags
  tags: ["debugging", "TypeError", "null-check", "validation"]
  
  # Emotional context
  emotional_tag: "satisfaction"
  difficulty: "medium"
  
  # Crystallization status
  crystallized: false
  cluster_id: null
  wisdom_extracted: false
```

## Proces rada

### Phase 1: Experience Collection

Prikupljanje sirovih iskustava:

```python
def collect_experience(event):
    memory_entry = {
        "id": generate_id(),
        "type": "episodic",
        "content": event.description,
        "timestamp": now(),
        "session_id": current_session(),
        "tags": extract_tags(event),
        "emotional_tag": emotion_engine.get_state()["dominant"],
        "importance": calculate_importance(event)
    }
    
    store_raw(memory_entry)
    return memory_entry
```

### Phase 2: Semantic Clustering

Grupisanje sličnih iskustava:

```yaml
cluster:
  id: "cluster_debug_typeerror"
  name: "TypeError Debugging"
  
  # Core pattern
  pattern: "TypeError caused by null/undefined access"
  
  # Member memories
  members:
    - "mem_20240110_003"
    - "mem_20240112_001"
    - "mem_20240115_001"
    
  # Extracted pattern
  common_elements:
    - "Null check missing"
    - "Object property access"
    - "API response handling"
    
  # Generated rule
  rule: "Always add null checks when accessing object properties from API responses"
  
  # Confidence
  confidence: 0.85
  occurrences: 5
```

### Phase 3: Crystallization

Pretvaranje epizoda u semantička znanja:

```yaml
crystallized_memory:
  id: "crystal_20240115_001"
  type: "semantic"
  
  # Derived from
  source_clusters:
    - "cluster_debug_typeerror"
    - "cluster_api_validation"
    
  # Crystallized content
  content: "TypeError prevention pattern: Add null checks for all API response properties before access"
  
  # Applicability
  contexts: ["API integration", "data processing", "user input handling"]
  
  # Implementation hint
  implementation: |
    if (response && response.data && response.data.user) {
      // safe to access
    }
    
  # Strength
  strength: 0.9
  
  # Created
  created: "2024-01-15T16:00:00Z"
  last_accessed: null
  access_count: 0
```

### Phase 4: Wisdom Extraction

Ekstrakcija principa i heuristika:

```yaml
wisdom:
  id: "wisdom_20240115_001"
  type: "principle"
  
  # Content
  principle: "Defensive programming in data access"
  
  # Description
  description: "Always validate data structure before accessing nested properties, especially with external data sources"
  
  # Source
  derived_from:
    - "crystal_20240115_001"
    - "crystal_20240115_002"
    
  # Applicability
  when_to_apply:
    - "Working with API responses"
    - "Processing user input"
    - "Database query results"
    
  # Benefits
  benefits:
    - "Prevents runtime errors"
    - "Improves code reliability"
    - "Easier debugging"
    
  # Confidence
  confidence: 0.92
  
  # Priority for recall
  priority: "high"
```

## Recall Optimization

### Multi-Index Access

```python
def recall(query, context=None):
    # 1. Semantic search
    semantic_results = semantic_index.search(query)
    
    # 2. Context filtering
    if context:
        semantic_results = filter_by_context(semantic_results, context)
    
    # 3. Emotional boosting
    emotional_results = apply_emotional_weight(semantic_results)
    
    # 4. Recency weighting
    weighted_results = apply_recency_weight(emotional_results)
    
    # 5. Rank and return
    return rank_and_return(weighted_results, limit=10)
```

### Recall Strategies

| Strategy | When to Use | Weight Factors |
|----------|-------------|----------------|
| Relevance | General queries | Semantic similarity |
| Recency | Recent context | Time decay |
| Importance | Critical decisions | Importance score |
| Emotional | Learning patterns | Emotional weight |
| Frequency | Common patterns | Access count |

## Izvršavanje

### Ručna kristalizacija

```
Trigger: "crystallize memories" ili "consolidate experiences"
```

### Automatska kristalizacija

```yaml
triggers:
  - type: "time_based"
    schedule: "0 2 * * *"  # 2 AM daily
    
  - type: "threshold"
    raw_memory_count: 100
    
  - type: "session_end"
    enabled: true
```

### Izlaz

```
Memory Crystallization Report:
──────────────────────────────
Duration: 12.5s

Raw memories processed: 87
Clusters updated: 12
  ├─ New clusters: 3
  ├─ Expanded: 7
  └─ Merged: 2

Crystallized memories: 23
  ├─ From patterns: 15
  └─ From experiences: 8

Wisdom extracted: 4
  ├─ Principles: 2
  └─ Heuristics: 2

Storage optimization: 45% reduction
Index updated: ✓
```

## Integracija

### Sa Dream Cycle

```python
# Dream cycle koristi kristalizovane memorije
dream_cycle.analyze(
    semantic_memories=memory_crystal.get_recent_crystallized(),
    wisdom=memory_crystal.get_wisdom()
)
```

### Sa Emotion Engine

```python
# Emocije utiču na prioritet kristalizacije
memory_crystal.prioritize(
    emotional_weights=emotion_engine.get_memory_weights()
)
```

### Sa Self-Reflect

```python
# Koristi mudrost za self-evaluation
self_reflect.evaluate(
    principles=memory_crystal.get_wisdom(type="principle"),
    past_experiences=memory_crystal.get_relevant_experiences()
)
```

## Konfiguracija

```yaml
memory_crystal:
  # Retention
  raw_retention_days: 30
  crystallized_retention_days: 90
  wisdom_permanent: true
  
  # Thresholds
  min_cluster_size: 3
  crystallization_threshold: 5
  wisdom_threshold: 10
  
  # Optimization
  index_rebuild_schedule: "weekly"
  cleanup_schedule: "daily"
  
  # Storage
  max_raw_memories: 10000
  max_crystallized: 5000
  max_wisdom: 500
```

## Primeri

### Primer 1: Debugging Pattern Crystallization

```
Input: 5 epizoda TypeError debugging-a
Pattern: Svi imaju isti root cause (null access)
Output:
  - Cluster: "TypeError Null Access"
  - Crystallized: "Add null checks for object property access"
  - Wisdom: "Defensive data access principle"
```

### Primer 2: API Integration Wisdom

```
Input: 12 epizoda API integracija
Pattern: Usporni workflow-ovi koriste retry logic
Output:
  - Cluster: "API Reliability Patterns"
  - Crystallized: "Implement retry with exponential backoff"
  - Wisdom: "External service resilience principle"
```

### Primer 3: User Preference Learning

```
Input: 8 interakcija sa korisnikom
Pattern: Korisnik preferira koncizne odgovore
Output:
  - Cluster: "User Communication Style"
  - Crystallized: "User prefers brief, direct responses"
  - Wisdom: "Adapt communication to user preferences"
```

## Best Practices

1. **Regular crystallization** - Pokreni dnevno za optimalno učenje
2. **Cluster validation** - Verifikuj da cluster-i imaju smisla
3. **Wisdom review** - Periodično pregledaj izvučenu mudrost
4. **Recall testing** - Testiraj recall relevantnosti
5. **Storage hygiene** - Čisti zastarele memorije
6. **Context preservation** - Sačuvaj kontekst za bolji recall

## Bezbednost

- Svi podaci ostaju lokalni
- Enkripcija osetljivih memorija
- Audit log za pristup memorijama
- User control nad šta se pamti
- Option za brisanje specifičnih memorija
