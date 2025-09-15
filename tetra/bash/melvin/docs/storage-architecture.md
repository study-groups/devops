# Storage Architecture: Flat File Dimensional Analytics

## Architecture Philosophy

MELVIN's storage architecture is designed around **flat file optimization** for dimensional analytics. The goal is to make complex dimensional queries run efficiently using standard Unix tools (awk, sort, uniq, grep) on flat text files.

## Core Design Principles

### 1. **Unix Native**
- Built on awk/sort/uniq pipeline philosophy
- Streamable data processing for large datasets
- Composable operations that pipe together naturally

### 2. **Dimensional First**
- Storage layout optimized for dimensional slicing
- Pre-computed indexes for common dimension combinations
- Denormalized data to avoid joins

### 3. **Incremental Updates**
- Only reprocess changed data
- Maintain minimal state for fast updates
- Efficient detection of new/modified source files

## Directory Structure

```
~/.melvin/
├── registry/                    # Module registration
│   ├── qa.json                 # QA module manifest
│   ├── git.json                # Git module manifest
│   └── deploy.json             # Deploy module manifest
│
├── data/                       # Flattened analytical data
│   ├── qa/
│   │   ├── raw.tsv            # All QA data in flat format
│   │   ├── by_date.tsv        # Pre-aggregated by date
│   │   ├── by_engine.tsv      # Pre-aggregated by engine
│   │   └── by_engine_date.tsv # Pre-aggregated by engine×date
│   └── git/
│       ├── raw.tsv
│       └── by_author.tsv
│
├── index/                      # Search indexes
│   ├── qa/
│   │   ├── tokens.idx         # Token measure index
│   │   ├── cost.idx           # Cost measure index
│   │   └── full_text.idx      # Full text search
│   └── git/
│
├── cache/                      # Query result caching
│   ├── queries/               # Cached query results
│   └── metadata/              # Cache metadata
│
└── state/                      # System state
    ├── last_update.json       # Last update timestamps by module
    ├── events.log             # Cross-module event stream
    └── references.log         # Cross-module relationships
```

## Data Format Strategy

### Raw Data Format (TSV)
Each module's raw data is flattened into tab-separated values:

```tsv
# qa/raw.tsv
timestamp	id	tokens	cost	engine	context	user	tags	success	response_time
1757806329	1757806329	150	0.030	gpt-4	python	mricos	debug,async	1	2.3
1757806330	1757806330	200	0.020	gpt-3.5-turbo	devops	mricos	deploy,ssh	1	1.8
1757806331	1757806331	175	0.035	gpt-4	python	mricos	debug	0	-1
```

**Column Selection Strategy:**
- **Fixed columns** for common dimensions (timestamp, id, user)
- **Measure columns** for all numeric measures
- **Categorical columns** for primary dimensions
- **JSON column** for complex/variable metadata

### Pre-Aggregated Indexes

For common queries, maintain pre-aggregated data:

```tsv
# qa/by_engine.tsv
engine	count	sum_tokens	sum_cost	avg_response_time	last_updated
gpt-4	150	45000	12.50	2.3	1757806350
gpt-3.5-turbo	300	60000	8.75	1.8	1757806350
claude-3	75	22500	15.00	3.1	1757806350
```

```tsv
# qa/by_engine_date.tsv
engine	date	count	sum_tokens	sum_cost
gpt-4	2024-09-13	45	13500	3.75
gpt-4	2024-09-12	38	11400	3.42
gpt-3.5-turbo	2024-09-13	89	17800	2.67
```

## Query Execution Strategy

### 1. Query Planning
```bash
melvin_plan_query() {
    local query="$1"

    # Parse query into components
    local measure dimensions filters transforms

    # Determine optimal data source
    local data_source=$(select_optimal_source "$dimensions" "$filters")

    # Generate execution plan
    generate_execution_plan "$data_source" "$measure" "$dimensions" "$filters" "$transforms"
}
```

### 2. Data Source Selection
```bash
select_optimal_source() {
    local dimensions="$1"
    local filters="$2"

    # Check for exact pre-aggregated match
    local index_file="by_$(echo $dimensions | tr ' ' '_').tsv"
    if [[ -f "$MELVIN_DATA_DIR/$module/$index_file" ]]; then
        echo "$index_file"
        return
    fi

    # Check for compatible pre-aggregated source
    # (can aggregate up from more granular data)

    # Fall back to raw data
    echo "raw.tsv"
}
```

### 3. Pipeline Generation
```bash
generate_execution_plan() {
    local source="$1"
    local measure="$2"
    local dimensions="$3"
    local filters="$4"
    local transforms="$5"

    local pipeline=""

    # Start with data source
    pipeline="cat $MELVIN_DATA_DIR/$module/$source"

    # Add filters
    for filter in $filters; do
        pipeline="$pipeline | $(generate_filter_awk "$filter")"
    done

    # Add grouping/aggregation
    if [[ -n "$dimensions" ]]; then
        pipeline="$pipeline | $(generate_groupby_awk "$measure" "$dimensions")"
    fi

    # Add transforms
    for transform in $transforms; do
        pipeline="$pipeline | $(generate_transform_cmd "$transform")"
    done

    echo "$pipeline"
}
```

## Indexing Strategy

### Incremental Indexing
```bash
melvin_update_index() {
    local module="$1"
    local last_update=$(cat $MELVIN_STATE_DIR/last_update.json | jq -r ".$module // 0")

    # Find new/modified source files
    local source_pattern=$(get_module_source_pattern "$module")
    local new_files=$(find $source_pattern -newer "@$last_update")

    if [[ -z "$new_files" ]]; then
        return  # No updates needed
    fi

    # Process new files
    for file in $new_files; do
        extract_record_from_file "$module" "$file" >> $MELVIN_DATA_DIR/$module/raw.tsv
    done

    # Update pre-aggregated indexes
    regenerate_indexes "$module"

    # Update timestamp
    jq ".$module = $(date +%s)" $MELVIN_STATE_DIR/last_update.json > tmp && mv tmp $MELVIN_STATE_DIR/last_update.json
}
```

### Index Maintenance
```bash
regenerate_indexes() {
    local module="$1"
    local raw_file="$MELVIN_DATA_DIR/$module/raw.tsv"

    # Generate common indexes

    # by_date index
    awk -F'\t' '
        NR>1 {date=strftime("%Y-%m-%d", $1); count[date]++; tokens[date]+=$3; cost[date]+=$4}
        END {for(d in count) print d "\t" count[d] "\t" tokens[d] "\t" cost[d]}
    ' "$raw_file" | sort > "$MELVIN_DATA_DIR/$module/by_date.tsv"

    # by_engine index
    awk -F'\t' '
        NR>1 {count[$5]++; tokens[$5]+=$3; cost[$5]+=$4; time[$5]+=$10; n[$5]++}
        END {for(e in count) print e "\t" count[e] "\t" tokens[e] "\t" cost[e] "\t" (time[e]/n[e])}
    ' "$raw_file" | sort > "$MELVIN_DATA_DIR/$module/by_engine.tsv"

    # by_engine_date index (more granular)
    awk -F'\t' '
        NR>1 {
            date=strftime("%Y-%m-%d", $1)
            key=$5 "\t" date
            count[key]++; tokens[key]+=$3; cost[key]+=$4
        }
        END {for(k in count) print k "\t" count[k] "\t" tokens[k] "\t" cost[k]}
    ' "$raw_file" | sort > "$MELVIN_DATA_DIR/$module/by_engine_date.tsv"
}
```

## Query Execution Examples

### Simple Query: `melvin tokens by engine`

**Execution Plan:**
```bash
# Use pre-aggregated by_engine.tsv
cat ~/.melvin/data/qa/by_engine.tsv | awk -F'\t' 'NR>1 {print $1 "\t" $3}' | sort -k2 -nr
```

**Result:**
```
gpt-3.5-turbo	60000
gpt-4	45000
claude-3	22500
```

### Complex Query: `melvin cost by engine by day where date > -7d | sort desc`

**Execution Plan:**
```bash
# Use by_engine_date.tsv, filter by date, aggregate
seven_days_ago=$(date -d '-7 days' '+%Y-%m-%d')
cat ~/.melvin/data/qa/by_engine_date.tsv |
  awk -F'\t' -v cutoff="$seven_days_ago" 'NR>1 && $2 > cutoff {print $1 "\t" $2 "\t" $5}' |
  awk -F'\t' '{cost[$1]+=$3} END {for(e in cost) print cost[e] "\t" e}' |
  sort -k1 -nr |
  awk '{print $2 "\t" $1}'
```

### Cross-Dimensional Query: `melvin tokens by user by context | top 10`

**Execution Plan:**
```bash
# Must use raw.tsv for this combination
cat ~/.melvin/data/qa/raw.tsv |
  awk -F'\t' 'NR>1 {key=$7 "\t" $6; tokens[key]+=$3} END {for(k in tokens) print k "\t" tokens[k]}' |
  sort -k3 -nr |
  head -10
```

## Optimization Strategies

### 1. **Smart Indexing**
- Monitor query patterns to determine which indexes to maintain
- Automatically create indexes for frequently queried dimension combinations
- Drop unused indexes to save space

### 2. **Query Result Caching**
```bash
melvin_cache_query() {
    local query="$1"
    local cache_key=$(echo "$query" | sha256sum | cut -d' ' -f1)
    local cache_file="$MELVIN_CACHE_DIR/queries/$cache_key"

    if [[ -f "$cache_file" && $(find "$cache_file" -mmin -60) ]]; then
        # Cache hit, less than 1 hour old
        cat "$cache_file"
    else
        # Execute query and cache result
        melvin_execute_query_plan "$query" | tee "$cache_file"
    fi
}
```

### 3. **Streaming Processing**
For large datasets, process in streaming fashion:
```bash
melvin_stream_query() {
    local query="$1"

    # Use sort -m (merge) for large sorted datasets
    # Process data in chunks to avoid memory issues
    # Maintain running aggregations
}
```

### 4. **Columnar Storage**
For very high-volume scenarios, consider columnar storage:
```bash
# Instead of TSV rows, store columns separately
~/.melvin/data/qa/columns/
├── timestamp.col    # Binary timestamp data
├── tokens.col       # Binary integer data
├── engine.col       # String dictionary + indexes
└── cost.col         # Binary decimal data
```

## Storage Efficiency

### Space Optimization
- **Compression** - gzip older data files
- **Dictionary encoding** - Store categorical dimensions as integers
- **Delta encoding** - Store timestamp deltas instead of full timestamps
- **Column pruning** - Only materialize columns needed for common queries

### Time Optimization
- **Parallel processing** - Use GNU parallel for independent operations
- **Memory mapping** - mmap large read-only files
- **Pre-sorting** - Keep indexes sorted for faster range queries
- **Bloom filters** - Quick existence checks before expensive operations

## Consistency Strategy

### Eventually Consistent
- New data appears in queries after next index update
- Index updates happen incrementally (every few minutes)
- Immediate consistency not required for analytical workloads

### Conflict Resolution
- Later timestamps win for conflicting data
- Idempotent updates (re-running same update is safe)
- Graceful degradation when indexes are temporarily inconsistent

## Scalability Considerations

### Horizontal Scaling
- **Partitioning** by time ranges (daily/weekly partitions)
- **Module isolation** - each module's data stays separate
- **Distributed aggregation** - combine results from multiple partitions

### Vertical Scaling
- **Lazy loading** - only load data needed for specific query
- **Index compaction** - periodically rebuild indexes for efficiency
- **Background processing** - update indexes during low-usage periods

The storage architecture balances **simplicity** (flat files, Unix tools) with **performance** (pre-aggregated indexes, smart caching) to deliver fast dimensional analytics without requiring complex database infrastructure.

## Next Steps

Understanding storage architecture prepares you for:
- **[QA Integration](qa-integration.md)** - Concrete example of storage integration
- **[Implementation Notes](implementation-notes.md)** - Technical implementation details
- **[Examples](examples.md)** - Real-world query execution examples