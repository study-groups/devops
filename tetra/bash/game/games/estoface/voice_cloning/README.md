# Voice Cloning Pipeline for Formant

This directory contains tools to clone any voice and generate a personalized CELP codebook.

## Quick Start (30 minutes to your own voice!)

```bash
# 1. Record your voice (10 minutes)
./1_record_phonemes.sh

# 2. Extract excitation patterns (2 minutes)
python 2_extract_excitations.py

# 3. Train neural network (15 minutes on CPU, 3 minutes on GPU)
python 3_train_vae.py --epochs 50

# 4. Generate codebook (1 minute)
python 4_generate_codebook.py

# 5. Install and test (1 minute)
./5_install_codebook.sh
cd .. && ./demo_speech.sh
```

## What You'll Need

- **Python 3.8+** with: torch, numpy, scipy, librosa, sounddevice
- **Microphone** (any USB mic works fine)
- **5-10 minutes** of patience for recording

## Directory Structure

```
voice_cloning/
├── README.md                    # This file
├── 1_record_phonemes.sh         # Interactive recording script
├── 2_extract_excitations.py     # Extract training data
├── 3_train_vae.py              # Train VAE on your voice
├── 4_generate_codebook.py      # Generate C header
├── 5_install_codebook.sh       # Install into formant
├── requirements.txt            # Python dependencies
├── recordings/                 # Your voice recordings (created)
├── training_data/             # Extracted excitations (created)
├── models/                    # Trained models (created)
└── codebooks/                 # Generated codebooks (created)
```

## The Process

### Step 1: Record Phonemes
You'll be prompted to say each phoneme 3 times. The script will:
- Guide you through all English phonemes
- Record 1 second per phoneme
- Save to `recordings/`

### Step 2: Extract Excitations
Analyzes your recordings:
- Applies LPC analysis to separate excitation from vocal tract
- Extracts 10ms excitation frames
- Labels by phoneme type
- Saves training dataset

### Step 3: Train VAE
Learns your voice characteristics:
- Variational Autoencoder conditioned on phonemes
- Learns compact (32-dim) representation
- Captures pitch, breathiness, voice quality
- Saves model checkpoint

### Step 4: Generate Codebook
Creates personalized CELP codebook:
- Samples from learned distribution
- Generates variations (low/mid/high pitch)
- Exports to C header format
- Ready to drop into formant

### Step 5: Install & Test
- Replaces default codebook
- Rebuilds formant
- Your voice is now in the synthesizer!

## Advanced Usage

### Record Someone Else's Voice

```bash
# Record 5 minutes of natural speech
./1_record_phonemes.sh --speaker "george_clooney" --extended

# Train with more data
python 3_train_vae.py --data recordings/george_clooney/ --epochs 200
```

### Fine-tune Pre-trained Model

```bash
# Start from existing model
python 3_train_vae.py --pretrained models/base_voice.pth --finetune
```

### Blend Multiple Voices

```bash
# Generate hybrid codebook
python 4_generate_codebook.py --blend voice1.pth:0.6 voice2.pth:0.4
```

## Tips for Best Results

1. **Recording Environment**
   - Quiet room (background noise ruins training)
   - Consistent distance from mic
   - Normal speaking voice

2. **Recording Quality**
   - Speak clearly but naturally
   - Don't exaggerate phonemes
   - Sustain vowels for full duration

3. **Training**
   - More epochs = better quality (but diminishing returns after ~100)
   - GPU recommended but not required
   - Can pause and resume training

4. **Troubleshooting**
   - Voice too robotic? → Record more data or increase epochs
   - Voice sounds off? → Check recording quality
   - Too bright/dark? → Adjust low-pass filter in formant_celp.c

## Technical Details

**VAE Architecture:**
- Input: 160 samples (10ms @ 16kHz)
- Latent: 32 dimensions
- Conditioning: Phoneme embedding (64-dim)
- Total params: ~500K (small, trains fast!)

**Why VAE?**
- Learns smooth latent space (good for interpolation)
- Generates diverse but consistent excitations
- Phoneme conditioning ensures proper mapping

**Output:**
- 37 excitation vectors (matching original codebook)
- Organized by phoneme type and pitch variant
- Drop-in replacement for hand-crafted codebook

## Next Steps

After basic voice cloning works:
1. Multi-speaker model (blend voices)
2. Emotion conditioning (happy/sad/angry)
3. Real-time voice conversion
4. Style transfer (your voice → celebrity voice)

Let's get started! Run `./1_record_phonemes.sh` when ready.
