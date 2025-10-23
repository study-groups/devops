

  Complete PQL Command Set for Pulsar Engine

  ---
  1. Entity Management (CRUD)

  CREATE - Spawn new entities

  # Create a pulsar for user 0
  CREATE user.0.pulsar.0 mx=40 my=12 len0=18 amp=6 freq=0.5 dtheta=0.6
  valence=0

  # Create multiple pulsars
  CREATE user.0.pulsar.1 mx=120 my=12 len0=15 amp=4 freq=0.8 dtheta=-0.3
  valence=5
  CREATE user.1.pulsar.0 mx=80 my=30 len0=20 amp=8 freq=0.4 dtheta=1.2
  valence=2

  # Create with minimal parameters (use defaults)
  CREATE user.0.pulsar.2 mx=60 my=20

  # Create global world objects (requires DIRECTOR role)
  CREATE world.field.0 type=magnetic strength=1.5 radius=50

  UPDATE - Modify existing entities

  # Update single property
  UPDATE user.0.pulsar.0 mx=45
  UPDATE user.0.pulsar.0 dtheta=1.2

  # Update multiple properties
  UPDATE user.0.pulsar.0 mx=50 my=25 dtheta=0.8

  # Update nested properties
  UPDATE user.0.pulsar.0.arm.0 length=25 energy=0.8

  # Update global state (requires DIRECTOR)
  UPDATE world.gravity_y=-9.8
  UPDATE world.time_dilation=0.5
  UPDATE world.drag=0.02

  # Update render settings
  UPDATE render.fps=120
  UPDATE render.palette=neon
  UPDATE render.vsync=1

  # Update UI
  UPDATE ui.panel.1.visible=true
  UPDATE ui.panel.9.tab=controls.md

  QUERY - Read state

  # Query single value
  QUERY user.0.pulsar.0.mx
  # Returns: 45

  QUERY user.0.pulsar.0.dtheta
  # Returns: 1.2

  # Query all properties of entity
  QUERY user.0.pulsar.0.*
  # Returns: mx=45 my=25 dtheta=1.2 valence=0 ...

  # Query wildcard (all pulsars for user)
  QUERY user.0.pulsar.*.mx
  # Returns: pulsar.0.mx=45 pulsar.1.mx=120 pulsar.2.mx=60

  # Query across all users (spectating)
  QUERY user.*.pulsar.0.mx
  # Returns: user.0.pulsar.0.mx=45 user.1.pulsar.0.mx=80

  # Query global state
  QUERY world.gravity_y
  # Returns: -9.8

  QUERY world.*
  # Returns: gravity_y=-9.8 time_dilation=0.5 drag=0.02 ...

  # Query render state
  QUERY render.fps
  # Returns: 120

  # Query system stats
  QUERY system.sprite_count
  # Returns: 3

  QUERY system.frame_time_ms
  # Returns: 8.3

  QUERY system.cpu_usage
  # Returns: 23.5

  DELETE - Remove entities

  # Delete specific pulsar
  DELETE user.0.pulsar.0

  # Delete all pulsars for a user
  DELETE user.0.pulsar.*

  # Delete global entities (requires DIRECTOR)
  DELETE world.field.0

  # Clear all entities for user (reset)
  DELETE user.0.*

  ---
  2. Input Mapping

  MAP - Create input mapping

  # Gamepad axis → pulsar velocity (linear)
  MAP player0_move_x input.gamepad.0.axis.0 -> pulsar.0.velocity_x \
    curve=linear param1=20.0 param2=0.0 deadzone=0.15

  # Gamepad axis → pulsar velocity (logistic S-curve)
  MAP player0_move_y input.gamepad.0.axis.1 -> pulsar.0.velocity_y \
    curve=logistic param1=5.0 param2=0.0 deadzone=0.15 ramp=100

  # Gamepad axis → pulsar rotation
  MAP player0_rotate input.gamepad.0.axis.2 -> pulsar.0.dtheta \
    curve=linear param1=3.14 param2=0.0 deadzone=0.2

  # Keyboard key → velocity (with hold dynamics)
  MAP keyboard_w input.keyboard.w -> pulsar.0.velocity_y \
    curve=linear param1=-20.0 param2=0.0 \
    hold_scaling=1.5 ramp=50

  # Keyboard key → velocity (simple binary)
  MAP keyboard_a input.keyboard.a -> pulsar.0.velocity_x \
    curve=linear param1=-20.0 param2=0.0

  # Button → discrete action
  MAP gamepad_jump input.gamepad.0.button.0 -> pulsar.0.jump_trigger \
    curve=linear param1=1.0 param2=0.0

  # Trigger → global time control (requires DIRECTOR)
  MAP director_time input.gamepad.2.axis.5 -> world.time_dilation \
    curve=linear param1=2.0 param2=0.0 target_scope=global

  # Shift modifier for precision mode
  MAP player0_move_x_precise input.gamepad.0.axis.0 -> pulsar.0.velocity_x \
    curve=linear param1=20.0 deadzone=0.15 \
    shift_enabled=1 shift_scale=0.25

  UNMAP - Delete mapping

  # Remove specific map
  UNMAP player0_move_x

  # Remove all maps for user
  UNMAP user.0.map.*

  UPDATE MAP - Modify existing mapping

  # Adjust deadzone
  UPDATE map.player0_move_x deadzone=0.25

  # Change curve parameters
  UPDATE map.player0_move_x param1=8.0 param2=0.5

  # Disable map temporarily
  UPDATE map.player0_move_x active=0

  # Re-enable map
  UPDATE map.player0_move_x active=1

  # Change curve type
  UPDATE map.player0_move_x curve=quadratic param1=1.5

  # Add ramping
  UPDATE map.player0_move_x ramp=200

  QUERY MAP - Inspect mappings

  # List all maps
  QUERY maps.*
  # Returns: map.player0_move_x map.player0_move_y map.keyboard_w ...

  # Inspect specific map
  QUERY map.player0_move_x.*
  # Returns: active=1 curve=linear param1=20.0 deadzone=0.15 ...

  # Query map parameter
  QUERY map.player0_move_x.deadzone
  # Returns: 0.15

  # List maps for specific user
  QUERY user.0.map.*

  ---
  3. Input Queries (Raw & Mapped)

  Raw Input (debugging)

  # Raw gamepad values
  QUERY input.raw.gamepad.0.axis.0.value
  # Returns: -0.534

  QUERY input.raw.gamepad.0.axis.1.value
  # Returns: 0.821

  QUERY input.raw.gamepad.0.button.0
  # Returns: 1 (pressed) or 0 (released)

  # Raw keyboard state
  QUERY input.raw.keyboard.w.down
  # Returns: 1 (pressed) or 0 (released)

  QUERY input.raw.keyboard.w.hold_duration
  # Returns: 234 (milliseconds)

  QUERY input.raw.keyboard.w.press_time
  # Returns: 1698765432000 (nanoseconds)

  # All raw axes for gamepad
  QUERY input.raw.gamepad.0.axis.*
  # Returns: axis.0=-0.534 axis.1=0.821 axis.2=0.0 ...

  Mapped Input (post-processing)

  # Final mapped value
  QUERY input.mapped.pulsar.0.velocity_x
  # Returns: 12.5

  # Source information
  QUERY input.mapped.pulsar.0.velocity_x.raw
  # Returns: -0.534 (original raw value)

  QUERY input.mapped.pulsar.0.velocity_x.map
  # Returns: player0_move_x (which map produced this)

  # All mapped values for entity
  QUERY input.mapped.pulsar.0.*

  ---
  4. World & Physics

  # Gravity
  UPDATE world.gravity_x=0.0
  UPDATE world.gravity_y=-9.8
  UPDATE world.gravity_z=0.0

  # Drag/friction
  UPDATE world.drag=0.01
  UPDATE world.energy_decay=0.001

  # Time control
  UPDATE world.time_dilation=1.0     # Normal speed
  UPDATE world.time_dilation=0.5     # Slow motion
  UPDATE world.time_dilation=2.0     # Fast forward

  # Field properties
  UPDATE world.magnetic_field=1.5
  UPDATE world.synchronization_coupling=0.1

  # Boundaries
  UPDATE world.boundary_mode=wrap    # wrap, bounce, destroy, tunnel
  UPDATE world.width=160
  UPDATE world.height=96

  # Query world state
  QUERY world.*

  ---
  5. Rendering & Display

  # Frame rate
  UPDATE render.fps=60
  UPDATE render.fps=120

  # Palette/theme
  UPDATE render.palette=default
  UPDATE render.palette=neon
  UPDATE render.palette=grayscale

  # VSync
  UPDATE render.vsync=1
  UPDATE render.vsync=0

  # Character set
  UPDATE render.charset=ascii
  UPDATE render.charset=braille
  UPDATE render.charset=unicode

  # Effects
  UPDATE render.bloom=1
  UPDATE render.motion_blur=0.5

  # Query render state
  QUERY render.*
  QUERY render.fps
  QUERY render.palette

  ---
  6. UI & Panels

  # Toggle panels (1-9)
  UPDATE ui.panel.1.visible=true    # Debug panel
  UPDATE ui.panel.2.visible=true    # Event log
  UPDATE ui.panel.3.visible=false   # Player stats
  UPDATE ui.panel.9.visible=true    # Documentation panel

  # Documentation panel tabs
  UPDATE ui.panel.9.tab=0
  UPDATE ui.panel.9.tab=controls.md
  UPDATE ui.panel.9.tab=gameplay.md

  # Panel positions (if movable)
  UPDATE ui.panel.1.x=10
  UPDATE ui.panel.1.y=5
  UPDATE ui.panel.1.width=40
  UPDATE ui.panel.1.height=10

  # Query UI state
  QUERY ui.panel.*
  QUERY ui.panel.9.visible
  QUERY ui.panel.9.tab
  QUERY ui.panel.9.docs     # List available docs

  ---
  7. User & Session Management

  # User properties
  UPDATE user.0.username=Player1
  UPDATE user.0.role=player           # guest, player, director, admin

  # Score/credits
  UPDATE user.0.score=1250
  UPDATE user.0.tokens=50
  UPDATE user.0.credits=100

  # Input device assignment
  UPDATE user.0.primary_gamepad=0
  UPDATE user.1.primary_gamepad=1

  # Permissions (requires ADMIN)
  UPDATE user.0.can_create_entities=1
  UPDATE user.0.can_modify_world=0
  UPDATE user.2.role=director

  # Query user state
  QUERY user.0.*
  QUERY user.0.username
  QUERY user.0.score
  QUERY user.*.username              # All usernames

  ---
  8. System Commands

  # Reload configuration from disk
  RELOAD maps                        # Reload maps/default.toml
  RELOAD config                      # Reload config/pulsar.toml
  RELOAD palette                     # Reload palette definitions

  # Save snapshot
  SAVE snapshot.toml                 # Save entire game state

  # Load snapshot
  LOAD snapshot.toml                 # Restore game state

  # Pause/resume
  UPDATE system.paused=1
  UPDATE system.paused=0

  # System queries
  QUERY system.sprite_count
  QUERY system.active_users
  QUERY system.frame_time_ms
  QUERY system.cpu_usage
  QUERY system.uptime_seconds

  # Engine control
  UPDATE system.debug_mode=1         # Enable debug output
  UPDATE system.log_level=verbose    # quiet, normal, verbose

  # Quit engine
  QUIT

  ---
  9. Event Log Queries

  # Recent events
  QUERY events.recent.10             # Last 10 events

  # Events by type
  QUERY events.type.GAMEPAD
  QUERY events.type.KEYBOARD
  QUERY events.type.SYSTEM

  # Events by user
  QUERY events.user.0
  QUERY events.user.1

  # Event details
  QUERY events.0.timestamp
  QUERY events.0.type
  QUERY events.0.data

  ---
  10. Bulk Operations

  # Batch create (multiple entities)
  BATCH
    CREATE user.0.pulsar.0 mx=40 my=12
    CREATE user.0.pulsar.1 mx=80 my=12
    CREATE user.0.pulsar.2 mx=120 my=12
  END

  # Batch update (multiple properties)
  BATCH
    UPDATE user.0.pulsar.0 mx=45 my=20
    UPDATE user.0.pulsar.1 mx=85 my=20
    UPDATE world.gravity_y=-5.0
  END

  # Transaction (all-or-nothing)
  TRANSACTION
    DELETE user.0.pulsar.*
    CREATE user.0.pulsar.0 mx=80 my=48
    MAP player0_move input.gamepad.0.axis.0 -> pulsar.0.velocity_x
  COMMIT

  ---
  11. Curve Types & Parameters

  # Linear: y = p1*x + p2
  MAP linear_example source -> target curve=linear param1=1.0 param2=0.0

  # Quadratic: y = p1*x² + p2
  MAP quadratic_example source -> target curve=quadratic param1=1.5
  param2=0.0

  # Cubic: y = p1*x³ + p2
  MAP cubic_example source -> target curve=cubic param1=2.0 param2=0.0

  # Logistic (S-curve): y = 1/(1 + e^(-p1*(x-p2)))
  MAP logistic_example source -> target curve=logistic param1=5.0 param2=0.0

  # Exponential: y = p1 * e^(p2*x)
  MAP exponential_example source -> target curve=exponential param1=1.0
  param2=2.0

  # Deadzone: y = |x| < p1 ? 0 : x
  MAP deadzone_example source -> target curve=deadzone param1=0.15
  param2=0.0

  # Custom (user-defined Lua/expression)
  MAP custom_example source -> target curve=custom expression="x^2 +
  sin(x*3.14)"

  ---
  12. Complete Examples

  Example 1: Two-player setup

  # User 0 (Player 1) - Gamepad 0, controls cyan pulsar
  CREATE user.0.pulsar.0 mx=40 my=48 valence=1
  MAP p0_x input.gamepad.0.axis.0 -> pulsar.0.velocity_x curve=logistic
  param1=5.0 deadzone=0.15
  MAP p0_y input.gamepad.0.axis.1 -> pulsar.0.velocity_y curve=logistic
  param1=5.0 deadzone=0.15
  MAP p0_rot input.gamepad.0.axis.2 -> pulsar.0.dtheta curve=linear
  param1=3.14 deadzone=0.2

  # User 1 (Player 2) - Gamepad 1, controls magenta pulsar
  CREATE user.1.pulsar.0 mx=120 my=48 valence=4
  MAP p1_x input.gamepad.1.axis.0 -> pulsar.0.velocity_x curve=logistic
  param1=5.0 deadzone=0.15
  MAP p1_y input.gamepad.1.axis.1 -> pulsar.0.velocity_y curve=logistic
  param1=5.0 deadzone=0.15
  MAP p1_rot input.gamepad.1.axis.2 -> pulsar.0.dtheta curve=linear
  param1=3.14 deadzone=0.2

  # World setup
  UPDATE world.gravity_y=-2.0
  UPDATE world.drag=0.05
  UPDATE render.fps=60

  Example 2: Technical director session

  # Director controls world time with right trigger
  MAP dir_time input.gamepad.2.axis.5 -> world.time_dilation \
    curve=linear param1=2.0 param2=0.0 target_scope=global

  # Director controls gravity with left stick
  MAP dir_gravity input.gamepad.2.axis.1 -> world.gravity_y \
    curve=linear param1=-20.0 param2=0.0 target_scope=global

  # Director can toggle panels with D-pad
  MAP dir_panel1 input.gamepad.2.button.11 -> ui.panel.1.visible
  MAP dir_panel2 input.gamepad.2.button.12 -> ui.panel.2.visible

  Example 3: Keyboard-only player

  # Create pulsar
  CREATE user.0.pulsar.0 mx=80 my=48 valence=2

  # WASD for movement (with hold scaling)
  MAP kbd_w input.keyboard.w -> pulsar.0.velocity_y \
    curve=linear param1=-20.0 hold_scaling=1.5 ramp=100
  MAP kbd_a input.keyboard.a -> pulsar.0.velocity_x \
    curve=linear param1=-20.0 hold_scaling=1.5 ramp=100
  MAP kbd_s input.keyboard.s -> pulsar.0.velocity_y \
    curve=linear param1=20.0 hold_scaling=1.5 ramp=100
  MAP kbd_d input.keyboard.d -> pulsar.0.velocity_x \
    curve=linear param1=20.0 hold_scaling=1.5 ramp=100

  # IJKL for rotation
  MAP kbd_j input.keyboard.j -> pulsar.0.dtheta curve=linear param1=-1.0
  MAP kbd_l input.keyboard.l -> pulsar.0.dtheta curve=linear param1=1.0

  # Space for action
  MAP kbd_space input.keyboard.space -> pulsar.0.boost curve=linear
  param1=1.0

  ---
  13. Dgram Protocol Format

  // Every dgram message includes user context
  struct pql_dgram {
      uint32_t version;           // Protocol version = 1
      int32_t user_id;            // 0-3 for local players, -1 for system
      char command[256];          // PQL command string
  };

  Example dgram sends:

  # User 0 updates their pulsar
  echo -e "\x01\x00\x00\x00\x00\x00\x00\x00UPDATE pulsar.0 mx=50" | \
    nc -uU /tmp/pulsar_control.sock

  # User 1 queries their position
  echo -e "\x01\x00\x00\x00\x01\x00\x00\x00QUERY pulsar.0.mx" | \
    nc -uU /tmp/pulsar_control.sock

  # Director modifies world (user 2)
  echo -e "\x01\x00\x00\x00\x02\x00\x00\x00UPDATE world.gravity_y=-9.8" | \
    nc -uU /tmp/pulsar_control.sock

  ---
  14. Permission Matrix

  | Command                | Guest | Player  | Director | Admin |
  |------------------------|-------|---------|----------|-------|
  | QUERY user.*.*         | ✓     | ✓       | ✓        | ✓     |
  | QUERY world.*          | ✓     | ✓       | ✓        | ✓     |
  | CREATE user.N.pulsar.* | ✗     | ✓ (own) | ✓        | ✓     |
  | UPDATE user.N.pulsar.* | ✗     | ✓ (own) | ✓        | ✓     |
  | DELETE user.N.pulsar.* | ✗     | ✓ (own) | ✓        | ✓     |
  | UPDATE world.*         | ✗     | ✗       | ✓        | ✓     |
  | MAP ... -> user.N.*    | ✗     | ✓ (own) | ✓        | ✓     |
  | MAP ... -> world.*     | ✗     | ✗       | ✓        | ✓     |
  | RELOAD *               | ✗     | ✗       | ✓        | ✓     |
  | UPDATE user.N.role     | ✗     | ✗       | ✗        | ✓     |

  ---
  This is the complete canonical PQL command reference. Every command shown
  can be sent via:
  - Dgram socket (/tmp/pulsar_control.sock)
  - Stdin (when engine in command mode)
  - TOML config files (loaded at startup)

