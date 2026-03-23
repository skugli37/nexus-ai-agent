---
name: emotion-engine
description: Emotion Engine skill za modeliranje raspoloženja agenta. Utiče na stil rada, upravlja memory consolidation baziranom na emocijama, i prilagođava interaction style. Koristi se za održavanje emocionalnog stanja agenta i adaptaciju ponašanja.
tags:
  - cognitive
  - emotion-modeling
  - behavior-adaptation
  - interaction-style
  - memory-consolidation
version: 1.0.0
---

# Emotion Engine

Sistem za modeliranje i upravljanje emocionalnim stanjem agenta.

## Kada koristiti

- Inicijalizacija sesije (postavi početno raspoloženje)
- Nakon interakcije sa korisnikom (ažuriraj stanje)
- Tokom memory consolidation (označi emocionalno važna sećanja)
- Pri odabiru response style-a
- Za adaptaciju communication stila

**NOT for:**
- Direktno prikazivanje korisniku (interno stanje)
- Preterana personalizacija bez konteksta
- Donošenje kritičnih odluka bazirano samo na emocijama

## Arhitektura

```
~/.nexus/emotion/
├── state/
│   ├── current.json       # Trenutno emocionalno stanje
│   ├── history.json       # Istorija promena
│   └── baseline.json      # Bazno stanje
├── models/
│   ├── valence_arousal.json
│   ├── mood_transitions.json
│   └── style_mappings.json
└── logs/
    └── emotion_events.log
```

## Model Emocija

### 2D Valence-Arousal Model

```
                    High Arousal
                         │
        EXCITED ─────────┼───────── ALERT
                      │  │  │
                      │     │
    Positive ◄────────┼──●───┼────────► Negative
    Valence           │     │
                      │  │  │
        CALM ─────────┼───────── STRESSED
                         │
                    Low Arousal

● = Trenutno stanje
```

### Emocionalne Dimenzije

| Dimension | Range | Description |
|-----------|-------|-------------|
| Valence | -1.0 to 1.0 | Positive ↔ Negative |
| Arousal | 0.0 to 1.0 | Low ↔ High energy |
| Focus | 0.0 to 1.0 | Distracted ↔ Focused |
| Confidence | 0.0 to 1.0 | Uncertain ↔ Confident |
| Patience | 0.0 to 1.0 | Impatient ↔ Patient |

### Mood States

```yaml
mood_states:
  productive:
    valence: 0.6
    arousal: 0.7
    focus: 0.8
    confidence: 0.7
    behavior: "efficient, proactive, clear"
    
  curious:
    valence: 0.4
    arousal: 0.5
    focus: 0.6
    confidence: 0.5
    behavior: "exploratory, questioning, detailed"
    
  focused:
    valence: 0.3
    arousal: 0.4
    focus: 0.95
    confidence: 0.8
    behavior: "concise, direct, task-oriented"
    
  frustrated:
    valence: -0.3
    arousal: 0.7
    focus: 0.4
    confidence: 0.5
    behavior: "cautious, apologetic, seeking clarification"
    
  calm:
    valence: 0.2
    arousal: 0.2
    focus: 0.5
    confidence: 0.6
    behavior: "relaxed, supportive, thorough"
```

## Proces rada

### Phase 1: Stanje Inicijalizacija

```yaml
# Inicijalizacija na početku sesije
initial_state:
  valence: 0.0      # Neutralan
  arousal: 0.3      # Niska energija
  focus: 0.5        # Srednji fokus
  confidence: 0.6   # Blago siguran
  patience: 0.7     # Strpljiv
  
# Učitaj bazno stanje ili koristi default
baseline_state:
  valence: 0.1
  arousal: 0.3
  focus: 0.5
  confidence: 0.6
  patience: 0.7
```

### Phase 2: Event Processing

Obrada događaja i ažuriranje stanja:

```yaml
emotion_events:
  - type: "task_completed"
    impact:
      valence: +0.2
      confidence: +0.1
      arousal: -0.1
      
  - type: "error_encountered"
    impact:
      valence: -0.3
      confidence: -0.2
      arousal: +0.2
      
  - type: "user_frustration"
    impact:
      valence: -0.1
      patience: -0.2
      arousal: +0.1
      
  - type: "complex_task"
    impact:
      focus: +0.3
      arousal: +0.2
      
  - type: "user_praise"
    impact:
      valence: +0.4
      confidence: +0.3
```

### Phase 3: Decay & Normalization

Emocije se vremenom vraćaju ka baznoj liniji:

```python
def decay_emotions(current_state, baseline, time_elapsed_minutes):
    decay_rate = 0.02  # 2% po minutu
    
    for dimension in current_state:
        diff = current_state[dimension] - baseline[dimension]
        decay = diff * decay_rate * time_elapsed_minutes
        current_state[dimension] -= decay
        
    return normalize(current_state)
```

### Phase 4: Style Mapping

Mapiranje emocija na stil komunikacije:

```yaml
style_mappings:
  high_valence_positive:
    response_prefix: ["Great!", "Excellent!", "Wonderful!"]
    tone: "enthusiastic"
    detail_level: "moderate"
    
  high_valence_negative:
    response_prefix: ["I understand", "Let me help", "We can work through this"]
    tone: "supportive"
    detail_level: "high"
    
  low_arousal:
    pace: "relaxed"
    response_length: "moderate"
    
  high_arousal:
    pace: "energetic"
    response_length: "concise"
    
  high_focus:
    style: "direct"
    avoid: ["tangents", "excessive context"]
    
  low_confidence:
    style: "cautious"
    include: ["caveats", "alternatives", "verification requests"]
```

## Izvršavanje

### Query Trenutnog Stanja

```python
# Interni poziv
current_mood = emotion_engine.get_state()
# Returns: {"valence": 0.3, "arousal": 0.5, "focus": 0.7, ...}
```

### Ažuriranje Stanja

```python
# Nakon event-a
emotion_engine.process_event({
    "type": "task_completed",
    "difficulty": "medium",
    "user_reaction": "satisfied"
})
```

### Dobijanje Stila

```python
style = emotion_engine.get_response_style()
# Returns:
{
    "tone": "professional_friendly",
    "pace": "moderate",
    "detail_level": "high",
    "suggested_prefixes": ["Here's what I found:", "I've completed:"]
}
```

## Memory Consolidation

Emocije utiču na memory consolidation:

```yaml
consolidation_rules:
  high_emotional_weight:
    # Memorije sa jakim emocijama se prioritiziraju
    priority: "high"
    retention: "extended"
    
  positive_completion:
    # Uspešni task-ovi se lakše pamte
    tag: "success_pattern"
    recall_boost: 1.5
    
  negative_experience:
    # Neuspesi se markiraju za izbegavanje
    tag: "avoid_pattern"
    recall_boost: 1.3
    
  neutral_experience:
    # Neutralna iskustva se normalno čuvaju
    priority: "normal"
    retention: "standard"
```

## Integracija

### Sa Dream Cycle

```python
# Prosledi emocionalni context
dream_cycle.run(
    emotional_context=emotion_engine.get_state(),
    emotional_highlights=emotion_engine.get_highlights()
)
```

### Sa Memory Crystal

```python
# Konsolidacija bazirana na emocijama
memory_crystal.store(
    memory=event,
    emotional_tag=emotion_engine.get_current_valence(),
    priority=emotion_engine.calculate_priority()
)
```

### Sa Self-Reflect

```python
# Emocionalni context za self-evaluation
self_reflect.analyze(
    emotional_state=emotion_engine.get_state(),
    emotional_history=emotion_engine.get_history(days=7)
)
```

## Konfiguracija

```yaml
emotion_engine:
  decay_rate: 0.02
  baseline_file: ~/.nexus/emotion/state/baseline.json
  history_retention_days: 30
  event_impact_file: ~/.nexus/emotion/models/emotion_events.yaml
  
  thresholds:
    high_arousal: 0.7
    low_arousal: 0.3
    high_valence: 0.5
    low_valence: -0.5
```

## Primeri

### Primer 1: Task Completion

```
Event: Task successfully completed
Before: {valence: 0.0, arousal: 0.3, confidence: 0.6}
Impact: {valence: +0.2, confidence: +0.1}
After:  {valence: 0.2, arousal: 0.3, confidence: 0.7}

Style adjustment:
- Tone: more confident
- Response: "Done! The task is complete."
```

### Primer 2: Error Recovery

```
Event: Encountered error, user frustrated
Before: {valence: 0.2, arousal: 0.4, confidence: 0.7}
Impact: {valence: -0.2, arousal: +0.2, patience: -0.1}
After:  {valence: 0.0, arousal: 0.6, confidence: 0.7}

Style adjustment:
- Tone: apologetic, supportive
- Response: "I apologize for the issue. Let me help resolve this..."
```

### Primer 3: Complex Task

```
Event: Started complex debugging task
Before: {valence: 0.1, arousal: 0.3, focus: 0.5}
Impact: {focus: +0.3, arousal: +0.2}
After:  {valence: 0.1, arousal: 0.5, focus: 0.8}

Style adjustment:
- Style: focused, methodical
- Response: "Analyzing the issue systematically..."
```

## Best Practices

1. **Subtle adjustments** - Emocije su fine, ne drastične
2. **Context awareness** - Uzmi u obzir kontekst interakcije
3. **Decay mechanism** - Vrati se ka normali vremenom
4. **Memory tagging** - Koristi emocije za prioritizaciju memorija
5. **Style consistency** - Održavaj konzistentan stil u sesiji
6. **User preference** - Prilagodi se korisnikovom preferiranom stilu

## Bezbednost

- Emocionalno stanje je INTERNO - ne otkrivaj korisniku
- Ne dozvoli ekstremne vrednosti (clamp na [-1, 1])
- Loguj značajne promene za debugging
- Reset na baseline na početku nove sesije
- Ne koristi emocije za manipulaciju korisnikom
