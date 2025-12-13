# Estoface Articulation Examples

This document shows extreme articulator positions to demonstrate the visual system.

## Extreme Vowels

### [i] - Close Front Unrounded (like "beet")
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  '                            /----------\
| /    '                          (tight closed)
||      .
 \       ~~~*
  \      \
   \________

Articulators:
- Jaw: CLOSED (0.0)
- Tongue: HIGH + FRONT (0.9/0.9)
- Lips: SPREAD (round=0.0)
```

### [ɑ] - Open Back Unrounded (like "father")
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  '                            /          \
| /    '                          |            |
||                                |            |
 \   *~~~                         |            |
  \    \                           \__      __/
   \____________(                     ------
        (((                      (wide open jaw)

Articulators:
- Jaw: OPEN (1.0)
- Tongue: LOW + BACK (0.0/0.0)
- Lips: SPREAD
```

### [u] - Close Back Rounded (like "boot")
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  '                              (    )
| /    '                             (    )
||      .                            (    )
 \   *~~~                            (    )
  \    \ (((                          (  )
   \________(                    (rounded tight)

Articulators:
- Jaw: CLOSED (0.2)
- Tongue: HIGH + BACK (0.9/0.1)
- Lips: ROUNDED (round=1.0)
```

### [æ] - Near-Open Front Unrounded (like "cat")
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  '                            /‾‾‾‾‾‾‾‾‾‾\
| /    '                          |            |
||                                 \__      __/
 \      ~~~*                          ------
  \       \                     (moderate open)
   \__________

Articulators:
- Jaw: OPEN (0.6)
- Tongue: MID-LOW + FRONT (0.3/0.8)
- Lips: SPREAD
```

### [ɔ] - Open-Mid Back Rounded (like "thought")
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  '                              (‾‾‾‾‾‾)
| /    '                            (        )
||                                  (        )
 \    *~~                            (      )
  \     \ (((                         (    )
   \_________(((                   (open round)

Articulators:
- Jaw: OPEN (0.7)
- Tongue: MID + BACK (0.4/0.2)
- Lips: ROUNDED (round=0.8)
```

## Consonant Positions

### [t/d] - Alveolar Stop (tongue tip at alveolar ridge)
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  *'                           /----------\
| /    '                          (tongue tip up,
||      .                          touching ridge)
 \
  \
   \__________

Note: * marks tongue tip touching alveolar ridge (.)
```

### [k/g] - Velar Stop (tongue back at velum)
```
Side View:                          Front View:
.------.                               //  \\
|    /*                                O    O
|   / \                                  v
|  /  '                            /----------\
| /    '                          (tongue back up,
||                                 touching velum)
 \   ~~~
  \    \
   \__________

Note: * marks tongue back touching velum (/)
```

### [f/v] - Labiodental Fricative (teeth on lower lip)
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  '                            /‾‾‾‾‾‾‾‾‾‾\
| /    '                                   ___
||      .  |                          (upper teeth
 \       ~~|                           on lower lip)
  \       \|
   \________

Note: | shows teeth position on lower lip
```

### [ʃ] - Post-alveolar Fricative (like "sh" in "shoe")
```
Side View:                          Front View:
.------.                               //  \\
|    /\                                O    O
|   / \                                  v
|  /  .'                            (‾‾‾‾‾‾‾‾)
| /    *'                          (  slight  )
||      .                           ( round  )
 \     ~~                             (    )
  \     \  (                      (tongue raised,
   \_______(                       lips rounded)

Note: Tongue near post-alveolar region, lips slightly rounded
```

## Lip Positions

### Maximum Rounding (round=1.0)
```
Front View:
   //  \\
   O    O
     v
   (    )
   (    )
   (    )
    (  )
```

### Maximum Spreading (round=0.0)
```
Front View:
   //  \\
   O    O
     v
/----------\
(horizontal)
```

### Neutral (round=0.5)
```
Front View:
   //  \\
   O    O
     v
 /---------\
(slight curve)
```

## Jaw Positions

### Closed (jaw=0.0)
```
Side View:
.------.
|    /\
|   / \
|  /  '
| /    '
||      .
 \
  \
   \______

(minimal vertical space)
```

### Half Open (jaw=0.5)
```
Side View:
.------.
|    /\
|   / \
|  /  '
| /    '
||      .
 \
  \
   \_________

(moderate space)
```

### Fully Open (jaw=1.0)
```
Side View:
.------.
|    /\
|   / \
|  /  '
| /    '
||      .
 \
  \
   \____________

(maximum vertical space)
```

## Tongue Positions

### High Front (height=0.9, front=0.9)
```
Side View:
       ~~~*      (tongue tip forward and high)
        \
```

### Low Back (height=0.0, front=0.0)
```
Side View:
 *~~~             (tongue tip back and low)
  \
```

### Mid Central (height=0.5, front=0.5)
```
Side View:
      ~~*         (tongue in neutral/schwa position)
       \
```

## Control Keys Reference

```
W/S  - Jaw close/open
I/K  - Tongue height up/down
J/L  - Tongue back/forward
Q    - Lip rounding increase
E    - Lip corner height (smile)
R    - Reset to neutral
1-5  - Toggle info panels
:    - Command mode
```

## Notes

- The side view shows anatomical structure (sagittal cross-section)
- The front view shows facial appearance
- Both update in real-time as you adjust articulators
- Panels (1-5) provide numerical values and IPA matching
