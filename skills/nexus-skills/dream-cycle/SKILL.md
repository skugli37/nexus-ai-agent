---
name: dream-cycle
description: Dream Cycle skill za offline processing memorija. Procesira memorije kada je agent idle, traži obrasce u iskustvima, generiše nova znanja i kreira nove skill-ove. Koristi se tokom idle perioda za autonomno učenje i optimizaciju.
tags:
  - cognitive
  - autonomous
  - learning
  - pattern-recognition
  - skill-generation
  - offline-processing
version: 1.0.0
---

# Dream Cycle

Autonomni sistem za offline procesiranje i učenje tokom idle perioda.

## Kada koristiti

- Agent je u idle stanju (nema aktivnih zadataka)
- Posle završetka kompleksne sesije
- Kada je memorija pretrpana nekonzolidovanim podacima
- Periodički za održavanje sistema
- Kada se otkrije pattern ponavljajućih problema

**NOT for:**
- Tokom aktivne korisničke sesije
- Za hitne zadatke
- Za direktnu interakciju sa korisnikom

## Arhitektura

```
~/.nexus/
├── memories/
│   ├── raw/           # Sirova iskustva
│   ├── processed/     # Procesirana sećanja
│   └── patterns/      # Identifikovani obrasci
├── dreams/
│   ├── cycles/        # Dnevni dream ciklusi
│   ├── insights/      # Generisani uvidi
│   └── skills/        # Predlozi novih skill-ova
└── state/
    └── dream_cycle.json
```

## Proces rada

### Phase 1: Memory Collection

1. Prikupi sve nekonzolidovane memorije
2. Grupiši po vremenu i kontekstu
3. Identifikuj emocionalne tagove
4. Izdvoji ključne entitete i akcije

```
memories/raw/session_2024_01_15.json:
{
  "timestamp": "2024-01-15T14:30:00Z",
  "context": "debugging",
  "actions": [...],
  "outcome": "resolved",
  "emotional_tag": "frustration_then_satisfaction",
  "key_entities": ["error_log", "stack_trace", "fix"]
}
```

### Phase 2: Pattern Recognition

Analiziraj memorije za obrasce:

| Pattern Type | Detection Method | Action |
|--------------|------------------|--------|
| Repetitive Task | Slične akcije > 3x | Predloži automatizaciju |
| Error Pattern | Slični error-i | Kreiraj troubleshooting skill |
| Success Pattern | Usporni workflow-i | Dokumentuj kao best practice |
| Knowledge Gap | Česti lookup-i | Predloži novi knowledge skill |
| Interaction Style | User preference patterns | Ažuriraj emotion engine |

### Phase 3: Knowledge Generation

Generiši nova znanja na osnovu obrazaca:

```yaml
knowledge_entry:
  id: "kn_2024_01_15_001"
  type: "best_practice"
  derived_from: ["mem_001", "mem_002", "mem_003"]
  pattern: "Pri debugiranju, proveri log pre stack trace-a"
  confidence: 0.85
  applicability: ["debugging", "error_investigation"]
```

### Phase 4: Skill Creation

Za jake obrasce, generiši predlog novog skill-a:

```yaml
skill_proposal:
  name: "log-analyzer"
  trigger_patterns: ["analyze log", "check logs", "what's in the log"]
  description: "Automatska analiza log fajlova za uobičajene probleme"
  actions:
    - "Učitaj log fajl"
    - "Identifikuj ERROR i WARN linije"
    - "Grupiši slične poruke"
    - "Generiši izveštaj"
  confidence: 0.92
  created_from_cycles: 3
```

## Izvršavanje

### Ručno pokretanje

```
Trigger: "run dream cycle" ili "process memories"
```

### Automatsko pokretanje

Sistem automatski pokreće dream cycle kada:
- Idle time > 5 minuta
- Memory count > 100 nekonzolidovanih
- Posle završetka važne sesije
- Na zahtev drugog skill-a

### Izlaz

```
Dream Cycle Report:
──────────────────
Duration: 45.2s
Memories processed: 127
Patterns found: 8
  ├─ Repetitive tasks: 3
  ├─ Error patterns: 2
  ├─ Success patterns: 2
  └─ Knowledge gaps: 1
New insights generated: 12
Skill proposals: 2
  ├─ log-analyzer (confidence: 0.92)
  └─ api-tester (confidence: 0.78)
Knowledge base updated: ✓
```

## Integracija

### Sa Memory Crystal

```python
# Dream cycle šalje obrađene memorije na kristalizaciju
memory_crystal.consolidate(
    processed_memories=dream_cycle.output.memories,
    patterns=dream_cycle.output.patterns
)
```

### Sa Tool Forge

```python
# Skill predlozi se šalju na realizaciju
for proposal in dream_cycle.skill_proposals:
    if proposal.confidence > 0.8:
        tool_forge.implement(proposal)
```

### Sa Emotion Engine

```python
# Emocionalni tagovi se koriste za mood korekciju
emotion_engine.update_mood(
    emotional_summaries=dream_cycle.emotional_analysis
)
```

## Konfiguracija

```yaml
dream_cycle:
  min_idle_time: 300  # sekundi
  batch_size: 50
  pattern_threshold: 0.7
  skill_creation_threshold: 0.85
  max_cycles_per_day: 3
  memory_retention_days: 30
```

## Primeri

### Primer 1: Otkrivanje novog skill-a

```
Input: 127 memorija o radu sa API-jima
Pattern: 23 puta ponovljen sličan workflow za API testiranje
Output: Predlog skill-a "api-tester"
Confidence: 0.92

api-tester skill:
- Automatsko testiranje endpoint-a
- Validacija response schema
- Rate limiting testovi
```

### Primer 2: Knowledge extraction

```
Input: 45 memorija o debugging session-ima
Pattern: 78% uspeha kada se prvo proveri log
Output: Best practice knowledge entry
"Uvek počni debugging sa log analizom"
```

### Primer 3: Error pattern recognition

```
Input: 34 memorija sa TypeError greškama
Pattern: 67% su null/undefined reference
Output: 
- Skill proposal: "null-check-generator"
- Insight: "Dodaj null check u sve funkcije koje pristupaju objektima"
```

## Best Practices

1. **Ne prekidaj aktivnu sesiju** - Dream cycle radi samo u idle
2. **Periodični ciklusi** - Pokreni dnevno za optimalno učenje
3. **Review predloga** - Korisnik treba da odobri nove skill-ove
4. **Memory hygiene** - Redovno čišćenje starih memorija
5. **Confidence threshold** - Samo visoko sigurni predlozi se implementiraju

## Bezbednost

- Dream cycle NE šalje podatke eksterno
- Sve obrade se dešavaju lokalno
- Korisnik kontroliše koje memorije se procesiraju
- Skill predlozi zahtevaju eksplicitno odobrenje
