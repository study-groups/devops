# Grammar of Graphics: From Visual to CLI Analytics

## The Original Grammar of Graphics

Leland Wilkinson's **Grammar of Graphics** revolutionized data visualization by providing a systematic way to construct graphics from composable elements:

### Core Components (Visual)
1. **Data**: The dataset being visualized
2. **Aesthetics**: Mappings from data to visual properties (x, y, color, size)
3. **Geometries**: Visual representations (points, lines, bars)
4. **Scales**: Transformations from data space to aesthetic space
5. **Coordinates**: Coordinate systems (cartesian, polar, geographic)
6. **Facets**: Subplots based on categorical variables
7. **Statistics**: Statistical transformations (mean, count, regression)

### Example (ggplot2)
```r
ggplot(data) +
  aes(x=date, y=cost, color=engine) +
  geom_line() +
  scale_y_log10() +
  facet_wrap(~context) +
  stat_smooth()
```

This **composes** simple elements into sophisticated visualizations.

## MELVIN's CLI Grammar Adaptation

MELVIN adapts Grammar of Graphics principles for **command-line analytics**, replacing visual mappings with **dimensional analysis operations**.

### CLI Grammar Components

#### 1. **Data** → **Domain**
```bash
# Visual ggplot: data=queries_df
# CLI MELVIN: domain=qa (implies $QA_DIR/db/*.answer files)
melvin qa tokens by engine
```

#### 2. **Aesthetics** → **Dimensions/Measures**
```bash
# Visual: aes(x=date, y=cost, color=engine)
# CLI: tokens (measure) by day (x-dimension) by engine (color-dimension)
melvin tokens by day by engine
```

#### 3. **Geometries** → **Output Formats**
```bash
# Visual: geom_line(), geom_bar(), geom_point()
# CLI: | chart, | table, | csv, | json
melvin tokens by day | chart
melvin tokens by engine | table
```

#### 4. **Statistics** → **Aggregations**
```bash
# Visual: stat_count(), stat_summary()
# CLI: sum (default), avg, count, rate, trend
melvin tokens by engine | avg
melvin queries by hour | rate
```

#### 5. **Scales** → **Transformations**
```bash
# Visual: scale_y_log10(), scale_x_date()
# CLI: | log, | normalize, | percent
melvin cost by day | log
melvin tokens by engine | percent
```

#### 6. **Facets** → **Cross-Dimensions**
```bash
# Visual: facet_wrap(~context)
# CLI: Multi-dimensional grouping
melvin tokens by engine by context  # Creates engine×context matrix
```

#### 7. **Coordinates** → **Filters & Context**
```bash
# Visual: coord_cartesian(xlim=c(0,100))
# CLI: where clauses and context setting
melvin tokens by engine where date > -7d
```

## Composability in CLI Grammar

### Building Complexity Incrementally

Just like ggplot2 builds complex visualizations by adding layers, MELVIN builds complex analytics by adding dimensions:

```bash
# Start simple
melvin tokens
# Result: 1547 (total tokens)

# Add time dimension
melvin tokens by day
# Result: Daily token usage table

# Add engine dimension
melvin tokens by day by engine
# Result: Daily×Engine matrix

# Add filtering
melvin tokens by day by engine where context=python
# Result: Filtered to Python work only

# Add statistical transformation
melvin tokens by day by engine where context=python | trend
# Result: Trend analysis of Python token usage by engine

# Add output formatting
melvin tokens by day by engine where context=python | trend | chart
# Result: ASCII chart of the trend
```

### Pipe-Based Composition

Following Unix philosophy, MELVIN uses pipes for transformation composition:

```bash
# Grammar: measure + dimensions + filters + transformations + output
melvin cost by engine by day where tag=urgent | sum | sort desc | top 5 | table
```

This reads like natural language while maintaining composability.

## Grammar Patterns

### The "By" Pattern (Dimensional Grouping)
```bash
melvin <measure> by <dimension> [by <dimension>...] [where <filter>]
```

### The Pipe Pattern (Transformation Chain)
```bash
melvin <base_query> | <transform> | <transform> | <output>
```

### The Where Pattern (Filtering)
```bash
melvin <query> where <dimension>=<value> [and <condition>...]
```

## Comparison: Visual vs CLI Grammar

### Visual Grammar (ggplot2)
```r
# Complex multi-faceted visualization
ggplot(qa_data) +
  aes(x=timestamp, y=cost, color=engine) +
  geom_line() +
  geom_smooth() +
  scale_x_date() +
  scale_y_continuous() +
  facet_wrap(~context) +
  theme_minimal() +
  labs(title="Cost Trends by Engine and Context")
```

### CLI Grammar (MELVIN)
```bash
# Equivalent analytical query
melvin cost by day by engine by context | trend | chart
```

**Key Insight**: CLI grammar is more **concise** but less **visual**. The trade-off is immediacy vs visual richness.

## Advanced Grammar Patterns

### Cross-Domain Queries
```bash
# Query across multiple registered domains
melvin qa.cost + git.commits by day where qa.context=python
```

### Calculated Measures
```bash
# Create derived measures
melvin define efficiency = tokens / cost
melvin efficiency by engine | sort desc
```

### Temporal Windows
```bash
# Rolling calculations
melvin cost by day | rolling 7d avg | chart
```

### Comparative Analysis
```bash
# Period-over-period comparison
melvin tokens by engine this_month vs last_month | percent_change
```

## Why This Grammar Works

### 1. **Cognitive Alignment**
The grammar matches how people naturally think about data questions:
- "Show me **cost** (measure) **by engine** (dimension) **for last week** (filter)"

### 2. **Discoverability**
Grammar elements are discoverable:
```bash
melvin help measures    # Shows available measures
melvin help dimensions  # Shows available dimensions
melvin help transforms  # Shows available transformations
```

### 3. **Composability**
Like ggplot2, complex analyses emerge from simple building blocks.

### 4. **Consistency**
Same grammar works across all registered domains (qa, git, deploy, etc.).

## Implementation Philosophy

Grammar of Graphics taught us that **good grammar enables powerful expression**. By providing the right compositional elements, users can create sophisticated analyses without needing to know the underlying implementation.

MELVIN's grammar aims for the same **expressive power** that ggplot2 brought to visualization, but adapted for the **command-line analytics** context where most technical work happens.

The goal is **Tableau-like analytical power** expressed through **Unix-philosophy composability**.

## Next Steps

Understanding the grammar foundation prepares you for:
- **[DQL Language](dql-language.md)** - Complete language specification
- **[Examples](examples.md)** - Real-world grammar usage patterns
- **[Storage Architecture](storage-architecture.md)** - How grammar maps to file operations