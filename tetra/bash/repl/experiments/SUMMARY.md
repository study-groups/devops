# Unicode Explorer REPL

Interactive bash tool for composing 4-character Unicode prompt strings with state-based transformations.

## How It Works

**Slots & Display**: 4 internal slots map to 2×2 grid output via state mappings. Display shows transformed output, not raw slots.

**States**: 4 mapping configurations transform slots→output:
- State 1: `1234` (identity)
- State 2: `2143` (swap 1↔2)
- State 3: `3412` (rotate left)
- State 4: `4321` (reverse)

Custom mappings allowed (e.g., `1320` = swap 2↔3, blank position 4; `1111` = all same char).

**Banks**: 10 Unicode ranges, 820+ characters total:
- Braille, Box, Block, BlockShade, BlockQuad, BlockGeom
- Arrow, Geometric, Symbol, Dingbat

**Locks**: Per-slot locks protect characters during random generation.

**Persistence**: Saves to `current_prompt.txt` (4 lines) with current mapping applied. Auto-saves on slot changes.

## Controls

```
↑↓          Navigate within bank
← →         Switch banks
1,2,3,4     Assign current char to slot (auto-saves)
Shift+1-4   Toggle slot lock (!, @, #, $)
[ ]         Cycle states (updates display immediately)
m           Edit current state's mapping
r           Randomize unlocked slots
s           Manual save
q           Quit
```

## Display Format

```
 AB ::
 CD
```
Characters shown after state mapping applied. Lock indicator: 🔒

## Files

- `unicode_explorer.sh` (310 lines) - Main REPL
- `current_prompt.txt` - 4-line transformed output
- `SUMMARY.md` - This doc

## Technical Notes

**Unicode generation**: `printf "\\U$hex"` (hex must be literal in escape sequence)

**Arrays**: 1-indexed (slots[1-4], mappings[1-4]) to match user mental model.

**Key insight**: Separation of internal model (slots) from display (computed via mapping) enables instant state switching without modifying slot data.
