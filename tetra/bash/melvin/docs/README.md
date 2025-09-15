# MELVIN: Dimensional Analytics for Command Line Tools

MELVIN is an autonomous agent that provides **dimensional analytics** capabilities for bash-based tools, using a Grammar of Graphics approach adapted for CLI environments.

## Core Concept

Instead of traditional row-based data analysis, MELVIN thinks **dimensionally**:

- **Measures**: What you want to aggregate (tokens, cost, count, time)
- **Dimensions**: How you want to slice the data (time, module, engine, context, tags)
- **Grammar**: Composable query language for exploring data relationships

## Quick Examples

```bash
# Token usage by AI engine
melvin tokens by engine

# Cost trends over time
melvin cost by day where date > -7d

# Cross-module activity analysis
melvin queries by module by context | where tag=python

# Saved queries and alerts
melvin save "daily_costs" "cost by day"
melvin alert "high_usage" "tokens > 1000 per hour"
```

## Architecture Overview

MELVIN operates as a **universal dimensional query system** that any bash tool can integrate with:

1. **Modules register** their queryable data dimensions
2. **MELVIN indexes** the data using flat file strategies
3. **Users query** using natural dimensional language (DQL)
4. **Results** are formatted for further processing or visualization

## Key Features

### Dimensional Query Language (DQL)
- **Grammar-based**: Composable syntax inspired by Grammar of Graphics
- **Intuitive**: Natural language-like queries that match how people think about data
- **Powerful**: Complex multi-dimensional analysis with simple syntax

### Flat File Optimized
- **Unix-native**: Built on awk, sort, uniq for maximum compatibility
- **Fast**: Optimized for the flat file data common in bash environments
- **Scalable**: Handles large datasets through streaming and indexing

### Module Integration
- **Non-invasive**: Existing tools (like QA system) work unchanged
- **Protocol-based**: Standard registration format for new modules
- **Cross-system**: Queries can span data from multiple tools

## Project Structure

```
melvin/
├── docs/              # Comprehensive documentation
├── lib/               # Core libraries (parser, executor, formatter)
├── schemas/           # Domain definitions for modules
├── queries/           # Saved query storage
└── melvin.sh          # Main entry point
```

## Integration Philosophy

MELVIN follows the **Grammar of Graphics** principle: start with simple building blocks that compose into sophisticated analysis. Just as ggplot2 made statistical graphics accessible through grammar, MELVIN makes dimensional analytics accessible through CLI grammar.

The goal is **Tableau-like power** with **Unix philosophy simplicity**.

## Documentation Guide

- **[Dimensional Thinking](dimensional-thinking.md)** - Core concepts and philosophy
- **[Grammar of Graphics](grammar-of-graphics.md)** - How visual grammar applies to CLI
- **[DQL Language](dql-language.md)** - Complete query language specification
- **[Protocol Design](protocol-design.md)** - How modules integrate with MELVIN
- **[Storage Architecture](storage-architecture.md)** - Flat file optimization strategies
- **[QA Integration](qa-integration.md)** - Real-world integration example
- **[Examples](examples.md)** - Practical use cases and query patterns

## Status

🚧 **In Development** - Documentation-driven design phase

MELVIN represents a new approach to CLI analytics, bringing the power of dimensional analysis to the command line environment where most development and operations work actually happens.