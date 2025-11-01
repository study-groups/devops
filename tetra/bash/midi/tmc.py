#!/usr/bin/env python3
"""
TMC Python Bridge - Bidirectional MIDI I/O using python-rtmidi
Alternative to tmc.c for easier installation on Apple Silicon
"""

import sys
import socket
import threading
import time
import argparse
from pathlib import Path

try:
    import rtmidi
except ImportError:
    print("Error: python-rtmidi not installed")
    print("Install with: pip3 install python-rtmidi")
    sys.exit(1)


class TMCBridge:
    def __init__(self, socket_path, input_device=-1, output_device=-1, verbose=False):
        self.socket_path = socket_path
        self.input_device_id = input_device
        self.output_device_id = output_device
        self.verbose = verbose
        self.running = True

        self.midi_in = None
        self.midi_out = None
        self.sock = None

    def log(self, msg):
        if self.verbose:
            print(f"[TMC] {msg}", file=sys.stderr)

    def list_devices(self):
        """List available MIDI devices"""
        print("Available MIDI Devices:")
        print("========================\n")

        print("Input Devices:")
        midi_in = rtmidi.MidiIn()
        for i, port in enumerate(midi_in.get_ports()):
            print(f"  [{i}] {port}")

        print("\nOutput Devices:")
        midi_out = rtmidi.MidiOut()
        for i, port in enumerate(midi_out.get_ports()):
            print(f"  [{i}] {port}")
        print()

    def init_midi(self):
        """Initialize MIDI devices"""
        # Initialize input
        self.midi_in = rtmidi.MidiIn()
        available_inputs = self.midi_in.get_ports()

        if self.input_device_id < 0:
            # Auto-detect first available
            if available_inputs:
                self.input_device_id = 0
            else:
                self.log("No MIDI input devices found")
                self.midi_in = None

        if self.midi_in and self.input_device_id < len(available_inputs):
            self.midi_in.open_port(self.input_device_id)
            self.midi_in.set_callback(self.midi_callback)
            self.log(f"Opened MIDI input: {available_inputs[self.input_device_id]}")

        # Initialize output
        self.midi_out = rtmidi.MidiOut()
        available_outputs = self.midi_out.get_ports()

        if self.output_device_id < 0:
            # Auto-detect first available
            if available_outputs:
                self.output_device_id = 0
            else:
                self.log("No MIDI output devices found")
                self.midi_out = None

        if self.midi_out and self.output_device_id < len(available_outputs):
            self.midi_out.open_port(self.output_device_id)
            self.log(f"Opened MIDI output: {available_outputs[self.output_device_id]}")

    def connect_socket(self):
        """Connect to Unix socket"""
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            self.sock.connect(self.socket_path)
            self.log(f"Connected to socket: {self.socket_path}")
        except Exception as e:
            print(f"ERROR: Failed to connect to socket: {e}", file=sys.stderr)
            sys.exit(1)

    def format_midi_message(self, message):
        """Format MIDI message for socket"""
        if not message:
            return None

        status = message[0]
        msg_type = status & 0xF0
        channel = (status & 0x0F) + 1  # 1-indexed

        if msg_type == 0x80:  # Note Off
            return f"NOTE_OFF {channel} {message[1]}\n"
        elif msg_type == 0x90:  # Note On
            if len(message) > 2 and message[2] == 0:
                return f"NOTE_OFF {channel} {message[1]}\n"
            else:
                return f"NOTE_ON {channel} {message[1]} {message[2]}\n"
        elif msg_type == 0xB0:  # Control Change
            return f"CC {channel} {message[1]} {message[2]}\n"
        elif msg_type == 0xC0:  # Program Change
            return f"PROGRAM_CHANGE {channel} {message[1]}\n"
        elif msg_type == 0xE0:  # Pitch Bend
            bend = (message[2] << 7) | message[1]
            return f"PITCH_BEND {channel} {bend}\n"
        else:
            return f"UNKNOWN {status:02X} {message[1] if len(message) > 1 else 0} {message[2] if len(message) > 2 else 0}\n"

    def midi_callback(self, event, data=None):
        """Callback for incoming MIDI messages"""
        message, deltatime = event
        formatted = self.format_midi_message(message)

        if formatted:
            if self.verbose:
                print(f"MIDI IN: {formatted.strip()}")

            if self.sock:
                try:
                    self.sock.sendall(formatted.encode())
                except Exception as e:
                    print(f"ERROR: Failed to send to socket: {e}", file=sys.stderr)
                    self.running = False

    def parse_midi_command(self, line):
        """Parse socket command and send MIDI output"""
        parts = line.strip().split()
        if not parts or not self.midi_out:
            return

        cmd = parts[0]

        try:
            if cmd == "CC" and len(parts) >= 4:
                channel = int(parts[1]) - 1
                controller = int(parts[2])
                value = int(parts[3])
                self.midi_out.send_message([0xB0 | (channel & 0x0F), controller & 0x7F, value & 0x7F])
                if self.verbose:
                    print(f"MIDI OUT: {line.strip()}")

            elif cmd == "NOTE_ON" and len(parts) >= 4:
                channel = int(parts[1]) - 1
                note = int(parts[2])
                velocity = int(parts[3])
                self.midi_out.send_message([0x90 | (channel & 0x0F), note & 0x7F, velocity & 0x7F])
                if self.verbose:
                    print(f"MIDI OUT: {line.strip()}")

            elif cmd == "NOTE_OFF" and len(parts) >= 3:
                channel = int(parts[1]) - 1
                note = int(parts[2])
                self.midi_out.send_message([0x80 | (channel & 0x0F), note & 0x7F, 0])
                if self.verbose:
                    print(f"MIDI OUT: {line.strip()}")

            elif cmd == "PROGRAM_CHANGE" and len(parts) >= 3:
                channel = int(parts[1]) - 1
                program = int(parts[2])
                self.midi_out.send_message([0xC0 | (channel & 0x0F), program & 0x7F])
                if self.verbose:
                    print(f"MIDI OUT: {line.strip()}")
        except Exception as e:
            print(f"ERROR: Failed to send MIDI: {e}", file=sys.stderr)

    def socket_listener(self):
        """Listen for commands from socket"""
        buffer = ""
        while self.running:
            try:
                data = self.sock.recv(1024)
                if not data:
                    break

                buffer += data.decode()
                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    if line:
                        self.parse_midi_command(line)
            except Exception as e:
                print(f"ERROR: Socket read error: {e}", file=sys.stderr)
                break

    def run(self):
        """Main run loop"""
        self.log("Starting TMC Bridge...")

        self.init_midi()
        self.connect_socket()

        if self.midi_out:
            # Start socket listener thread
            listener_thread = threading.Thread(target=self.socket_listener, daemon=True)
            listener_thread.start()

        print("TMC Bridge running (Ctrl+C to stop)")

        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nShutting down...")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        self.running = False

        if self.midi_in:
            self.midi_in.close_port()
        if self.midi_out:
            self.midi_out.close_port()
        if self.sock:
            self.sock.close()


def main():
    parser = argparse.ArgumentParser(description="TMC Bridge - MIDI I/O for Tetra")
    parser.add_argument('-l', '--list', action='store_true',
                       help='List available MIDI devices and exit')
    parser.add_argument('-i', '--input', type=int, default=-1,
                       help='MIDI input device ID')
    parser.add_argument('-o', '--output', type=int, default=-1,
                       help='MIDI output device ID')
    parser.add_argument('-s', '--socket', type=str, required=False,
                       help='Unix socket path for TMC communication')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Verbose output')

    args = parser.parse_args()

    if args.list:
        bridge = TMCBridge("", verbose=args.verbose)
        bridge.list_devices()
        return 0

    if not args.socket:
        print("ERROR: Socket path required (-s option)", file=sys.stderr)
        parser.print_help()
        return 1

    bridge = TMCBridge(args.socket, args.input, args.output, args.verbose)
    bridge.run()

    return 0


if __name__ == "__main__":
    sys.exit(main())
