/**
 * EarthMover - Optimal transport for particle-to-target assignment
 *
 * Uses greedy nearest-neighbor matching to minimize total movement distance.
 * This approximates the Earth Mover's Distance (Wasserstein distance) solution.
 */

export class EarthMover {
  /**
   * Assign particles to targets minimizing total distance
   *
   * Uses a greedy algorithm: for each target, find the nearest unassigned particle.
   * This is O(n²) but good enough for ~1000 particles.
   *
   * @param {Array<{x: number, y: number}>} particles - Current particle positions
   * @param {Array<{x: number, y: number}>} targets - Target positions
   * @returns {Array<number>} Assignment indices: assignment[i] = target index for particle i, or -1
   */
  static assignGreedy(particles, targets) {
    const n = particles.length;
    const m = targets.length;

    // Track which targets have been assigned
    const targetAssigned = new Array(m).fill(false);

    // For each particle, store its assigned target index (-1 = none)
    const assignment = new Array(n).fill(-1);

    // Build list of all particle-target distances
    const distances = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const dx = particles[i].x - targets[j].x;
        const dy = particles[i].y - targets[j].y;
        const dist = dx * dx + dy * dy; // Squared distance for speed
        distances.push({ particleIdx: i, targetIdx: j, dist });
      }
    }

    // Sort by distance (shortest first)
    distances.sort((a, b) => a.dist - b.dist);

    // Greedy assignment: take shortest edges that don't conflict
    const particleAssigned = new Array(n).fill(false);
    let assignedCount = 0;
    const maxAssignments = Math.min(n, m);

    for (const { particleIdx, targetIdx } of distances) {
      if (assignedCount >= maxAssignments) break;

      if (!particleAssigned[particleIdx] && !targetAssigned[targetIdx]) {
        assignment[particleIdx] = targetIdx;
        particleAssigned[particleIdx] = true;
        targetAssigned[targetIdx] = true;
        assignedCount++;
      }
    }

    return assignment;
  }

  /**
   * Faster assignment using spatial hashing (for large particle counts)
   *
   * Divides space into grid cells and matches particles to nearby targets.
   * O(n) average case with good spatial distribution.
   *
   * @param {Array<{x: number, y: number}>} particles - Current positions
   * @param {Array<{x: number, y: number}>} targets - Target positions
   * @param {number} gridSize - Grid cell size (default 0.1 = 10x10 grid)
   * @returns {Array<number>} Assignment indices
   */
  static assignSpatial(particles, targets, gridSize = 0.05) {
    const n = particles.length;
    const m = targets.length;

    // Build spatial hash of targets
    const grid = new Map();
    const cellKey = (x, y) => {
      const cx = Math.floor(x / gridSize);
      const cy = Math.floor(y / gridSize);
      return `${cx},${cy}`;
    };

    // Index all targets by cell
    const targetAssigned = new Array(m).fill(false);
    for (let j = 0; j < m; j++) {
      const key = cellKey(targets[j].x, targets[j].y);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(j);
    }

    // For each particle, find nearest unassigned target in nearby cells
    const assignment = new Array(n).fill(-1);

    for (let i = 0; i < n; i++) {
      const px = particles[i].x;
      const py = particles[i].y;
      const cx = Math.floor(px / gridSize);
      const cy = Math.floor(py / gridSize);

      let bestTarget = -1;
      let bestDist = Infinity;

      // Search current cell and neighbors (3x3)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const key = `${cx + dx},${cy + dy}`;
          const cell = grid.get(key);
          if (!cell) continue;

          for (const j of cell) {
            if (targetAssigned[j]) continue;

            const ddx = px - targets[j].x;
            const ddy = py - targets[j].y;
            const dist = ddx * ddx + ddy * ddy;

            if (dist < bestDist) {
              bestDist = dist;
              bestTarget = j;
            }
          }
        }
      }

      // If no nearby target, expand search
      if (bestTarget === -1) {
        for (let j = 0; j < m; j++) {
          if (targetAssigned[j]) continue;

          const ddx = px - targets[j].x;
          const ddy = py - targets[j].y;
          const dist = ddx * ddx + ddy * ddy;

          if (dist < bestDist) {
            bestDist = dist;
            bestTarget = j;
          }
        }
      }

      if (bestTarget !== -1) {
        assignment[i] = bestTarget;
        targetAssigned[bestTarget] = true;
      }
    }

    return assignment;
  }

  /**
   * Calculate total transport distance for an assignment
   * (For debugging/comparison)
   */
  static totalDistance(particles, targets, assignment) {
    let total = 0;
    for (let i = 0; i < particles.length; i++) {
      const j = assignment[i];
      if (j >= 0) {
        const dx = particles[i].x - targets[j].x;
        const dy = particles[i].y - targets[j].y;
        total += Math.sqrt(dx * dx + dy * dy);
      }
    }
    return total;
  }
}

export default EarthMover;
