package main

import (
	"os"

	"github.com/BurntSushi/toml"
)

// Config holds the entire application layout defined in TOML.
type Config struct {
	Panels []PanelConfig `toml:"panel"`
}

// PanelConfig defines the properties of a single panel.
type PanelConfig struct {
	Name    string `toml:"name"`
	Kind    string `toml:"kind"`
	Dock    string `toml:"dock"`
	Command string `toml:"command"`
}

// LoadConfig reads and parses the panels.toml file.
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config Config
	if _, err := toml.Decode(string(data), &config); err != nil {
		return nil, err
	}

	return &config, nil
}
