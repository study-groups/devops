# Vox Dry-Run Feature

## Overview

The dry-run feature allows you to analyze text inputs and understand what would happen when using vox commands **without making any OpenAI API calls**. This is useful for:

- Testing and debugging input sources
- Understanding cache behavior
- Estimating API costs before committing
- Validating content characteristics
- Checking for truncation issues
- Planning batch operations

## Usage

```bash
vox dry-run <command> [options]
```

## Commands

### 1. Analyze Stdin

Analyze text from standard input:

```bash
echo "Your text here" | vox dry-run stdin sally
cat article.txt | vox dry-run stdin nova
```

### 2. Analyze QA Reference

Analyze a specific QA database entry:

```bash
# Using relative index
vox dry-run qa qa:0 alloy

# Using absolute timestamp
vox dry-run qa qa:1728756234 nova

# Using explicit latest
vox dry-run qa qa:latest echo
```

### 3. Analyze File

Analyze a file directly:

```bash
vox dry-run file story.txt fable
vox dry-run file /path/to/document.txt shimmer
```

### 4. Batch Analysis

Analyze multiple QA answers at once:

```bash
# Analyze qa:0 through qa:9 with alloy voice
vox dry-run batch alloy 0 10

# Analyze qa:5 through qa:14 with sally voice
vox dry-run batch sally 5 10
```

## What Gets Analyzed

### Content Characteristics
- **Characters**: Total character count
- **Words**: Word count
- **Lines**: Line count
- **Hash**: Content hash for cache lookup (first 12 chars shown)

### Truncation Detection
- OpenAI TTS has a 4096 character limit
- Dry-run warns if text would be truncated
- Shows how many characters would be lost

### Cache Status
- **HIT**: Audio already cached, no API call needed
- **MISS**: Would require new API call
- Shows cached file path and size if available
- Estimates audio size if not cached

### Cost Estimation
- Calculates exact API cost based on character count
- OpenAI pricing: $15 per 1M characters
- Only counts effective characters (respects 4096 limit)

### Content Preview
- Shows first 200 characters of content
- Helps verify you're analyzing the right source

## Example Output

```
===================================
Vox Dry-Run Analysis
===================================

Source:
  Type:       qa
  ID:         qa:2 (resolved: 1760229395)

Content:
  Characters: 4961
  Words:      802
  Lines:      89
  Hash:       e5d4eec36e30...
  Truncation: YES - will truncate 865 chars (limit: 4096)

TTS Request:
  Voice:      nova
  Model:      tts-1
  Cost:       $.061440 USD

Cache:
  Status:     MISS
  Action:     Will generate new audio (API call required)
  Est. Size:  ~50-200 KB

Content Preview (first 200 chars):
-----------------------------------
Absolutely! You're on the right path to building...
-----------------------------------

Summary:
  This request would require TTS generation.
  OpenAI API call: $.061440 USD
  Audio would be cached for future use.
```

## Batch Analysis Output

```
===================================
Batch Dry-Run Analysis
===================================
Voice: sally
Range: qa:0 to qa:4

qa:0     [MISS]         37 chars  Test question?
qa:1     [MISS]       7839 chars  write a combined article...
qa:2     [MISS]       4961 chars  Would you agree that...
qa:3     [MISS]       4706 chars  Describe arithetic operations...
qa:4     [MISS]       2046 chars  i want to connect to a tgam...

Summary:
  Total items:    5
  Cache hits:     0
  Cache misses:   5
  Total chars:    19589
  Est. cost:      $.2938 USD (for cache misses)
```

## Use Cases

### 1. Cost Planning

Before processing a batch of QA answers:

```bash
# Check cost for 20 answers
vox dry-run batch alloy 0 20

# Check cost for specific voice
vox dry-run batch nova 0 20
```

### 2. Cache Optimization

Find which answers are already cached:

```bash
# Analyze to see cache status
vox dry-run batch sally 0 50 | grep HIT
```

### 3. Content Validation

Verify content before TTS:

```bash
# Check if content will be truncated
vox dry-run qa qa:5 nova

# Review content preview before generating
cat script.txt | vox dry-run stdin alloy
```

### 4. Debugging

Troubleshoot issues without API calls:

```bash
# Verify QA reference resolution
vox dry-run qa qa:1728756234 nova

# Check file encoding/content
vox dry-run file mystery.txt echo
```

### 5. Testing

Test inputs during development:

```bash
# Test with sample text
echo "Test message" | vox dry-run stdin alloy

# Test with generated content
generate_text.sh | vox dry-run stdin nova
```

## Implementation Details

### Module: vox_dry_run.sh

Core functions:
- `vox_dry_run_analyze()` - Main analysis function
- `vox_dry_run_qa()` - QA-specific analysis
- `vox_dry_run_file()` - File analysis
- `vox_dry_run_batch()` - Batch analysis

### Integration

Dry-run is integrated into main vox command:
- Available as `vox dry-run` or `vox analyze`
- No API keys required
- Works with all voice options
- Fully pipe-compatible

### Safety

- **No API calls**: Never touches OpenAI endpoints
- **Read-only**: Only reads files, never writes
- **No side effects**: Doesn't modify cache or state
- **Error handling**: Validates inputs before analysis

## Testing

Run the test suite:

```bash
bash/vox/test_dry_run.sh
```

This tests:
- Stdin analysis (short and long text)
- QA reference analysis
- File analysis
- Batch analysis
- Truncation detection
- Cache status checking

## Aliases

You can use shorter command names:

```bash
vox dry-run ...    # Full name
vox dry ...        # Short form
vox analyze ...    # Alternative name
```

## Related Commands

- `vox ls qa` - List available QA answers with IDs
- `vox cache stats` - View cache statistics
- `vox cache info <hash>` - Inspect specific cache entry
- `vox play <voice> <id>` - Actually generate/play audio

## Tips

1. **Use batch analysis** to survey large sets of QA answers
2. **Check cache first** to avoid redundant API calls
3. **Validate truncation** for long documents before generating
4. **Estimate costs** for budget planning
5. **Test with stdin** when developing content pipelines

## Future Enhancements

Potential additions:
- `--json` flag for machine-readable output
- Voice quality recommendations based on content
- Pronunciation warnings for technical terms
- Estimated generation time
- Cache utilization suggestions
- Cost comparison across voices
