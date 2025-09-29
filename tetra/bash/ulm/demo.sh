#!/usr/bin/env bash
# demo.sh - Interactive demonstration of ULM (Unix Language Model) concepts
set -euo pipefail

ULM_DIR="${BASH_SOURCE[0]%/*}"
DEMO_DATA_DIR="$ULM_DIR/demo_data"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Demo control
PAUSE_BETWEEN_STEPS=3
AUTO_MODE=0

usage() {
    cat <<'EOF'
Usage: demo.sh [OPTIONS]

OPTIONS:
  --auto              Run demo automatically without pauses
  --fast              Quick demo with 1s pauses
  --interactive       Wait for user input between steps (default)
  --setup-only        Just create demo data, don't run demo
  --clean             Clean up demo data and exit

DEMO SECTIONS:
  1. The Attention Metaphor - Q, K, V explained with Unix tools
  2. Multi-Head Attention - Four different perspectives on code
  3. Ranking in Action - See ULM score and rank real files
  4. Policy Learning - How ULM adapts its attention weights
  5. Integration Demo - ULM → RAG → TetraBoard pipeline

This demo uses a sample codebase to show how ULM understands code
using only Unix tools (no neural networks required).
EOF
    exit 1
}

# Utility functions
print_header() {
    echo -e "\n${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🧠 ULM DEMO: $1${NC}"
    echo -e "${WHITE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
    echo -e "\n${YELLOW}▶ Step $1: $2${NC}\n"
}

print_concept() {
    echo -e "${PURPLE}💡 Concept: $1${NC}\n"
}

print_command() {
    echo -e "${GREEN}$ $1${NC}"
}

print_output() {
    echo -e "${BLUE}$1${NC}"
}

pause_demo() {
    if [[ $AUTO_MODE -eq 0 ]]; then
        echo -e "\n${WHITE}Press ENTER to continue...${NC}"
        read -r
    else
        sleep $PAUSE_BETWEEN_STEPS
    fi
}

create_demo_data() {
    echo "Creating demo dataset..."

    mkdir -p "$DEMO_DATA_DIR/src"
    mkdir -p "$DEMO_DATA_DIR/auth"
    mkdir -p "$DEMO_DATA_DIR/utils"
    mkdir -p "$DEMO_DATA_DIR/config"

    # Create sample JavaScript files
    cat > "$DEMO_DATA_DIR/auth/login.js" <<'EOF'
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class AuthService {
    constructor(config) {
        this.secret = config.jwtSecret;
        this.saltRounds = config.saltRounds || 12;
    }

    async hashPassword(password) {
        return await bcrypt.hash(password, this.saltRounds);
    }

    async validatePassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    generateToken(userId, role) {
        return jwt.sign(
            { userId, role, iat: Date.now() },
            this.secret,
            { expiresIn: '24h' }
        );
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.secret);
        } catch (error) {
            return null;
        }
    }
}
EOF

    cat > "$DEMO_DATA_DIR/auth/middleware.js" <<'EOF'
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = authService.verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
}

export function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
EOF

    cat > "$DEMO_DATA_DIR/utils/validation.js" <<'EOF'
export const validators = {
    email: (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    password: (password) => {
        return password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
    },

    required: (value) => {
        return value != null && value !== '';
    }
};

export function validateInput(data, schema) {
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
        for (const rule of rules) {
            if (!validators[rule](data[field])) {
                errors[field] = errors[field] || [];
                errors[field].push(`${field} failed ${rule} validation`);
            }
        }
    }

    return Object.keys(errors).length === 0 ? null : errors;
}
EOF

    cat > "$DEMO_DATA_DIR/utils/logger.js" <<'EOF'
class Logger {
    constructor(level = 'info') {
        this.level = level;
        this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    }

    log(level, message, meta = {}) {
        if (this.levels[level] <= this.levels[this.level]) {
            const timestamp = new Date().toISOString();
            console.log(JSON.stringify({ timestamp, level, message, ...meta }));
        }
    }

    error(message, meta) { this.log('error', message, meta); }
    warn(message, meta) { this.log('warn', message, meta); }
    info(message, meta) { this.log('info', message, meta); }
    debug(message, meta) { this.log('debug', message, meta); }
}

export default new Logger();
EOF

    cat > "$DEMO_DATA_DIR/config/database.js" <<'EOF'
export const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'myapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',

    pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000
    },

    migrations: {
        directory: './migrations',
        tableName: 'knex_migrations'
    }
};

export const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: 0
};
EOF

    cat > "$DEMO_DATA_DIR/src/app.js" <<'EOF'
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { AuthService } from '../auth/login.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { validateInput, validators } from '../utils/validation.js';
import logger from '../utils/logger.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Auth endpoints
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const errors = validateInput(req.body, {
        email: ['required', 'email'],
        password: ['required']
    });

    if (errors) {
        return res.status(400).json({ errors });
    }

    // Authentication logic here
    logger.info('Login attempt', { email });
    res.json({ token: 'jwt-token-here' });
});

app.get('/profile', requireAuth, (req, res) => {
    res.json({ user: req.user });
});

app.get('/admin', requireAuth, requireRole('admin'), (req, res) => {
    res.json({ message: 'Admin area' });
});

export default app;
EOF

    echo "Demo dataset created in $DEMO_DATA_DIR"
}

# Demo Section 1: The Attention Metaphor
demo_attention_metaphor() {
    print_header "1. The Attention Metaphor - Q, K, V with Unix Tools"

    print_concept "In transformers, attention works with Query (Q), Key (K), and Value (V):\n\
• Query (Q) = What are you looking for?\n\
• Key (K) = What can I tell you about myself?\n\
• Value (V) = Here's my actual content"

    pause_demo

    print_step "1.1" "Let's say our QUERY is: 'authentication functions'"

    echo "🔍 Query: 'authentication functions'"
    echo "We want to find code related to authentication..."

    pause_demo

    print_step "1.2" "Extract KEYS from each file (what can each file tell us?)"

    print_command "# Let's extract function names (KEYS) from our auth file"
    echo

    # Show key extraction
    print_output "From auth/login.js:"
    rg "^\s*(function|async|constructor|\w+\s*\()" "$DEMO_DATA_DIR/auth/login.js" | head -5
    echo
    print_output "Keys extracted: hashPassword, validatePassword, generateToken, verifyToken, constructor"

    pause_demo

    print_step "1.3" "Calculate attention scores (Query ↔ Key relevance)"

    print_command "# How well do our keys match our query?"
    echo
    print_output "Query terms: ['authentication', 'functions']"
    print_output "Key 'validatePassword' matches 'authentication' → Score: 1"
    print_output "Key 'generateToken' matches 'authentication' → Score: 1"
    print_output "Key 'verifyToken' matches 'authentication' → Score: 1"
    print_output "Total attention score for auth/login.js: 3"

    pause_demo

    print_step "1.4" "If attention score is high → include VALUE (file content)"

    print_command "# Since score is high, we include this file's content"
    echo
    print_output "✅ auth/login.js gets included in context (score: 3)"
    print_output "❌ config/database.js gets skipped (score: 0)"

    print_concept "This is exactly how transformer attention works, but using Unix tools instead of neural networks!"

    pause_demo
}

# Demo Section 2: Multi-Head Attention
demo_multihead_attention() {
    print_header "2. Multi-Head Attention - Four Perspectives on Code"

    print_concept "ULM uses 4 attention heads, each looking at code differently:\n\
🎯 Functional Head - functions, methods, procedures\n\
🏗️ Structural Head - classes, complexity, architecture\n\
⏰ Temporal Head - how recent/modified files are\n\
🔗 Dependency Head - imports, exports, connections"

    pause_demo

    print_step "2.1" "Functional Head - Looking for functions"

    print_command "rg 'function|async|constructor' $DEMO_DATA_DIR/auth/login.js"
    rg "function|async|constructor" "$DEMO_DATA_DIR/auth/login.js" | head -3

    echo
    print_output "🎯 Functional Score: 5 (found 5 functions)"

    pause_demo

    print_step "2.2" "Structural Head - Looking at code structure"

    print_command "# Count classes and code blocks"
    print_command "rg '^export class' $DEMO_DATA_DIR/auth/login.js"
    rg "^export class" "$DEMO_DATA_DIR/auth/login.js"

    echo
    print_output "🏗️ Structural Score: 2 (1 class + moderate complexity)"

    pause_demo

    print_step "2.3" "Temporal Head - How recent is this file?"

    print_command "stat -c %Y $DEMO_DATA_DIR/auth/login.js"
    file_age=$(stat -c %Y "$DEMO_DATA_DIR/auth/login.js" 2>/dev/null || stat -f %m "$DEMO_DATA_DIR/auth/login.js")
    current_time=$(date +%s)
    age_minutes=$(( (current_time - file_age) / 60 ))

    echo "$file_age ($(date -d @$file_age '+%Y-%m-%d %H:%M' 2>/dev/null || date -r $file_age '+%Y-%m-%d %H:%M'))"
    print_output "⏰ Temporal Score: 90 (very recent - $age_minutes minutes old)"

    pause_demo

    print_step "2.4" "Dependency Head - What does this file import/export?"

    print_command "rg '^(import|export)' $DEMO_DATA_DIR/auth/login.js"
    rg "^(import|export)" "$DEMO_DATA_DIR/auth/login.js"

    echo
    print_output "🔗 Dependency Score: 4 (2 imports + 1 export)"

    pause_demo

    print_step "2.5" "Combine all heads with attention weights"

    print_output "Default weights: Functional=40%, Structural=30%, Temporal=20%, Dependency=10%"
    echo
    print_output "Final Score = 5×0.4 + 2×0.3 + 90×0.2 + 4×0.1"
    print_output "Final Score = 2.0 + 0.6 + 18.0 + 0.4 = 21.0"

    print_concept "Each head contributes a different perspective, just like transformer multi-head attention!"

    pause_demo
}

# Demo Section 3: Ranking in Action
demo_ranking_action() {
    print_header "3. ULM Ranking in Action"

    print_concept "Let's see ULM rank all files in our demo dataset for the query 'authentication'"

    pause_demo

    print_step "3.1" "Run ULM ranking on our demo dataset"

    print_command "./ulm.sh rank 'authentication' $DEMO_DATA_DIR --top 5"

    # Actually run ULM ranking
    echo
    "$ULM_DIR/ulm.sh" rank "authentication" "$DEMO_DATA_DIR" --top 5

    pause_demo

    print_step "3.2" "Let's try a different query: 'validation utilities'"

    print_command "./ulm.sh rank 'validation utilities' $DEMO_DATA_DIR --top 5"

    echo
    "$ULM_DIR/ulm.sh" rank "validation utilities" "$DEMO_DATA_DIR" --top 5

    pause_demo

    print_step "3.3" "Compare with a structural query: 'database configuration'"

    print_command "./ulm.sh rank 'database configuration' $DEMO_DATA_DIR --top 5"

    echo
    "$ULM_DIR/ulm.sh" rank "database configuration" "$DEMO_DATA_DIR" --top 5

    print_concept "Notice how different queries surface different files! This is ULM's attention mechanism working."

    pause_demo
}

# Demo Section 4: Policy Learning
demo_policy_learning() {
    print_header "4. Policy Learning - How ULM Adapts"

    print_concept "ULM can learn better attention weights through reinforcement learning.\nLet's see the current policy and how it could adapt."

    pause_demo

    print_step "4.1" "Show current attention policy"

    print_command "./ulm.sh policy --show"

    echo
    "$ULM_DIR/ulm.sh" policy --show

    pause_demo

    print_step "4.2" "Simulate policy learning scenario"

    print_concept "Imagine:\n\
• User asks for 'authentication functions'\n\
• ULM suggests files based on current policy\n\
• User provides feedback: 'Good results!' (reward = 0.9)\n\
• Policy gets updated to reinforce current weights"

    echo
    print_output "Before training:"
    print_output "  Functional: 40%"
    print_output "  Structural: 30%"
    print_output "  Temporal: 20%"
    print_output "  Dependency: 10%"

    echo
    print_output "After positive feedback (reward=0.9):"
    print_output "  Functional: 42% ↑ (reinforced)"
    print_output "  Structural: 31% ↑ (reinforced)"
    print_output "  Temporal: 18% ↓ (less important for this query type)"
    print_output "  Dependency: 9% ↓ (less important for this query type)"

    pause_demo

    print_step "4.3" "Multi-Armed Bandit Algorithm Selection"

    print_concept "ULM can also learn which ranking algorithms work best:\n\
• multi_head (our transformer-style approach)\n\
• tfidf (traditional information retrieval)\n\
• complexity (favor complex/important code)\n\
• semantic (match intent, not just keywords)"

    echo
    print_output "Algorithm Performance (simulated):"
    print_output "  multi_head: 87% success rate ⭐"
    print_output "  tfidf: 72% success rate"
    print_output "  complexity: 65% success rate"
    print_output "  semantic: 78% success rate"

    print_output "\n→ ULM learns to prefer 'multi_head' for most queries"

    pause_demo
}

# Demo Section 5: Integration Demo
demo_integration() {
    print_header "5. Full Pipeline - ULM → RAG → TetraBoard"

    print_concept "Let's see the complete system in action:\nULM ranks files → RAG formats for LLMs → TetraBoard tracks performance"

    pause_demo

    print_step "5.1" "Use ULM ranking with multicat and agent profiles"

    print_command "cd .. && ./rag/core/multicat/multicat.sh --agent openai --ulm-rank 'authentication' $DEMO_DATA_DIR --ulm-top 2"

    echo
    print_output "This command:"
    print_output "1. Uses ULM to rank files for 'authentication'"
    print_output "2. Takes top 2 files"
    print_output "3. Formats them with OpenAI-optimized instructions"
    print_output "4. Outputs ready-to-paste MULTICAT format"

    # Actually run it
    cd "$ULM_DIR/.." && ./rag/core/multicat/multicat.sh --agent openai --ulm-rank "authentication" "$DEMO_DATA_DIR" --ulm-top 2 | head -25

    pause_demo

    print_step "5.2" "Log the generation and check TetraBoard"

    print_command "../rag/state_manager.sh log-generation 'openai' 2 15000 'success' 'authentication demo'"

    # Log a demo generation
    cd "$ULM_DIR" && ../rag/state_manager.sh log-generation "openai" 2 15000 "success" "authentication demo"

    echo
    print_output "✅ Generation logged to RAG state system"

    pause_demo

    print_step "5.3" "View updated TetraBoard dashboard"

    print_command "../tetraboard/tetraboard.sh summary"

    echo
    cd "$ULM_DIR" && ../tetraboard/tetraboard.sh summary

    pause_demo

    print_step "5.4" "The complete learning cycle"

    print_concept "The system now has:\n\
✅ Intelligent file ranking (ULM)\n\
✅ Agent-optimized output formatting (RAG)\n\
✅ Performance tracking (TetraBoard)\n\
✅ Learning from feedback (Policy updates)\n\
\nThis creates a self-improving code understanding system!"

    echo -e "\n${GREEN}🎉 Demo Complete!${NC}"
    echo
    echo -e "${WHITE}Key Takeaways:${NC}"
    echo "• ULM implements transformer attention using only Unix tools"
    echo "• Multi-head attention provides different perspectives on code"
    echo "• Reinforcement learning adapts the system over time"
    echo "• The full pipeline creates LLM-ready, contextually relevant code"
    echo "• No neural networks required - just bash, grep, and Unix philosophy!"

    pause_demo
}

# Cleanup
cleanup_demo() {
    if [[ -d "$DEMO_DATA_DIR" ]]; then
        echo "Cleaning up demo data..."
        rm -rf "$DEMO_DATA_DIR"
        echo "Demo cleanup complete."
    fi
}

# Main demo runner
run_demo() {
    echo -e "${WHITE}🧠 Welcome to the ULM (Unix Language Model) Demo!${NC}\n"
    echo "This interactive demonstration will show you how ULM implements"
    echo "transformer-style attention mechanisms using only Unix tools."
    echo

    if [[ $AUTO_MODE -eq 0 ]]; then
        echo -e "${YELLOW}Press ENTER to start the demo...${NC}"
        read -r
    fi

    # Create demo data
    create_demo_data

    # Run demo sections
    demo_attention_metaphor
    demo_multihead_attention
    demo_ranking_action
    demo_policy_learning
    demo_integration

    echo -e "\n${CYAN}Thanks for exploring ULM! 🚀${NC}"
    echo -e "Try running: ${GREEN}./ulm.sh rank 'your query' /path/to/code${NC}"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --auto)
            AUTO_MODE=1
            PAUSE_BETWEEN_STEPS=2
            ;;
        --fast)
            AUTO_MODE=1
            PAUSE_BETWEEN_STEPS=1
            ;;
        --interactive)
            AUTO_MODE=0
            ;;
        --setup-only)
            create_demo_data
            exit 0
            ;;
        --clean)
            cleanup_demo
            exit 0
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
    shift
done

# Trap cleanup on exit
trap cleanup_demo EXIT

# Run the demo
run_demo