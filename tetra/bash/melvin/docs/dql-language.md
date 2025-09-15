# DQL: Dimensional Query Language Specification

## Language Overview

**Dimensional Query Language (DQL)** is MELVIN's grammar for expressing dimensional analytics queries in natural, composable syntax.

## Core Grammar

### Basic Syntax
```
melvin [domain.]<measure> [by <dimension>...] [where <condition>...] [| <transform>...]
```

### Components

#### 1. Domain (Optional)
Specifies which registered data domain to query:
```bash
melvin tokens by engine          # Default domain (usually 'qa')
melvin qa.tokens by engine       # Explicit QA domain
melvin git.commits by author     # Git domain
melvin deploy.time by env        # Deploy domain
```

#### 2. Measure (Required)
What you want to aggregate or analyze:
```bash
melvin tokens          # Token count
melvin cost           # Dollar cost
melvin queries        # Query count
melvin response_time  # Response time in seconds
```

#### 3. Dimensions (Optional)
How to group/slice the data:
```bash
melvin tokens by engine                    # Group by AI engine
melvin tokens by day                      # Group by day
melvin tokens by engine by day            # Group by both
melvin tokens by user by context by tag   # Multi-dimensional grouping
```

#### 4. Filters (Optional)
Conditions to limit the data:
```bash
melvin tokens where date > -7d
melvin cost where engine = gpt-4
melvin queries where context = python and cost > 0.10
```

#### 5. Transformations (Optional)
Post-processing operations:
```bash
melvin tokens by engine | sort desc
melvin cost by day | rolling 7d avg
melvin queries by hour | rate per_day
```

## Detailed Syntax

### Measures

**Numeric Measures:**
- `tokens` - Token count
- `cost` - Dollar cost
- `response_time` - Response time in seconds
- `queries` - Query count

**Derived Measures:**
- `cost_per_token` - Cost divided by tokens
- `tokens_per_query` - Average tokens per query
- `success_rate` - Percentage of successful queries

**Custom Measures:**
```bash
melvin define efficiency = tokens / cost
melvin define daily_spend = cost | sum by day
```

### Dimensions

**Temporal Dimensions:**
```bash
by second | minute | hour | day | week | month | quarter | year
by date | time | timestamp
```

**Categorical Dimensions:**
```bash
by engine | model          # AI engine/model
by context                 # Query context
by user                    # User identity
by tag | tags              # Tags (single or multiple)
by success | status        # Success/failure status
```

**Hierarchical Dimensions:**
```bash
by year by month by day    # Time hierarchy
by user by team by org     # Organizational hierarchy
```

### Filters (Where Clauses)

**Comparison Operators:**
```bash
where date > 2024-01-01
where cost < 0.50
where tokens >= 100
where engine != gpt-3.5
```

**Temporal Filters:**
```bash
where date > -7d           # Last 7 days
where time > -2h           # Last 2 hours
where date between 2024-01-01 and 2024-01-31
where hour in [9,10,11,12,13,14,15,16,17]  # Business hours
```

**Pattern Matching:**
```bash
where context like python
where tag contains debug
where engine matches gpt-*
```

**Logical Operators:**
```bash
where cost > 1.0 and engine = gpt-4
where date > -7d or tag contains urgent
where not (context = test)
```

### Transformations (Pipe Operations)

**Aggregation Transformations:**
```bash
| sum                    # Sum values
| avg | average         # Average values
| count                 # Count items
| min | max            # Min/max values
| median | p95         # Percentiles
```

**Sorting and Limiting:**
```bash
| sort asc | sort desc         # Sort results
| top 10 | bottom 5           # Limit results
| head 20 | tail 10           # First/last N
```

**Statistical Transformations:**
```bash
| trend                       # Trend analysis
| rate per_hour | per_day    # Rate calculations
| rolling 7d avg             # Rolling averages
| percent | normalize        # Percentage/normalization
```

**Output Formatting:**
```bash
| table                      # Formatted table
| csv | json | tsv          # Data formats
| chart | spark             # ASCII charts
| save filename             # Save to file
```

## Advanced Patterns

### Cross-Domain Queries
```bash
# Join data across domains
melvin qa.cost + git.commits by day where qa.context = python
```

### Time Series Analysis
```bash
# Temporal patterns
melvin cost by hour | pattern weekday vs weekend
melvin tokens by day | seasonal monthly
melvin queries by week | trend | forecast +4w
```

### Comparative Analysis
```bash
# Period comparisons
melvin cost by engine this_month vs last_month
melvin tokens by day | compare to_average
melvin queries by user | rank percentile
```

### Complex Filtering
```bash
# Multi-condition filters
melvin cost where (
  engine = gpt-4 and tokens > 1000
) or (
  engine = gpt-3.5 and cost > 0.50
)
```

### Calculated Dimensions
```bash
# Derived groupings
melvin cost by hour_of_day where weekday = true
melvin tokens by cost_bracket [0-0.1, 0.1-0.5, 0.5+]
```

## Query Composition Examples

### Simple Queries
```bash
# Basic aggregation
melvin tokens
melvin cost by day
melvin queries by engine | sort desc
```

### Intermediate Queries
```bash
# Multi-dimensional analysis
melvin cost by engine by day where date > -30d | chart
melvin tokens by user by context | top 10 by tokens
melvin response_time by engine where cost > 0.10 | avg
```

### Advanced Queries
```bash
# Complex analytical queries
melvin cost by engine by day where date > -90d | rolling 7d avg | trend | chart
melvin cost_per_token by engine where tokens > 100 | rank by efficiency | table
melvin queries by hour | pattern | alert if anomaly > 2_stddev
```

## Saved Queries

### Saving Queries
```bash
# Save frequently used queries
melvin save "daily_costs" "cost by day"
melvin save "top_engines" "tokens by engine | sort desc | top 5"
melvin save "weekly_trend" "cost by week | trend"
```

### Loading Saved Queries
```bash
# Execute saved queries
melvin load daily_costs
melvin load top_engines where date > -7d
melvin load weekly_trend | chart
```

### Query Categories
```bash
~/.melvin/queries/
├── frequent/          # Daily/hourly queries
│   ├── daily_costs.dql
│   ├── hourly_usage.dql
├── reports/           # Weekly/monthly reports
│   ├── monthly_summary.dql
│   ├── cost_breakdown.dql
├── alerts/            # Monitoring queries
│   ├── high_usage.dql
│   ├── cost_spike.dql
└── custom/            # Ad-hoc user queries
    ├── python_analysis.dql
    ├── weekend_patterns.dql
```

## Language Extensions

### Custom Functions
```bash
# Define reusable calculations
melvin define cost_efficiency = tokens / cost
melvin define peak_hours = hour in [9,10,11,14,15,16]
melvin define workdays = weekday not in [sat,sun]
```

### Macros
```bash
# Define query templates
melvin macro engine_analysis = "
  $1 by engine by day where date > $2 |
  rolling 7d avg |
  chart title='$1 Analysis'
"

# Use macro
melvin engine_analysis cost -30d
melvin engine_analysis tokens -14d
```

### Domain-Specific Extensions
```bash
# QA-specific functions
melvin tokens by complexity [simple, moderate, complex]
melvin cost by intent [question, debug, explain, code]

# Git-specific functions
melvin commits by impact [minor, major, breaking]
melvin files by language [python, javascript, go]
```

## Implementation Notes

### Parsing Strategy
1. **Tokenize** the query into components
2. **Validate** against schema (available measures, dimensions)
3. **Optimize** query plan based on available indexes
4. **Generate** awk/sort/uniq pipeline
5. **Execute** and format results

### Error Handling
```bash
# Helpful error messages
melvin tokins by engine
# Error: Unknown measure 'tokins'. Did you mean 'tokens'?

melvin tokens by enginee
# Error: Unknown dimension 'enginee'. Available: engine, context, user, tag

melvin tokens where date > yesterday
# Error: Invalid date format. Use: -7d, 2024-01-01, or -1d
```

### Performance Optimization
- **Index awareness** - Use existing flat file indexes
- **Pipeline optimization** - Minimize file passes
- **Caching** - Cache expensive query results
- **Streaming** - Process large datasets in chunks

## Next Steps

Understanding DQL prepares you for:
- **[Examples](examples.md)** - Real-world DQL usage patterns
- **[Storage Architecture](storage-architecture.md)** - How DQL maps to flat file operations
- **[Protocol Design](protocol-design.md)** - How modules register queryable dimensions