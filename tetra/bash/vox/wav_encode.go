package main

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"strconv"
)

// WAV file header structure
type WAVHeader struct {
	ChunkID       [4]byte // "RIFF"
	ChunkSize     uint32
	Format        [4]byte // "WAVE"
	Subchunk1ID   [4]byte // "fmt "
	Subchunk1Size uint32  // 16 for PCM
	AudioFormat   uint16  // 1 for PCM
	NumChannels   uint16
	SampleRate    uint32
	ByteRate      uint32
	BlockAlign    uint16
	BitsPerSample uint16
	Subchunk2ID   [4]byte // "data"
	Subchunk2Size uint32
}

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintf(os.Stderr, "Usage: %s <sample_rate> <num_channels>\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Reads float samples from stdin, writes WAV to stdout\n")
		os.Exit(1)
	}

	sampleRate, err := strconv.Atoi(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: invalid sample rate: %v\n", err)
		os.Exit(1)
	}

	numChannels, err := strconv.Atoi(os.Args[2])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: invalid channel count: %v\n", err)
		os.Exit(1)
	}

	// Read float samples from stdin
	var samples []float64
	scanner := bufio.NewScanner(os.Stdin)
	for scanner.Scan() {
		var sample float64
		_, err := fmt.Sscanf(scanner.Text(), "%f", &sample)
		if err != nil {
			continue // Skip invalid lines
		}
		samples = append(samples, sample)
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "Error reading input: %v\n", err)
		os.Exit(1)
	}

	if len(samples) == 0 {
		fmt.Fprintf(os.Stderr, "Error: no samples read\n")
		os.Exit(1)
	}

	// Convert to 16-bit PCM
	pcmData := make([]int16, len(samples))
	for i, sample := range samples {
		// Clamp to [-1.0, 1.0]
		if sample > 1.0 {
			sample = 1.0
		} else if sample < -1.0 {
			sample = -1.0
		}
		// Convert to int16
		pcmData[i] = int16(sample * 32767.0)
	}

	// Build WAV header
	bitsPerSample := uint16(16)
	dataSize := uint32(len(pcmData) * 2) // 2 bytes per sample
	header := WAVHeader{
		ChunkID:       [4]byte{'R', 'I', 'F', 'F'},
		ChunkSize:     36 + dataSize,
		Format:        [4]byte{'W', 'A', 'V', 'E'},
		Subchunk1ID:   [4]byte{'f', 'm', 't', ' '},
		Subchunk1Size: 16,
		AudioFormat:   1, // PCM
		NumChannels:   uint16(numChannels),
		SampleRate:    uint32(sampleRate),
		ByteRate:      uint32(sampleRate) * uint32(numChannels) * uint32(bitsPerSample/8),
		BlockAlign:    uint16(numChannels) * bitsPerSample / 8,
		BitsPerSample: bitsPerSample,
		Subchunk2ID:   [4]byte{'d', 'a', 't', 'a'},
		Subchunk2Size: dataSize,
	}

	// Write header
	if err := binary.Write(os.Stdout, binary.LittleEndian, &header); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing header: %v\n", err)
		os.Exit(1)
	}

	// Write PCM data
	if err := binary.Write(os.Stdout, binary.LittleEndian, pcmData); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing data: %v\n", err)
		os.Exit(1)
	}
}

// Clamp value between -1 and 1
func clamp(value float64) float64 {
	return math.Max(-1.0, math.Min(1.0, value))
}
