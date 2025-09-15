# MELVIN Examples: Real-World Dimensional Analytics

## Basic Analytics Patterns

### Token Usage Analysis
```bash
# Simple token counting
melvin tokens
# Output: 125,847

# Token usage by AI engine
melvin tokens by engine
# Output:
# gpt-4           45,230
# gpt-3.5-turbo   78,192
# claude-3         2,425

# Token trends over time
melvin tokens by day where date > -30d
# Output:
# 2024-09-01    3,245
# 2024-09-02    4,102
# 2024-09-03    2,876
# ...

# Token usage patterns by hour
melvin tokens by hour | chart
# Output: ASCII chart showing hourly usage patterns
```

### Cost Analysis
```bash
# Total spend
melvin cost
# Output: $23.45

# Cost by engine with sorting
melvin cost by engine | sort desc
# Output:
# gpt-4          $18.92
# gpt-3.5-turbo  $3.91
# claude-3       $0.62

# Daily costs for last week
melvin cost by day where date > -7d | chart
# Output: ASCII chart of daily spending

# Cost efficiency analysis
melvin cost_per_token by engine | sort asc
# Output:
# gpt-3.5-turbo  0.000050
# gpt-4          0.000418
# claude-3       0.000255
```

## Advanced Analytics Patterns

### Multi-Dimensional Analysis
```bash
# Engine usage by day matrix
melvin tokens by engine by day where date > -14d | table
# Output:
#              2024-09-01  2024-09-02  2024-09-03
# gpt-4              1,245       1,876       2,103
# gpt-3.5-turbo      2,876       3,245       2,987
# claude-3             123         156         234

# Context analysis
melvin queries by context by engine | top 10
# Output:
# python    gpt-4          45
# devops    gpt-3.5-turbo  38
# debug     gpt-4          32
# ...
```

### Temporal Patterns
```bash
# Weekend vs weekday usage
melvin tokens by weekday vs weekend
# Output:
# weekday    89,245
# weekend    36,602

# Peak usage hours
melvin queries by hour | sort desc | top 5
# Output:
# 14 (2pm)   23
# 15 (3pm)   21
# 10 (10am)  19
# 11 (11am)  18
# 16 (4pm)   17

# Monthly trends
melvin cost by month | trend
# Output: Shows increasing/decreasing trend over months
```

### Efficiency Analysis
```bash
# Response time by engine
melvin response_time by engine | avg
# Output:
# gpt-4          2.3s
# gpt-3.5-turbo  1.8s
# claude-3       3.1s

# Success rates
melvin success_rate by engine | percent
# Output:
# gpt-4          97.2%
# gpt-3.5-turbo  98.5%
# claude-3       96.8%

# Cost vs quality analysis
melvin cost by engine where success = true | compare cost by engine
# Output: Cost comparison for successful queries only
```

## Filtering and Conditional Analysis

### Date Range Queries
```bash
# Last 24 hours
melvin tokens by engine where date > -1d

# Specific date range
melvin cost where date between 2024-09-01 and 2024-09-07

# This month vs last month
melvin tokens this_month vs last_month | percent_change
# Output: +23.4%

# Business hours only
melvin queries by day where hour in [9,10,11,12,13,14,15,16,17]
```

### Context-Based Analysis
```bash
# Python-related queries
melvin cost where context = python
melvin tokens by engine where context = python

# Debugging sessions
melvin queries where tag contains debug by day | chart

# High-cost queries
melvin queries where cost > 0.50 by engine
# Output:
# gpt-4     23
# claude-3   5
# gpt-3.5-turbo 2
```

### Complex Filters
```bash
# Expensive debugging sessions
melvin cost where context = debug and cost > 1.00 by day

# Weekend emergency work
melvin queries where weekday in [sat,sun] and hour in [0,1,2,3,22,23] by day

# Failed queries analysis
melvin tokens where success = false by engine by context
```

## Tag-Based Analytics

### Tag Management
```bash
# Tag recent queries
qa_tag 1757806329 python async debugging
qa_tag 1757806330 devops docker kubernetes

# Bulk tagging by context
melvin retag where context = python with programming,code
```

### Tag Analysis
```bash
# Most common tags
melvin queries by tag | sort desc | top 10
# Output:
# python      67
# debugging   45
# devops      38
# javascript  23
# ...

# Tag combinations
melvin queries by tag where tag contains python and tag contains async
# Output: 12

# Cost by tag
melvin cost by tag where date > -30d | sort desc
# Output:
# python     $8.92
# debugging  $6.34
# devops     $4.12
# ...
```

## Comparative Analysis

### Engine Comparisons
```bash
# Feature comparison matrix
melvin tokens,cost,response_time by engine | table
# Output:
#              tokens   cost    avg_time
# gpt-4        45,230   $18.92  2.3s
# gpt-3.5-turbo 78,192  $3.91   1.8s
# claude-3      2,425   $0.62   3.1s

# Efficiency ranking
melvin define efficiency = tokens / cost
melvin efficiency by engine | rank
# Output:
# 1. gpt-3.5-turbo  (19,995 tokens/$)
# 2. claude-3       (3,911 tokens/$)
# 3. gpt-4          (2,390 tokens/$)
```

### Time-Based Comparisons
```bash
# Growth analysis
melvin tokens by month | growth_rate
# Output:
# 2024-07    baseline
# 2024-08    +15.2%
# 2024-09    +8.7%

# Seasonal patterns
melvin queries by month | seasonal
# Output: Shows monthly variation patterns

# Day-of-week patterns
melvin cost by weekday | normalize
# Output:
# Monday     1.12 (12% above average)
# Tuesday    1.05
# Wednesday  0.95
# Thursday   1.08
# Friday     0.88
# Saturday   0.76
# Sunday     0.68
```

## Cross-Module Analytics (Future)

### QA + Git Integration
```bash
# Correlate QA usage with code activity
melvin qa.tokens + git.commits by day | correlation
# Output: 0.73 (strong positive correlation)

# Context analysis with git data
melvin qa.cost by qa.context where git.files_changed > 10
# Output: Shows QA costs when active coding sessions
```

### QA + Deploy Integration
```bash
# QA usage around deployments
melvin qa.queries by day where deploy.status = failed | spike_detection
# Output: Shows if failed deploys increase QA usage

# Learning curve analysis
melvin qa.cost by qa.context where deploy.environment = new_feature
# Output: Learning costs for new feature development
```

## Saved Queries and Automation

### Creating Saved Queries
```bash
# Save frequent queries
melvin save "daily_costs" "cost by day where date > -7d | chart"
melvin save "engine_efficiency" "cost_per_token by engine | sort asc"
melvin save "peak_hours" "queries by hour | sort desc | top 5"
melvin save "weekend_usage" "tokens by day where weekday in [sat,sun]"
```

### Using Saved Queries
```bash
# Execute saved queries
melvin daily_costs
melvin engine_efficiency
melvin peak_hours where date > -30d  # Can add filters to saved queries
```

### Query Automation
```bash
# Set up alerts
melvin alert "high_daily_cost" "cost by day > 50.00" email
melvin alert "unusual_usage" "queries by hour | anomaly > 2_stddev" slack

# Scheduled reports
melvin schedule "weekly_report" "
  cost by engine by day where date > -7d |
  table |
  email team@company.com
" every_monday_9am
```

## Performance Monitoring

### Query Performance
```bash
# Slow queries
melvin response_time where response_time > 5.0 by engine by context

# Token efficiency over time
melvin cost_per_token by day | trend | alert_if increasing

# Usage spikes
melvin queries by hour | spike_detection | threshold 3_stddev
```

### System Health
```bash
# Error rates
melvin error_rate by engine by day where date > -7d | chart

# Cost runaway detection
melvin cost by day | rolling 3d avg | trend | alert_if slope > 0.1

# Usage anomalies
melvin tokens by hour | anomaly_score | threshold 95th_percentile
```

## Workflow-Specific Examples

### Development Workflow
```bash
# Morning standup insights
melvin cost where date = yesterday by context | table
melvin queries by tag where tag contains blocked | count

# Weekly review
melvin tokens,cost by day where date > -7d | summary_stats
melvin context_switch_rate by day  # Custom calculated measure
```

### Debugging Workflow
```bash
# Debugging session analysis
melvin cost where tag contains debug by session_id | sort desc
melvin response_time where context = debug | percentile 95

# Learning effectiveness
melvin define resolution_rate = success_queries / total_queries where tag contains debug
melvin resolution_rate by day | trend
```

### Research Workflow
```bash
# Research deep-dives
melvin tokens where context = research by topic | top 10
melvin cost per research_session by complexity | distribution

# Knowledge building
melvin follow_up_rate by initial_context | table
# Shows which contexts lead to more follow-up questions
```

## Output Formatting Examples

### Table Format
```bash
melvin cost by engine by day where date > -7d | table
# Produces formatted table with headers and alignment
```

### Chart Format
```bash
melvin tokens by day where date > -30d | chart
# ASCII line chart showing trends

melvin queries by hour | bar_chart
# ASCII bar chart showing distribution
```

### Export Formats
```bash
melvin cost by engine | csv > engine_costs.csv
melvin tokens by day where date > -90d | json > usage_data.json
melvin queries by context | tsv | sort -k2 -nr > context_ranking.tsv
```

These examples demonstrate MELVIN's power to transform simple QA system data into rich analytical insights using intuitive dimensional query language. The patterns shown here apply to any module that integrates with MELVIN's protocol.