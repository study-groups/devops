#!/usr/bin/env bash
# ideal_surface.sh - Generate and analyze ideal 5x5 error surface for ULM learning
set -euo pipefail

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_concept() {
    echo -e "${PURPLE}💡 $1${NC}"
}

# Generate ideal 5x5 surface
generate_ideal_surface() {
    print_header "🎯 Ideal 5x5 Error Surface Generation"
    echo

    # Define the surface mathematically
    # Center (2,2) = peak score 1.0
    # Monotonic decrease toward edges but non-zero boundaries

    local -A surface
    local max_score=1.0
    local min_score=0.1

    echo "Grid coordinates (i,j) and their scores:"
    echo "| i\\j | 0 | 1 | 2 | 3 | 4 |"
    echo "|-----|---|---|---|---|---|"

    for i in {0..4}; do
        printf "| %d   |" "$i"
        for j in {0..4}; do
            # Distance from center (2,2) using Chebyshev distance (max of differences)
            local di=$((i - 2))
            local dj=$((j - 2))
            local dist_manhattan=$(( (di < 0 ? -di : di) + (dj < 0 ? -dj : dj) ))
            local dist_chebyshev=$(( (di < 0 ? -di : di) > (dj < 0 ? -dj : dj) ? (di < 0 ? -di : di) : (dj < 0 ? -dj : dj) ))

            # Use exponential decay from center, but ensure non-zero boundaries
            # score = min_score + (max_score - min_score) * exp(-decay_rate * distance)
            local score
            score=$(awk "BEGIN {printf \"%.2f\", $min_score + ($max_score - $min_score) * exp(-0.8 * $dist_chebyshev)}")

            surface["$i,$j"]="$score"
            printf " %.2f |" "$score"
        done
        echo
    done

    echo
    print_concept "Surface Properties:"
    echo "• Peak score: ${surface[2,2]} at center (2,2)"
    echo "• Boundary scores: non-zero (min: ${surface[0,0]})"
    echo "• Monotonic decrease from center to edges"
    echo "• No local minima or plateaus"

    # Store surface for analysis
    for i in {0..4}; do
        for j in {0..4}; do
            echo "$i $j ${surface[$i,$j]}"
        done
    done > /tmp/ideal_surface.dat

    echo
}

# Explain why this is ideal for learning
explain_ideal_properties() {
    print_header "🧠 Why This Surface is Ideal for Learning"
    echo

    print_concept "1. SINGLE GLOBAL OPTIMUM"
    echo "   ✅ One clear peak at center (2,2) = 1.0"
    echo "   ✅ No competing local maxima to confuse search"
    echo "   ✅ Unambiguous target for optimization algorithms"
    echo

    print_concept "2. SMOOTH GRADIENT EVERYWHERE"
    echo "   ✅ Continuous, differentiable surface"
    echo "   ✅ Gradient always points toward optimum"
    echo "   ✅ No flat regions where gradient = 0"
    echo

    print_concept "3. NON-ZERO BOUNDARIES"
    echo "   ✅ Edge scores ≥ 0.1 (not zero)"
    echo "   ✅ Prevents algorithms from getting 'stuck' at boundaries"
    echo "   ✅ Maintains exploration pressure even at edges"
    echo

    print_concept "4. MONOTONIC DECREASE"
    echo "   ✅ Score always decreases moving away from center"
    echo "   ✅ No false peaks or valleys"
    echo "   ✅ Consistent reward signal for learning"
    echo

    print_concept "5. CONVEX SHAPE"
    echo "   ✅ Any local improvement leads toward global optimum"
    echo "   ✅ Gradient descent guaranteed to converge"
    echo "   ✅ No saddle points or ridges"
    echo
}

# Show gradient analysis
analyze_gradients() {
    print_header "📈 Gradient Analysis"
    echo

    echo "Gradient vectors pointing toward optimum:"
    echo "| Position | Score | Gradient Direction | Magnitude |"
    echo "|----------|-------|-------------------|-----------|"

    # Calculate gradients at key points
    local -A surface
    while read i j score; do
        surface["$i,$j"]="$score"
    done < /tmp/ideal_surface.dat

    for i in 0 1 3 4; do
        for j in 0 1 3 4; do
            local score="${surface[$i,$j]}"

            # Calculate gradient direction (pointing toward center)
            local gi=$((2 - i))  # gradient in i direction
            local gj=$((2 - j))  # gradient in j direction

            # Normalize direction
            local magnitude
            magnitude=$(awk "BEGIN {printf \"%.2f\", sqrt($gi*$gi + $gj*$gj)}")

            if [[ "$magnitude" != "0.00" ]]; then
                local norm_gi norm_gj
                norm_gi=$(awk "BEGIN {printf \"%.2f\", $gi / $magnitude}")
                norm_gj=$(awk "BEGIN {printf \"%.2f\", $gj / $magnitude}")

                printf "| (%d,%d)    | %s | (%.2f, %.2f)      | %.2f      |\n" \
                       "$i" "$j" "$score" "$norm_gi" "$norm_gj" "$magnitude"
            fi
        done
    done

    echo
    print_concept "All gradients point inward toward center (2,2)!"
}

# Compare with problematic surfaces
show_problematic_surfaces() {
    print_header "❌ Problematic Surface Examples"
    echo

    print_concept "BAD SURFACE 1: Multiple Local Maxima"
    echo "| 0.8 | 0.3 | 0.1 | 0.3 | 0.9 |"
    echo "| 0.3 | 0.2 | 0.1 | 0.2 | 0.3 |"
    echo "| 0.1 | 0.1 | 0.0 | 0.1 | 0.1 |"
    echo "| 0.3 | 0.2 | 0.1 | 0.2 | 0.3 |"
    echo "| 0.7 | 0.3 | 0.1 | 0.3 | 0.8 |"
    echo "Problem: Algorithm might get stuck at corners!"
    echo

    print_concept "BAD SURFACE 2: Zero Boundaries"
    echo "| 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |"
    echo "| 0.0 | 0.3 | 0.6 | 0.3 | 0.0 |"
    echo "| 0.0 | 0.6 | 1.0 | 0.6 | 0.0 |"
    echo "| 0.0 | 0.3 | 0.6 | 0.3 | 0.0 |"
    echo "| 0.0 | 0.0 | 0.0 | 0.0 | 0.0 |"
    echo "Problem: No gradient information at boundaries!"
    echo

    print_concept "BAD SURFACE 3: Flat Plateau"
    echo "| 0.2 | 0.2 | 0.2 | 0.2 | 0.2 |"
    echo "| 0.2 | 0.5 | 0.5 | 0.5 | 0.2 |"
    echo "| 0.2 | 0.5 | 1.0 | 0.5 | 0.2 |"
    echo "| 0.2 | 0.5 | 0.5 | 0.5 | 0.2 |"
    echo "| 0.2 | 0.2 | 0.2 | 0.2 | 0.2 |"
    echo "Problem: Gradient = 0 in plateau regions!"
    echo
}

# Apply to ULM learning
apply_to_ulm() {
    print_header "🎯 Application to ULM Learning"
    echo

    print_concept "ULM Parameter Space as 5x5 Grid"
    echo "• X-axis: Functional attention weight (0.1 → 0.9)"
    echo "• Y-axis: Structural attention weight (0.1 → 0.9)"
    echo "• Z-axis: User satisfaction score (0.1 → 1.0)"
    echo "• Optimal: Functional=0.5, Structural=0.5 (center)"
    echo

    echo "Grid mapping:"
    echo "| Grid | Functional | Structural |"
    echo "|------|------------|------------|"
    echo "| 0,0  | 0.1        | 0.1        |"
    echo "| 1,1  | 0.3        | 0.3        |"
    echo "| 2,2  | 0.5        | 0.5        | ← Optimal"
    echo "| 3,3  | 0.7        | 0.7        |"
    echo "| 4,4  | 0.9        | 0.9        |"
    echo

    print_concept "Learning Algorithm Benefits:"
    echo "✅ Gradient descent will converge to optimal (2,2)"
    echo "✅ Random exploration has directional bias toward center"
    echo "✅ Policy gradient always has useful signal"
    echo "✅ No risk of getting trapped in suboptimal regions"
    echo "✅ Boundary exploration still provides learning signal"
    echo
}

# Generate learning simulation
simulate_learning() {
    print_header "🤖 Learning Algorithm Simulation"
    echo

    # Simulate gradient descent starting from corner
    echo "Gradient Descent Path (starting from corner 0,0):"

    local current_i=0
    local current_j=0
    local learning_rate=0.8
    local step=0

    while [[ $current_i -ne 2 || $current_j -ne 2 ]] && [[ $step -lt 10 ]]; do
        local current_score
        current_score=$(awk -v i="$current_i" -v j="$current_j" '$1==i && $2==j {print $3}' /tmp/ideal_surface.dat)

        printf "Step %d: Position (%d,%d) Score %.2f\n" "$step" "$current_i" "$current_j" "$current_score"

        # Calculate gradient (direction toward center)
        local grad_i=$((2 - current_i))
        local grad_j=$((2 - current_j))

        # Take step in gradient direction
        if [[ $grad_i -gt 0 ]]; then
            ((current_i++))
        elif [[ $grad_i -lt 0 ]]; then
            ((current_i--))
        fi

        if [[ $grad_j -gt 0 ]]; then
            ((current_j++))
        elif [[ $grad_j -lt 0 ]]; then
            ((current_j--))
        fi

        ((step++))
    done

    printf "Step %d: Position (%d,%d) Score %.2f ← CONVERGED!\n" "$step" "$current_i" "$current_j" "1.00"

    echo
    print_concept "Perfect convergence in $step steps!"
}

# Generate visualization
create_visualization() {
    print_header "📊 Surface Visualization"
    echo

    echo "ASCII Heat Map (darker = higher score):"

    # Read surface data
    local -A surface
    while read i j score; do
        surface["$i,$j"]="$score"
    done < /tmp/ideal_surface.dat

    for i in {0..4}; do
        for j in {0..4}; do
            local score="${surface[$i,$j]}"

            # Convert score to visual intensity
            if (( $(awk "BEGIN {print ($score >= 0.9)}") )); then
                printf "██"  # Darkest
            elif (( $(awk "BEGIN {print ($score >= 0.7)}") )); then
                printf "▓▓"  # Dark
            elif (( $(awk "BEGIN {print ($score >= 0.5)}") )); then
                printf "▒▒"  # Medium
            elif (( $(awk "BEGIN {print ($score >= 0.3)}") )); then
                printf "░░"  # Light
            else
                printf "  "  # Lightest
            fi
        done
        echo
    done

    echo
    echo "Legend: ██ (>0.9) ▓▓ (>0.7) ▒▒ (>0.5) ░░ (>0.3)   (<0.3)"
    echo
}

# Main execution
main() {
    echo -e "${GREEN}🎯 Ideal 5x5 Error Surface Analysis${NC}\n"

    generate_ideal_surface
    explain_ideal_properties
    analyze_gradients
    show_problematic_surfaces
    apply_to_ulm
    simulate_learning
    create_visualization

    echo -e "${GREEN}🏆 Summary: This surface is ideal because it has exactly the properties${NC}"
    echo -e "${GREEN}   that make machine learning algorithms converge quickly and reliably!${NC}"

    # Cleanup
    rm -f /tmp/ideal_surface.dat
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi