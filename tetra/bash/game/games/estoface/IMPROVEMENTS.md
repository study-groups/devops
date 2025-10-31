# Estoface C Port - Enhanced Features

## New Features

### 1. Cartoon Mouth Rendering (16x8 characters)

**Parametric Lip Curves:**
- **Upper Lip Formula**: Combines parabolic base curve with:
  - Corner lift/drop based on `lip_corner_height` (smile/frown)
  - Rounding factor from `lip_rounding`
  - Jaw opening shift
  
- **Lower Lip Formula**: Combines upward parabola with:
  - Primary jaw drop from `jaw_openness`
  - Corner pull for smile effect
  - Protrusion and rounding factors

**Visual Characters:**
- `^` - Smiling upper lip
- `v` - Frowning upper lip  
- `~` - Rounded lips
- `-` - Neutral/closed
- `_` - Open lower lip
- `.` - Mouth interior
- `T/t` - Tongue visible when high

### 2. IPA Matching System

**Real-time Closest Match:**
- Calculates Euclidean distance in facial parameter space
- Weighted for articulatory importance:
  - Jaw openness: 2x weight
  - Tongue height/frontness: 1.5x weight
  - Lip rounding: 1.2x weight
  - Lip corners: 0.5x weight (less critical)

**Displays**: Current closest IPA phoneme at bottom of screen

### 3. IPA Information Panels

**5 Toggle-able Panels** (number keys 1-5):
```
╔════════════════════════════════════════╗
║ IPA Panel 1                            ║
╠════════════════════════════════════════╣
║ IPA Symbol: a                          ║
║ Open front unrounded vowel [bat]       ║
╠════════════════════════════════════════╣
║ Articulation:                          ║
║   Jaw:0.90 Tongue:0.20/0.60 Round:0.00 ║
╠════════════════════════════════════════╣
║ Esto Format:                           ║
║   a:150:120                            ║
╚════════════════════════════════════════╝
```

**Panel Positions:**
- Panel 1: Top-left
- Panel 2: Top-right
- Panel 3: Mid-left
- Panel 4: Mid-right
- Panel 5: Center

### 4. Esto Format Integration

Each panel shows the esto speech script format for the phoneme:
```
<phoneme>:<duration_ms>:<pitch_hz>
```

**Example:**
```
a:150:120    # 'a' sound, 150ms, 120Hz
```

Compatible with formant synthesis engine at `../formant/`

## Usage

### Interactive Mode

```bash
cd ../game/games/estoface
./bin/estoface
```

**Controls:**
- `W/S` - Jaw control (close/open)
- `I/K` - Tongue height
- `J/L` - Tongue frontness
- `U/O` - Lip rounding/spreading
- `R` - Reset to neutral
- `1-5` - Toggle IPA info panels
- `:` - Enter command mode

### Keyboard to Mouth Mapping

| Control | Effect on Mouth |
|---------|-----------------|
| S (jaw open) | Mouth widens vertically, lips separate |
| W (jaw close) | Mouth closes, lips come together |
| Q (round) | Lips form circular shape (~) |
| E (corners up) | Upper lip curves upward (^, smile) |
| I (tongue up) | Interior shows T/t characters |

### Visual Examples

**Neutral (starting position):**
```
                                
       ---                      
      |   |                     
      |   |                     
       ---                      
```

**Open /a/ (jaw open, tongue low):**
```
                                
      |^^^ |                    
      |..T.|                    
      |..t.|                    
      |.   |                    
      |____|                    
```

**Rounded /u/ (lips rounded):**
```
                                
       ~~~                      
      |~~~|                     
      |...|                     
       ~~~                      
```

## Implementation Files

### New Modules
- `src/mouth.c` - Parametric mouth rendering
- `src/panels.c` - IPA panel system
- `include/mouth.h` - Mouth API
- `include/panels.h` - Panel API

### Enhanced Modules
- `src/render.c` - Integrated cartoon mouth + panels
- `src/phonemes.c` - Added IPA matching algorithm
- `include/types.h` - Extended with panel structures

## Performance

- Mouth rendering: O(WIDTH × HEIGHT) = O(128) per frame
- IPA matching: O(N phonemes × 5 parameters) = O(25) per frame
- Total overhead: < 1% CPU at 50fps

## Future Enhancements

1. **Teeth visualization** - Show teeth row when mouth very open
2. **Formant panel** - Display F1/F2/F3 frequencies alongside IPA
3. **Audio integration** - Live playback via formant engine
4. **Recordmode** - Capture sequence as .esto file
5. **Coarticulation** - Smooth phoneme transitions
6. **Lip sync** - Real-time audio-driven animation

## Esto Format Reference

See `../formant/ESTO_FORMAT.md` for complete specification.

**Quick Reference:**
```bash
# Vowel sequence
i:200:140    # High front
e:180:135    # Mid front
a:220:125    # Low front
o:200:120    # Mid back
u:180:115    # High back

# With directives
@EMOTION HAPPY 0.8
@PITCH 140
a:200:140
```

## Integration with Formant

To use with audio synthesis:

```bash
# Terminal 1: Start formant engine
cd ../formant
./bin/formant

# Terminal 2: Run estoface and copy esto codes from panels
cd ../estoface
./bin/estoface

# Send esto codes to formant:
echo "a:200:120" | nc localhost 9999  # If formant listens on socket
# Or write to named pipe
```

Full audio-visual integration coming soon!

