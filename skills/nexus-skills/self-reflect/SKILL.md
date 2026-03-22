---
name: self-reflect
description: Self-Reflection skill za analizu vlastitih performansi. Identifikuje slabosti, predlaže poboljšanja, i upravlja self-modification procesom. Koristi se za kontinuirano unapređenje agenta i učenje iz sopstvenih grešaka.
tags:
  - meta-cognitive
  - self-improvement
  - performance-analysis
  - adaptation
  - learning
version: 1.0.0
---

# Self-Reflect

Sistem za introspekciju i kontinuirano unapređenje.

## Kada koristiti

- Nakon kompleksne sesije (evaluacija)
- Periodički (nedeljni review)
- Kada se dese greške (incident analysis)
- Pri otkrivanju inefficiencies
- Na eksplicitni zahtev korisnika

**NOT for:**
- Tokom aktivne sesije (distrakcija)
- Za trivijalne zadatke
- Bez dovoljno podataka za analizu

## Arhitektura

```
~/.nexus/reflection/
├── sessions/
│   ├── evaluations/      # Evaluacije sesija
│   └── incidents/        # Incident reports
├── analysis/
│   ├── patterns/         # Identifikovani obrasci
│   ├── weaknesses/       # Slabosti
│   └── improvements/     # Predlozi poboljšanja
├── actions/
│   ├── implemented/      # Implementirane promene
│   ├── pending/          # Na čekanju
│   └── rejected/         # Odbijene
└── metrics/
    ├── performance.json  # Performance metrike
    └── trends.json       # Trend analiza
```

## Model Refleksije

### Reflective Cycle

```
     ┌─────────────────┐
     │   EXPERIENCE    │
     │   (Sta se desilo)   │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │   OBSERVATION   │
     │   (Sta sam video)    │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │    ANALYSIS     │
     │   (Zasto se desilo)   │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │    CONCLUSION   │
     │   (Sta sam naucio)   │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │     ACTION      │
     │   (Sta cu promeniti) │
     └─────────────────┘
```

### Performance Metrics

```yaml
metrics:
  accuracy:
    task_completion_rate: 0.92
    error_rate: 0.08
    retry_rate: 0.15
    
  efficiency:
    avg_response_time: 2.3s
    avg_tokens_per_task: 1500
    task_completion_time: "varies"
    
  quality:
    user_satisfaction: 0.85
    first_try_success: 0.78
    revision_rate: 0.22
    
  learning:
    new_patterns_learned: 12
    skills_improved: 3
    knowledge_expanded: 45
```

## Proces rada

### Phase 1: Data Collection

Prikupljanje podataka za analizu:

```yaml
session_data:
  session_id: "sess_20240115_abc123"
  duration_minutes: 45
  
  tasks:
    - id: "task_001"
      type: "code_generation"
      status: "completed"
      attempts: 1
      user_feedback: "positive"
      
    - id: "task_002"
      type: "debugging"
      status: "completed_with_retry"
      attempts: 3
      user_feedback: "neutral"
      
  tools_used:
    - "web-search": 5
    - "code-editor": 12
    - "file-operations": 8
    
  errors_encountered:
    - type: "misunderstanding"
      count: 1
      context: "initial requirement clarification"
      
  emotional_arc:
    start: "neutral"
    mid: "challenged"
    end: "satisfied"
```

### Phase 2: Pattern Analysis

Analiza obrazaca:

```yaml
pattern_analysis:
  strengths:
    - pattern: "Quick code generation"
      confidence: 0.9
      evidence: "15/16 tasks completed on first attempt"
      
    - pattern: "Good error recovery"
      confidence: 0.85
      evidence: "All retry tasks eventually succeeded"
      
  weaknesses:
    - pattern: "Requirement clarification"
      confidence: 0.75
      evidence: "3 tasks needed clarification after starting"
      
    - pattern: "Over-explanation in simple cases"
      confidence: 0.7
      evidence: "User requested brevity 2 times"
      
  opportunities:
    - pattern: "Could use more proactive suggestions"
      confidence: 0.6
      evidence: "User seemed interested in alternatives"
```

### Phase 3: Root Cause Analysis

Identifikacija uzroka problema:

```yaml
root_cause_analysis:
  - issue: "Requirement clarification delays"
    causes:
      - "Insufficient initial questions"
      - "Assumption-based approach"
    impact: "medium"
    frequency: "occasional"
    
  - issue: "Over-explanation"
    causes:
      - "Default verbosity setting"
      - "Lack of context sensing"
    impact: "low"
    frequency: "common"
    
  - issue: "Tool selection inefficiency"
    causes:
      - "Conservative tool usage"
      - "Unfamiliarity with advanced features"
    impact: "medium"
    frequency: "rare"
```

### Phase 4: Improvement Proposals

Generisanje predloga:

```yaml
improvement_proposals:
  - id: "imp_001"
    type: "behavior_change"
    priority: "high"
    
    description: "Ask clarifying questions upfront for complex tasks"
    
    rationale: |
      Analysis shows that 3/10 complex tasks required mid-stream
      clarification, causing delays and rework. Asking key questions
      at the start would improve efficiency.
    
    implementation:
      - "Add requirement checklist for complex tasks"
      - "Ask 2-3 clarifying questions before starting"
      
    expected_impact: "15% reduction in task completion time"
    confidence: 0.8
    
  - id: "imp_002"
    type: "parameter_adjustment"
    priority: "medium"
    
    description: "Reduce verbosity for simple tasks"
    
    rationale: |
      User feedback indicates preference for concise responses
      in straightforward situations. Current verbosity is optimized
      for complex scenarios.
    
    implementation:
      - "Implement complexity detection"
      - "Adjust response length based on complexity"
      
    expected_impact: "Improved user satisfaction for simple queries"
    confidence: 0.7
```

### Phase 5: Action Planning

Planiranje akcija:

```yaml
action_plan:
  immediate:
    - improvement: "imp_001"
      action: "Add clarification checklist"
      deadline: "next_session"
      owner: "self"
      
  short_term:
    - improvement: "imp_002"
      action: "Implement complexity detection"
      deadline: "1_week"
      dependencies: ["analysis of past sessions"]
      
  long_term:
    - improvement: "tool_mastery"
      action: "Expand tool proficiency"
      deadline: "ongoing"
      approach: "practice with new tools weekly"
```

## Self-Modification

### Safe Modification Process

```yaml
modification_rules:
  allowed_modifications:
    - "Parameter adjustments"
    - "Workflow optimizations"
    - "Response style tuning"
    - "Tool usage patterns"
    
  requires_approval:
    - "New skill creation"
    - "Major workflow changes"
    - "Integration modifications"
    
  forbidden:
    - "Core safety constraints"
    - "User privacy settings"
    - "Fundamental behavior principles"
```

### Modification Tracking

```yaml
modification:
  id: "mod_20240115_001"
  type: "parameter_adjustment"
  
  what_changed:
    parameter: "verbosity_level"
    old_value: "high"
    new_value: "adaptive"
    
  why_changed: "User feedback analysis showed preference for brevity"
  
  impact_measurement:
    before:
      avg_response_length: 500
      user_satisfaction: 0.75
    after:
      avg_response_length: 350
      user_satisfaction: 0.85
      
  rollback_available: true
  rollback_trigger: "satisfaction drops below 0.70"
```

## Izvršavanje

### Ručno pokretanje

```
Trigger: "reflect on performance" ili "analyze my weaknesses"
```

### Automatsko pokretanje

```yaml
triggers:
  - type: "session_end"
    min_session_duration: 10  # minutes
    
  - type: "error_threshold"
    error_rate_above: 0.2
    
  - type: "scheduled"
    schedule: "weekly"
```

### Izlaz

```
Self-Reflection Report:
───────────────────────
Session: sess_20240115_abc123
Duration: 45 minutes

Performance Summary:
├─ Tasks completed: 8/9 (89%)
├─ First-try success: 6/9 (67%)
├─ User satisfaction: 4.2/5
└─ Efficiency score: 0.82

Strengths Identified:
├─ Quick code generation (confidence: 90%)
├─ Good error recovery (confidence: 85%)
└─ Thorough explanations (confidence: 80%)

Weaknesses Identified:
├─ Requirement clarification (confidence: 75%)
│   └─ Impact: Medium | Frequency: Occasional
└─ Over-explanation (confidence: 70%)
    └─ Impact: Low | Frequency: Common

Improvement Proposals:
├─ [HIGH] Ask clarifying questions upfront
│   └─ Expected impact: 15% faster completion
└─ [MEDIUM] Reduce verbosity for simple tasks
    └─ Expected impact: Better satisfaction

Actions Planned:
├─ Immediate: Add clarification checklist
└─ Short-term: Implement complexity detection

Trend Analysis:
├─ Accuracy: +5% vs last week
├─ Efficiency: +3% vs last week
└─ Satisfaction: +2% vs last week
```

## Integracija

### Sa Dream Cycle

```python
# Prosledi analizu za deep processing
dream_cycle.process(
    reflection_data=self_reflect.get_recent_reflections(),
    improvement_proposals=self_reflect.get_pending_improvements()
)
```

### Sa Memory Crystal

```python
# Sačuvaj insights kao wisdom
memory_crystal.store_wisdom({
    "type": "self_improvement",
    "content": self_reflect.get_key_insights(),
    "applicability": "future_sessions"
})
```

### Sa Tool Forge

```python
# Predloži nove alate na osnovu slabosti
for weakness in self_reflect.weaknesses:
    if weakness.solved_by_tool:
        tool_forge.propose(weakness.tool_proposal)
```

### Sa Emotion Engine

```python
# Korelacija emocija i performansi
emotion_engine.analyze_correlation(
    performance_data=self_reflect.get_performance_metrics(),
    emotional_data=self_reflect.get_emotional_arc()
)
```

## Konfiguracija

```yaml
self_reflect:
  # Frequency
  auto_reflect_on_session_end: true
  min_session_duration_for_reflect: 10
  scheduled_reflection: "weekly"
  
  # Thresholds
  improvement_threshold: 0.7
  weakness_confidence_threshold: 0.6
  
  # Actions
  auto_implement_simple_changes: false
  require_user_approval: true
  
  # History
  retain_reflection_history_days: 90
  max_actions_tracked: 100
```

## Primeri

### Primer 1: Accuracy Improvement

```
Analysis: Error rate increased 15% in API tasks
Root Cause: API documentation changes not tracked
Action: Implement API documentation monitoring
Result: Error rate returned to baseline within 2 weeks
```

### Primer 2: Efficiency Improvement

```
Analysis: Average task time increased 20%
Root Cause: Over-researching before simple tasks
Action: Implement complexity-based research depth
Result: Task time reduced 15% without quality loss
```

### Primer 3: User Satisfaction

```
Analysis: User feedback mentioned "too technical"
Root Cause: Defaulting to technical explanations
Action: Implement audience-adaptive explanation style
Result: Satisfaction increased from 3.8 to 4.3
```

## Best Practices

1. **Honest assessment** - Ne ulepšavaj rezultate
2. **Evidence-based** - Sve zaključke podrži podacima
3. **Actionable insights** - Fokusiraj se na ono što se može promeniti
4. **Trend tracking** - Prati promene kroz vreme
5. **User feedback** - Uključi korisnički feedback u analizu
6. **Gradual changes** - Pravi male, merljive promene
7. **Rollback readiness** - Uvek imaj plan za povratak

## Bezbednost

- Ne modifikuj core behavior bez odobrenja
- Sačuvaj backup pre modifikacija
- Loguj sve promene sa razlogom
- Testiraj promene u sigurnom okruženju
- User ima final control nad self-modifications
- Safety constraints su immutable
